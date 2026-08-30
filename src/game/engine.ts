import { ANOMALIES, findAnomaly, type AnomalyDefinition, type AnomalyId } from '../data/anomalies';
import { BOARD, BOARD_SIZE, getTile, RAILROAD_RENT_BY_COUNT } from '../data/board';
import { ANOMALOUS_EVENT_CARDS, FOUNDATION_DIRECTIVE_CARDS, findCard, type CardEffect } from '../data/cards';
import { STARTING_PIECES } from '../data/pieces';
import type {
  CardDeck,
  ColorGroup,
  GameState,
  GamePlayerState,
  LooseAnomaly,
  PieceId,
  PocketDimensionTile,
  TradeOffer,
} from '../types/game';

const STARTING_CREDITS = 1500;
/** D-Class's "Standard Expendability Clause": reduced funding for the one-time requisitioned replacement. */
const RESPAWN_CREDITS = 750;
const GO_BONUS = 200;
const JAIL_POSITION = 10;
/** Charged every turn a player fails to roll doubles while stuck in the Containment Chamber - a running cost of staying, not a one-time fine. D-Class is exempt. */
const HOLDING_FEE = 50;
/** The Escape Fee - paying to leave the Containment Chamber immediately, before even trying for doubles. Steeper than the Holding Fee since it buys certainty. D-Class never pays it; Janitor gets one free via the master keyring. */
const ESCAPE_FEE = 200;
const MAX_DOUBLES_BEFORE_JAIL = 3;
/** After 3 turns stuck without rolling doubles, a player is released for free - they've already paid the Holding Fee each of those turns. */
const MAX_TURNS_IN_JAIL = 3;
const PURPLE_SEIZE_GROUP: ColorGroup = 'purple';
/** Field Researcher's "Grant Funding": a flat stipend for landing on either card tile. */
const GRANT_FUNDING_AMOUNT = 100;
/** Logistics Officer's "Bulk Requisition": the discount multiplier on their own house/hotel builds. */
const BULK_REQUISITION_MULTIPLIER = 0.75;
/** Specialist's "Standard Containment Procedure": the rent discount multiplier on Wings/Tunnels they pay. */
const CONTAINMENT_PROCEDURE_MULTIPLIER = 0.75;
/** Specialist's "Redundant Safeguards": the one-time emergency grant when a forced payment would otherwise be unaffordable. */
const REDUNDANT_SAFEGUARDS_AMOUNT = 300;
/** Chance, checked once per completed turn, that a new hostile anomaly breaches containment. */
const BREACH_CHANCE = 0.08;
/** How many spaces a hunting anomaly closes the gap by per turn tick - fast enough that being hunted is genuinely urgent. */
const ANOMALY_HUNT_SPEED = 6;
/** SCP-173's unwatched move: closes the gap on whoever's nearest by a quarter of the board - fast enough to plausibly catch someone, but capped so outrunning it is genuinely possible if they're far enough ahead. */
const SCULPTURE_UNWATCHED_SPEED = Math.floor(BOARD_SIZE / 4);
/** SCP-106's own main-board hunt speed - half of ANOMALY_HUNT_SPEED, since catching someone isn't itself a loss for it (see dragIntoPocketDimension), it's just the start of a much more dangerous ordeal. */
const OLD_MAN_MAIN_BOARD_SPEED = 3;
/** The Pocket Dimension track's length, tile 0 (the drag-in point) included - it loops back around from the far end rather than dead-ending. */
const POCKET_DIMENSION_LENGTH = 9;
/** SCP-106's own crawl inside the Pocket Dimension: 1 tile closer every time the trapped player takes their turn - see movePocketDimension. */
const OLD_MAN_POCKET_DIMENSION_SPEED = 1;
/** Cost of landing on a Decaying Passage inside the Pocket Dimension. Can't afford it and it's a Termination instead - see movePocketDimension. */
const DECAYING_PASSAGE_COST = 150;
/** The Site Warhead is tile 12 - see data/board.ts. Only its current owner can trigger a purge. */
const SITE_WARHEAD_TILE_ID = 12;
const SITE_WARHEAD_PURGE_COST = 500;
/** Intern's "On a Learning Curve": laps of the board needed before they're cleared to roll both dice unsupervised. */
const INTERN_GRADUATION_LAPS = 3;
/** Intern's "Unpaid Overtime": extra Credits collected on top of the standard Go bonus every time they pass the Site Entrance. */
const INTERN_OVERTIME_BONUS = 50;
// Half real Monopoly's bank supply (32/12) - makes the shared pool a
// real constraint worth fighting over, and makes Logistics Officer's
// Overstock (bypasses the shared pool entirely) noticeably stronger by
// comparison. Running dry just blocks further building until someone
// sells houses back - there's no auction system to resolve a shortage.
const STARTING_HOUSES = 16;
const STARTING_HOTELS = 6;
// Standard Monopoly mortgage rules: mortgaging pays out half the tile's
// price; paying it back off costs that same amount plus 10% interest.
const MORTGAGE_PAYOFF_MULTIPLIER = 1.1;

function pieceOf(state: GameState, playerId: string): PieceId {
  return state.players[playerId].pieceId;
}

function tileIdsInSector(group: ColorGroup): number[] {
  return BOARD.filter((t) => t.kind === 'wing' && t.colorGroup === group).map((t) => t.id);
}

function ownsFullSector(state: GameState, playerId: string, group: ColorGroup): boolean {
  return tileIdsInSector(group).every((id) => state.players[playerId].ownedTileIds.includes(id));
}

function sectorOf(tileId: number): ColorGroup | null {
  const tile = getTile(tileId);
  return tile.kind === 'wing' ? tile.colorGroup : null;
}

/** Sets up a fresh game: every player starts on the Site Entrance with 1500 Credits and the Personnel they were assigned, and both card decks get shuffled. */
export function createInitialGameState(
  playerAssignments: { playerId: string; pieceId: PieceId }[],
  rng: () => number = Math.random,
): GameState {
  const players: Record<string, GamePlayerState> = {};
  for (const { playerId, pieceId } of playerAssignments) {
    players[playerId] = {
      pieceId,
      position: 0,
      credits: STARTING_CREDITS,
      ownedTileIds: [],
      inJail: false,
      turnsInJail: 0,
      doublesRolledCount: 0,
      heldCardIds: [],
      isSpectating: false,
      consecutiveAfkSkips: 0,
      isAfkSpectating: false,
      usedExpendabilityClause: false,
      usedMasterKey: false,
      usedTunnelTravelThisTurn: false,
      usedShowOfForce: false,
      usedRedirect: false,
      usedSafeguard: false,
      usedInduceBreach: false,
      lapsCompleted: 0,
    };
  }

  return {
    turnOrder: playerAssignments.map((p) => p.playerId),
    currentTurnIndex: 0,
    players,
    lastRoll: null,
    lastRollWasDoubles: false,
    pendingDecision: null,
    forcedRoll: null,
    anomalousEventDrawPile: shuffle(ANOMALOUS_EVENT_CARDS.map((c) => c.id), rng),
    anomalousEventDiscardPile: [],
    foundationDirectiveDrawPile: shuffle(FOUNDATION_DIRECTIVE_CARDS.map((c) => c.id), rng),
    foundationDirectiveDiscardPile: [],
    forcedCardId: null,
    houses: {},
    housesRemaining: STARTING_HOUSES,
    hotelsRemaining: STARTING_HOTELS,
    hatFreeHouseSectors: [],
    mortgagedTileIds: [],
    log: ['The game begins.'],
    turnCount: 0,
    lastJailRedirect: null,
    winnerId: null,
    activeTrades: [],
    rubberDuckEncounter: null,
    mtfEncounter: null,
    looseAnomalies: [],
    pendingPieceChoice: null,
    scp173Watched: false,
    pocketDimensionOrdeal: null,
  };
}

/** Player IDs still actually in the game - excludes anyone permanently isSpectating (Terminated) or benched for being AFK. Used anywhere a random pick or completion count must never land on someone who's already out. */
function activePlayerIds(state: GameState): string[] {
  return state.turnOrder.filter((id) => !state.players[id].isSpectating);
}

function rollTwoDice(rng: () => number): [number, number] {
  const rollOne = () => Math.floor(rng() * 6) + 1;
  return [rollOne(), rollOne()];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Clamped defensively: rng() is only ever documented as [0, 1), but a
    // test double returning exactly 1 (NO_BREACH_RNG, used pervasively to
    // guarantee no containment breach) would otherwise compute j = i + 1 -
    // out of bounds, silently growing the array by assigning past its end.
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function currentPlayerId(state: GameState): string {
  return state.turnOrder[state.currentTurnIndex];
}

function findOwner(state: GameState, tileId: number): string | null {
  for (const [playerId, player] of Object.entries(state.players)) {
    if (player.ownedTileIds.includes(tileId)) return playerId;
  }
  return null;
}

function tunnelsOwnedBy(state: GameState, playerId: string): number {
  return state.players[playerId].ownedTileIds.filter((tileId) => getTile(tileId).kind === 'tunnel').length;
}

function utilitiesOwnedBy(state: GameState, playerId: string): number {
  return state.players[playerId].ownedTileIds.filter((tileId) => getTile(tileId).kind === 'utility').length;
}

function logEvent(state: GameState, message: string): GameState {
  // Cap the log so it doesn't grow forever over a long game - the last 20
  // events is plenty for players to scroll back through.
  return { ...state, log: [...state.log, message].slice(-20) };
}

function updatePlayer(state: GameState, playerId: string, patch: Partial<GamePlayerState>): GameState {
  return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], ...patch } } };
}

function canAfford(state: GameState, playerId: string, amount: number): boolean {
  return state.players[playerId].credits >= amount;
}

/**
 * Deducts `amount` from playerId's Credits, paying it to `creditorId`
 * (or nowhere, for a fee paid to the Foundation) if they can afford it
 * outright. If they can't, opens a debtSettlement decision instead of
 * deducting anything - the player must sell houses/mortgage properties
 * to raise the difference (see settleDebt) or give up (declareBankruptcy).
 *
 * Specialist's "Redundant Safeguards" steps in right here, once per
 * game: if they can't afford a forced payment, an emergency grant
 * arrives first - not a guaranteed save (a big enough debt can still
 * exceed it and open debtSettlement anyway), just a cushion. Doesn't
 * apply to voluntary spending (buying, building, mortgage payoff),
 * since those callers already check canAfford themselves before ever
 * reaching chargePlayer.
 */
