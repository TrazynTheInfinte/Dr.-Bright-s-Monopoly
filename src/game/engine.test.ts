import { describe, expect, it } from 'vitest';
import { getTile } from '../data/board';
import {
  acceptTrade,
  acknowledgeCard,
  acknowledgePocketDimensionLanding,
  afkSkipTurn,
  buildHouse,
  buyTile,
  catRedirectCard,
  chooseCardFromChoices,
  chooseNewPersonnel,
  confirmStillHere,
  createInitialGameState,
  declareBankruptcy,
  declinePurchase,
  declineTrade,
  devForceSkipTurn,
  devJumpToTile,
  devKickPlayer,
  devRecontainAllAnomalies,
  devRevivePlayer,
  devSetCredits,
  devSetForcedCard,
  devSetForcedRoll,
  devSpawnAnomaly,
  drawFromPile,
  endTurn,
  induceBreach,
  keepWatchOnSculpture,
  mortgageProperty,
  movePocketDimension,
  payEscapeFee,
  proposeTrade,
  purgeAnomalies,
  rejoinFromAfk,
  resolveMtfEncounter,
  resolveRubberDuckEncounter,
  rollDice,
  sellHouse,
  settleDebt,
  unmortgageProperty,
  useBadComposition,
  useCountermeasure,
  useGamersFuel,
  useGetOutOfJailCard,
  useJanitorTunnelTravel,
  viewAnomaly,
  withdrawTrade,
} from './engine';
import type { GamePlayerState, GameState, LooseAnomaly, PieceId, PocketDimensionTile } from '../types/game';

// Defaults to two Personnel with no passive Special Power side effects
// (Site Director's/Field Researcher's card-choice power only triggers
// via drawFromPile's canChoose path, which every card test here bypasses
// by using devSetForcedCard first) - so generic mechanics tests aren't
// quietly perturbed by D-Class/Battleship/Janitor/etc.'s own powers.
// Tests for a specific Personnel's power pass their own pieceIds.
function makeGame(pieceIds: PieceId[] = ['dog', 'car']): GameState {
  const assignments = pieceIds.map((pieceId, i) => ({ playerId: `p${i + 1}`, pieceId }));
  return createInitialGameState(assignments, () => 0.42);
}

function withPlayer(state: GameState, playerId: string, patch: Partial<GamePlayerState>): GameState {
  return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], ...patch } } };
}

// endTurn/devForceSkipTurn roll for a containment breach using whatever
// rng they're given - tests that don't care about anomalies pass this
// to keep results deterministic instead of relying on real Math.random.
const NO_BREACH_RNG = () => 1;

describe('createInitialGameState', () => {
  it('starts every player at the Site Entrance with 1500 Credits', () => {
    const game = makeGame();
    expect(game.turnOrder).toEqual(['p1', 'p2']);
    for (const id of game.turnOrder) {
      expect(game.players[id].position).toBe(0);
      expect(game.players[id].credits).toBe(1500);
      expect(game.players[id].ownedTileIds).toEqual([]);
    }
    expect(game.winnerId).toBeNull();
    expect(game.currentTurnIndex).toBe(0);
  });
});

describe('rolling and movement', () => {
  it('passing the Site Entrance collects 200 Credits', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 38 });
    game = devSetForcedRoll(game, [3, 0]);
    game = rollDice(game);
    expect(game.players.p1.position).toBe(1);
    expect(game.players.p1.credits).toBe(1700);
  });

  it("Intern (Thimble) rolls only one die", () => {
    let game = makeGame(['thimble', 'boot']);
    game = devSetForcedRoll(game, [4, 0]);
    game = rollDice(game);
    expect(game.lastRoll).toEqual([4, 0]);
    expect(game.players.p1.position).toBe(4);
  });

  it('Intern actually only consumes one rng draw while not yet graduated', () => {
    let game = makeGame(['thimble', 'boot']);
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0 : 5 / 6); // 1st draw -> die value 1; a 2nd draw would give 6
    game = rollDice(game, rng);
    expect(game.lastRoll).toEqual([1, 0]);
    expect(calls).toBe(1);
  });

  it('Intern graduates to rolling both dice after 3 laps past the Site Entrance', () => {
    let game = makeGame(['thimble', 'boot']);
    game = withPlayer(game, 'p1', { lapsCompleted: 3 });
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0 : 5 / 6); // 1st draw -> 1, 2nd draw -> 6
    game = rollDice(game, rng);
    expect(game.lastRoll).toEqual([1, 6]);
    expect(calls).toBe(2);
  });

  it("Intern's Unpaid Overtime tops up the Go bonus by an extra 50 Credits", () => {
    let game = makeGame(['thimble', 'boot']);
    game = withPlayer(game, 'p1', { position: 38 });
    game = devSetForcedRoll(game, [3, 0]);
    game = rollDice(game);
    expect(game.players.p1.position).toBe(1);
    expect(game.players.p1.credits).toBe(1500 + 250); // 200 base + 50 Unpaid Overtime
  });

  it('Intern tracks laps completed and logs graduation the moment the 3rd lap finishes', () => {
    let game = makeGame(['thimble', 'boot']);
    game = withPlayer(game, 'p1', { position: 38, lapsCompleted: 2 });
    game = devSetForcedRoll(game, [3, 0]);
    game = rollDice(game);
    expect(game.players.p1.lapsCompleted).toBe(3);
    expect(game.log[game.log.length - 1]).toContain('Cleared for full field duty');
  });

  it('rolling doubles three times in a row sends the player to the Containment Chamber', () => {
    // Each landing must stay on a tile with no pendingDecision (jail as
    // "just visiting", then Break Room) so the next forced roll isn't
    // blocked - only the 3rd doubles itself matters for this rule.
    let game = makeGame();
    game = devSetForcedRoll(game, [5, 5]);
    game = rollDice(game); // 1st doubles: 0 -> 10 (Containment Chamber, visiting)
    expect(game.players.p1.inJail).toBe(false);
    game = devSetForcedRoll(game, [5, 5]);
    game = rollDice(game); // 2nd doubles: 10 -> 20 (Break Room)
    expect(game.players.p1.inJail).toBe(false);
    game = devSetForcedRoll(game, [2, 2]);
    game = rollDice(game); // 3rd doubles - jailed instead of moving
    expect(game.players.p1.inJail).toBe(true);
    expect(game.players.p1.position).toBe(10);
  });

  it('landing on Reassigned sends the player to the Containment Chamber', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 28 });
    game = devSetForcedRoll(game, [2, 0]);
    game = rollDice(game);
    expect(game.players.p1.inJail).toBe(true);
    expect(game.players.p1.position).toBe(10);
  });
});

describe('the Containment Chamber', () => {
  it('rolling doubles releases the player and moves them', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { inJail: true, position: 10 });
    game = devSetForcedRoll(game, [3, 3]);
    game = rollDice(game);
    expect(game.players.p1.inJail).toBe(false);
    expect(game.players.p1.position).toBe(16);
  });

  it('charges the Holding Fee for each failed attempt, then releases for free on the 3rd', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { inJail: true, position: 10 });
    game = devSetForcedRoll(game, [1, 2]);
    game = rollDice(game); // attempt 1
    expect(game.players.p1.inJail).toBe(true);
    expect(game.players.p1.credits).toBe(1450);
    game = devSetForcedRoll(game, [1, 2]);
    game = rollDice(game); // attempt 2
    expect(game.players.p1.inJail).toBe(true);
    expect(game.players.p1.credits).toBe(1400);
    game = devSetForcedRoll(game, [1, 2]);
    game = rollDice(game); // attempt 3 - still charged for this turn, then released with no extra fee
    expect(game.players.p1.inJail).toBe(false);
    expect(game.players.p1.credits).toBe(1350);
    expect(game.players.p1.position).toBe(13);
  });

  it('paying the Escape Fee voluntarily leaves immediately', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { inJail: true, position: 10 });
    game = payEscapeFee(game, 'p1');
    expect(game.players.p1.inJail).toBe(false);
    expect(game.players.p1.credits).toBe(1300);
  });

  it('a held Get Out of Containment Free card releases the player for free', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { inJail: true, position: 10, heldCardIds: ['clearanceRevokedAnomalous'] });
    game = useGetOutOfJailCard(game, 'p1', 'clearanceRevokedAnomalous');
    expect(game.players.p1.inJail).toBe(false);
    expect(game.players.p1.credits).toBe(1500);
    expect(game.players.p1.heldCardIds).toEqual([]);
  });
});

