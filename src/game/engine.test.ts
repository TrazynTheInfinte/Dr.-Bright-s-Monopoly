import { describe, expect, it } from 'vitest';
import { getTile } from '../data/board';
import {
  acceptTrade,
  acknowledgeCard,
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
  mortgageProperty,
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
  useGetOutOfJailCard,
  useJanitorTunnelTravel,
  viewAnomaly,
  withdrawTrade,
} from './engine';
import type { GamePlayerState, GameState, LooseAnomaly, PieceId } from '../types/game';

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
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
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
    expect(game.looseAnomalies).toEqual([{ anomalyId: 'shyGuy', tileId: 31, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 1 }]);
  });

  it('an unlucky roll breaches nothing', () => {
    let game = makeGame();
    game = endTurn(game, () => 0.99);
    expect(game.looseAnomalies).toEqual([]);
  });

  it("doesn't spawn a second copy of an anomaly that's already loose", () => {
    let game = makeGame();
    game = withLooseAnomalies(game, [{ anomalyId: 'shyGuy', tileId: 5, status: 'dormant', targetPlayerId: null, breachedOnTurnCount: 0 }]);
    game = endTurn(game, () => 0);
    expect(game.looseAnomalies).toHaveLength(1);
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
    const caughtId = 'p12'; // trex
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
});