function chargePlayer(state: GameState, playerId: string, amount: number, creditorId: string | null): GameState {
  if (amount <= 0) return state;
  let working = state;
  if (!canAfford(working, playerId, amount) && pieceOf(working, playerId) === 'penguin' && !working.players[playerId].usedSafeguard) {
    working = logEvent(
      updatePlayer(working, playerId, {
        credits: working.players[playerId].credits + REDUNDANT_SAFEGUARDS_AMOUNT,
        usedSafeguard: true,
      }),
      'Redundant Safeguards: an emergency grant arrives just in time.',
    );
  }
  if (!canAfford(working, playerId, amount)) {
    return { ...working, pendingDecision: { type: 'debtSettlement', forPlayerId: playerId, amountOwed: amount, creditorId } };
  }
  let next = updatePlayer(working, playerId, { credits: working.players[playerId].credits - amount });
  if (creditorId) {
    next = updatePlayer(next, creditorId, { credits: next.players[creditorId].credits + amount });
  }
  return next;
}

function giveCredits(state: GameState, playerId: string, amount: number): GameState {
  return updatePlayer(state, playerId, { credits: state.players[playerId].credits + amount });
}

function sendToJail(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  return updatePlayer(
    { ...state, lastJailRedirect: { playerId, fromTileId: player.position } },
    playerId,
    { position: JAIL_POSITION, inJail: true, turnsInJail: 0, doublesRolledCount: 0 },
  );
}

/**
 * Awards Administrator's (Hat's) Special Power the instant a Sector is
 * completed, if it hasn't already been rewarded for that Sector - one
 * free house on the first Wing found there with room to build. No-op
 * if this player isn't playing Administrator, the Sector isn't
 * actually complete, it's already been rewarded, or the bank is out of
 * houses.
 */
function checkHatFreeHouse(state: GameState, playerId: string, group: ColorGroup): GameState {
  if (pieceOf(state, playerId) !== 'hat') return state;
  if (state.hatFreeHouseSectors.includes(group)) return state;
  if (!ownsFullSector(state, playerId, group)) return state;
  if (state.housesRemaining <= 0) return state;

  const tileIds = tileIdsInSector(group);
  const targetTileId = tileIds.find((id) => (state.houses[id] ?? 0) < 4);
  if (targetTileId === undefined) return state;

  const next: GameState = {
    ...state,
    houses: { ...state.houses, [targetTileId]: (state.houses[targetTileId] ?? 0) + 1 },
    housesRemaining: state.housesRemaining - 1,
    hatFreeHouseSectors: [...state.hatFreeHouseSectors, group],
  };
  return logEvent(next, 'Administrator completed a Sector - a free house was granted.');
}

function transferTile(state: GameState, tileId: number, toPlayerId: string | null): GameState {
  const fromPlayerId = findOwner(state, tileId);
  let next = state;
  if (fromPlayerId) {
    next = updatePlayer(next, fromPlayerId, {
      ownedTileIds: next.players[fromPlayerId].ownedTileIds.filter((id) => id !== tileId),
    });
  }
  if (toPlayerId) {
    next = updatePlayer(next, toPlayerId, { ownedTileIds: [...next.players[toPlayerId].ownedTileIds, tileId] });
    const group = sectorOf(tileId);
    if (group) next = checkHatFreeHouse(next, toPlayerId, group);
  }
  return next;
}

// --- Rolling & movement --------------------------------------------------

/** Rolls the dice for the current player (or the forced dev-panel roll, if set) and resolves whatever happens next: leaving/staying in the Containment Chamber, or moving and resolving the landed tile. No-op if there's already a pending decision blocking play. */
export function rollDice(state: GameState, rng: () => number = Math.random): GameState {
  if (state.pendingDecision || state.winnerId) return state;
  const playerId = currentPlayerId(state);
  const player = state.players[playerId];
  if (player.isSpectating || player.isAfkSpectating) return state;

  const rollingOneDie = pieceOf(state, playerId) === 'thimble' && player.lapsCompleted < INTERN_GRADUATION_LAPS;
  const roll: [number, number] = state.forcedRoll
    ? state.forcedRoll
    : rollingOneDie
      ? [Math.floor(rng() * 6) + 1, 0]
      : rollTwoDice(rng);
  const isDoubles = !rollingOneDie && roll[0] === roll[1];

  let next: GameState = {
    ...state,
    forcedRoll: null,
    lastRoll: roll,
    lastRollWasDoubles: isDoubles,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        consecutiveAfkSkips: 0,
        doublesRolledCount: isDoubles ? player.doublesRolledCount + 1 : 0,
      },
    },
  };

  if (player.inJail) {
    return resolveJailRoll(next, playerId, roll, isDoubles);
  }

  if (isDoubles && next.players[playerId].doublesRolledCount >= MAX_DOUBLES_BEFORE_JAIL) {
    return logEvent(sendToJail(next, playerId), 'Rolled doubles three times in a row - sent to the Containment Chamber!');
  }

  return moveAndResolve(next, playerId, roll[0] + roll[1]);
}

/**
 * Charges the Escape Fee (200 Credits) - paying to leave the
 * Containment Chamber immediately rather than trying for doubles.
 * Applies D-Class's standing exemption ("Standard Expendability
 * Clause") and Janitor's one-time free pass ("Below the Floor Plan" -
 * the master keyring). Returns the resulting state either way - check
 * .pendingDecision for whether a debtSettlement opened instead of
 * actually deducting anything.
 */
function chargeEscapeFee(state: GameState, playerId: string): GameState {
  const piece = pieceOf(state, playerId);
  if (piece === 'boot') {
    return logEvent(state, "No questions asked - D-Class isn't billed the Escape Fee.");
  }
  if (piece === 'iron' && !state.players[playerId].usedMasterKey) {
    return updatePlayer(
      logEvent(state, 'Used the master keyring - no Escape Fee.'),
      playerId,
      { usedMasterKey: true },
    );
  }
  return chargePlayer(state, playerId, ESCAPE_FEE, null);
}

/** Charges the Holding Fee (50 Credits) for another turn stuck in the Containment Chamber - D-Class is exempt. */
function chargeHoldingFee(state: GameState, playerId: string): GameState {
  if (pieceOf(state, playerId) === 'boot') {
    return logEvent(state, "No questions asked - D-Class isn't billed the Holding Fee.");
  }
  return chargePlayer(state, playerId, HOLDING_FEE, null);
}

function resolveJailRoll(state: GameState, playerId: string, roll: [number, number], isDoubles: boolean): GameState {
  if (isDoubles) {
    const freed = updatePlayer(state, playerId, { inJail: false, turnsInJail: 0 });
    return moveAndResolve(logEvent(freed, 'Rolled doubles - released from the Containment Chamber.'), playerId, roll[0] + roll[1]);
  }

  const charged = chargeHoldingFee(
    logEvent(state, 'Failed to roll doubles - the Holding Fee is charged for another turn inside.'),
    playerId,
  );
  if (charged.pendingDecision) return charged; // couldn't afford it - debtSettlement takes over

  const turnsInJail = charged.players[playerId].turnsInJail + 1;
  if (turnsInJail >= MAX_TURNS_IN_JAIL) {
    const freed = updatePlayer(charged, playerId, { inJail: false, turnsInJail: 0 });
    return moveAndResolve(logEvent(freed, `Failed to roll doubles ${MAX_TURNS_IN_JAIL} times - released.`), playerId, roll[0] + roll[1]);
  }

  return logEvent(updatePlayer(charged, playerId, { turnsInJail }), 'Still in the Containment Chamber.');
}

/** Voluntarily pays the Escape Fee to leave the Containment Chamber right away, before rolling. */
export function payEscapeFee(state: GameState, playerId: string): GameState {
  if (state.pendingDecision || !state.players[playerId].inJail) return state;
  if (currentPlayerId(state) !== playerId) return state;
  const charged = chargeEscapeFee(state, playerId);
  if (charged.pendingDecision) return charged;
  return updatePlayer(logEvent(charged, 'Paid the Escape Fee.'), playerId, { inJail: false, turnsInJail: 0 });
}

/** Spends a held "Get Out of Containment Free" card to leave immediately, before rolling. */
export function useGetOutOfJailCard(state: GameState, playerId: string, cardId: string): GameState {
  if (state.pendingDecision || !state.players[playerId].inJail) return state;
  if (currentPlayerId(state) !== playerId) return state;
  const player = state.players[playerId];
  if (!player.heldCardIds.includes(cardId)) return state;

  const deck = findCard(cardId).deck;
  const discardKey = deck === 'anomalousEvent' ? 'anomalousEventDiscardPile' : 'foundationDirectiveDiscardPile';
  const next: GameState = {
    ...state,
    [discardKey]: [...state[discardKey], cardId],
  } as GameState;
  return updatePlayer(
    logEvent(next, 'Used a Get Out of Containment Free card.'),
    playerId,
    { inJail: false, turnsInJail: 0, heldCardIds: player.heldCardIds.filter((id) => id !== cardId) },
  );
}

/** Awards the Go bonus for passing the Site Entrance, plus Intern's "Unpaid Overtime" top-up if applicable, and tracks laps completed for Intern's "On a Learning Curve" graduation. */
function passGo(state: GameState, playerId: string): GameState {
  const piece = pieceOf(state, playerId);
  const lapsCompleted = state.players[playerId].lapsCompleted + 1;
  const bonus = GO_BONUS + (piece === 'thimble' ? INTERN_OVERTIME_BONUS : 0);
  let next = giveCredits(
    logEvent(updatePlayer(state, playerId, { lapsCompleted }), `Passed the Site Entrance - collected ${bonus} Credits.`),
    playerId,
    bonus,
  );
  if (piece === 'thimble' && lapsCompleted === INTERN_GRADUATION_LAPS) {
    next = logEvent(next, 'Cleared for full field duty - no longer restricted to rolling one die.');
  }
  return next;
}