describe('buying and rent', () => {
  it('buying an unowned Wing deducts its price and transfers ownership', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 1 });
    game = devSetForcedRoll(game, [1, 0]); // no-op roll just to land again isn't needed; simulate landing directly
    game = { ...game, pendingDecision: { type: 'purchase', tileId: 1 } };
    game = buyTile(game, 'p1');
    expect(game.players.p1.ownedTileIds).toEqual([1]);
    expect(game.players.p1.credits).toBe(1450);
    expect(game.pendingDecision).toBeNull();
  });

  it('declining a purchase leaves the tile unowned', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'purchase', tileId: 1 } };
    game = declinePurchase(game);
    expect(game.pendingDecision).toBeNull();
    expect(game.players.p1.ownedTileIds).toEqual([]);
  });

  it('landing on an owned Wing charges rent to the owner', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [6] });
    game = withPlayer(game, 'p2', { position: 5 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [1, 0]);
    game = rollDice(game);
    expect(game.players.p2.credits).toBe(1494); // 6 rent at 0 houses
    expect(game.players.p1.credits).toBe(1506);
  });

  it('rent doubles on an unimproved Wing if the owner has the full Sector', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] });
    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [1, 0]);
    game = rollDice(game);
    expect(game.players.p2.credits).toBe(1500 - 4); // tile 1 rent (2) doubled to 4
  });

  it('Maintenance Tunnel rent scales with how many the owner has', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [5, 15] });
    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [5, 0]);
    game = rollDice(game);
    expect(game.players.p2.credits).toBe(1500 - 50); // 2 owned = 50 rent
  });

  it('utility rent is 4x the dice roll with one owned, 10x with both', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [12] });
    game = withPlayer(game, 'p2', { position: 8 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [2, 2]);
    game = rollDice(game); // lands on 12, rolled 4 total -> 4x4=16... but doubles also moves again
    expect(game.players.p2.credits).toBe(1500 - 16);
  });

  it("D-Class (Boot) buys utilities at half price", () => {
    let game = makeGame(['boot', 'battleship']);
    game = withPlayer(game, 'p1', { position: 12 });
    game = { ...game, pendingDecision: { type: 'purchase', tileId: 12 } };
    game = buyTile(game, 'p1');
    expect(game.players.p1.credits).toBe(1500 - 75);
  });

  it('MTF Operative (Battleship) buys Maintenance Tunnels at half price', () => {
    let game = makeGame(['battleship', 'boot']);
    game = { ...game, pendingDecision: { type: 'purchase', tileId: 5 } };
    game = buyTile(game, 'p1');
    expect(game.players.p1.credits).toBe(1500 - 100);
  });
});

describe('houses and mortgages', () => {
  it('building a house costs Credits and increases the Wing rent tier', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] });
    game = buildHouse(game, 'p1', 1);
    expect(game.houses[1]).toBe(1);
    expect(game.players.p1.credits).toBe(1500 - 50);
    expect(game.housesRemaining).toBe(15);
  });

  it('refuses to build without owning the full Sector', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = buildHouse(game, 'p1', 1);
    expect(game.houses[1] ?? 0).toBe(0);
  });

  it('selling a house refunds half its cost', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] });
    game = buildHouse(game, 'p1', 1);
    game = sellHouse(game, 'p1', 1);
    expect(game.houses[1]).toBe(0);
    expect(game.players.p1.credits).toBe(1500 - 50 + 25);
  });

  it('mortgaging pays half price and blocks rent collection', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = mortgageProperty(game, 'p1', 1);
    expect(game.players.p1.credits).toBe(1525);
    expect(game.mortgagedTileIds).toContain(1);

    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [1, 0]);
    game = rollDice(game);
    expect(game.players.p2.credits).toBe(1500); // no rent - mortgaged
  });

  it('paying off a mortgage costs the payout plus 10% interest', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = mortgageProperty(game, 'p1', 1);
    game = unmortgageProperty(game, 'p1', 1);
    expect(game.mortgagedTileIds).not.toContain(1);
    expect(game.players.p1.credits).toBe(1500 + 25 - Math.ceil(25 * 1.1));
  });
});

describe('cards', () => {
  it('a collect-effect card pays out to the drawer', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'hazardPayBonus');
    game = drawFromPile(game, 'p1');
    expect(game.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'hazardPayBonus', forPlayerId: 'p1' });
    game = acknowledgeCard(game);
    expect(game.players.p1.credits).toBe(1550);
    expect(game.pendingDecision).toBeNull();
  });

  it('a moveTo-effect card relocates the player and can award passing the Site Entrance', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 35 });
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'realityAnchorMalfunction'); // moveTo tile 0
    game = drawFromPile(game, 'p1');
    game = acknowledgeCard(game);
    expect(game.players.p1.position).toBe(0);
    expect(game.players.p1.credits).toBe(1700);
  });

  it('a goToJail-effect card sends the player to the Containment Chamber', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'foundationDirective' } };
    game = devSetForcedCard(game, 'reassignedToContainmentDuty');
    game = drawFromPile(game, 'p1');
    game = acknowledgeCard(game);
    expect(game.players.p1.inJail).toBe(true);
    expect(game.players.p1.position).toBe(10);
  });

  it('a getOutOfJailFree-effect card is held rather than resolved immediately', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'clearanceRevokedAnomalous');
    game = drawFromPile(game, 'p1');
    game = acknowledgeCard(game);
    expect(game.players.p1.heldCardIds).toEqual(['clearanceRevokedAnomalous']);
  });

  it('collectFromEachPlayer takes Credits from every other active player', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'foundationDirective' } };
    game = devSetForcedCard(game, 'foundersDayGala');
    game = drawFromPile(game, 'p1');
    game = acknowledgeCard(game);
    expect(game.players.p1.credits).toBe(1550);
    expect(game.players.p2.credits).toBe(1450);
  });

  it("Site Director (Car) chooses which card to draw from an Anomalous Event tile", () => {
    let game = makeGame(['car', 'boot']);
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = drawFromPile(game, 'p1');
    expect(game.pendingDecision?.type).toBe('cardChoice');
    const choiceIds = game.pendingDecision?.type === 'cardChoice' ? game.pendingDecision.choiceCardIds : [];
    expect(choiceIds.length).toBeGreaterThan(0);
    game = chooseCardFromChoices(game, 'p1', choiceIds[0]);
    // Site Director's own "Redirect Without Exposure" also offers a
    // redirect choice on the card they just picked - see the dedicated
    // describe block below for that power specifically.
    expect(game.pendingDecision?.type).toBe('catRedirect');
  });

  it('Chaos Insurgency Spy (Cat) can hand a drawn card off to another player', () => {
    let game = makeGame(['cat', 'boot']);
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'hazardPayBonus');
    game = drawFromPile(game, 'p1');
    expect(game.pendingDecision?.type).toBe('catRedirect');
    game = catRedirectCard(game, 'p1', 'p2');
    expect(game.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'hazardPayBonus', forPlayerId: 'p2' });
    game = acknowledgeCard(game);
    expect(game.players.p2.credits).toBe(1550);
    expect(game.players.p1.credits).toBe(1500);
  });
});

describe('special powers', () => {
  it('Logistics Officer (Wheel Barrel) auto-requisitions an unowned purple Wing', () => {
    let game = makeGame(['wheelBarrel', 'boot']);
    game = withPlayer(game, 'p1', { position: 0 });
    game = devSetForcedRoll(game, [1, 0]);
    game = rollDice(game);
    expect(game.players.p1.ownedTileIds).toEqual([1]);
    expect(game.players.p1.credits).toBe(1500); // free
  });

  it("Rogue Anomaly (T-Rex) can't buy but auto-seizes an owned Wing with no rent paid", () => {
    let game = makeGame(['trex', 'boot']);
    game = withPlayer(game, 'p2', { ownedTileIds: [6] });
    game = withPlayer(game, 'p1', { position: 0 });
    game = devSetForcedRoll(game, [6, 0]);
    game = rollDice(game);
    expect(game.players.p1.ownedTileIds).toEqual([6]);
    expect(game.players.p2.ownedTileIds).toEqual([]);
    expect(game.players.p1.credits).toBe(1500);
  });

  it("Security Officer (Rubber Duck) can send an occupant to the Containment Chamber", () => {
    let game = makeGame(['rubberDuck', 'boot']);
    game = withPlayer(game, 'p2', { position: 5 });
    game = withPlayer(game, 'p1', { position: 0 });
    game = devSetForcedRoll(game, [5, 0]);
    game = rollDice(game);
    expect(game.rubberDuckEncounter).toEqual({ rubberDuckPlayerId: 'p1', targetPlayerId: 'p2' });
    game = resolveRubberDuckEncounter(game, true);
    expect(game.players.p2.inJail).toBe(true);
    expect(game.rubberDuckEncounter).toBeNull();
  });

  it('Site Administrator (Hat) gets a free house on completing a Sector', () => {
    let game = makeGame(['hat', 'boot']);
    game = withPlayer(game, 'p1', { position: 1, ownedTileIds: [3] });
    game = { ...game, pendingDecision: { type: 'purchase', tileId: 1 } };
    game = buyTile(game, 'p1');
    expect(game.houses[1] ?? game.houses[3]).toBe(1);
    expect(game.hatFreeHouseSectors).toContain('purple');
  });
});

describe("Administrator's Zoning Authority", () => {
  it('can build on a partial Sector, capped at one house per Wing owned', () => {
    let game = makeGame(['hat', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [6] }); // lightBlue Sector has 3 Wings: 6, 8, 9
    game = buildHouse(game, 'p1', 6);
    expect(game.houses[6]).toBe(1);
    const before = game;
    game = buildHouse(game, 'p1', 6); // a 2nd house would exceed the 1-Wing cap
    expect(game).toEqual(before);
  });

  it('the cap rises as Administrator owns more Wings in the Sector', () => {
    let game = makeGame(['hat', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [6, 8] });
    game = buildHouse(game, 'p1', 6);
    game = buildHouse(game, 'p1', 8);
    expect(game.houses[6]).toBe(1);
    expect(game.houses[8]).toBe(1);
    const before = game;
    game = buildHouse(game, 'p1', 6); // a 3rd house total would exceed the 2-Wing cap
    expect(game).toEqual(before);
  });

  it('normal building rules (no cap) apply once the Sector is fully owned', () => {
    let game = makeGame(['hat', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] }); // purple Sector, fully owned
    game = buildHouse(game, 'p1', 1);
    game = buildHouse(game, 'p1', 1);
    expect(game.houses[1]).toBe(2);
  });

  it("a non-Administrator still can't build without the full Sector", () => {
    let game = makeGame(['boot', 'hat']);
    game = withPlayer(game, 'p1', { ownedTileIds: [6] });
    const before = game;
    game = buildHouse(game, 'p1', 6);
    expect(game).toEqual(before);
  });
});

