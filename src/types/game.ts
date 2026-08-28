// Board tiles come in a few distinct shapes, so this is a "discriminated
// union": every variant has a `kind` field, and TypeScript uses that field
// to figure out which other fields are actually present. E.g. only
// WingTile has `colorGroup` - TS will error if you try to read
// `.colorGroup` on a tile without first checking `tile.kind === 'wing'`.

export type ColorGroup =
  | 'purple'
  | 'lightBlue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkBlue';

export type CardDeck = 'anomalousEvent' | 'foundationDirective';

interface BaseTile {
  /** Position on the board, 0 (Site Entrance) through 39, going clockwise. */
  id: number;
  name: string;
}

export interface SiteEntranceTile extends BaseTile {
  kind: 'go';
}

export interface ContainmentChamberTile extends BaseTile {
  kind: 'jail';
}

export interface BreakRoomTile extends BaseTile {
  kind: 'freeParking';
}

export interface ReassignedTile extends BaseTile {
  kind: 'goToJail';
}

/** A single ownable tile - ownership, rent, and houses/hotels all work exactly like classic Monopoly properties. */
export interface WingTile extends BaseTile {
  kind: 'wing';
  price: number;
  colorGroup: ColorGroup;
  /** Cost of one house (or the hotel that replaces the 4th). */
  houseCost: number;
  /** Rent at 0/1/2/3/4 houses, then a hotel - index 5 = hotel, matching the houses count on GameState.houses (0-4 houses, 5 = hotel). */
  rentTable: [number, number, number, number, number, number];
}

/** A Maintenance Tunnels tile - classic railroad rent (doubles per additional one the same owner has). */
export interface TunnelTile extends BaseTile {
  kind: 'tunnel';
  price: number;
}

/** Site Warhead or Site Coolant - classic utility rent (a dice-roll multiplier). */
export interface UtilityTile extends BaseTile {
  kind: 'utility';
  price: number;
}

export interface CardTile extends BaseTile {
  kind: 'card';
  deck: CardDeck;
}

export type BoardTile =
  | SiteEntranceTile
  | ContainmentChamberTile
  | BreakRoomTile
  | ReassignedTile
  | WingTile
  | TunnelTile
  | UtilityTile
  | CardTile;

export type PieceId =
  | 'boot'
  | 'battleship'
  | 'car'
  | 'iron'
  | 'thimble'
  | 'dog'
  | 'wheelBarrel'
  | 'hat'
  | 'penguin'
  | 'cat'
  | 'rubberDuck'
  | 'trex';

export interface PieceDefinition {
  id: PieceId;
  /** The name printed on the token, e.g. "D-Class". */
  name: string;
  /** The in-fiction role, e.g. "D-Class Personnel". */
  title: string;
  /** Null for a piece whose old power depended on a mechanic this build doesn't have (see CONTEXT.md) - to be redesigned later. */
  powerDescription: string | null;
}

/** One player's state within an in-progress game (as opposed to RoomPlayer, which is just their lobby name). */
export interface GamePlayerState {
  pieceId: PieceId;
  /** Board tile index, 0-39. */
  position: number;
  credits: number;
  /** Tile IDs of Wings/Tunnels/utilities this player owns. */
  ownedTileIds: number[];
  inJail: boolean;
  /** Turns spent stuck in the Containment Chamber so far this stay - classic rule: forced to pay the Clearance Fee (and leave) after the 3rd failed attempt. Reset to 0 on leaving. */
  turnsInJail: number;
  /** Consecutive doubles rolled during the current turn sequence - a 3rd sends this player to the Containment Chamber instead of moving again. Resets whenever a turn actually ends (a non-doubles roll, or this rule triggering). */
  doublesRolledCount: number;
  /** Held "Get Out of Containment Free" cards, kept for later voluntary use rather than resolving immediately. */
  heldCardIds: string[];
  /** True only if permanently out (real Bankruptcy/Terminated): assets returned to the Foundation, skipped in turn order forever. The match ends once only one non-spectating player remains. */
  isSpectating: boolean;
  /** Consecutive automatic away-skips (see afkSkipTurn in game/engine.ts) - resets the moment they roll for real (rollDice) or confirm they're still there (confirmStillHere). Reaching the limit inside afkSkipTurn benches them (isAfkSpectating) instead of skipping again. */
  consecutiveAfkSkips: number;
  /** True only while spectating because afkSkipTurn benched them for being away too long - distinct from isSpectating alone (a real Termination), since this one can be undone with rejoinFromAfk. */
  isAfkSpectating: boolean;
}

/**
 * A decision the current player (or another named player) must make
 * before play can continue.
 *
 * cardChoice is Car's/Dog's Special Power: instead of automatically
 * drawing the top card of the deck they landed on, they're shown a few
 * of the next cards and pick which one to actually draw.
 *
 * catRedirect is Cat's Special Power: after a card is drawn (by Cat
 * specifically), choose to keep it themselves or hand its whole effect
 * to another player instead.
 *
 * awaitingCardDraw is landing on an Anomalous Event/Foundation
 * Directive tile itself - the deck doesn't actually get drawn from
 * until the player clicks the matching pile (see drawFromPile in
 * game/engine.ts), which turns into cardChoice (Car/Dog) or cardDrawn
 * (everyone else) next.
 *
 * cardDrawn carries `forPlayerId` - normally the drawer, but when Cat
 * redirects a card, this is whoever they gave it to instead.
 *
 * debtSettlement is a player who owes more than they can currently
 * pay: they can sell houses/mortgage properties (the existing
 * sellHouse/mortgageProperty, unrestricted by any pendingDecision) to
 * try to cover it, then either pay (settleDebt) or give up
 * (declareBankruptcy) - real Monopoly liquidation.
 */