function moveAndResolve(state: GameState, playerId: string, spaces: number): GameState {
  const player = state.players[playerId];
  const newPosition = ((player.position + spaces) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
  const passedGo = newPosition < player.position || spaces >= BOARD_SIZE;
  let next = updatePlayer(state, playerId, { position: newPosition });
  if (passedGo) next = passGo(next, playerId);

  return resolveLanding(next, playerId, newPosition);
}

/** Checks whether any other player is already standing on `position` - Security Officer's (Rubber Duck's) Special Power. */
function findOccupant(state: GameState, position: number, excludingPlayerId: string): string | null {
  return (
    state.turnOrder.find(
      (id) => id !== excludingPlayerId && !state.players[id].isSpectating && state.players[id].position === position,
    ) ?? null
  );
}

function resolveLanding(state: GameState, playerId: string, position: number): GameState {
  const tile = getTile(position);
  let next = state;

  if (pieceOf(next, playerId) === 'rubberDuck') {
    const occupant = findOccupant(next, position, playerId);
    if (occupant) next = { ...next, rubberDuckEncounter: { rubberDuckPlayerId: playerId, targetPlayerId: occupant } };
  }

  switch (tile.kind) {
    case 'go':
    case 'freeParking':
    case 'jail': // just visiting - only actually being sent here does anything
      return next;
    case 'goToJail':
      return logEvent(sendToJail(next, playerId), 'Reassigned to the Containment Chamber.');
    case 'card': {
      // Field Researcher's "Grant Funding" - a flat stipend for landing
      // on either card tile, regardless of what the card turns out to say.
      const funded =
        pieceOf(next, playerId) === 'dog'
          ? logEvent(giveCredits(next, playerId, GRANT_FUNDING_AMOUNT), 'Grant Funding: collected a research stipend.')
          : next;
      return { ...funded, pendingDecision: { type: 'awaitingCardDraw', deck: tile.deck } };
    }
    case 'wing':
    case 'tunnel':
    case 'utility':
      return resolveOwnableLanding(next, playerId, tile.id);
  }
}

function resolveOwnableLanding(state: GameState, playerId: string, tileId: number): GameState {
  const owner = findOwner(state, tileId);
  const piece = pieceOf(state, playerId);

  if (!owner) {
    if (piece === 'trex') return state; // T-Rex can't buy - just sits there unowned
    if (piece === 'wheelBarrel' && sectorOf(tileId) === PURPLE_SEIZE_GROUP) {
      return logEvent(transferTile(state, tileId, playerId), 'Logistics Officer automatically requisitioned this Wing.');
    }
    return { ...state, pendingDecision: { type: 'purchase', tileId } };
  }

  if (owner === playerId || state.mortgagedTileIds.includes(tileId)) return state;

  if (piece === 'trex' || (piece === 'wheelBarrel' && sectorOf(tileId) === PURPLE_SEIZE_GROUP)) {
    return logEvent(transferTile(state, tileId, playerId), 'Automatically seized - no rent paid.');
  }

  // Janitor's "Below the Floor Plan" - never pays toll on a Maintenance Tunnel.
  if (piece === 'iron' && getTile(tileId).kind === 'tunnel') {
    return logEvent(state, 'Janitor walks right through - no toll on the tunnels.');
  }

  // MTF Operative's "Show of Force" - the first time (per game) anyone
  // lands on one of their Wings, offer a choice instead of charging
  // rent automatically. See resolveMtfEncounter.
  if (getTile(tileId).kind === 'wing' && pieceOf(state, owner) === 'battleship' && !state.players[owner].usedShowOfForce) {
    return { ...state, mtfEncounter: { mtfPlayerId: owner, targetPlayerId: playerId, tileId } };
  }

  const rent = calculateRent(state, tileId, owner, playerId);
  return logEvent(chargePlayer(state, playerId, rent, owner), `Paid ${rent} Credits rent.`);
}

function calculateRent(state: GameState, tileId: number, owner: string, payerId: string): number {
  const tile = getTile(tileId);
  let rent: number;
  if (tile.kind === 'wing') {
    const houses = state.houses[tileId] ?? 0;
    const baseRent = tile.rentTable[houses];
    rent = houses === 0 && ownsFullSector(state, owner, tile.colorGroup) ? baseRent * 2 : baseRent;
  } else if (tile.kind === 'tunnel') {
    const baseRent = RAILROAD_RENT_BY_COUNT[Math.min(tunnelsOwnedBy(state, owner), 4) - 1] ?? RAILROAD_RENT_BY_COUNT[0];
    // MTF Operative's "Rapid Deployment": rent collected on an owned Tunnel is doubled.
    rent = pieceOf(state, owner) === 'battleship' ? baseRent * 2 : baseRent;
  } else {
    // utility: 4x the roll if the owner has one, 10x if both - no
    // Standard Containment Procedure discount here, it only covers
    // Wings and Tunnels.
    const roll = state.lastRoll ? state.lastRoll[0] + state.lastRoll[1] : 0;
    return utilitiesOwnedBy(state, owner) >= 2 ? roll * 10 : roll * 4;
  }

  // Specialist's "Standard Containment Procedure" - 25% less rent on any Wing or Tunnel.
  return pieceOf(state, payerId) === 'penguin' ? Math.floor(rent * CONTAINMENT_PROCEDURE_MULTIPLIER) : rent;
}

// --- Buying ----------------------------------------------------------------

/** Discounted purchase price for Boot (utilities) and Battleship (Maintenance Tunnels). */
function purchasePriceFor(state: GameState, playerId: string, tileId: number): number {
  const tile = getTile(tileId);
  const price = tile.kind === 'wing' || tile.kind === 'tunnel' || tile.kind === 'utility' ? tile.price : 0;
  const piece = pieceOf(state, playerId);
  if (piece === 'boot' && tile.kind === 'utility') return price / 2;
  if (piece === 'battleship' && tile.kind === 'tunnel') return price / 2;
  return price;
}

export function buyTile(state: GameState, playerId: string): GameState {
  if (state.pendingDecision?.type !== 'purchase' || currentPlayerId(state) !== playerId) return state;
  const { tileId } = state.pendingDecision;
  const price = purchasePriceFor(state, playerId, tileId);
  if (!canAfford(state, playerId, price)) return state;

  let next = chargePlayer({ ...state, pendingDecision: null }, playerId, price, null);
  next = transferTile(next, tileId, playerId);
  return logEvent(next, `Bought ${getTile(tileId).name}.`);
}

export function declinePurchase(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'purchase') return state;
  // No auction system - it just stays unowned.
  return { ...state, pendingDecision: null };
}

// --- Cards -------------------------------------------------------------

function drawPileKeys(deck: CardDeck): { draw: 'anomalousEventDrawPile' | 'foundationDirectiveDrawPile'; discard: 'anomalousEventDiscardPile' | 'foundationDirectiveDiscardPile' } {
  return deck === 'anomalousEvent'
    ? { draw: 'anomalousEventDrawPile', discard: 'anomalousEventDiscardPile' }
    : { draw: 'foundationDirectiveDrawPile', discard: 'foundationDirectiveDiscardPile' };
}

/** Pops the next card ID off a deck's draw pile, reshuffling its discard pile back in first if it's run dry. Does not mutate either pile - callers apply the returned state themselves. */
function popNextCardId(state: GameState, deck: CardDeck, rng: () => number): { cardId: string; next: GameState } {
  const { draw, discard } = drawPileKeys(deck);
  let drawPile = state[draw];
  let next = state;
  if (drawPile.length === 0) {
    drawPile = shuffle(state[discard], rng);
    next = { ...next, [discard]: [] } as GameState;
  }
  const [cardId, ...rest] = drawPile;
  next = { ...next, [draw]: rest } as GameState;
  return { cardId, next };
}

/** Clicking the deck a player just landed on: draws the top card (or, for Site Director/Field Researcher's Special Power, shows a few to choose from), or uses forcedCardId if the dev panel set one. */
export function drawFromPile(state: GameState, playerId: string, rng: () => number = Math.random): GameState {
  if (state.pendingDecision?.type !== 'awaitingCardDraw') return state;
  const { deck } = state.pendingDecision;
  const piece = pieceOf(state, playerId);
  // Site Director's "Executive Authority" covers both decks; Field
  // Researcher's own power is limited to Foundation Directive only.
  const canChoose = piece === 'car' || (piece === 'dog' && deck === 'foundationDirective');

  if (state.forcedCardId) {
    return drawSpecificCard(state, playerId, state.forcedCardId);
  }

  if (canChoose) {
    const { draw } = drawPileKeys(deck);
    const choiceCardIds = state[draw].slice(0, 3);
    if (choiceCardIds.length === 0) return { ...state, pendingDecision: null };
    return { ...state, pendingDecision: { type: 'cardChoice', deck, choiceCardIds } };
  }

  const { cardId, next } = popNextCardId(state, deck, rng);
  return applyDrawnCard(next, playerId, cardId);
}

/** Site Director's/Field Researcher's Special Power: picks one of the offered cards, returning the rest to the top of the pile in their original order. */
export function chooseCardFromChoices(state: GameState, playerId: string, cardId: string): GameState {
  if (state.pendingDecision?.type !== 'cardChoice') return state;
  const { deck, choiceCardIds } = state.pendingDecision;
  if (!choiceCardIds.includes(cardId)) return state;
  const { draw } = drawPileKeys(deck);
  const remaining = choiceCardIds.filter((id) => id !== cardId);
  const next: GameState = { ...state, [draw]: [...remaining, ...state[draw].slice(choiceCardIds.length)] } as GameState;
  return applyDrawnCard(next, playerId, cardId);
}

function drawSpecificCard(state: GameState, playerId: string, cardId: string): GameState {
  return applyDrawnCard({ ...state, forcedCardId: null }, playerId, cardId);
}