describe("MTF Operative's Rapid Deployment and Show of Force", () => {
  it('doubles rent collected on an owned Maintenance Tunnel', () => {
    let game = makeGame(['battleship', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [5] });
    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [5, 0]);
    game = rollDice(game);
    expect(game.players.p2.credits).toBe(1500 - 50); // 25 base for 1 owned, doubled
  });

  it('opens a Show of Force choice instead of charging rent on an owned Wing', () => {
    let game = makeGame(['battleship', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [1, 0]);
    game = rollDice(game);
    expect(game.mtfEncounter).toEqual({ mtfPlayerId: 'p1', targetPlayerId: 'p2', tileId: 1 });
    expect(game.players.p2.credits).toBe(1500); // not charged yet
  });

  it('collecting rent resolves the encounter normally', () => {
    let game = makeGame(['battleship', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, mtfEncounter: { mtfPlayerId: 'p1', targetPlayerId: 'p2', tileId: 1 } };
    game = resolveMtfEncounter(game, false);
    expect(game.mtfEncounter).toBeNull();
    expect(game.players.p2.credits).toBe(1500 - 2);
    expect(game.players.p1.usedShowOfForce).toBe(false);
  });

  it('seizing takes one of the other player\'s Wings/Tunnels instead of rent, once per game', () => {
    let game = makeGame(['battleship', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = withPlayer(game, 'p2', { position: 0, ownedTileIds: [6] });
    game = { ...game, mtfEncounter: { mtfPlayerId: 'p1', targetPlayerId: 'p2', tileId: 1 } };
    game = resolveMtfEncounter(game, true);
    expect(game.players.p1.ownedTileIds).toEqual([1, 6]);
    expect(game.players.p2.ownedTileIds).toEqual([]);
    expect(game.players.p2.credits).toBe(1500); // no rent paid either
    expect(game.players.p1.usedShowOfForce).toBe(true);

    // A second landing no longer offers the choice at all.
    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, currentTurnIndex: 1 };
    game = devSetForcedRoll(game, [1, 0]);
    game = rollDice(game);
    expect(game.mtfEncounter).toBeNull();
    expect(game.players.p2.credits).toBe(1500 - 2);
  });

  it('seizing with nothing else to take still burns the one-time use', () => {
    let game = makeGame(['battleship', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = withPlayer(game, 'p2', { position: 0 });
    game = { ...game, mtfEncounter: { mtfPlayerId: 'p1', targetPlayerId: 'p2', tileId: 1 } };
    game = resolveMtfEncounter(game, true);
    expect(game.players.p1.usedShowOfForce).toBe(true);
    expect(game.players.p2.credits).toBe(1500);
  });
});

describe("Site Director's Executive Authority and Redirect Without Exposure", () => {
  it('can choose a card from either deck', () => {
    let game = makeGame(['car', 'boot']);
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'foundationDirective' } };
    game = drawFromPile(game, 'p1');
    expect(game.pendingDecision?.type).toBe('cardChoice');
  });

  it('can redirect a drawn card once per game', () => {
    let game = makeGame(['car', 'boot']);
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'hazardPayBonus');
    game = drawFromPile(game, 'p1');
    expect(game.pendingDecision?.type).toBe('catRedirect');
    game = catRedirectCard(game, 'p1', 'p2');
    expect(game.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'hazardPayBonus', forPlayerId: 'p2' });
    expect(game.players.p1.usedRedirect).toBe(true);
  });

  it('keeping the card themselves does not use up the once-per-game redirect', () => {
    let game = makeGame(['car', 'boot']);
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'hazardPayBonus');
    game = drawFromPile(game, 'p1');
    game = catRedirectCard(game, 'p1', null);
    expect(game.players.p1.usedRedirect).toBe(false);
  });

  it('draws normally, with no redirect choice, once the one-time use is spent', () => {
    let game = makeGame(['car', 'boot']);
    game = withPlayer(game, 'p1', { usedRedirect: true });
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'hazardPayBonus');
    game = drawFromPile(game, 'p1');
    expect(game.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'hazardPayBonus', forPlayerId: 'p1' });
  });
});

describe("Field Researcher's Grant Funding", () => {
  it('collects a stipend landing on either card tile, on top of the card itself', () => {
    let game = makeGame(['dog', 'boot']);
    game = withPlayer(game, 'p1', { position: 1 }); // 1 -> 4 lands on a Foundation Directive tile
    game = devSetForcedRoll(game, [3, 0]);
    game = rollDice(game);
    expect(game.players.p1.credits).toBe(1500 + 100);
    expect(game.pendingDecision?.type).toBe('awaitingCardDraw');
  });

  it('is not collected by anyone else landing on a card tile', () => {
    let game = makeGame(['boot', 'battleship']);
    game = withPlayer(game, 'p1', { position: 1 });
    game = devSetForcedRoll(game, [3, 0]);
    game = rollDice(game);
    expect(game.players.p1.credits).toBe(1500);
  });
});

describe("Logistics Officer's Bulk Requisition and Overstock", () => {
  it('builds houses at a 25% discount', () => {
    let game = makeGame(['wheelBarrel', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] });
    game = buildHouse(game, 'p1', 1);
    expect(game.players.p1.credits).toBe(1500 - Math.floor(50 * 0.75));
  });

  it('can still build once the shared supply is exhausted, without drawing from it', () => {
    let game = makeGame(['wheelBarrel', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] });
    game = { ...game, housesRemaining: 0 };
    game = buildHouse(game, 'p1', 1);
    expect(game.houses[1]).toBe(1);
    expect(game.housesRemaining).toBe(0); // unchanged - never drew from the shared pool
  });

  it('selling an Overstock build does not inflate the shared supply', () => {
    let game = makeGame(['wheelBarrel', 'boot']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] });
    game = buildHouse(game, 'p1', 1);
    expect(game.housesRemaining).toBe(16); // untouched by the build
    game = sellHouse(game, 'p1', 1);
    expect(game.houses[1]).toBe(0);
    expect(game.housesRemaining).toBe(16); // still untouched
  });

  it("a normal player's builds are unaffected by Overstock", () => {
    let game = makeGame(['boot', 'wheelBarrel']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1, 3] });
    game = buildHouse(game, 'p1', 1);
    expect(game.players.p1.credits).toBe(1500 - 50); // full price
    expect(game.housesRemaining).toBe(15); // drawn from the shared pool as normal
  });
});

describe("Specialist's Standard Containment Procedure and Redundant Safeguards", () => {
  it('pays 25% less rent on an owned Wing', () => {
    let game = makeGame(['penguin', 'boot']);
    game = withPlayer(game, 'p2', { ownedTileIds: [6] });
    game = withPlayer(game, 'p1', { position: 0 });
    game = devSetForcedRoll(game, [6, 0]);
    game = rollDice(game);
    expect(game.players.p1.credits).toBe(1500 - Math.floor(6 * 0.75));
  });

  it('pays 25% less rent on a Maintenance Tunnel', () => {
    let game = makeGame(['penguin', 'boot']);
    game = withPlayer(game, 'p2', { ownedTileIds: [5] });
    game = withPlayer(game, 'p1', { position: 0 });
    game = devSetForcedRoll(game, [5, 0]);
    game = rollDice(game);
    expect(game.players.p1.credits).toBe(1500 - Math.floor(25 * 0.75));
  });

  it('does not discount utility rent', () => {
    let game = makeGame(['penguin', 'boot']);
    game = withPlayer(game, 'p2', { ownedTileIds: [12] });
    game = withPlayer(game, 'p1', { position: 8 });
    game = devSetForcedRoll(game, [2, 2]);
    game = rollDice(game);
    expect(game.players.p1.credits).toBe(1500 - 16); // full 4x the roll, no discount
  });

  it('an emergency grant covers a forced payment that would otherwise be unaffordable', () => {
    let game = makeGame(['penguin', 'boot']);
    game = withPlayer(game, 'p1', { inJail: true, position: 10, credits: 10 });
    game = payEscapeFee(game, 'p1');
    expect(game.players.p1.usedSafeguard).toBe(true);
    expect(game.players.p1.credits).toBe(10 + 300 - 200);
    expect(game.players.p1.inJail).toBe(false);
    expect(game.pendingDecision).toBeNull();
  });

  it('only grants the emergency safeguard once per game', () => {
    let game = makeGame(['penguin', 'boot']);
    game = withPlayer(game, 'p1', { inJail: true, position: 10, credits: 10, usedSafeguard: true });
    game = payEscapeFee(game, 'p1');
    expect(game.pendingDecision).toEqual({ type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 200, creditorId: null });
    expect(game.players.p1.credits).toBe(10);
  });

  it("still opens a debtSettlement if the emergency grant isn't enough", () => {
    let game = makeGame(['penguin', 'boot']);
    game = withPlayer(game, 'p1', {
      credits: 0,
      ownedTileIds: [1, 3, 6, 8, 9],
      position: 0,
    });
    game = { ...game, houses: { 1: 5, 3: 5, 6: 5, 8: 5, 9: 5 } }; // 5 hotels, 500 owed
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'structuralDamageAssessment');
    game = drawFromPile(game, 'p1');
    game = acknowledgeCard(game);
    expect(game.players.p1.usedSafeguard).toBe(true);
    expect(game.players.p1.credits).toBe(300); // the grant landed, just wasn't enough
    expect(game.pendingDecision).toEqual({ type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 500, creditorId: null });
  });
});

