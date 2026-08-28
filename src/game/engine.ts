import { BOARD, BOARD_SIZE, getTile, RAILROAD_RENT_BY_COUNT } from '../data/board';
import { ANOMALOUS_EVENT_CARDS, FOUNDATION_DIRECTIVE_CARDS, findCard, type CardEffect } from '../data/cards';
import type { CardDeck, ColorGroup, GameState, GamePlayerState, PieceId, TradeOffer } from '../types/game';

const STARTING_CREDITS = 1500;
/** D-Class's "Standard Expendability Clause": reduced funding for the one-time requisitioned replacement. */
const RESPAWN_CREDITS = 750;
const GO_BONUS = 200;
const JAIL_POSITION = 10;
/** Classic Monopoly's jail fine - the Clearance Fee, per CONTEXT.md. */
const CLEARANCE_FEE = 50;
const MAX_DOUBLES_BEFORE_JAIL = 3;
/** Classic rule: after 3 turns stuck in the Containment Chamber without rolling doubles, you must pay the Clearance Fee and move. */
const MAX_TURNS_IN_JAIL = 3;
const PURPLE_SEIZE_GROUP: ColorGroup = 'purple';
// Standard Monopoly bank supply. Real Monopoly resolves a shortage with
// an auction between players - we don't have one, so running dry just
// blocks further building until someone sells houses back.
const STARTING_HOUSES = 32;
const STARTING_HOTELS = 12;
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
    const j = Math.floor(rng() * (i + 1));
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
 */