function applyDrawnCard(state: GameState, playerId: string, cardId: string): GameState {
  const card = findCard(cardId);
  const discardKey = card.deck === 'anomalousEvent' ? 'anomalousEventDiscardPile' : 'foundationDirectiveDiscardPile';
  let next: GameState = { ...state, [discardKey]: [...state[discardKey], cardId] } as GameState;

  // Chaos Insurgency Spy's power works every time; Site Director's
  // "Redirect Without Exposure" is the same choice screen but only
  // available once per game (see catRedirectCard).
  const piece = pieceOf(next, playerId);
  if (piece === 'cat' || (piece === 'car' && !next.players[playerId].usedRedirect)) {
    return { ...next, pendingDecision: { type: 'catRedirect', cardId } };
  }

  next = { ...next, pendingDecision: { type: 'cardDrawn', cardId, forPlayerId: playerId } };
  return next;
}

/** Chaos Insurgency Spy's (Cat's) Special Power, also Site Director's one-time "Redirect Without Exposure": keep the drawn card themselves, or hand its whole effect to another player instead. Nothing in the resulting log names who made the call, matching Site Director's flavor - it's simply how the two Personnel are described to begin with, no extra code needed for that part. */
export function catRedirectCard(state: GameState, playerId: string, targetPlayerId: string | null): GameState {
  if (state.pendingDecision?.type !== 'catRedirect') return state;
  const { cardId } = state.pendingDecision;
  const forPlayerId = targetPlayerId && state.players[targetPlayerId] && targetPlayerId !== playerId ? targetPlayerId : playerId;
  let next = state;
  if (pieceOf(state, playerId) === 'car' && forPlayerId !== playerId) {
    next = updatePlayer(next, playerId, { usedRedirect: true });
  }
  return { ...next, pendingDecision: { type: 'cardDrawn', cardId, forPlayerId } };
}

/** Applies a drawn card's effect to whoever it's actually for, then clears the decision. */
export function acknowledgeCard(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'cardDrawn') return state;
  const { cardId, forPlayerId } = state.pendingDecision;
  const card = findCard(cardId);
  const cleared: GameState = { ...state, pendingDecision: null };
  return applyCardEffect(logEvent(cleared, `Drew: ${card.title}.`), forPlayerId, card.effect);
}

function applyCardEffect(state: GameState, playerId: string, effect: CardEffect): GameState {
  switch (effect.type) {
    case 'collect':
      return giveCredits(state, playerId, effect.amount);
    case 'pay':
      return chargePlayer(state, playerId, effect.amount, null);
    case 'moveTo': {
      const player = state.players[playerId];
      const passedGo = effect.tileId < player.position;
      let next = updatePlayer(state, playerId, { position: effect.tileId });
      if (passedGo) next = passGo(next, playerId);
      return resolveLanding(next, playerId, effect.tileId);
    }
    case 'moveToNearestTunnel': {
      const tunnelIds = BOARD.filter((t) => t.kind === 'tunnel').map((t) => t.id);
      const nearest = nearestAhead(state.players[playerId].position, tunnelIds);
      return moveAndResolve(state, playerId, distanceAhead(state.players[playerId].position, nearest));
    }
    case 'moveToNearestUtility': {
      const utilityIds = BOARD.filter((t) => t.kind === 'utility').map((t) => t.id);
      const nearest = nearestAhead(state.players[playerId].position, utilityIds);
      return moveAndResolve(state, playerId, distanceAhead(state.players[playerId].position, nearest));
    }
    case 'moveBackSpaces': {
      const player = state.players[playerId];
      const newPosition = (player.position - effect.spaces + BOARD_SIZE) % BOARD_SIZE;
      return resolveLanding(updatePlayer(state, playerId, { position: newPosition }), playerId, newPosition);
    }
    case 'goToJail':
      return logEvent(sendToJail(state, playerId), 'Reassigned to the Containment Chamber.');
    case 'getOutOfJailFree':
      // Held until used - see useGetOutOfJailCard. The card that granted
      // this was already moved to the discard pile in applyDrawnCard;
      // pull it back out since it's meant to sit with the player instead.
      return pullBackFromDiscard(state, playerId);
    case 'collectFromEachPlayer': {
      let next = state;
      for (const otherId of activePlayerIds(next)) {
        if (otherId === playerId) continue;
        next = giveCredits(chargePlayer(next, otherId, effect.amount, null), playerId, effect.amount);
      }
      return next;
    }
    case 'payEachPlayer': {
      let next = state;
      for (const otherId of activePlayerIds(next)) {
        if (otherId === playerId) continue;
        next = giveCredits(chargePlayer(next, playerId, effect.amount, null), otherId, effect.amount);
      }
      return next;
    }
    case 'repairs': {
      const player = state.players[playerId];
      let houseCount = 0;
      let hotelCount = 0;
      for (const tileId of player.ownedTileIds) {
        const houses = state.houses[tileId] ?? 0;
        if (houses === 5) hotelCount++;
        else houseCount += houses;
      }
      const amount = houseCount * effect.perHouse + hotelCount * effect.perHotel;
      return chargePlayer(state, playerId, amount, null);
    }
  }
}

/** The card that just granted a Get Out of Containment Free effect gets held by the player instead of discarded - undoes the discard-pile push applyDrawnCard already did. */
function pullBackFromDiscard(state: GameState, playerId: string): GameState {
  const lastCardId = (deckDiscard: string[]) => deckDiscard[deckDiscard.length - 1];
  const anomalousLast = lastCardId(state.anomalousEventDiscardPile);
  const directiveLast = lastCardId(state.foundationDirectiveDiscardPile);
  if (anomalousLast && findCard(anomalousLast).effect.type === 'getOutOfJailFree') {
    return updatePlayer(
      { ...state, anomalousEventDiscardPile: state.anomalousEventDiscardPile.slice(0, -1) },
      playerId,
      { heldCardIds: [...state.players[playerId].heldCardIds, anomalousLast] },
    );
  }
  if (directiveLast && findCard(directiveLast).effect.type === 'getOutOfJailFree') {
    return updatePlayer(
      { ...state, foundationDirectiveDiscardPile: state.foundationDirectiveDiscardPile.slice(0, -1) },
      playerId,
      { heldCardIds: [...state.players[playerId].heldCardIds, directiveLast] },
    );
  }
  return state;
}

function distanceAhead(from: number, to: number): number {
  return (to - from + BOARD_SIZE) % BOARD_SIZE;
}

function nearestAhead(from: number, candidateTileIds: number[]): number {
  return candidateTileIds.reduce((best, id) =>
    distanceAhead(from, id) < distanceAhead(from, best) ? id : best,
  candidateTileIds[0]);
}

// --- Security Officer's (Rubber Duck's) Special Power -----------------------

export function resolveRubberDuckEncounter(state: GameState, sendToJailChoice: boolean): GameState {
  if (!state.rubberDuckEncounter) return state;
  const { targetPlayerId } = state.rubberDuckEncounter;
  let next: GameState = { ...state, rubberDuckEncounter: null };
  if (sendToJailChoice) next = logEvent(sendToJail(next, targetPlayerId), 'Security Officer sent a player to the Containment Chamber.');
  return next;
}

// --- MTF Operative's Special Power ---------------------------------------

/**
 * "Show of Force": MTF Operative either collects the normal rent, or -
 * once per game - seizes one of the landing player's other Wings/
 * Tunnels instead (a deterministic pick, the first eligible one in
 * their owned-tile list, rather than random - if they have no other
 * eligible tile, MTF Operative still burns their one-time use and gets
 * nothing, same as a real high-variance gamble not paying off).
 */
export function resolveMtfEncounter(state: GameState, seize: boolean): GameState {
  if (!state.mtfEncounter) return state;
  const { mtfPlayerId, targetPlayerId, tileId } = state.mtfEncounter;
  let next: GameState = { ...state, mtfEncounter: null };

  if (!seize) {
    const rent = calculateRent(next, tileId, mtfPlayerId, targetPlayerId);
    return logEvent(chargePlayer(next, targetPlayerId, rent, mtfPlayerId), `Paid ${rent} Credits rent.`);
  }

  next = updatePlayer(next, mtfPlayerId, { usedShowOfForce: true });
  const seizableTileId = next.players[targetPlayerId].ownedTileIds.find(
    (id) => id !== tileId && (next.houses[id] ?? 0) === 0,
  );
  if (seizableTileId === undefined) {
    return logEvent(next, 'Show of Force: nothing left to seize - no rent collected either.');
  }
  next = transferTile(next, seizableTileId, mtfPlayerId);
  return logEvent(next, `Show of Force: seized ${getTile(seizableTileId).name} instead of collecting rent.`);
}

// --- Janitor's Special Power ---------------------------------------------

/**
 * "Below the Floor Plan": from one Maintenance Tunnel, Janitor moves
 * directly to any other one, replacing their roll for the turn - only
 * usable on their own turn, before they've rolled, not while in the
 * Containment Chamber (the tunnels don't help you there), only when
 * they're currently standing on a Tunnel themselves (the service
 * corridors connect the tunnels to each other, not to the rest of the
 * board), and only once per turn - otherwise nothing stops them
 * chaining every Tunnel on the board in a single turn for free.
 * Landing this way still resolves normally (an unowned Tunnel can be
 * bought), it just never charges Janitor rent - see
 * resolveOwnableLanding.
 */
export function useJanitorTunnelTravel(state: GameState, playerId: string, targetTileId: number): GameState {
  if (state.pendingDecision || state.winnerId) return state;
  if (currentPlayerId(state) !== playerId || pieceOf(state, playerId) !== 'iron') return state;
  const player = state.players[playerId];
  if (player.inJail || state.lastRoll || player.usedTunnelTravelThisTurn) return state;
  if (getTile(player.position).kind !== 'tunnel') return state;
  if (getTile(targetTileId).kind !== 'tunnel') return state;

  const next = updatePlayer(state, playerId, { position: targetTileId, usedTunnelTravelThisTurn: true });
  return resolveLanding(logEvent(next, 'Used the service corridors to reach another Maintenance Tunnel.'), playerId, targetTileId);
}

// --- Houses & mortgages ------------------------------------------------