describe("D-Class's Standard Expendability Clause", () => {
  it('is never billed the Escape Fee', () => {
    let game = makeGame(['boot', 'battleship']);
    game = withPlayer(game, 'p1', { inJail: true, position: 10 });
    game = payEscapeFee(game, 'p1');
    expect(game.players.p1.credits).toBe(1500);
    expect(game.players.p1.inJail).toBe(false);
  });

  it('is never billed the Holding Fee', () => {
    let game = makeGame(['boot', 'battleship']);
    game = withPlayer(game, 'p1', { inJail: true, position: 10 });
    game = devSetForcedRoll(game, [1, 2]);
    game = rollDice(game);
    expect(game.players.p1.credits).toBe(1500);
    expect(game.players.p1.inJail).toBe(true);
  });

  it('survives its first Termination by respawning with reduced Credits', () => {
    let game = makeGame(['boot', 'battleship']);
    game = withPlayer(game, 'p1', { ownedTileIds: [1], credits: 5 });
    game = { ...game, pendingDecision: { type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 999, creditorId: null } };
    game = declareBankruptcy(game, 'p1');
    expect(game.players.p1.isSpectating).toBe(false);
    expect(game.players.p1.credits).toBe(750);
    expect(game.players.p1.position).toBe(0);
    expect(game.players.p1.ownedTileIds).toEqual([]);
    expect(game.players.p1.usedExpendabilityClause).toBe(true);
    expect(game.winnerId).toBeNull();
  });

  it('is Terminated for real the second time', () => {
    let game = makeGame(['boot', 'battleship']);
    game = withPlayer(game, 'p1', { credits: 5, usedExpendabilityClause: true });
    game = { ...game, pendingDecision: { type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 999, creditorId: null } };
    game = declareBankruptcy(game, 'p1');
    expect(game.players.p1.isSpectating).toBe(true);
    expect(game.winnerId).toBe('p2');
  });
});

describe("Janitor's Below the Floor Plan", () => {
  it('leaves the Containment Chamber for free once, using the master keyring', () => {
    let game = makeGame(['iron', 'boot']);
    game = withPlayer(game, 'p1', { inJail: true, position: 10 });
    game = payEscapeFee(game, 'p1');
    expect(game.players.p1.credits).toBe(1500);
    expect(game.players.p1.usedMasterKey).toBe(true);
    expect(game.players.p1.inJail).toBe(false);
  });

  it('pays the normal Escape Fee once the master keyring is already used', () => {
    let game = makeGame(['iron', 'boot']);
    game = withPlayer(game, 'p1', { inJail: true, position: 10, usedMasterKey: true });
    game = payEscapeFee(game, 'p1');
    expect(game.players.p1.credits).toBe(1500 - 200);
  });

  it('moves directly to a chosen Maintenance Tunnel from another one', () => {
    let game = makeGame(['iron', 'boot']);
    game = withPlayer(game, 'p1', { position: 5 });
    game = useJanitorTunnelTravel(game, 'p1', 15);
    expect(game.players.p1.position).toBe(15);
    expect(game.pendingDecision).toEqual({ type: 'purchase', tileId: 15 });
  });

  it('refuses to travel unless currently standing on a Maintenance Tunnel', () => {
    let game = makeGame(['iron', 'boot']);
    const before = game; // starts at position 0 (the Site Entrance), not a tunnel
    game = useJanitorTunnelTravel(game, 'p1', 15);
    expect(game).toEqual(before);
  });

  it('never pays toll on a Maintenance Tunnel someone else owns', () => {
    let game = makeGame(['iron', 'boot']);
    game = withPlayer(game, 'p1', { position: 25 });
    game = withPlayer(game, 'p2', { ownedTileIds: [5] });
    game = useJanitorTunnelTravel(game, 'p1', 5);
    expect(game.players.p1.credits).toBe(1500);
    expect(game.pendingDecision).toBeNull();
  });

  it('can only be used once per turn', () => {
    let game = makeGame(['iron', 'boot']);
    game = withPlayer(game, 'p1', { position: 5 });
    game = useJanitorTunnelTravel(game, 'p1', 15);
    expect(game.players.p1.position).toBe(15);
    expect(game.players.p1.usedTunnelTravelThisTurn).toBe(true);
    game = declinePurchase(game);
    const before = game;
    game = useJanitorTunnelTravel(game, 'p1', 25);
    expect(game).toEqual(before);
  });

  it('resets the once-per-turn limit once the turn actually ends', () => {
    let game = makeGame(['iron', 'boot']);
    game = withPlayer(game, 'p1', { position: 5, usedTunnelTravelThisTurn: true });
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.players.p1.usedTunnelTravelThisTurn).toBe(false);
  });

  it("refuses to travel once the player has already rolled this turn", () => {
    let game = makeGame(['iron', 'boot']);
    game = withPlayer(game, 'p1', { position: 5 });
    game = devSetForcedRoll(game, [2, 3]);
    game = rollDice(game); // 5 -> 10, Containment Chamber (just visiting, no decision)
    const before = game;
    game = useJanitorTunnelTravel(game, 'p1', 15);
    expect(game).toEqual(before);
  });
});

describe('trading', () => {
  it('accepting a trade exchanges Wings and Credits between both players', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1], credits: 1000 });
    game = withPlayer(game, 'p2', { ownedTileIds: [6], credits: 1000 });
    game = proposeTrade(game, {
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      offerTileIds: [1],
      offerCredits: 50,
      offerCardIds: [],
      requestTileIds: [6],
      requestCredits: 0,
      requestCardIds: [],
    });
    expect(game.activeTrades).toHaveLength(1);
    game = acceptTrade(game, game.activeTrades[0].id);
    expect(game.players.p1.ownedTileIds).toEqual([6]);
    expect(game.players.p2.ownedTileIds).toEqual([1]);
    expect(game.players.p1.credits).toBe(950);
    expect(game.players.p2.credits).toBe(1050);
    expect(game.activeTrades).toHaveLength(0);
  });

  it('declining or withdrawing a trade removes it without side effects', () => {
    let game = makeGame();
    game = proposeTrade(game, {
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      offerTileIds: [],
      offerCredits: 10,
      offerCardIds: [],
      requestTileIds: [],
      requestCredits: 0,
      requestCardIds: [],
    });
    const tradeId = game.activeTrades[0].id;
    game = declineTrade(game, tradeId);
    expect(game.activeTrades).toHaveLength(0);
    expect(game.players.p1.credits).toBe(1500);

    game = proposeTrade(game, {
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      offerTileIds: [],
      offerCredits: 10,
      offerCardIds: [],
      requestTileIds: [],
      requestCredits: 0,
      requestCardIds: [],
    });
    game = withdrawTrade(game, game.activeTrades[0].id);
    expect(game.activeTrades).toHaveLength(0);
  });
});

describe('debt and bankruptcy', () => {
  it('an unaffordable charge opens a debtSettlement decision instead of deducting anything', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { credits: 10 });
    game = withPlayer(game, 'p1', { position: 10, inJail: true });
    game = payEscapeFee(game, 'p1'); // 200 owed, only has 10
    expect(game.pendingDecision).toEqual({ type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 200, creditorId: null });
    expect(game.players.p1.credits).toBe(10);
  });

  it('settleDebt pays off the debt once the player can afford it', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 50, creditorId: null } };
    game = withPlayer(game, 'p1', { credits: 100 });
    game = settleDebt(game, 'p1');
    expect(game.pendingDecision).toBeNull();
    expect(game.players.p1.credits).toBe(50);
  });

  it('declareBankruptcy to the bank returns Wings to the Foundation and Terminates the player', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1], credits: 10 });
    game = { ...game, houses: { 1: 2 }, housesRemaining: 14, pendingDecision: { type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 999, creditorId: null } };
    game = declareBankruptcy(game, 'p1');
    expect(game.players.p1.isSpectating).toBe(true);
    expect(game.players.p1.credits).toBe(0);
    expect(game.players.p1.ownedTileIds).toEqual([]);
    expect(game.houses[1]).toBe(0);
    expect(game.housesRemaining).toBe(16);
    expect(game.winnerId).toBe('p2'); // only one player left standing
  });

  it('declareBankruptcy to a player hands over the debtor Credits and Wings', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1], credits: 25 });
    game = { ...game, pendingDecision: { type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 999, creditorId: 'p2' } };
    game = declareBankruptcy(game, 'p1');
    expect(game.players.p2.ownedTileIds).toEqual([1]);
    expect(game.players.p2.credits).toBe(1525);
    expect(game.players.p1.isSpectating).toBe(true);
  });
});

