import { useCallback, useEffect, useRef, useState } from 'react';
import { ANOMALIES } from '../data/anomalies';
import { BOARD, getTile } from '../data/board';
import { STARTING_PIECES } from '../data/pieces';
import { findCard } from '../data/cards';
import type { CardDeck, GameState } from '../types/game';
import {
  acknowledgeCardAndSync,
  buyTileAndSync,
  declinePurchaseAndSync,
  endTurnAndSync,
  induceBreachAndSync,
  keepWatchOnSculptureAndSync,
  mortgageTileAndSync,
  payEscapeFeeAndSync,
  purgeAnomaliesAndSync,
  rejoinFromAfkAndSync,
  rollDiceAndSync,
  useJanitorTunnelTravelAndSync,
} from '../lib/gameSync';
import { isPlayerAway } from '../lib/presence';
import { playCardDraw } from '../lib/sound';
import type { Room } from '../types/room';
import ActionModal from './ActionModal';
import AnimatedNumber from './AnimatedNumber';
import Board from './Board';
import CardChoicePrompt from './CardChoicePrompt';
import CatRedirectPrompt from './CatRedirectPrompt';
import DebtSettlementPrompt from './DebtSettlementPrompt';
import DevPanel from './DevPanel';
import DiceRoller from './DiceRoller';
import FlyingCard from './FlyingCard';
import GameOverScreen from './GameOverScreen';
import Hand from './Hand';
import NowPlayingBanner from './NowPlayingBanner';
import PersonnelChoicePrompt from './PersonnelChoicePrompt';
import PieceInfoPanel from './PieceInfoPanel';
import MtfEncounterBanner from './MtfEncounterBanner';
import RubberDuckEncounterBanner from './RubberDuckEncounterBanner';
import TradePanel from './TradePanel';
import YourTurnBanner from './YourTurnBanner';
import { useAfkSelfCheck } from './useAfkSelfCheck';
import { useCardFlight } from './useCardFlight';
import { useCurrentGameTrackName } from './useCurrentGameTrackName';
import { useGameMusic } from './useGameMusic';
import { useHostAfkWatchdog } from './useHostAfkWatchdog';
import { useBotDriver } from './useBotDriver';
import { useIsDesktop } from './useIsDesktop';
import { useSoundEvents } from './useSoundEvents';
import { useStagedGame } from './useStagedGame';
import { useTurnStartNonce } from './useTurnStartNonce';
import { useYourTurnChime } from './useYourTurnChime';
import './GameBoard.css';