export function buildHouse(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'wing') return state;
  if (findOwner(state, tileId) !== playerId) return state;
  if (state.mortgagedTileIds.some((id) => tileIdsInSector(tile.colorGroup).includes(id))) return state;
  const ownsFull = ownsFullSector(state, playerId, tile.colorGroup);
  if (!ownsFull) {
    // Administrator's "Zoning Authority" - can build without the full
    // Sector, but the whole Sector's house count is capped at how many
    // Wings in it they actually own (so a single owned Wing tops out at
    // 1 house, two Wings at 2, and so on) - never enough to reach a
    // hotel until the Sector really is complete, at which point normal
    // rules (and the housesRemaining/hotelsRemaining checks below) apply
    // in full, same as anyone else.
    if (pieceOf(state, playerId) !== 'hat') return state;
    const sectorTileIds = tileIdsInSector(tile.colorGroup);
    const ownedInSector = sectorTileIds.filter((id) => state.players[playerId].ownedTileIds.includes(id)).length;
    const totalHousesInSector = sectorTileIds.reduce((sum, id) => sum + (state.houses[id] ?? 0), 0);
    if (totalHousesInSector >= ownedInSector) return state;
  }
  const houses = state.houses[tileId] ?? 0;
  if (houses >= 5) return state;
  const isHotel = houses === 4;
  // Logistics Officer's "Overstock" - their own builds are never
  // blocked by (or counted against) the Foundation's shared supply.
  const isLogisticsOfficer = pieceOf(state, playerId) === 'wheelBarrel';
  if (!isLogisticsOfficer) {
    if (isHotel && state.hotelsRemaining <= 0) return state;
    if (!isHotel && state.housesRemaining <= 0) return state;
  }
  // Logistics Officer's "Bulk Requisition" - a standing discount on their own builds.
  const cost = isLogisticsOfficer ? Math.floor(tile.houseCost * BULK_REQUISITION_MULTIPLIER) : tile.houseCost;
  if (!canAfford(state, playerId, cost)) return state;

  let next = chargePlayer(state, playerId, cost, null);
  next = {
    ...next,
    houses: { ...next.houses, [tileId]: houses + 1 },
    housesRemaining: isHotel || isLogisticsOfficer ? next.housesRemaining : next.housesRemaining - 1,
    hotelsRemaining: !isHotel || isLogisticsOfficer ? next.hotelsRemaining : next.hotelsRemaining - 1,
  };
  return logEvent(next, `Built ${isHotel ? 'a hotel' : 'a house'} on ${tile.name}.`);
}

export function sellHouse(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'wing') return state;
  if (findOwner(state, tileId) !== playerId) return state;
  const houses = state.houses[tileId] ?? 0;
  if (houses <= 0) return state;
  const wasHotel = houses === 5;
  const refund = Math.floor(tile.houseCost / 2);
  // Logistics Officer's "Overstock" builds never came out of the shared
  // supply in the first place (see buildHouse) - selling one back
  // mustn't add to it either, or the whole table's supply cap leaks.
  const returnsToSupply = pieceOf(state, playerId) !== 'wheelBarrel';

  const next: GameState = {
    ...giveCredits(state, playerId, refund),
    houses: { ...state.houses, [tileId]: houses - 1 },
    housesRemaining: !returnsToSupply ? state.housesRemaining : wasHotel ? state.housesRemaining + 4 : state.housesRemaining + 1,
    hotelsRemaining: !returnsToSupply ? state.hotelsRemaining : wasHotel ? state.hotelsRemaining - 1 : state.hotelsRemaining,
  };
  return logEvent(next, `Sold ${wasHotel ? 'a hotel' : 'a house'} on ${tile.name}.`);
}

export function mortgageProperty(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'wing' && tile.kind !== 'tunnel') return state;
  if (findOwner(state, tileId) !== playerId) return state;
  if (state.mortgagedTileIds.includes(tileId)) return state;
  if ((state.houses[tileId] ?? 0) > 0) return state;

  const payout = tile.price / 2;
  const next: GameState = {
    ...giveCredits(state, playerId, payout),
    mortgagedTileIds: [...state.mortgagedTileIds, tileId],
  };
  return logEvent(next, `Mortgaged ${tile.name} for ${payout} Credits.`);
}

export function unmortgageProperty(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'wing' && tile.kind !== 'tunnel') return state;
  if (findOwner(state, tileId) !== playerId) return state;
  if (!state.mortgagedTileIds.includes(tileId)) return state;

  const payoff = Math.ceil((tile.price / 2) * MORTGAGE_PAYOFF_MULTIPLIER);
  if (!canAfford(state, playerId, payoff)) return state;
  const next: GameState = {
    ...chargePlayer(state, playerId, payoff, null),
    mortgagedTileIds: state.mortgagedTileIds.filter((id) => id !== tileId),
  };
  return logEvent(next, `Paid off the mortgage on ${tile.name}.`);
}

// --- Debt & bankruptcy ---------------------------------------------------

/** Pays off a pending debtSettlement now that the player has liquidated enough (sold houses/mortgaged properties) to afford it. */
export function settleDebt(state: GameState, playerId: string): GameState {
  if (state.pendingDecision?.type !== 'debtSettlement' || state.pendingDecision.forPlayerId !== playerId) return state;
  const { amountOwed, creditorId } = state.pendingDecision;
  if (!canAfford(state, playerId, amountOwed)) return state;
  return chargePlayer({ ...state, pendingDecision: null }, playerId, amountOwed, creditorId);
}

/**
 * Returns every Wing (and its houses/hotels) a player holds to the
 * Foundation - or, if creditorId is given, hands them to that player
 * instead - and pays over their remaining Credits the same way.
 * Doesn't touch isSpectating, zero the player's own Credits, or apply
 * D-Class's exemption - callers decide what happens to the player
 * afterward. Shared by declareBankruptcy, devKickPlayer, and Shy Guy's
 * catch effect.
 */
function seizeAssets(state: GameState, playerId: string, creditorId: string | null): GameState {
  let next = state;
  for (const tileId of [...state.players[playerId].ownedTileIds]) {
    const houses = next.houses[tileId] ?? 0;
    if (houses > 0) {
      // Houses/hotels always return to the bank's supply, even if the
      // Wing itself goes to another player - matches the real rule
      // that you must sell all houses before going bankrupt to
      // another player (we don't enforce that directly, so this is
      // the fallback that keeps the bank's supply from leaking).
      next = {
        ...next,
        houses: { ...next.houses, [tileId]: 0 },
        housesRemaining: next.housesRemaining + (houses === 5 ? 0 : houses),
        hotelsRemaining: next.hotelsRemaining + (houses === 5 ? 1 : 0),
      };
    }
    next = transferTile(next, tileId, creditorId);
    next = { ...next, mortgagedTileIds: next.mortgagedTileIds.filter((id) => id !== tileId) };
  }
  if (creditorId) next = giveCredits(next, creditorId, next.players[playerId].credits);
  return next;
}

/** Gives up rather than settling a debt: every asset (Credits, Wings, houses/hotels, mortgages, held cards) is either handed to the creditor (if a specific player) or returned to the Foundation, and this player is permanently out. */
export function declareBankruptcy(state: GameState, playerId: string): GameState {
  if (state.pendingDecision?.type !== 'debtSettlement' || state.pendingDecision.forPlayerId !== playerId) return state;
  const { creditorId } = state.pendingDecision;
  let next: GameState = seizeAssets({ ...state, pendingDecision: null }, playerId, creditorId);

  // D-Class's "Standard Expendability Clause": the first Termination is
  // survivable - requisitioned back into play instead of going out for
  // good. Only once - a second Termination is permanent like anyone
  // else's.
  if (pieceOf(next, playerId) === 'boot' && !next.players[playerId].usedExpendabilityClause) {
    next = updatePlayer(next, playerId, {
      credits: RESPAWN_CREDITS,
      position: 0,
      ownedTileIds: [],
      heldCardIds: [],
      inJail: false,
      turnsInJail: 0,
      usedExpendabilityClause: true,
    });
    return logEvent(next, 'Requisitioned a replacement D-Class - back in play with reduced funding.');
  }

  next = updatePlayer(next, playerId, { credits: 0, isSpectating: true, ownedTileIds: [], heldCardIds: [] });
  next = logEvent(next, `${creditorId ? 'Terminated' : 'Terminated - assets returned to the Foundation'}.`);

  return checkWinCondition(next);
}

function checkWinCondition(state: GameState): GameState {
  const active = activePlayerIds(state);
  if (active.length === 1 && !state.winnerId) {
    return logEvent({ ...state, winnerId: active[0] }, 'Only one player remains - the match is over.');
  }
  return state;
}

// --- Hostile anomalies ---------------------------------------------------
//
// A world event independent of any single player's turn: once a real
// turn ends (not a doubles-continuation - see endTurn), a new anomaly
// might breach containment, and any already-loose ones take a step.
// Each anomaly gets its own bespoke behavior (only Shy Guy exists so
// far) rather than a generic shared "AI" - see data/anomalies.ts.

function updateAnomaly(state: GameState, anomalyId: string, patch: Partial<LooseAnomaly>): GameState {
  return { ...state, looseAnomalies: state.looseAnomalies.map((a) => (a.anomalyId === anomalyId ? { ...a, ...patch } : a)) };
}

/**
 * Builds the LooseAnomaly entry for a fresh breach. Every anomaly
 * starts dormant except SCP-106, which never needed a "look" to start
 * engaging in the first place - it's already hunting whoever's closest
 * to its spawn tile from the very first tick (falls back to dormant
 * only in the degenerate case where literally nobody's eligible yet).
 */
function spawnLooseAnomaly(state: GameState, anomaly: AnomalyDefinition, anchorPlayerId: string): LooseAnomaly {
  const targetId = anomaly.id === 'theOldMan' ? nearestHuntableTarget(state, anomaly.spawnTileId) : null;
  return {
    anomalyId: anomaly.id,
    tileId: anomaly.spawnTileId,
    status: targetId ? 'hunting' : 'dormant',
    targetPlayerId: targetId,
    breachedOnTurnCount: state.turnCount,
    spawnedOnPlayerId: anchorPlayerId,
  };
}