describe('AFK handling', () => {
  it('repeated AFK skips eventually bench the player as a spectator', () => {
    let game = makeGame();
    game = afkSkipTurn(game);
    expect(game.players.p1.consecutiveAfkSkips).toBe(1);
    expect(game.players.p1.isAfkSpectating).toBe(false);

    game = { ...game, currentTurnIndex: 0 };
    game = afkSkipTurn(game);
    game = { ...game, currentTurnIndex: 0 };
    game = afkSkipTurn(game);
    expect(game.players.p1.isAfkSpectating).toBe(true);
  });

  it('confirming presence resets the AFK-skip streak', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { consecutiveAfkSkips: 2 });
    game = confirmStillHere(game, 'p1');
    expect(game.players.p1.consecutiveAfkSkips).toBe(0);
  });

  it('rejoinFromAfk un-benches a player without touching Credits/Wings', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { isAfkSpectating: true, credits: 900 });
    game = rejoinFromAfk(game, 'p1');
    expect(game.players.p1.isAfkSpectating).toBe(false);
    expect(game.players.p1.credits).toBe(900);
  });
});

describe('dev panel helpers', () => {
  it('devSetCredits sets a player\'s balance directly', () => {
    let game = makeGame();
    game = devSetCredits(game, 'p1', 42);
    expect(game.players.p1.credits).toBe(42);
  });

  it('devJumpToTile teleports and resolves landing', () => {
    let game = makeGame();
    game = devJumpToTile(game, 'p1', 1);
    expect(game.players.p1.position).toBe(1);
    expect(game.pendingDecision).toEqual({ type: 'purchase', tileId: 1 });
  });

  it('devKickPlayer returns assets to the Foundation and Terminates the player', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = devKickPlayer(game, 'p1');
    expect(game.players.p1.isSpectating).toBe(true);
    expect(getTile(1)).toBeDefined(); // tile itself is unaffected, just unowned now
    expect(game.winnerId).toBe('p2');
  });

  it('devRevivePlayer clears spectating flags', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { isSpectating: true });
    game = devRevivePlayer(game, 'p1');
    expect(game.players.p1.isSpectating).toBe(false);
  });

  it('devSpawnAnomaly forces a breach, ignoring the random chance', () => {
    let game = makeGame();
    game = devSpawnAnomaly(game, 'shyGuy');
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
  });

  it("devSpawnAnomaly won't spawn a second copy of one already loose", () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 5, status: 'hunting', targetPlayerId: 'p1', breachedOnTurnCount: 0 }]);
    game = devSpawnAnomaly(game, 'shyGuy');
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'shyGuy', tileId: 5, status: 'hunting', targetPlayerId: 'p1', breachedOnTurnCount: 0 }]);
  });

  it('devRecontainAllAnomalies clears every loose anomaly for free', () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 5, status: 'hunting', targetPlayerId: 'p1', breachedOnTurnCount: 0 }]);
    game = devRecontainAllAnomalies(game);
    expect(game.looseAnomalies).toEqual([]);
  });

  it('devForceSkipTurn ends the turn even mid-decision', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'purchase', tileId: 1 } };
    game = devForceSkipTurn(game, NO_BREACH_RNG);
    expect(game.pendingDecision).toBeNull();
    expect(game.currentTurnIndex).toBe(1);
  });
});

describe('ending a turn', () => {
  it('a non-doubles roll requires endTurn to advance to the next player', () => {
    let game = makeGame();
    game = devSetForcedRoll(game, [4, 6]); // 0 -> 10, Containment Chamber (just visiting, no decision)
    game = rollDice(game);
    expect(game.currentTurnIndex).toBe(0);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.currentTurnIndex).toBe(1);
  });

  it('doubles grant another roll instead of ending the turn', () => {
    let game = makeGame();
    game = devSetForcedRoll(game, [5, 5]); // 0 -> 10, Containment Chamber (just visiting, no decision)
    game = rollDice(game);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.currentTurnIndex).toBe(0); // still p1's turn
  });

  it('returns instead of hanging forever if every player ends up spectating', () => {
    // Regression test: a real 1-player (or otherwise fully-out) game
    // used to freeze the whole tab here - an unbounded do-while loop
    // searching for "the next non-spectating player" that doesn't
    // exist never terminates, and JS never yields back to handle a
    // click once it starts. If this test doesn't hang, the fix holds.
    let game = makeGame();
    game = withPlayer(game, 'p1', { isSpectating: true });
    game = withPlayer(game, 'p2', { isSpectating: true });
    game = endTurn(game, NO_BREACH_RNG);
    expect(game).toBeDefined();
  });
});

function withLooseAnomalies(state: GameState, anomalies: LooseAnomaly[]): GameState {
  return { ...state, looseAnomalies: anomalies };
}