interface GameBoardProps {
  room: Room;
  roomCode: string;
  playerId: string;
  /** Passed straight through to GameOverScreen (see RoomView) - unused otherwise, since there's no leave-mid-game affordance, only from the Lobby and the game-over screen. */
  onLeave: () => void;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

const TUNNEL_TILES = BOARD.filter((tile) => tile.kind === 'tunnel');

/** Owned Wings/Tunnels `player` could mortgage right now to raise cash before deciding on a purchase - not already mortgaged, no houses on the specific tile. Mirrors DebtSettlementPrompt's own filter (mortgageProperty itself still rejects one with houses elsewhere in its Sector, logging why, if this lighter check lets one through). */
function mortgageableForPurchase(
  game: GameState,
  player: { ownedTileIds: number[] },
): { tileId: number; name: string; mortgageValue: number }[] {
  return player.ownedTileIds.flatMap((tileId) => {
    const tile = getTile(tileId);
    if (tile.kind !== 'wing' && tile.kind !== 'tunnel') return [];
    if (game.mortgagedTileIds.includes(tileId)) return [];
    if ((game.houses[tileId] ?? 0) > 0) return [];
    return [{ tileId, name: tile.name, mortgageValue: Math.floor(tile.price / 2) }];
  });
}

// Player IDs are crypto.randomUUID() (see lib/playerIdentity.ts) - a
// pattern distinctive enough that a plain regex match against one never
// collides with normal log text. engine.ts can't put a player's actual
// display name in a log message itself (it only knows player IDs -
// display names live on the separate Room document, see the standing
// note in game/engine.ts), so a message that needs to name someone by
// name embeds their raw ID instead, and this substitutes it back in at
// display time, where the Room is available.
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function formatLogEntry(entry: string, room: Room): string {
  return entry.replace(UUID_PATTERN, (id) => room.players[id]?.name ?? 'a departed player');
}

// The actual board visual lives in <Board> below; everything in this
// file past that is still the plain functional readout (status, actions,
// decision prompts, event log) - that part isn't a placeholder, it's
// just not meant to be pretty, since decisions need to stay legible.
function GameBoard({ room, roomCode, playerId, onLeave }: GameBoardProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [rollTrigger, setRollTrigger] = useState(0);
  // A card visibly flying from the deck pile just clicked (Board.tsx's
  // onDeckClick reports where) to wherever the real reveal panel lands
  // (layoutActionsRef below) - purely cosmetic, cleared once the flight
  // animation finishes on its own (see FlyingCard).
  const [cardFlight, setCardFlight] = useState<{ deck: CardDeck; from: DOMRect; to: DOMRect } | null>(null);
  const layoutActionsRef = useRef<HTMLElement>(null);
  // Only consulted below a screen-width breakpoint (see GameBoard.css) -
  // above it, CSS shows every section regardless of this and the tab
  // buttons themselves stay hidden, so this state is simply inert on a
  // wide screen rather than needing its own "are we on mobile" check.
  const [mobileTab, setMobileTab] = useState<'board' | 'status'>('board');
  const [selectedTunnelId, setSelectedTunnelId] = useState(TUNNEL_TILES[0].id);
  // Drives the desktop-only dice-roller swap below (playtest feedback) -
  // see useIsDesktop for why this needs to be a real JS check rather
  // than pure CSS: only one DiceRoller can ever be mounted at a time,
  // or its sound effects would double up.
  const isDesktop = useIsDesktop();
  // Delays revealing anything about a state update besides the mover's
  // token walking there, so a card that Terminates the drawer (or any
  // other landing effect) doesn't seem to happen before their piece has
  // visibly finished moving - see useStagedGame for the full story.
  const game = useStagedGame(room.game);
  // Hooks can't be called conditionally, so this (and useStagedGame
  // above) has to run before the `if (!game) return null` guard below -
  // an empty array is a harmless placeholder for the one render where
  // game isn't available yet.
  useSoundEvents(game?.log ?? []);
  useGameMusic(game);
  const currentTrackName = useCurrentGameTrackName();
  // Both computed defensively here (game may still be undefined on this
  // render) so the two watchdog hooks below - which also can't be
  // called conditionally - have real values rather than needing their
  // own duplicate "is game even loaded yet" checks.
  const isMyTurnEarly = !!game && game.turnOrder[game.currentTurnIndex] === playerId;
  const isHost = playerId === room.hostId;
  const afkPrompt = useAfkSelfCheck(roomCode, game, playerId, isMyTurnEarly);
  useHostAfkWatchdog(roomCode, room, game, isHost);
  useBotDriver(roomCode, room, game, isHost);
  useYourTurnChime(isMyTurnEarly);
  const turnStartNonce = useTurnStartNonce(isMyTurnEarly);
  const handleCardFlight = useCallback(
    (deck: CardDeck, from: DOMRect, to: DOMRect) => setCardFlight({ deck, from, to }),
    [],
  );
  useCardFlight(game, layoutActionsRef.current, handleCardFlight);

  // RoomView only ever renders GameBoard once room.game exists, but
  // TypeScript can't see that from here, so we still need this check to
  // satisfy it (and to bail out safely if it's ever wrong).
  if (!game) return null;

  if (game.winnerId) {
    return <GameOverScreen room={room} game={game} roomCode={roomCode} playerId={playerId} onLeave={onLeave} />;
  }

  const currentTurnPlayerId = game.turnOrder[game.currentTurnIndex];
  const isMyTurn = currentTurnPlayerId === playerId;
  const pendingTile = game.pendingDecision?.type === 'purchase' ? getTile(game.pendingDecision.tileId) : null;
  // Shown to EVERY viewer, not just whoever's resolving it - a drawn
  // card used to only render for pendingDecision.forPlayerId, so
  // everyone else just saw nothing happen until the drawer clicked
  // Continue. Only the actual resolver gets the button (see the
  // isPendingCardMine check below); everyone else gets a read-only
  // "waiting on" view of the same card.
  const pendingCard = game.pendingDecision?.type === 'cardDrawn' ? findCard(game.pendingDecision.cardId) : null;
  const isPendingCardMine =
    game.pendingDecision?.type === 'cardDrawn' && game.pendingDecision.forPlayerId === playerId;
  const me = game.players[playerId];

  const isDevPanelUnlocked = playerId === room.hostId;

  async function handleRoll() {
    setIsRolling(true);
    setRollTrigger((n) => n + 1);
    try {
      await rollDiceAndSync(roomCode, game!);
    } finally {
      setIsRolling(false);
    }
  }

  return (
    <main className="game-board">
      {afkPrompt.visible && (
        <div className="afk-prompt-overlay">
          <div className="afk-prompt">
            <p>Still there? It's your turn.</p>
            <button onClick={afkPrompt.confirmStillHere}>Yes, I'm here</button>
            <p className="afk-prompt-countdown">
              Turn skips automatically in {afkPrompt.secondsLeft}s...
            </p>
          </div>
        </div>
      )}

      {cardFlight && (
        <FlyingCard
          deck={cardFlight.deck}
          from={cardFlight.from}
          to={cardFlight.to}
          onDone={() => setCardFlight(null)}
        />
      )}

      {me && <PieceInfoPanel pieceId={me.pieceId} />}

      {turnStartNonce > 0 && <YourTurnBanner key={turnStartNonce} />}
      {currentTrackName && <NowPlayingBanner key={currentTrackName} trackName={currentTrackName} />}

      <p className="turn-indicator">
        {isMyTurn ? 'Your turn' : `${room.players[currentTurnPlayerId]?.name}'s turn`}
      </p>

      <div className="board-layout" data-mobile-tab={mobileTab}>
        {/* Only shown below the mobile breakpoint (see GameBoard.css) -
            switches which of the two tab groups below is visible.
            layout-actions is in neither group, so whatever needs a
            response (Roll Dice, a card reveal) stays reachable no
            matter which tab is active. */}
        <div className="mobile-tabs">
          <button
            type="button"
            className={mobileTab === 'board' ? 'is-active' : ''}
            onClick={() => setMobileTab('board')}
          >
            Board
          </button>
          <button
            type="button"
            className={mobileTab === 'status' ? 'is-active' : ''}
            onClick={() => setMobileTab('status')}
          >
            Status
          </button>
        </div>

        <section className="layout-status">
          <div className="game-status">
            {game.lastRoll && (
              <p className="dice-result">
                {game.lastRoll[1] === 0
                  ? `Rolled ${game.lastRoll[0]} (one die)`
                  : `Rolled ${game.lastRoll[0]} + ${game.lastRoll[1]}${game.lastRollWasDoubles ? ' (doubles!)' : ''}`}
              </p>
            )}
          </div>

          <ul className="player-summary">
            {game.turnOrder.map((id) => {
              const player = game.players[id];
              return (
                <li key={id} className={id === currentTurnPlayerId ? 'is-current' : ''}>
                  <span className="player-name">
                    {room.players[id] && (
                      <span
                        className={`presence-dot ${isPlayerAway(room.players[id]) ? 'is-away' : ''}`}
                        title={isPlayerAway(room.players[id]) ? 'Away' : 'Online'}
                      />
                    )}
                    {room.players[id]?.name} ({pieceName(player.pieceId)})
                    {room.players[id]?.isBot && <span className="bot-badge">BOT</span>}
                  </span>
                  <span className="player-credits">
                    ₡<AnimatedNumber value={player.credits} />
                  </span>
                  <span className="player-position">
                    {player.isSpectating ? 'Terminated' : getTile(player.position).name}
                    {player.inJail ? ' [CONTAINED]' : ''}
                  </span>
                </li>
              );
            })}
          </ul>

          {!me?.isSpectating && <TradePanel playerId={playerId} roomCode={roomCode} room={room} game={game} />}
        </section>

        <section className="layout-actions" ref={layoutActionsRef}>
          {me?.isAfkSpectating && (
            <div className="purchase-prompt card-prompt afk-rejoin-banner">
              <p>You were benched for being away too long - you're just spectating for now.</p>
              <button onClick={() => rejoinFromAfkAndSync(roomCode, game, playerId)}>
                Rejoin the Game
              </button>
            </div>
          )}

          {isMyTurn && !game.pendingDecision && (
            <div className="actions">
              {/* Roll is only available before this turn's first roll, or
                  again after doubles ("if you get a double, you get to roll
                  again"). Once a non-doubles roll has happened, only End Turn
                  shows - otherwise a player could just keep re-rolling
                  forever instead of passing the turn. */}
              {(!game.lastRoll || game.lastRollWasDoubles) && (
                <button onClick={handleRoll} disabled={isRolling}>
                  {isRolling ? 'Rolling...' : 'Roll Dice'}
                </button>
              )}
              {/* Keep Watch is only available in that same pre-roll window,
                  only while SCP-173 is actually loose, and only if this
                  player isn't in the Containment Chamber (resolve that
                  normally first). Everyone's a potential target, so anyone
                  on their turn can spend it watching - it's only actually
                  read on the round's one move-check turn (whoever's turn it
                  breached on), but an early Keep Watch earlier in the round
                  still holds until then. Choosing it skips rolling entirely
                  and ends the turn on the spot. */}
              {!game.lastRoll && !me?.inJail && game.looseAnomalies.some((a) => a.anomalyId === 'theSculpture') && (
                <button onClick={() => keepWatchOnSculptureAndSync(roomCode, game, playerId)}>
                  Keep Watch on SCP-173
                </button>
              )}
              {/* Only before rolling - once they've rolled, resolveJailRoll
                  already charged the Holding Fee for this turn (or freed
                  them), so there's nothing left to pay here. */}
              {!game.lastRoll && me?.inJail && (
                <button onClick={() => payEscapeFeeAndSync(roomCode, game, playerId)}>
                  Pay Escape Fee{' '}
                  {me.pieceId === 'boot'
                    ? '(free - D-Class isn\'t billed)'
                    : me.pieceId === 'iron' && !me.usedMasterKey
                      ? '(free - master keyring)'
                      : '(200 Credits)'}
                </button>
              )}
              {game.lastRoll && !game.lastRollWasDoubles && (
                <button onClick={() => endTurnAndSync(roomCode, game)}>End Turn</button>
              )}
              {game.lastRollWasDoubles && <p className="hint">Doubles! Roll again.</p>}
            </div>
          )}

          {isMyTurn &&
            !game.pendingDecision &&
            !game.lastRoll &&
            me?.pieceId === 'iron' &&
            !me.inJail &&
            getTile(me.position).kind === 'tunnel' &&
            (() => {
              // selectedTunnelId can go stale (e.g. it still points at
              // the tunnel Janitor is currently standing on, which isn't
              // a valid destination) without the dropdown ever firing
              // onChange to update it - always fall back to the first
              // real option rather than silently submitting a same-tile
              // "move" that looks like nothing happened.
              const otherTunnels = TUNNEL_TILES.filter((tile) => tile.id !== me.position);
              const effectiveTunnelId = otherTunnels.some((tile) => tile.id === selectedTunnelId)
                ? selectedTunnelId
                : otherTunnels[0].id;
              return (
                <div className="actions">
                  <label>
                    Below the Floor Plan:{' '}
                    <select value={effectiveTunnelId} onChange={(event) => setSelectedTunnelId(Number(event.target.value))}>
                      {otherTunnels.map((tile) => (
                        <option key={tile.id} value={tile.id}>
                          {tile.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button onClick={() => useJanitorTunnelTravelAndSync(roomCode, game, playerId, effectiveTunnelId)}>
                    Use Service Corridors
                  </button>
                </div>
              );
            })()}

          {isMyTurn && pendingTile && game.pendingDecision?.type === 'purchase' && (
            <ActionModal>
              <div className="purchase-prompt">
                <p>
                  Buy {pendingTile.name}
                  {'price' in pendingTile && (
                    <>
                      {' for '}
                      {pendingTile.kind === 'tunnel' && me?.pieceId === 'battleship' ? (
                        <>
                          <span className="board-popup-price-struck">₡{pendingTile.price}</span>{' '}
                          ₡{Math.floor(pendingTile.price / 2)}
                        </>
                      ) : pendingTile.kind === 'utility' && me?.pieceId === 'boot' ? (
                        <>
                          <span className="board-popup-price-struck">₡{pendingTile.price}</span>{' '}
                          ₡{Math.floor(pendingTile.price / 2)}
                        </>
                      ) : (
                        `₡${pendingTile.price}`
                      )}
                    </>
                  )}
                  ?
                </p>
                {me && mortgageableForPurchase(game, me).length > 0 && (
                  <div className="liquidation-choice-group">
                    <p className="hint">Short on cash? Mortgage something first:</p>
                    {mortgageableForPurchase(game, me).map(({ tileId, name, mortgageValue }) => (
                      <button key={tileId} onClick={() => mortgageTileAndSync(roomCode, game, playerId, tileId)}>
                        {name} (+₡{mortgageValue})
                      </button>
                    ))}
                  </div>
                )}
                <div className="purchase-prompt-actions">
                  <button onClick={() => buyTileAndSync(roomCode, game, playerId)}>Buy</button>
                  <button onClick={() => declinePurchaseAndSync(roomCode, game)}>Skip</button>
                </div>
              </div>
            </ActionModal>
          )}

          {pendingCard && game.pendingDecision?.type === 'cardDrawn' && (
            <ActionModal>
              <div key={game.pendingDecision.cardId} className="purchase-prompt card-prompt card-reveal">
                <CardRevealSound />
                <p className="card-title">{pendingCard.title}</p>
                <p>{pendingCard.text}</p>
                {isPendingCardMine ? (
                  <button onClick={() => acknowledgeCardAndSync(roomCode, game)}>Continue</button>
                ) : (
                  <p className="hint">
                    Waiting for {room.players[game.pendingDecision.forPlayerId]?.name}...
                  </p>
                )}
              </div>
            </ActionModal>
          )}

          {game.pendingDecision?.type === 'cardChoice' && (
            <ActionModal>
              <CardChoicePrompt
                deck={game.pendingDecision.deck}
                choiceCardIds={game.pendingDecision.choiceCardIds}
                roomCode={roomCode}
                game={game}
                playerId={currentTurnPlayerId}
                isMine={isMyTurn}
                chooserName={room.players[currentTurnPlayerId]?.name}
              />
            </ActionModal>
          )}

          {isMyTurn && game.pendingDecision?.type === 'catRedirect' && (
            <ActionModal>
              <CatRedirectPrompt
                cardId={game.pendingDecision.cardId}
                room={room}
                roomCode={roomCode}
                playerId={playerId}
                game={game}
              />
            </ActionModal>
          )}

          {game.pendingDecision?.type === 'debtSettlement' &&
            game.pendingDecision.forPlayerId === playerId && (
              <ActionModal>
                <DebtSettlementPrompt
                  playerId={playerId}
                  amountOwed={game.pendingDecision.amountOwed}
                  roomCode={roomCode}
                  game={game}
                />
              </ActionModal>
            )}

          <RubberDuckEncounterBanner room={room} roomCode={roomCode} playerId={playerId} game={game} />
          <MtfEncounterBanner room={room} roomCode={roomCode} playerId={playerId} game={game} />

          {game.pendingPieceChoice?.playerId === playerId && (
            <ActionModal>
              <PersonnelChoicePrompt playerId={playerId} roomCode={roomCode} game={game} />
            </ActionModal>
          )}

          {game.looseAnomalies.length > 0 && me?.ownedTileIds.includes(12) && (
            <div className="purchase-prompt card-prompt">
              <p>
                {game.looseAnomalies.length} anomal{game.looseAnomalies.length === 1 ? 'y' : 'ies'} currently
                loose. As the Site Warhead's owner, you can recontain everything for 500 Credits.
              </p>
              <button onClick={() => purgeAnomaliesAndSync(roomCode, game, playerId)} disabled={me.credits < 500}>
                Activate Site Warhead
              </button>
            </div>
          )}

          {me?.pieceId === 'trex' && !me.usedInduceBreach && game.looseAnomalies.length < ANOMALIES.length && (
            <div className="purchase-prompt card-prompt">
              <p>Uncontained: force a containment breach right now instead of waiting for one to happen naturally.</p>
              <button onClick={() => induceBreachAndSync(roomCode, game, playerId)}>Induce a Breach</button>
            </div>
          )}
        </section>

        <section className="layout-log">
          <ul className="event-log">
            {game.log
              .slice()
              .reverse()
              .map((entry, index) => (
                <li key={index}>{formatLogEntry(entry, room)}</li>
              ))}
          </ul>

          {isDesktop && <DiceRoller game={room.game ?? game} rollTrigger={rollTrigger} />}

          {isDevPanelUnlocked && <DevPanel room={room} roomCode={roomCode} game={game} />}
        </section>

        <div className="board-column layout-board">
          <Board room={room} roomCode={roomCode} playerId={playerId} game={game} />
        </div>

        <div className="dice-column layout-dice">
          {/* Live, not staged - the dice should start tumbling the
              instant a roll happens, not wait for the token's walk to
              finish revealing everything else. */}
          {!isDesktop && <DiceRoller game={room.game ?? game} rollTrigger={rollTrigger} />}
        </div>
      </div>

      <Hand room={room} roomCode={roomCode} playerId={playerId} game={game} />
    </main>
  );
}

// A silent helper that just plays the card-draw sound once, the moment
// it mounts - since the card-reveal banner it lives inside is keyed by
// cardId (see above), React mounts a fresh one of these every time a
// new card is actually drawn, which is exactly the trigger we want.
function CardRevealSound() {
  useEffect(() => {
    playCardDraw();
  }, []);
  return null;
}

export default GameBoard;