function maybeBreachContainment(state: GameState, rng: () => number, anchorPlayerId: string): GameState {
  if (rng() >= BREACH_CHANCE) return state;
  const looseIds = new Set(state.looseAnomalies.map((a) => a.anomalyId));
  const candidates = ANOMALIES.filter((a) => !looseIds.has(a.id));
  if (candidates.length === 0) return state; // every anomaly type is already loose
  const anomaly = candidates[Math.floor(rng() * candidates.length)];
  const loose = spawnLooseAnomaly(state, anomaly, anchorPlayerId);
  return logEvent(
    { ...state, looseAnomalies: [...state.looseAnomalies, loose] },
    `Containment breach: ${anomaly.name} has escaped into ${getTile(anomaly.spawnTileId).name}.`,
  );
}

/** Moves `from` toward `to` by at most `maxSteps`, always clockwise - the same direction every player token moves in. */
function stepToward(from: number, to: number, maxSteps: number): number {
  const clockwiseDistance = (to - from + BOARD_SIZE) % BOARD_SIZE;
  if (clockwiseDistance === 0) return from;
  return (from + Math.min(clockwiseDistance, maxSteps)) % BOARD_SIZE;
}

function availablePersonnelIds(state: GameState): PieceId[] {
  const claimed = new Set(Object.values(state.players).filter((p) => !p.isSpectating).map((p) => p.pieceId));
  return STARTING_PIECES.map((p) => p.id).filter((id) => !claimed.has(id));
}

/**
 * The actual consequence of being caught by a Hostile Anomaly, split
 * out from resolveAnomalyCatch below so SCP-106's Pocket Dimension can
 * reuse it too (a Termination inside the Pocket Dimension is the same
 * consequence, just reached a different way - see
 * terminateInsidePocketDimension). Every asset returns to the
 * Foundation, exactly like a real Termination. D-Class's "Standard
 * Expendability Clause" still applies first if they haven't used it.
 * Otherwise, if any Personnel nobody else is playing exists, they're
 * queued to pick one (see chooseNewPersonnel) instead of going out for
 * good - only a real Termination if nothing's left to reassign. Does
 * not touch the anomaly's own state at all - callers handle that.
 */
function resolvePlayerCaughtByAnomaly(state: GameState, anomalyId: string, targetPlayerId: string): GameState {
  const anomaly = findAnomaly(anomalyId as AnomalyId);
  let next = logEvent(state, `${anomaly.name} caught up with someone.`);
  next = seizeAssets(next, targetPlayerId, null);

  if (pieceOf(next, targetPlayerId) === 'boot' && !next.players[targetPlayerId].usedExpendabilityClause) {
    next = updatePlayer(next, targetPlayerId, {
      credits: RESPAWN_CREDITS,
      position: 0,
      ownedTileIds: [],
      heldCardIds: [],
      inJail: false,
      turnsInJail: 0,
      usedExpendabilityClause: true,
    });
    next = logEvent(next, 'Requisitioned a replacement D-Class - back in play with reduced funding.');
  } else {
    const available = availablePersonnelIds(next);
    next = updatePlayer(next, targetPlayerId, { credits: 0, ownedTileIds: [], heldCardIds: [] });
    if (available.length === 0) {
      next = updatePlayer(next, targetPlayerId, { isSpectating: true });
      next = checkWinCondition(logEvent(next, 'Terminated - no unclaimed Personnel left to reassign.'));
    } else {
      next = { ...next, pendingPieceChoice: { playerId: targetPlayerId, availablePieceIds: available } };
      next = logEvent(next, 'Requisitioning a new Personnel assignment.');
    }
  }

  return next;
}

/** Shy Guy's and SCP-173's shared catch effect on the main board: resolvePlayerCaughtByAnomaly's consequence, then the anomaly itself goes back to dormant right where it caught them - still loose until someone purges it. SCP-106 never calls this - see dragIntoPocketDimension instead, since a main-board catch isn't a loss for it. */
function resolveAnomalyCatch(state: GameState, anomalyId: string, targetPlayerId: string, caughtAtTileId: number): GameState {
  const next = resolvePlayerCaughtByAnomaly(state, anomalyId, targetPlayerId);
  return updateAnomaly(next, anomalyId, { status: 'dormant', targetPlayerId: null, tileId: caughtAtTileId });
}

/** Whoever's closest to a given tile, eligible to actually be hunted - excludes Rogue Anomaly (always immune) and anyone AFK-benched. Used for SCP-106's automatic targeting (no viewing required) and SCP-173's nearest-victim pick each unwatched tick. Null if nobody's currently eligible at all. */
function nearestHuntableTarget(state: GameState, fromTileId: number): string | null {
  const candidates = activePlayerIds(state).filter((id) => !state.players[id].isAfkSpectating && pieceOf(state, id) !== 'trex');
  if (candidates.length === 0) return null;
  return candidates.reduce((closest, id) =>
    distanceAhead(fromTileId, state.players[id].position) < distanceAhead(fromTileId, state.players[closest].position) ? id : closest,
  );
}

function advanceHuntingAnomalies(state: GameState, rng: () => number): GameState {
  let next = state;
  for (const anomaly of state.looseAnomalies) {
    const current = next.looseAnomalies.find((a) => a.anomalyId === anomaly.anomalyId);
    if (!current || current.status !== 'hunting' || !current.targetPlayerId) continue;

    const target = next.players[current.targetPlayerId];
    if (!target || target.isSpectating || pieceOf(next, current.targetPlayerId) === 'trex') {
      // Target's really gone (Terminated some other way), or was just reassigned into Rogue
      // Anomaly ("Uncontained") mid-hunt. SCP-106 never needed a "look" to
      // start engaging in the first place, so losing a target doesn't put
      // it back to sleep either - it immediately re-picks whoever's now
      // closest instead. Every other anomaly just loses interest and
      // stays put dormant.
      if (current.anomalyId === 'theOldMan') {
        const reacquired = nearestHuntableTarget(next, current.tileId);
        next = updateAnomaly(next, current.anomalyId, reacquired ? { targetPlayerId: reacquired } : { status: 'dormant', targetPlayerId: null });
      } else {
        next = updateAnomaly(next, current.anomalyId, { status: 'dormant', targetPlayerId: null });
      }
      continue;
    }
    if (target.isAfkSpectating) continue; // just paused, not lost - waits for them rather than giving up

    const speed = current.anomalyId === 'theOldMan' ? OLD_MAN_MAIN_BOARD_SPEED : ANOMALY_HUNT_SPEED;
    const newTileId = stepToward(current.tileId, target.position, speed);
    if (newTileId !== target.position) {
      next = updateAnomaly(next, current.anomalyId, { tileId: newTileId });
      continue;
    }
    // Caught. SCP-106 doesn't resolve like every other anomaly - catching
    // someone on the main board isn't itself a loss, it drags them into
    // the Pocket Dimension instead (see dragIntoPocketDimension).
    next =
      current.anomalyId === 'theOldMan'
        ? dragIntoPocketDimension(next, current.targetPlayerId, rng)
        : resolveAnomalyCatch(next, current.anomalyId, current.targetPlayerId, newTileId);
  }
  return next;
}

/**
 * SCP-173's own tick, entirely separate from the dormant/hunting flow
 * above - it never locks onto one target, and it doesn't check every
 * turn either: it only ever acts once per round, specifically when
 * it becomes the turn of whoever's turn it was when it breached (see
 * spawnedOnPlayerId) - endTurn only calls this when endingPlayerId
 * matches. No-op if it's not loose, or someone did keep watch this
 * tick (frozen). Moves clockwise toward whoever's nearest by
 * SCULPTURE_UNWATCHED_SPEED spaces - catches them outright if that's
 * far enough, but a target far enough ahead genuinely outruns it this
 * round. Rogue Anomaly is never a valid target (immune, like with Shy
 * Guy); an AFK player is skipped too, same as a benched Shy Guy target.
 */
function advanceUnwatchedSculpture(state: GameState, endingPlayerId: string): GameState {
  const sculpture = state.looseAnomalies.find((a) => a.anomalyId === 'theSculpture');
  if (!sculpture || sculpture.spawnedOnPlayerId !== endingPlayerId || state.scp173Watched) return state;

  const nearestId = nearestHuntableTarget(state, sculpture.tileId);
  if (!nearestId) return state;

  const newTileId = stepToward(sculpture.tileId, state.players[nearestId].position, SCULPTURE_UNWATCHED_SPEED);
  return newTileId === state.players[nearestId].position
    ? resolveAnomalyCatch(state, 'theSculpture', nearestId, newTileId)
    : updateAnomaly(state, 'theSculpture', { tileId: newTileId });
}

// --- SCP-106's Pocket Dimension --------------------------------------------
//
// Entirely its own thing, distinct from every other anomaly's catch
// effect: catching someone on the main board isn't a loss for them at
// all, just the start of a much more dangerous ordeal on a separate
// 9-tile track (see PocketDimensionOrdeal in types/game.ts). Only
// failing inside it - an unaffordable Decaying Passage, or SCP-106
// physically reaching their tile in there - actually costs them
// anything, via the exact same resolvePlayerCaughtByAnomaly pipeline
// every other catch uses.

/** Tile 0 is always neutral (the drag-in point); the rest are freshly reshuffled every time - 2 Fracture Points, 3 Decaying Passages, 3 neutral, in random order. */
function generatePocketDimensionTrack(rng: () => number): PocketDimensionTile[] {
  const rest: PocketDimensionTile[] = ['fracturePoint', 'fracturePoint', 'decayingPassage', 'decayingPassage', 'decayingPassage', 'neutral', 'neutral', 'neutral'];
  return ['neutral', ...shuffle(rest, rng)];
}

/** SCP-106 catching someone on the main board: both of them move into a freshly generated Pocket Dimension. The anomaly itself is marked 'inPocketDimension' - off the main board entirely (no marker, unreachable by Purge) until the ordeal resolves one way or another. */
function dragIntoPocketDimension(state: GameState, playerId: string, rng: () => number): GameState {
  const track = generatePocketDimensionTrack(rng);
  const next: GameState = {
    ...updateAnomaly(state, 'theOldMan', { status: 'inPocketDimension', targetPlayerId: null }),
    pocketDimensionOrdeal: { trappedPlayerId: playerId, track, playerTrackPosition: 0, anomalyTrackPosition: 0 },
  };
  return logEvent(next, 'SCP-106 caught up with someone and dragged them into its Pocket Dimension.');
}