describe('hostile anomalies', () => {
  it('a lucky roll breaches containment and spawns Shy Guy dormant at its spawn tile', () => {
    let game = makeGame();
    game = endTurn(game, () => 0); // 0 < BREACH_CHANCE every time it's called
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 1, spawnedOnPlayerId: 'p1' }]);
  });

  it('an unlucky roll breaches nothing', () => {
    let game = makeGame();
    game = endTurn(game, () => 0.99);
    expect(game.looseAnomalies).toEqual([]);
  });

  it("doesn't spawn a second copy of an anomaly that's already loose", () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [
      { anomalyId: 'shyGuy', tileId: 5, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
      { anomalyId: 'theSculpture', tileId: 18, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
      { anomalyId: 'theOldMan', tileId: 34, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
    ]);
    game = endTurn(game, () => 0); // every anomaly type is already loose - nothing left to spawn
    expect(game.looseAnomalies).toHaveLength(3);
    expect(game.looseAnomalies[0].tileId).toBe(5); // unchanged, not respawned at 31
  });

  it('viewing a dormant anomaly makes the viewer its target', () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    game = viewAnomaly(game, 'p2', 'shyGuy');
    expect(game.looseAnomalies[0]).toEqual({ anomalyId: 'shyGuy', tileId: 31, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 });
  });

  it('viewing an anomaly already hunting someone else does nothing', () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 31, status: 'hunting', targetPlayerId: 'p1', breachedOnTurnCount: 0 }]);
    game = viewAnomaly(game, 'p2', 'shyGuy');
    expect(game.looseAnomalies[0].targetPlayerId).toBe('p1');
  });

  it('a hunting anomaly steps toward its target, clockwise, capped at its hunt speed', () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { position: 10 });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 0, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].tileId).toBe(6); // 0 -> 10 clockwise, capped at 6 spaces
  });

  it('a hunting anomaly always moves clockwise, even when that is the longer way around', () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { position: 0 });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 10, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    // Counter-clockwise (10 -> 0) is only 10 spaces away, but anomalies never move backward - they
    // step clockwise like every player token, so it heads the long way around instead.
    expect(game.looseAnomalies[0].tileId).toBe(16); // 10 -> 0 clockwise (30 spaces), capped at 6
  });

  it('pauses (does not give up) while its target is only AFK-benched', () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { position: 10, isAfkSpectating: true });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 0, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0]).toEqual({ anomalyId: 'shyGuy', tileId: 0, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 });
  });

  it('catching a non-D-Class player seizes their assets and queues a new Personnel choice', () => {
    let game = makeGame(); // p2 is 'car'
    game = withPlayer(game, 'p2', { position: 10, credits: 1000, ownedTileIds: [6] });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 8, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG); // distance 2, well within the 6-space hunt speed - catches this tick
    expect(game.players.p2.credits).toBe(0);
    expect(game.players.p2.ownedTileIds).toEqual([]);
    expect(game.players.p2.isSpectating).toBe(false);
    expect(game.pendingPieceChoice?.playerId).toBe('p2');
    expect(game.pendingPieceChoice?.availablePieceIds.length).toBeGreaterThan(0);
    expect(game.pendingPieceChoice?.availablePieceIds).not.toContain('car'); // can't "reassign" to the piece they already had
    expect(game.looseAnomalies[0]).toEqual({ anomalyId: 'shyGuy', tileId: 10, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 });
  });

  it('a D-Class survives being caught via its own Standard Expendability Clause instead', () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { pieceId: 'boot', position: 10, credits: 1000, ownedTileIds: [6] });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 8, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.players.p2.credits).toBe(750);
    expect(game.players.p2.position).toBe(0);
    expect(game.players.p2.usedExpendabilityClause).toBe(true);
    expect(game.players.p2.isSpectating).toBe(false);
    expect(game.pendingPieceChoice).toBeNull();
  });

  it('is a real Termination if every Personnel is already claimed', () => {
    const allPieceIds: PieceId[] = [
      'boot', 'battleship', 'car', 'iron', 'thimble', 'dog',
      'wheelBarrel', 'hat', 'penguin', 'cat', 'rubberDuck', 'trex',
    ];
    let game = makeGame(allPieceIds);
    const caughtId = 'p2'; // battleship - not D-Class (no respawn) and not Rogue Anomaly (not immune)
    game = withPlayer(game, caughtId, { position: 10 });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 8, status: 'hunting', targetPlayerId: caughtId, breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.players[caughtId].isSpectating).toBe(true);
    expect(game.pendingPieceChoice).toBeNull();
    expect(game.winnerId).toBeNull(); // 11 players still active
  });

  it('chooseNewPersonnel reassigns to any available Personnel and clears the choice', () => {
    let game = makeGame();
    game = { ...game, pendingPieceChoice: { playerId: 'p2', availablePieceIds: ['iron', 'thimble'] } };
    game = chooseNewPersonnel(game, 'p2', 'iron');
    expect(game.players.p2.pieceId).toBe('iron');
    expect(game.pendingPieceChoice).toBeNull();
  });

  it('chooseNewPersonnel refuses a Personnel outside the offered list', () => {
    let game = makeGame();
    game = { ...game, pendingPieceChoice: { playerId: 'p2', availablePieceIds: ['iron'] } };
    game = chooseNewPersonnel(game, 'p2', 'thimble');
    expect(game.players.p2.pieceId).toBe('car'); // unchanged
    expect(game.pendingPieceChoice).not.toBeNull();
  });

  it("the Site Warhead's owner can purge every loose anomaly for a cost", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [12] });
    game = withLooseAnomalies(game, [
      { anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
      { anomalyId: 'testDummy', tileId: 5, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 },
    ]);
    game = purgeAnomalies(game, 'p1');
    expect(game.players.p1.credits).toBe(1500 - 500);
    expect(game.looseAnomalies).toEqual([]);
  });

  it("refuses to purge for anyone who doesn't own the Site Warhead", () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    game = purgeAnomalies(game, 'p1');
    expect(game.looseAnomalies).toHaveLength(1);
    expect(game.players.p1.credits).toBe(1500);
  });

  it("refuses to purge if the owner can't afford it", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [12], credits: 10 });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    game = purgeAnomalies(game, 'p1');
    expect(game.looseAnomalies).toHaveLength(1);
    expect(game.players.p1.credits).toBe(10);
    expect(game.pendingDecision).toBeNull(); // voluntary - never opens a debtSettlement
  });

  it('does nothing when nothing is loose', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [12] });
    const before = game;
    game = purgeAnomalies(game, 'p1');
    expect(game).toEqual(before);
  });

  it("Rogue Anomaly can't be targeted - viewing it never turns it hunting", () => {
    let game = makeGame(['trex', 'car']);
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    game = viewAnomaly(game, 'p1', 'shyGuy');
    expect(game.looseAnomalies[0]).toEqual({ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 });
  });

  it('a hunting anomaly loses interest the moment its target is reassigned into Rogue Anomaly', () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { position: 10 });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 0, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = withPlayer(game, 'p2', { pieceId: 'trex' });
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].status).toBe('dormant');
    expect(game.looseAnomalies[0].targetPlayerId).toBeNull();
  });

  it('Rogue Anomaly can induce a breach on demand', () => {
    let game = makeGame(['trex', 'car']);
    game = induceBreach(game, 'p1', () => 0);
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
    expect(game.players.p1.usedInduceBreach).toBe(true);
  });

  it("refuses to induce a breach for anyone who isn't Rogue Anomaly", () => {
    let game = makeGame();
    const before = game;
    game = induceBreach(game, 'p1', () => 0);
    expect(game).toEqual(before);
  });

  it('only lets Rogue Anomaly induce a breach once per game', () => {
    let game = makeGame(['trex', 'car']);
    game = withPlayer(game, 'p1', { usedInduceBreach: true });
    const before = game;
    game = induceBreach(game, 'p1', () => 0);
    expect(game).toEqual(before);
  });

  it('does nothing if every anomaly type is already loose', () => {
    let game = makeGame(['trex', 'car']);
    game = withLooseAnomalies(game, [
      { anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
      { anomalyId: 'theSculpture', tileId: 18, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
      { anomalyId: 'theOldMan', tileId: 34, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
    ]);
    const before = game;
    game = induceBreach(game, 'p1', () => 0);
    expect(game).toEqual(before);
    expect(game.players.p1.usedInduceBreach).toBe(false);
  });

  it('Induce a Breach can spawn SCP-173 specifically', () => {
    let game = makeGame(['trex', 'car']);
    game = induceBreach(game, 'p1', () => 0.5); // 2nd of 3 candidates in ANOMALIES
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'theSculpture', tileId: 18, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
  });

  it('Induce a Breach can spawn SCP-106 specifically, already hunting the only eligible player', () => {
    let game = makeGame(['trex', 'car']);
    game = induceBreach(game, 'p1', () => 0.99); // 3rd of 3 candidates in ANOMALIES
    // p1 is Rogue Anomaly (immune) - p2 is the only eligible target, so
    // SCP-106 engages automatically without anyone needing to view it.
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'theOldMan', tileId: 34, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
  });

  it('hovering (viewAnomaly) does nothing for SCP-173 - its own interaction is Keep Watch', () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 18, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    game = viewAnomaly(game, 'p1', 'theSculpture');
    expect(game.looseAnomalies[0]).toEqual({ anomalyId: 'theSculpture', tileId: 18, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 });
  });

  it('SCP-173 catches whoever is nearest if nobody kept watch and they were close enough', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 20 }); // out of the running - p2 is the nearest one
    game = withPlayer(game, 'p2', { position: 10 }); // exactly SCULPTURE_UNWATCHED_SPEED away
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].tileId).toBe(10);
    expect(game.pendingPieceChoice?.playerId).toBe('p2'); // caught -> asset seizure, same as Shy Guy's catch
  });

  it('SCP-173 can be outrun if the nearest player is far enough away', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 39 }); // out of the running - p2 is the nearest one
    game = withPlayer(game, 'p2', { position: 15 }); // further than SCULPTURE_UNWATCHED_SPEED (10)
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].tileId).toBe(10); // closed the gap, but didn't reach them
    expect(game.players.p2.isSpectating).toBe(false);
  });

  it('SCP-173 never targets Rogue Anomaly, even if closer than every other player', () => {
    let game = makeGame(['trex', 'dog']);
    game = withPlayer(game, 'p1', { position: 1 }); // Rogue Anomaly, right next to it
    game = withPlayer(game, 'p2', { position: 10 }); // dog, further away but the only valid candidate
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].tileId).toBe(10); // went for p2, not the much-closer p1
  });

  it('SCP-173 skips an AFK-benched player as a candidate', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { isAfkSpectating: true, position: 1 });
    game = withPlayer(game, 'p2', { position: 20 });
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].tileId).toBe(10); // capped step toward p2 (distance 20), not p1
  });

  it("doesn't move on the very turn it breaches, even if someone's right next to its spawn tile", () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { position: 20 }); // close to Testing Chamber 12 (tile 18)
    let calls = 0;
    const rng = () => (calls++ === 0 ? 0 : 0.5); // guarantees a breach, then picks theSculpture (2nd of 3 candidates)
    game = endTurn(game, rng);
    const sculpture = game.looseAnomalies.find((a) => a.anomalyId === 'theSculpture');
    expect(sculpture?.tileId).toBe(18); // spawned, didn't also move this same tick
    expect(game.pendingPieceChoice).toBeNull(); // definitely not caught
  });

  it('only checks for a move once per round (the anchor player\'s turn), not on every turn in between', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 5 }); // the nearest candidate, well within range
    game = withPlayer(game, 'p2', { position: 30 }); // out of the running
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p2' }]);
    game = endTurn(game, NO_BREACH_RNG); // p1's turn ends - not the round anchor, no move yet
    expect(game.looseAnomalies[0].tileId).toBe(0);
    game = endTurn(game, NO_BREACH_RNG); // p2's turn ends - the round anchor, resolves now
    expect(game.looseAnomalies[0].tileId).toBe(5); // caught p1, the only candidate
    expect(game.pendingPieceChoice?.playerId).toBe('p1');
  });

  it('Keep Watch freezes SCP-173 for that tick instead of letting it move', () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { position: 5 }); // would otherwise be caught outright
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p1' }]);
    game = keepWatchOnSculpture(game, 'p1', NO_BREACH_RNG);
    expect(game.looseAnomalies[0].tileId).toBe(0); // didn't move at all
    expect(game.currentTurnIndex).toBe(1); // the turn still ended
    expect(game.scp173Watched).toBe(false); // cleared again after being used for the tick
  });

  it('refuses Keep Watch outside the pre-roll window, off-turn, in jail, or with nothing loose to watch', () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);

    expect(keepWatchOnSculpture(game, 'p2')).toEqual(game); // not their turn
    expect(keepWatchOnSculpture({ ...game, lastRoll: [3, 4] }, 'p1')).toEqual({ ...game, lastRoll: [3, 4] }); // already rolled
    const jailed = withPlayer(game, 'p1', { inJail: true });
    expect(keepWatchOnSculpture(jailed, 'p1')).toEqual(jailed); // resolve jail normally first

    const nothingLoose = withLooseAnomalies(game, []);
    expect(keepWatchOnSculpture(nothingLoose, 'p1')).toEqual(nothingLoose);
  });

  it("lets a non-anchor player keep watch too - everyone's a potential target, so it holds until the round's actual check turn", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 5 }); // would otherwise be caught outright on the anchor's turn
    game = withLooseAnomalies(game, [{ anomalyId: 'theSculpture', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0, spawnedOnPlayerId: 'p2' }]);
    game = keepWatchOnSculpture(game, 'p1', NO_BREACH_RNG); // p1's turn, not the round anchor (p2) - still allowed
    expect(game.currentTurnIndex).toBe(1); // p1's turn still ended normally
    expect(game.scp173Watched).toBe(true); // held over, not consumed yet
    game = endTurn(game, NO_BREACH_RNG); // p2's turn ends - the round anchor, resolves now
    expect(game.looseAnomalies[0].tileId).toBe(0); // frozen by p1's earlier Keep Watch
    expect(game.scp173Watched).toBe(false); // consumed now that the round's check actually happened
  });
});