export type PendingDecision =
  | { type: 'purchase'; tileId: number }
  | { type: 'awaitingCardDraw'; deck: CardDeck }
  | { type: 'cardChoice'; deck: CardDeck; choiceCardIds: string[] }
  | { type: 'catRedirect'; cardId: string }
  | { type: 'cardDrawn'; cardId: string; forPlayerId: string }
  | { type: 'debtSettlement'; forPlayerId: string; amountOwed: number; creditorId: string | null };

export interface GameState {
  /** Player IDs in turn order. */
  turnOrder: string[];
  currentTurnIndex: number;
  players: Record<string, GamePlayerState>;
  lastRoll: [number, number] | null;
  lastRollWasDoubles: boolean;
  pendingDecision: PendingDecision | null;
  /** Dev-panel override: if set, the next rollDice() call uses this instead of a random roll, then clears it. */
  forcedRoll: [number, number] | null;
  /** Card IDs remaining to be drawn, and already-drawn IDs to reshuffle in once a pile runs out. */
  anomalousEventDrawPile: string[];
  anomalousEventDiscardPile: string[];
  foundationDirectiveDrawPile: string[];
  foundationDirectiveDiscardPile: string[];
  /** Dev-panel override: if set, the next card-tile landing draws this specific card instead of the pile's next one, without disturbing either pile. */
  forcedCardId: string | null;
  /**
   * Houses built on each Wing tile: 0-4 is a house count, 5 means a
   * hotel (which replaced the 4 houses - see buildHouse/sellHouse in
   * game/engine.ts). Keyed by tile ID rather than by owner, so a
   * Wing's houses simply travel with it if it's ever forcibly
   * transferred (Wheel Barrel, T-Rex). Missing/absent entries mean 0.
   */
  houses: Record<number, number>;
  /** Bank supply, standard Monopoly counts (32 houses, 12 hotels) - building is blocked once these run out, since there's no auction system to resolve a shortage. */
  housesRemaining: number;
  hotelsRemaining: number;
  /** Sectors Hat has already been granted a free house for (Hat's Special Power) - prevents re-granting every time ownership of an already-rewarded Sector churns. Cleared for a Sector if Hat later loses it, so completing it again re-triggers the reward. */
  hatFreeHouseSectors: ColorGroup[];
  /** Tile IDs currently mortgaged: the owner already collected half its price and can't collect rent on it until they pay the mortgage off. */
  mortgagedTileIds: number[];
  /** Recent event descriptions, newest last, capped for display. */
  log: string[];
  /** How many turns have actually passed to a new player so far (doubles-continuations don't count) - starts at 0. Purely a UI hook. */
  turnCount: number;
  /**
   * Set by sendToJail to the tile the player was actually standing on
   * the instant they got redirected to the Containment Chamber - a UI
   * hint for animating the walk there before revealing the jump,
   * rather than snapping straight there. Cleared once the turn ends.
   */
  lastJailRedirect: { playerId: string; fromTileId: number } | null;
  /** The moment only one non-spectating player is left in turnOrder, eliminatePlayer sets this to their ID and the match is over. Null the rest of the time. */
  winnerId: string | null;
  /**
   * Security Officer's (Rubber Duck's) Special Power: set when their own
   * move lands them on a tile another player already occupies. Runs
   * independently of pendingDecision, since the tile they landed on
   * might already have its own pending decision (e.g. an unowned Wing's
   * purchase prompt) - jailing is optional and shouldn't compete for
   * that one slot. Lapses (implicitly "no") if Security Officer ends
   * their turn without acting on it.
   */
  rubberDuckEncounter: { rubberDuckPlayerId: string; targetPlayerId: string } | null;
  /** Pending player-to-player trade proposals - independent of pendingDecision, since trading isn't turn-gated and shouldn't block or be blocked by whatever else is pending. See proposeTrade/acceptTrade/declineTrade/withdrawTrade. */
  activeTrades: TradeOffer[];
}

/** A proposed trade between two players - Wings/Tunnels/utilities and/or Credits, either direction. Neither side's tileIds may have houses on them (must be sold first). Not resolved until the recipient (toPlayerId) accepts or declines, or the proposer (fromPlayerId) withdraws it. */
export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  /** What fromPlayerId is putting up. */
  offerTileIds: number[];
  offerCredits: number;
  /** Held "Get Out of Containment Free" card IDs fromPlayerId is putting up - see GamePlayerState.heldCardIds. */
  offerCardIds: string[];
  /** What fromPlayerId wants from toPlayerId in return. */
  requestTileIds: number[];
  requestCredits: number;
  requestCardIds: string[];
}