/** Landing on a Fracture Point: back to the main board, unharmed, right where they were caught (their position was never touched while trapped). SCP-106 is recontained the instant the ordeal ends, regardless of how. */
function escapePocketDimension(state: GameState): GameState {
  const next: GameState = {
    ...state,
    looseAnomalies: state.looseAnomalies.filter((a) => a.anomalyId !== 'theOldMan'),
    pocketDimensionOrdeal: null,
  };
  return logEvent(next, 'Escaped the Pocket Dimension through a Fracture Point - SCP-106 recontained.');
}

/** Failing inside the Pocket Dimension - an unaffordable Decaying Passage, or SCP-106 reaching their tile. Same consequence as any other anomaly's catch (resolvePlayerCaughtByAnomaly), and SCP-106 is recontained either way, same as an escape. */
function terminateInsidePocketDimension(state: GameState, trappedPlayerId: string): GameState {
  const next = resolvePlayerCaughtByAnomaly(state, 'theOldMan', trappedPlayerId);
  return {
    ...next,
    looseAnomalies: next.looseAnomalies.filter((a) => a.anomalyId !== 'theOldMan'),
    pocketDimensionOrdeal: null,
  };
}

/**
 * The trapped player's own turn, replacing their usual roll-and-move
 * on the main board entirely: rolls one die to advance along the
 * Pocket Dimension track, wrapping back around to tile 0 past the far
 * end - a loop, not a dead end, so a bad run of rolls can never stall
 * you at the last tile with nowhere left to go while SCP-106 closes
 * in. Doesn't resolve the landed tile yet - opens a pendingDecision
 * instead, so the UI can hold on the landed tile for a beat before
 * revealing what it actually does (see
 * acknowledgePocketDimensionLanding). Blocks every other action in the
 * meantime, same as any other pendingDecision.
 */
export function movePocketDimension(state: GameState, playerId: string, rng: () => number = Math.random): GameState {
  if (state.pendingDecision || state.winnerId) return state;
  if (currentPlayerId(state) !== playerId) return state;
  const ordeal = state.pocketDimensionOrdeal;
  if (!ordeal || ordeal.trappedPlayerId !== playerId) return state;

  const roll = Math.floor(rng() * 6) + 1;
  const newPlayerPos = (ordeal.playerTrackPosition + roll) % POCKET_DIMENSION_LENGTH;
  return logEvent(
    {
      ...state,
      pocketDimensionOrdeal: { ...ordeal, playerTrackPosition: newPlayerPos },
      pendingDecision: { type: 'pocketDimensionLanded', forPlayerId: playerId },
    },
    `Rolled a ${roll} in the Pocket Dimension.`,
  );
}

/**
 * Resolves whatever tile movePocketDimension just landed the trapped
 * player on, then - if the ordeal is still going - SCP-106 creeps one
 * tile closer. The track loops, so "closer" is the clockwise gap
 * between them, wrapping around same as everything else here - if
 * that gap is small enough for SCP-106's speed to close it entirely
 * (including already being right on the player's tile), that's a
 * catch, checked before anything else since it preempts even landing
 * on a Fracture Point. Otherwise resolves the tile normally, then (if
 * still trapped) advances SCP-106 by its own speed around the loop.
 * Ends the turn itself, same as keepWatchOnSculpture, since there's
 * nothing else to resolve this turn either way.
 */
export function acknowledgePocketDimensionLanding(state: GameState, rng: () => number = Math.random): GameState {
  if (state.pendingDecision?.type !== 'pocketDimensionLanded') return state;
  const { forPlayerId: playerId } = state.pendingDecision;
  const ordeal = state.pocketDimensionOrdeal;
  if (!ordeal) return { ...state, pendingDecision: null };

  let next: GameState = { ...state, pendingDecision: null };
  const gapToAnomaly =
    (ordeal.playerTrackPosition - ordeal.anomalyTrackPosition + POCKET_DIMENSION_LENGTH) % POCKET_DIMENSION_LENGTH;

  if (gapToAnomaly <= OLD_MAN_POCKET_DIMENSION_SPEED) {
    return endTurn(terminateInsidePocketDimension(next, playerId), rng);
  }

  const landedTile = ordeal.track[ordeal.playerTrackPosition];
  if (landedTile === 'fracturePoint') {
    next = escapePocketDimension(next);
  } else if (landedTile === 'decayingPassage') {
    next =
      next.players[playerId].credits < DECAYING_PASSAGE_COST
        ? terminateInsidePocketDimension(next, playerId)
        : chargePlayer(next, playerId, DECAYING_PASSAGE_COST, null);
  }

  const stillTrapped = next.pocketDimensionOrdeal;
  if (stillTrapped) {
    const newAnomalyPos = (stillTrapped.anomalyTrackPosition + OLD_MAN_POCKET_DIMENSION_SPEED) % POCKET_DIMENSION_LENGTH;
    next = { ...next, pocketDimensionOrdeal: { ...stillTrapped, anomalyTrackPosition: newAnomalyPos } };
  }

  return endTurn(next, rng);
}

/** A player "viewing" a dormant anomaly - hovering its tile. Shy Guy's own interaction (the first to do so becomes its target and it starts hunting them); no-op for every other anomaly - SCP-173 has its own interaction instead (see keepWatchOnSculpture), and SCP-106 never needs to be viewed at all, it engages automatically (see spawnLooseAnomaly). Also a no-op if it's already hunting someone, isn't loose at all, or the viewer is Rogue Anomaly ("Uncontained": fellow anomalies don't see it as prey). */
export function viewAnomaly(state: GameState, playerId: string, anomalyId: string): GameState {
  if (anomalyId !== 'shyGuy') return state;
  const anomaly = state.looseAnomalies.find((a) => a.anomalyId === anomalyId);
  if (!anomaly || anomaly.status !== 'dormant') return state;
  if (pieceOf(state, playerId) === 'trex') return state;
  return logEvent(
    updateAnomaly(state, anomalyId, { status: 'hunting', targetPlayerId: playerId }),
    `${findAnomaly(anomalyId as AnomalyId).name} noticed it was being watched.`,
  );
}

/** Resolves a pendingPieceChoice opened by resolveAnomalyCatch - picks any Personnel nobody else is currently playing. */
export function chooseNewPersonnel(state: GameState, playerId: string, pieceId: PieceId): GameState {
  if (!state.pendingPieceChoice || state.pendingPieceChoice.playerId !== playerId) return state;
  if (!state.pendingPieceChoice.availablePieceIds.includes(pieceId)) return state;
  const next = updatePlayer({ ...state, pendingPieceChoice: null }, playerId, { pieceId });
  return logEvent(next, `Reassigned as ${STARTING_PIECES.find((p) => p.id === pieceId)?.name ?? pieceId}.`);
}

/** The Site Warhead's owner spending Credits to instantly recontain every currently reachable loose anomaly. SCP-106 is the one exception - while it's off in its own Pocket Dimension mid-chase (see pocketDimensionOrdeal), the Warhead can't reach it at all. No-op (not even a charge) if nothing reachable is loose, they don't own it, or they can't afford it - this is a voluntary action, not a forced payment, so it never opens a debtSettlement. */
export function purgeAnomalies(state: GameState, playerId: string): GameState {
  const reachable = state.pocketDimensionOrdeal
    ? state.looseAnomalies.filter((a) => a.anomalyId !== 'theOldMan')
    : state.looseAnomalies;
  if (reachable.length === 0) return state;
  if (findOwner(state, SITE_WARHEAD_TILE_ID) !== playerId) return state;
  if (!canAfford(state, playerId, SITE_WARHEAD_PURGE_COST)) return state;
  const next = chargePlayer(state, playerId, SITE_WARHEAD_PURGE_COST, null);
  const remaining = state.pocketDimensionOrdeal ? next.looseAnomalies.filter((a) => a.anomalyId === 'theOldMan') : [];
  return logEvent({ ...next, looseAnomalies: remaining }, 'Site Warhead activated - every reachable loose anomaly has been recontained.');
}

/** Rogue Anomaly's Special Power ("Induce a Breach"): forces a containment breach on demand instead of waiting on the random per-turn chance, picking a random not-yet-loose anomaly type exactly like a natural breach would. Once per game. No-op if it's not this player's power, they've already used it, or every anomaly type is already loose (nothing left to induce). */
export function induceBreach(state: GameState, playerId: string, rng: () => number = Math.random): GameState {
  if (pieceOf(state, playerId) !== 'trex' || state.players[playerId].usedInduceBreach) return state;
  const looseIds = new Set(state.looseAnomalies.map((a) => a.anomalyId));
  const candidates = ANOMALIES.filter((a) => !looseIds.has(a.id));
  if (candidates.length === 0) return state;

  const anomaly = candidates[Math.floor(rng() * candidates.length)];
  const loose = spawnLooseAnomaly(state, anomaly, currentPlayerId(state));
  const next = updatePlayer(state, playerId, { usedInduceBreach: true });
  return logEvent(
    { ...next, looseAnomalies: [...next.looseAnomalies, loose] },
    `Induced a containment breach: ${anomaly.name} has escaped into ${getTile(anomaly.spawnTileId).name}.`,
  );
}

// --- Trading -------------------------------------------------------------

let tradeIdCounter = 0;
function nextTradeId(): string {
  tradeIdCounter += 1;
  return `trade-${Date.now()}-${tradeIdCounter}`;
}

export function proposeTrade(state: GameState, offer: Omit<TradeOffer, 'id'>): GameState {
  const trade: TradeOffer = { ...offer, id: nextTradeId() };
  return { ...state, activeTrades: [...state.activeTrades, trade] };
}

export function withdrawTrade(state: GameState, tradeId: string): GameState {
  return { ...state, activeTrades: state.activeTrades.filter((t) => t.id !== tradeId) };
}

export function declineTrade(state: GameState, tradeId: string): GameState {
  return { ...state, activeTrades: state.activeTrades.filter((t) => t.id !== tradeId) };
}