// Deterministic 9-tile Pocket Dimension track for tests that need to
// force a specific tile-type landing: 0 neutral (always, for real
// tracks too), 2 a Fracture Point, 4 a Decaying Passage, everything
// else neutral.
const TEST_TRACK: PocketDimensionTile[] = [
  'neutral',
  'neutral',
  'fracturePoint',
  'neutral',
  'decayingPassage',
  'neutral',
  'neutral',
  'neutral',
  'neutral',
];

describe('SCP-106 and the Pocket Dimension', () => {
  it('engages automatically on breach - no viewing required - targeting whoever is nearest', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { position: 20 }); // further from tile 34 than p2
    game = withPlayer(game, 'p2', { position: 35 });
    game = devSpawnAnomaly(game, 'theOldMan');
    expect(game.looseAnomalies[0].status).toBe('hunting');
    expect(game.looseAnomalies[0].targetPlayerId).toBe('p2');
  });

  it('hunts at half of Shy Guy\'s speed once engaged', () => {
    let game = makeGame();
    game = withPlayer(game, 'p2', { position: 10 });
    game = withLooseAnomalies(game, [{ anomalyId: 'theOldMan', tileId: 0, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].tileId).toBe(3); // half of Shy Guy's 6-space hunt speed
  });

  it("viewing SCP-106 does nothing - it never needed to be looked at", () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'theOldMan', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    game = viewAnomaly(game, 'p1', 'theOldMan');
    expect(game.looseAnomalies[0]).toEqual({ anomalyId: 'theOldMan', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 });
  });

  it("Rogue Anomaly is never picked as SCP-106's automatic target", () => {
    let game = makeGame(['trex', 'car']);
    game = withPlayer(game, 'p1', { position: 33 }); // right next to tile 34 - would be nearest if eligible
    game = withPlayer(game, 'p2', { position: 20 });
    game = devSpawnAnomaly(game, 'theOldMan');
    expect(game.looseAnomalies[0].status).toBe('hunting');
    expect(game.looseAnomalies[0].targetPlayerId).toBe('p2'); // not the much-closer p1
  });

  it('immediately re-picks whoever is now nearest if it loses its target, instead of going dormant', () => {
    let game = makeGame(['dog', 'car', 'trex']);
    game = withPlayer(game, 'p1', { isSpectating: true }); // its current target - really gone
    game = withPlayer(game, 'p2', { position: 20 }); // the only remaining eligible candidate (p3 is Rogue Anomaly)
    game = withPlayer(game, 'p3', { position: 5 });
    game = withLooseAnomalies(game, [{ anomalyId: 'theOldMan', tileId: 0, status: 'hunting', targetPlayerId: 'p1', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].status).toBe('hunting'); // still actively hunting, not dormant
    expect(game.looseAnomalies[0].targetPlayerId).toBe('p2');
  });

  it('goes dormant only if literally nobody is left eligible to hunt', () => {
    let game = makeGame(['dog', 'trex']);
    game = withPlayer(game, 'p1', { isSpectating: true }); // its target - gone, and p2 (trex) is immune
    game = withLooseAnomalies(game, [{ anomalyId: 'theOldMan', tileId: 0, status: 'hunting', targetPlayerId: 'p1', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0]).toEqual({ anomalyId: 'theOldMan', tileId: 0, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 });
  });

  it("catching someone on the main board drags them into the Pocket Dimension instead of Terminating them", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = withPlayer(game, 'p2', { position: 3 });
    game = withLooseAnomalies(game, [{ anomalyId: 'theOldMan', tileId: 0, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG);
    expect(game.looseAnomalies[0].status).toBe('inPocketDimension');
    expect(game.pocketDimensionOrdeal?.trappedPlayerId).toBe('p2');
    expect(game.pocketDimensionOrdeal?.playerTrackPosition).toBe(0);
    expect(game.pocketDimensionOrdeal?.anomalyTrackPosition).toBe(0);
    expect(game.pocketDimensionOrdeal?.track).toHaveLength(9);
    expect(game.pocketDimensionOrdeal?.track[0]).toBe('neutral');
    // Nothing seized yet - a main-board catch by SCP-106 isn't a loss by itself.
    expect(game.players.p2.credits).toBe(1500);
    expect(game.players.p1.ownedTileIds).toEqual([1]);
  });

  it('landing on a Fracture Point escapes back to the main board unharmed and recontains SCP-106', () => {
    let game = makeGame();
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    game = movePocketDimension(game, 'p1', () => 0.2); // rolls a 2 -> tile 2, a Fracture Point
    expect(game.pendingDecision).toEqual({ type: 'pocketDimensionLanded', forPlayerId: 'p1' }); // not resolved yet
    expect(game.pocketDimensionOrdeal?.playerTrackPosition).toBe(2); // but the move itself already landed
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.pendingDecision).toBeNull();
    expect(game.pocketDimensionOrdeal).toBeNull();
    expect(game.looseAnomalies).toEqual([]);
    expect(game.players.p1.credits).toBe(1500);
    expect(game.players.p1.position).toBe(0); // untouched the whole time
    expect(game.currentTurnIndex).toBe(1); // the turn still ended
  });

  it('landing on an affordable Decaying Passage costs Credits and the ordeal continues, with SCP-106 creeping closer', () => {
    let game = makeGame();
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    game = movePocketDimension(game, 'p1', () => 0.5); // rolls a 4 -> tile 4, a Decaying Passage
    expect(game.players.p1.credits).toBe(1500); // not deducted yet - still just landed
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.players.p1.credits).toBe(1500 - 150);
    expect(game.pocketDimensionOrdeal).toEqual({ trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 4, anomalyTrackPosition: 1 });
    expect(game.looseAnomalies[0].status).toBe('inPocketDimension'); // still loose, still trapped
  });

  it("an unaffordable Decaying Passage Terminates the trapped player through the same pipeline as any other catch", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { credits: 100, ownedTileIds: [1] });
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    game = movePocketDimension(game, 'p1', () => 0.5); // rolls a 4 -> tile 4, an unaffordable Decaying Passage
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.pocketDimensionOrdeal).toBeNull();
    expect(game.looseAnomalies).toEqual([]); // SCP-106 recontained, same as an escape
    expect(game.players.p1.ownedTileIds).toEqual([]); // seized
    expect(game.pendingPieceChoice?.playerId).toBe('p1'); // reassigned, not permanently out (other Personnel free)
  });

  it("SCP-106 reaching the trapped player's tile inside the Pocket Dimension is also a Termination", () => {
    let game = makeGame();
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      // Already 1 tile behind, as if it crept closer on a prior turn.
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 1 },
    };
    // Rolls a 1 -> player lands on tile 1 (neutral, no effect of its own).
    // SCP-106 then creeps from tile 1 to tile 2, which reaches/passes the
    // player's own tile 1 - a catch.
    game = movePocketDimension(game, 'p1', () => 0);
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.pocketDimensionOrdeal).toBeNull();
    expect(game.looseAnomalies).toEqual([]);
    expect(game.pendingPieceChoice?.playerId).toBe('p1');
  });

  it('movement loops back around from the far end instead of dead-ending', () => {
    let game = makeGame();
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 7, anomalyTrackPosition: 0 },
    };
    game = movePocketDimension(game, 'p1', () => 0.9); // rolls a 6; 7 + 6 = 13, wraps to 4 on a 9-tile loop
    expect(game.pocketDimensionOrdeal?.playerTrackPosition).toBe(4);
  });

  it('escaping through a Fracture Point wins even if SCP-106 is sitting right on that same tile', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 7, anomalyTrackPosition: 2 },
    };
    game = movePocketDimension(game, 'p1', () => 0.5); // rolls a 4 -> (7 + 4) % 9 = 2, same tile as SCP-106 - and a Fracture Point
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.pocketDimensionOrdeal).toBeNull();
    expect(game.looseAnomalies).toEqual([]); // SCP-106 recontained - same outcome, but via escape, not a catch
    expect(game.players.p1.ownedTileIds).toEqual([1]); // untouched - never seized, this was an escape
  });

  it('SCP-106 sitting on a landed tile that is NOT a Fracture Point still catches you', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [1] });
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      // Tile 5 is neutral in TEST_TRACK - nothing to preempt a catch with.
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 5 },
    };
    game = movePocketDimension(game, 'p1', () => 0.7); // rolls a 5 -> (0 + 5) % 9 = 5, same tile as SCP-106, neutral
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.pocketDimensionOrdeal).toBeNull();
    expect(game.looseAnomalies).toEqual([]);
    expect(game.players.p1.ownedTileIds).toEqual([]); // seized - a real catch this time
  });

  it("SCP-106's own advance wraps around the loop too", () => {
    let game = makeGame();
    game = {
      ...game,
      pendingDecision: { type: 'pocketDimensionLanded', forPlayerId: 'p1' },
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 5, anomalyTrackPosition: 8 },
    };
    // gap = (5 - 8 + 9) % 9 = 6, well outside SCP-106's speed (1) - no catch. Tile 5 is neutral, so the ordeal just continues.
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.pocketDimensionOrdeal?.anomalyTrackPosition).toBe(0); // wrapped from 8
  });

  it('refuses to move for anyone other than the actual trapped player', () => {
    let game = makeGame();
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    expect(movePocketDimension(game, 'p2')).toEqual(game);
  });

  it('refuses to move when nobody is currently trapped', () => {
    const game = makeGame();
    expect(movePocketDimension(game, 'p1')).toEqual(game);
  });

  it('refuses to move again while a landing is already awaiting resolution', () => {
    let game = makeGame();
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p1', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    game = movePocketDimension(game, 'p1', () => 0.2);
    const before = game;
    expect(movePocketDimension(game, 'p1', () => 0.2)).toEqual(before);
  });

  it("acknowledgePocketDimensionLanding does nothing without a landing actually awaiting resolution", () => {
    const game = makeGame();
    expect(acknowledgePocketDimensionLanding(game)).toEqual(game);
  });

  it('acknowledgePocketDimensionLanding just clears a stale decision if the ordeal was already ended some other way (e.g. a dev-panel recontain)', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'pocketDimensionLanded', forPlayerId: 'p1' }, pocketDimensionOrdeal: null };
    game = acknowledgePocketDimensionLanding(game, NO_BREACH_RNG);
    expect(game.pendingDecision).toBeNull();
  });

  it("Site Warhead purge can't reach SCP-106 mid-ordeal, but still clears everything else loose", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [12] });
    game = {
      ...game,
      looseAnomalies: [
        { anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 },
        { anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 },
      ],
      pocketDimensionOrdeal: { trappedPlayerId: 'p2', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    game = purgeAnomalies(game, 'p1');
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    expect(game.pocketDimensionOrdeal).not.toBeNull(); // the ordeal itself isn't ended by a purge
    expect(game.players.p1.credits).toBe(1500 - 500);
  });

  it('purge is a total no-op (no charge) if SCP-106 mid-ordeal is the only thing loose', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { ownedTileIds: [12] });
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p2', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    const before = game;
    game = purgeAnomalies(game, 'p1');
    expect(game).toEqual(before);
  });

  it("kicking the trapped player frees SCP-106 too, instead of leaving it stuck 'inPocketDimension' forever", () => {
    let game = makeGame();
    game = {
      ...game,
      looseAnomalies: [{ anomalyId: 'theOldMan', tileId: 34, status: 'inPocketDimension', targetPlayerId: null, breachedOnTurnCount: 0 }],
      pocketDimensionOrdeal: { trappedPlayerId: 'p2', track: TEST_TRACK, playerTrackPosition: 0, anomalyTrackPosition: 0 },
    };
    game = devKickPlayer(game, 'p2');
    expect(game.pocketDimensionOrdeal).toBeNull();
    expect(game.looseAnomalies).toEqual([]);
  });
});