function chargePlayer(state: GameState, playerId: string, amount: number, creditorId: string | null): GameState {
  if (amount <= 0) return state;
  if (!canAfford(state, playerId, amount)) {
    return { ...state, pendingDecision: { type: 'debtSettlement', forPlayerId: playerId, amountOwed: amount, creditorId } };
  }
  let next = updatePlayer(state, playerId, { credits: state.players[playerId].credits - amount });
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

  const rollingOneDie = pieceOf(state, playerId) === 'thimble';
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
 * Charges the Clearance Fee (50 Credits), applying D-Class's standing
 * exemption ("Standard Expendability Clause") and Janitor's one-time
 * free pass ("Below the Floor Plan" - the master keyring). Returns the
 * resulting state either way - check .pendingDecision for whether a
 * debtSettlement opened instead of actually deducting anything.
 */
function chargeClearanceFee(state: GameState, playerId: string): GameState {
  const piece = pieceOf(state, playerId);
  if (piece === 'boot') {
    return logEvent(state, "No questions asked - D-Class isn't billed a Clearance Fee.");
  }
  if (piece === 'iron' && !state.players[playerId].usedMasterKey) {
    return updatePlayer(
      logEvent(state, 'Used the master keyring - no Clearance Fee.'),
      playerId,
      { usedMasterKey: true },
    );
  }
  return chargePlayer(state, playerId, CLEARANCE_FEE, null);
}

function resolveJailRoll(state: GameState, playerId: string, roll: [number, number], isDoubles: boolean): GameState {
  if (isDoubles) {
    const freed = updatePlayer(state, playerId, { inJail: false, turnsInJail: 0 });
    return moveAndResolve(logEvent(freed, 'Rolled doubles - released from the Containment Chamber.'), playerId, roll[0] + roll[1]);
  }

  const turnsInJail = state.players[playerId].turnsInJail + 1;
  if (turnsInJail >= MAX_TURNS_IN_JAIL) {
    const charged = chargeClearanceFee(
      logEvent(state, `Failed to roll doubles ${MAX_TURNS_IN_JAIL} times - must pay the Clearance Fee.`),
      playerId,
    );
    if (charged.pendingDecision) return charged; // couldn't afford it - debtSettlement takes over
    const freed = updatePlayer(charged, playerId, { inJail: false, turnsInJail: 0 });
    return moveAndResolve(freed, playerId, roll[0] + roll[1]);
  }

  return logEvent(updatePlayer(state, playerId, { turnsInJail }), 'Still in the Containment Chamber.');
}

/** Voluntarily pays the Clearance Fee to leave the Containment Chamber right away, before rolling. */
export function payClearanceFee(state: GameState, playerId: string): GameState {
  if (state.pendingDecision || !state.players[playerId].inJail) return state;
  if (currentPlayerId(state) !== playerId) return state;
  const charged = chargeClearanceFee(state, playerId);
  if (charged.pendingDecision) return charged;
  return updatePlayer(logEvent(charged, 'Paid the Clearance Fee.'), playerId, { inJail: false, turnsInJail: 0 });
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

function moveAndResolve(state: GameState, playerId: string, spaces: number): GameState {
  const player = state.players[playerId];
  const newPosition = ((player.position + spaces) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
  const passedGo = newPosition < player.position || spaces >= BOARD_SIZE;
  let next = updatePlayer(state, playerId, { position: newPosition });
  if (passedGo) next = giveCredits(logEvent(next, 'Passed the Site Entrance - collected 200 Credits.'), playerId, GO_BONUS);

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
    case 'card':
      return { ...next, pendingDecision: { type: 'awaitingCardDraw', deck: tile.deck } };
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

  const rent = calculateRent(state, tileId, owner);
  return logEvent(chargePlayer(state, playerId, rent, owner), `Paid ${rent} Credits rent.`);
}

function calculateRent(state: GameState, tileId: number, owner: string): number {
  const tile = getTile(tileId);
  if (tile.kind === 'wing') {
    const houses = state.houses[tileId] ?? 0;
    const baseRent = tile.rentTable[houses];
    if (houses === 0 && ownsFullSector(state, owner, tile.colorGroup)) return baseRent * 2;
    return baseRent;
  }
  if (tile.kind === 'tunnel') {
    return RAILROAD_RENT_BY_COUNT[Math.min(tunnelsOwnedBy(state, owner), 4) - 1] ?? RAILROAD_RENT_BY_COUNT[0];
  }
  // utility: 4x the roll if the owner has one, 10x if both
  const roll = state.lastRoll ? state.lastRoll[0] + state.lastRoll[1] : 0;
  return utilitiesOwnedBy(state, owner) >= 2 ? roll * 10 : roll * 4;
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
  const canChoose = (piece === 'car' && deck === 'anomalousEvent') || (piece === 'dog' && deck === 'foundationDirective');

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

  if (pieceOf(next, playerId) === 'cat') {
    return { ...next, pendingDecision: { type: 'catRedirect', cardId } };
  }

  next = { ...next, pendingDecision: { type: 'cardDrawn', cardId, forPlayerId: playerId } };
  return next;
}

/** Chaos Insurgency Spy's (Cat's) Special Power: keep the drawn card themselves, or hand its whole effect to another player instead. */
export function catRedirectCard(state: GameState, playerId: string, targetPlayerId: string | null): GameState {
  if (state.pendingDecision?.type !== 'catRedirect') return state;
  const { cardId } = state.pendingDecision;
  const forPlayerId = targetPlayerId && state.players[targetPlayerId] && targetPlayerId !== playerId ? targetPlayerId : playerId;
  return { ...state, pendingDecision: { type: 'cardDrawn', cardId, forPlayerId } };
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
      if (passedGo) next = giveCredits(next, playerId, GO_BONUS);
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

// --- Janitor's Special Power ---------------------------------------------

/**
 * "Below the Floor Plan": from one Maintenance Tunnel, Janitor moves
 * directly to any other one, replacing their roll for the turn - only
 * usable on their own turn, before they've rolled, not while in the
 * Containment Chamber (the tunnels don't help you there), and only
 * when they're currently standing on a Tunnel themselves - the service
 * corridors connect the tunnels to each other, not to the rest of the
 * board. Landing this way still resolves normally (an unowned Tunnel
 * can be bought), it just never charges Janitor rent - see
 * resolveOwnableLanding.
 */
export function useJanitorTunnelTravel(state: GameState, playerId: string, targetTileId: number): GameState {
  if (state.pendingDecision || state.winnerId) return state;
  if (currentPlayerId(state) !== playerId || pieceOf(state, playerId) !== 'iron') return state;
  if (state.players[playerId].inJail || state.lastRoll) return state;
  if (getTile(state.players[playerId].position).kind !== 'tunnel') return state;
  if (getTile(targetTileId).kind !== 'tunnel') return state;

  const next = updatePlayer(state, playerId, { position: targetTileId });
  return resolveLanding(logEvent(next, 'Used the service corridors to reach another Maintenance Tunnel.'), playerId, targetTileId);
}

// --- Houses & mortgages ------------------------------------------------

export function buildHouse(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'wing') return state;
  if (findOwner(state, tileId) !== playerId) return state;
  if (state.mortgagedTileIds.some((id) => tileIdsInSector(tile.colorGroup).includes(id))) return state;
  if (!ownsFullSector(state, playerId, tile.colorGroup)) return state;
  const houses = state.houses[tileId] ?? 0;
  if (houses >= 5) return state;
  const isHotel = houses === 4;
  if (isHotel && state.hotelsRemaining <= 0) return state;
  if (!isHotel && state.housesRemaining <= 0) return state;
  if (!canAfford(state, playerId, tile.houseCost)) return state;

  let next = chargePlayer(state, playerId, tile.houseCost, null);
  next = {
    ...next,
    houses: { ...next.houses, [tileId]: houses + 1 },
    housesRemaining: isHotel ? next.housesRemaining : next.housesRemaining - 1,
    hotelsRemaining: isHotel ? next.hotelsRemaining - 1 : next.hotelsRemaining,
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

  const next: GameState = {
    ...giveCredits(state, playerId, refund),
    houses: { ...state.houses, [tileId]: houses - 1 },
    housesRemaining: wasHotel ? state.housesRemaining + 4 : state.housesRemaining + 1,
    hotelsRemaining: wasHotel ? state.hotelsRemaining - 1 : state.hotelsRemaining,
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

/** Gives up rather than settling a debt: every asset (Credits, Wings, houses/hotels, mortgages, held cards) is either handed to the creditor (if a specific player) or returned to the Foundation, and this player is permanently out. */
export function declareBankruptcy(state: GameState, playerId: string): GameState {
  if (state.pendingDecision?.type !== 'debtSettlement' || state.pendingDecision.forPlayerId !== playerId) return state;
  const { creditorId } = state.pendingDecision;
  const player = state.players[playerId];

  let next: GameState = { ...state, pendingDecision: null };
  for (const tileId of [...player.ownedTileIds]) {
    const houses = next.houses[tileId] ?? 0;
    if (houses > 0) {
      // Houses/hotels always return to the bank's supply on bankruptcy,
      // even if the Wing itself goes to another player - matches the
      // real rule that you must sell all houses before going bankrupt
      // to another player (we don't enforce that directly, so this is
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
export function endTurn(state: GameState): GameState {
  if (state.pendingDecision || state.winnerId || state.rubberDuckEncounter) return state;
  const playerId = currentPlayerId(state);
  if (state.lastRollWasDoubles && !state.players[playerId].inJail) return state; // they go again

  let nextIndex = state.currentTurnIndex;
  let turnCount = state.turnCount;
  do {
    nextIndex = (nextIndex + 1) % state.turnOrder.length;
    turnCount += 1;
  } while (state.players[state.turnOrder[nextIndex]].isSpectating || state.players[state.turnOrder[nextIndex]].isAfkSpectating);

  return {
    ...state,
    currentTurnIndex: nextIndex,
    lastRoll: null,
    lastRollWasDoubles: false,
    lastJailRedirect: null,
    turnCount,
  };
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
  let next: GameState = state;
  for (const tileId of [...state.players[playerId].ownedTileIds]) {
    next = { ...next, houses: { ...next.houses, [tileId]: 0 }, mortgagedTileIds: next.mortgagedTileIds.filter((id) => id !== tileId) };
    next = transferTile(next, tileId, null);
  }
  next = updatePlayer(next, playerId, { credits: 0, isSpectating: true, ownedTileIds: [], heldCardIds: [] });
  return checkWinCondition(logEvent(next, 'Kicked by the host.'));
}

export function devRevivePlayer(state: GameState, playerId: string): GameState {
  return updatePlayer({ ...state, winnerId: null }, playerId, { isSpectating: false, isAfkSpectating: false });
}

/** Forces the current turn to end right now, discarding any pending decision - a rescue tool for a genuinely stuck game. */
export function devForceSkipTurn(state: GameState): GameState {
  return endTurn({ ...state, pendingDecision: null, lastRollWasDoubles: false });
}