export function acceptTrade(state: GameState, tradeId: string): GameState {
  const trade = state.activeTrades.find((t) => t.id === tradeId);
  if (!trade) return state;
  if (!canAfford(state, trade.fromPlayerId, trade.offerCredits) || !canAfford(state, trade.toPlayerId, trade.requestCredits)) {
    return state;
  }

  let next: GameState = { ...state, activeTrades: state.activeTrades.filter((t) => t.id !== tradeId) };
  for (const tileId of trade.offerTileIds) next = transferTile(next, tileId, trade.toPlayerId);
  for (const tileId of trade.requestTileIds) next = transferTile(next, tileId, trade.fromPlayerId);
  next = giveCredits(chargePlayer(next, trade.fromPlayerId, trade.offerCredits, null), trade.toPlayerId, trade.offerCredits);
  next = giveCredits(chargePlayer(next, trade.toPlayerId, trade.requestCredits, null), trade.fromPlayerId, trade.requestCredits);
  next = updatePlayer(next, trade.fromPlayerId, {
    heldCardIds: [
      ...next.players[trade.fromPlayerId].heldCardIds.filter((id) => !trade.offerCardIds.includes(id)),
      ...trade.requestCardIds,
    ],
  });
  next = updatePlayer(next, trade.toPlayerId, {
    heldCardIds: [
      ...next.players[trade.toPlayerId].heldCardIds.filter((id) => !trade.requestCardIds.includes(id)),
      ...trade.offerCardIds,
    ],
  });
  return logEvent(next, 'Trade completed.');
}

// --- Turn management -------------------------------------------------------

/** Ends the current turn, unless the current player still owes another doubles-earned roll. Advances to the next non-spectating player. */
export function endTurn(state: GameState, rng: () => number = Math.random): GameState {
  if (state.pendingDecision || state.winnerId || state.rubberDuckEncounter || state.mtfEncounter) return state;
  const playerId = currentPlayerId(state);
  if (state.lastRollWasDoubles && !state.players[playerId].inJail) return state; // they go again

  let nextIndex = state.currentTurnIndex;
  let turnCount = state.turnCount;
  // Bounded to turnOrder.length attempts - if literally everyone is
  // spectating/AFK (a 1-player test game gone bankrupt, or some other
  // degenerate all-out-at-once case checkWinCondition didn't catch),
  // this must not spin forever: an unbounded loop here freezes the
  // entire tab, since JS never yields back to handle a click.
  for (let attempts = 0; attempts < state.turnOrder.length; attempts++) {
    nextIndex = (nextIndex + 1) % state.turnOrder.length;
    turnCount += 1;
    if (!state.players[state.turnOrder[nextIndex]].isSpectating && !state.players[state.turnOrder[nextIndex]].isAfkSpectating) {
      break;
    }
  }

  const cleared = updatePlayer(state, playerId, { usedTunnelTravelThisTurn: false });
  const next: GameState = {
    ...cleared,
    currentTurnIndex: nextIndex,
    lastRoll: null,
    lastRollWasDoubles: false,
    lastJailRedirect: null,
    turnCount,
  };
  // A real turn just ended (not a doubles-continuation) - the one place
  // hostile-anomaly "world events" tick: a new one might breach
  // containment, and any already loose ones take a step.
  const sculptureBefore = state.looseAnomalies.find((a) => a.anomalyId === 'theSculpture');
  let afterAnomalies = maybeBreachContainment(next, rng, playerId);
  // Skip the very tick it breaches on - a full round (back around to
  // whoever's turn it spawned on) has to actually pass before its first
  // move check, rather than potentially catching someone the instant
  // it's revealed.
  if (sculptureBefore) afterAnomalies = advanceUnwatchedSculpture(afterAnomalies, playerId);
  afterAnomalies = advanceHuntingAnomalies(afterAnomalies, rng);
  // scp173Watched can be set by anyone's Keep Watch during the round (see
  // keepWatchOnSculpture) - everyone's a potential target, so everyone
  // shares the job of watching it. It only actually gets read/consumed on
  // the one turn each round where SCP-173's move resolves (whoever's turn
  // it was when it breached), so it's only cleared then - any other
  // turn's end must leave it exactly as it was, or an early Keep Watch
  // earlier in the round would get wiped before it ever mattered.
  return sculptureBefore?.spawnedOnPlayerId === playerId ? { ...afterAnomalies, scp173Watched: false } : afterAnomalies;
}

/** Everyone's a potential target once SCP-173 is loose, so anyone can spend their turn keeping watch on it instead of rolling: no movement happens, but it freezes SCP-173 for the round's move check (whoever's turn it breached on - see endTurn). Only available to the current player, before they've rolled at all this turn, and only while SCP-173 is actually loose. */
export function keepWatchOnSculpture(state: GameState, playerId: string, rng: () => number = Math.random): GameState {
  if (state.pendingDecision || state.winnerId || state.rubberDuckEncounter || state.mtfEncounter) return state;
  if (currentPlayerId(state) !== playerId || state.lastRoll) return state;
  if (state.players[playerId].inJail) return state; // resolve the Containment Chamber the normal way first
  if (!state.looseAnomalies.some((a) => a.anomalyId === 'theSculpture')) return state;

  const watching = logEvent({ ...state, scp173Watched: true }, 'Kept watch on SCP-173 instead of taking a turn.');
  return endTurn(watching, rng);
}

// --- AFK handling ------------------------------------------------------

const MAX_CONSECUTIVE_AFK_SKIPS = 3;

/** Called when the current player hasn't confirmed they're still there in time - skips their turn, benching them as a spectator after too many skips in a row. */
export function afkSkipTurn(state: GameState): GameState {
  const playerId = currentPlayerId(state);
  const skips = state.players[playerId].consecutiveAfkSkips + 1;
  if (skips >= MAX_CONSECUTIVE_AFK_SKIPS) {
    const benched = updatePlayer(state, playerId, { isAfkSpectating: true, consecutiveAfkSkips: 0 });
    return endTurn(logEvent({ ...benched, pendingDecision: null }, 'Benched for inactivity.'));
  }
  return endTurn({ ...updatePlayer(state, playerId, { consecutiveAfkSkips: skips }), pendingDecision: null });
}

/** The current player confirming they're still here, resetting their AFK-skip streak. */
export function confirmStillHere(state: GameState, playerId: string): GameState {
  return updatePlayer(state, playerId, { consecutiveAfkSkips: 0 });
}

/** Rejoins a player who was only benched for being AFK (not a real Termination). */
export function rejoinFromAfk(state: GameState, playerId: string): GameState {
  if (!state.players[playerId].isAfkSpectating) return state;
  return updatePlayer(state, playerId, { isAfkSpectating: false });
}

// --- Dev panel helpers ---------------------------------------------------
// Host-only debugging tools (see components/DevPanel.tsx) - deliberately
// unrestricted by pendingDecision/turn order, since they exist to get a
// game into an otherwise-hard-to-reach state on demand.

export function devSetCredits(state: GameState, playerId: string, credits: number): GameState {
  return updatePlayer(state, playerId, { credits });
}

export function devSetForcedRoll(state: GameState, roll: [number, number] | null): GameState {
  return { ...state, forcedRoll: roll };
}

export function devSetForcedCard(state: GameState, cardId: string | null): GameState {
  return { ...state, forcedCardId: cardId };
}

/** Teleports a player straight to a tile and resolves landing there, same as a real move. */
export function devJumpToTile(state: GameState, playerId: string, tileId: number): GameState {
  return resolveLanding(updatePlayer(state, playerId, { position: tileId }), playerId, tileId);
}

/** Forces a player out of the game - assets return to the Foundation, same as declareBankruptcy with no creditor. */
export function devKickPlayer(state: GameState, playerId: string): GameState {
  let next: GameState = seizeAssets(state, playerId, null);
  next = updatePlayer(next, playerId, { credits: 0, isSpectating: true, ownedTileIds: [], heldCardIds: [] });
  if (next.pocketDimensionOrdeal?.trappedPlayerId === playerId) {
    // Otherwise SCP-106 stays 'inPocketDimension' forever with nobody able
    // to ever take the trapped player's turn again - a permanent softlock.
    next = { ...next, looseAnomalies: next.looseAnomalies.filter((a) => a.anomalyId !== 'theOldMan'), pocketDimensionOrdeal: null };
  }
  return checkWinCondition(logEvent(next, 'Kicked by the host.'));
}

export function devRevivePlayer(state: GameState, playerId: string): GameState {
  return updatePlayer({ ...state, winnerId: null }, playerId, { isSpectating: false, isAfkSpectating: false });
}

/** Forces the current turn to end right now, discarding any pending decision - a rescue tool for a genuinely stuck game. */
export function devForceSkipTurn(state: GameState, rng: () => number = Math.random): GameState {
  return endTurn({ ...state, pendingDecision: null, lastRollWasDoubles: false }, rng);
}

/** Forces a containment breach right now, bypassing the random per-turn chance - a no-op if that anomaly is already loose. */
export function devSpawnAnomaly(state: GameState, anomalyId: string): GameState {
  if (state.looseAnomalies.some((a) => a.anomalyId === anomalyId)) return state;
  const anomaly = findAnomaly(anomalyId as AnomalyId);
  const loose = spawnLooseAnomaly(state, anomaly, currentPlayerId(state));
  return logEvent({ ...state, looseAnomalies: [...state.looseAnomalies, loose] }, `[DEV] Forced a containment breach: ${anomaly.name}.`);
}

/** Instantly recontains every loose anomaly, free of charge and regardless of who owns the Site Warhead - a rescue tool, not the real purgeAnomalies. */
export function devRecontainAllAnomalies(state: GameState): GameState {
  if (state.looseAnomalies.length === 0) return state;
  // Also frees anyone currently trapped in SCP-106's Pocket Dimension -
  // otherwise looseAnomalies no longer has theOldMan in it at all, but
  // pocketDimensionOrdeal would still be set, soft-locking their turn
  // into a Pocket Dimension UI for an anomaly that's no longer loose.
  return logEvent({ ...state, looseAnomalies: [], pocketDimensionOrdeal: null }, '[DEV] Recontained every loose anomaly.');
}