describe('Object Anomalies', () => {
  it('a drawn objectAnomaly-effect card is held rather than resolved immediately', () => {
    let game = makeGame();
    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'anomalousEvent' } };
    game = devSetForcedCard(game, 'recoveredGamersFuel');
    game = drawFromPile(game, 'p1');
    game = acknowledgeCard(game);
    expect(game.players.p1.heldCardIds).toEqual(['recoveredGamersFuel']);
  });

  it("useGamersFuel moves the extra roll's worth of spaces and charges Credits per space traveled", () => {
    let game = makeGame();
    // pieceId overridden to sidestep Field Researcher's ("dog", the
    // default p1) Grant Funding bonus for landing on tile 2's card tile,
    // which would otherwise perturb the Credits math this test checks.
    game = withPlayer(game, 'p1', { heldCardIds: ['recoveredGamersFuel'], position: 0, pieceId: 'iron' });
    game = useGamersFuel(game, 'p1', 'recoveredGamersFuel', () => 0); // rollTwoDice(() => 0) -> [1, 1], 2 spaces
    expect(game.players.p1.position).toBe(2);
    expect(game.players.p1.credits).toBe(1500 - 2 * 5);
    expect(game.players.p1.heldCardIds).toEqual([]);
    expect(game.anomalousEventDiscardPile).toContain('recoveredGamersFuel');
  });

  it("useGamersFuel opens a debtSettlement instead of moving at all if the strain is unaffordable", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { heldCardIds: ['recoveredGamersFuel'], position: 0, credits: 5 });
    game = useGamersFuel(game, 'p1', 'recoveredGamersFuel', () => 0.99); // rollTwoDice(() => 0.99) -> [6, 6], 12 spaces, cost 60
    expect(game.pendingDecision).toEqual({ type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 60, creditorId: null });
    expect(game.players.p1.position).toBe(0); // never moved
    expect(game.players.p1.heldCardIds).toEqual([]); // already drunk regardless
  });

  it('useGamersFuel refuses to fire outside its own usability window (not this player, or not their turn)', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { heldCardIds: ['recoveredGamersFuel'] });
    const before = game;
    game = useGamersFuel(game, 'p2', 'recoveredGamersFuel', () => 0);
    expect(game).toEqual(before);
  });

  it('useBadComposition usually pays out a small reward', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { heldCardIds: ['recoveredBadComposition'] });
    game = useBadComposition(game, 'p1', 'recoveredBadComposition', () => 0.99); // well above the 1/6 explosion chance
    expect(game.players.p1.credits).toBe(1500 + 40);
    expect(game.players.p1.inJail).toBe(false);
    expect(game.players.p1.heldCardIds).toEqual([]);
  });

  it('useBadComposition can finish itself instead, costing Credits and a trip to the Containment Chamber', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { heldCardIds: ['recoveredBadComposition'] });
    game = useBadComposition(game, 'p1', 'recoveredBadComposition', () => 0); // below the 1/6 explosion chance
    expect(game.players.p1.credits).toBe(1500 - 150);
    expect(game.players.p1.inJail).toBe(true);
    expect(game.players.p1.heldCardIds).toEqual([]);
  });

  it('useCountermeasure arms the holder instead of doing anything immediately', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { heldCardIds: ['requisitionedCountermeasure'] });
    game = useCountermeasure(game, 'p1', 'requisitionedCountermeasure');
    expect(game.players.p1.hasCountermeasureArmed).toBe(true);
    expect(game.players.p1.heldCardIds).toEqual([]);
    expect(game.foundationDirectiveDiscardPile).toContain('requisitionedCountermeasure');
  });

  it('useCountermeasure is a no-op if already armed', () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { heldCardIds: ['requisitionedCountermeasure'], hasCountermeasureArmed: true });
    const before = game;
    game = useCountermeasure(game, 'p1', 'requisitionedCountermeasure');
    expect(game).toEqual(before);
  });

  it('an armed Countermeasure redirects a Hostile Anomaly catch onto a random other living player instead', () => {
    let game = makeGame(); // p1 'dog', p2 'car'
    game = withPlayer(game, 'p2', { position: 10, credits: 1000, ownedTileIds: [6], hasCountermeasureArmed: true });
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 8, status: 'hunting', targetPlayerId: 'p2', breachedOnTurnCount: 0 }]);
    game = endTurn(game, NO_BREACH_RNG); // distance 2, well within hunt speed - would otherwise catch p2 outright
    // p2 discharged the ring and is untouched; p1 (the only other active player) took the fall instead.
    expect(game.players.p2.hasCountermeasureArmed).toBe(false);
    expect(game.players.p2.credits).toBe(1000);
    expect(game.players.p2.ownedTileIds).toEqual([6]);
    expect(game.pendingPieceChoice?.playerId).toBe('p1');
  });

  it("drawing and using one Object Anomaly doesn't corrupt a later draw of a different one from the other deck", () => {
    // Regression test: pullBackFromDiscard used to guess which discard
    // pile's tail card to pull back into the drawer's hand, rather than
    // targeting the specific card just drawn. Using SCP-207 (Anomalous
    // Event) pushes it onto anomalousEventDiscardPile's tail via
    // discardHeldCard - if a later draw of SCP-963 (Foundation
    // Directive) mistakenly checked that pile first, it would pull the
    // already-used 207 back into the hand instead of holding the
    // actually-drawn 963, stranding 963 in its own discard pile forever.
    let game = makeGame();
    game = withPlayer(game, 'p1', { heldCardIds: ['recoveredGamersFuel'], pieceId: 'iron', position: 0 });
    game = useGamersFuel(game, 'p1', 'recoveredGamersFuel', () => 0);
    expect(game.players.p1.heldCardIds).toEqual([]);
    expect(game.anomalousEventDiscardPile[game.anomalousEventDiscardPile.length - 1]).toBe('recoveredGamersFuel');

    game = { ...game, pendingDecision: { type: 'awaitingCardDraw', deck: 'foundationDirective' } };
    game = devSetForcedCard(game, 'requisitionedCountermeasure');
    game = drawFromPile(game, 'p1');
    game = acknowledgeCard(game);
    expect(game.players.p1.heldCardIds).toEqual(['requisitionedCountermeasure']);
    expect(game.foundationDirectiveDiscardPile).not.toContain('requisitionedCountermeasure');
  });

  it("Countermeasure only intercepts a Hostile Anomaly catch, not debt-Termination", () => {
    let game = makeGame();
    game = withPlayer(game, 'p1', { hasCountermeasureArmed: true, ownedTileIds: [1] });
    game = { ...game, pendingDecision: { type: 'debtSettlement', forPlayerId: 'p1', amountOwed: 100, creditorId: null } };
    game = declareBankruptcy(game, 'p1');
    expect(game.players.p1.isSpectating).toBe(true); // Terminated for real, not redirected
    expect(game.players.p1.hasCountermeasureArmed).toBe(true); // untouched - debt-Termination never even checks it
  });
});
