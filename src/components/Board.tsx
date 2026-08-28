import { useState, type CSSProperties, type ReactNode } from 'react';
import { BOARD, RAILROAD_RENT_BY_COUNT } from '../data/board';
import { drawFromPileAndSync } from '../lib/gameSync';
import type { BoardTile, GameState } from '../types/game';
import type { Room } from '../types/room';
import {
  ArrowIcon,
  BarsIcon,
  BulbIcon,
  ChanceIcon,
  CuffsIcon,
  DropletIcon,
  EyeIcon,
  HammerIcon,
  ParkingIcon,
  StarIcon,
  TrainIcon,
} from './BoardTileIcon';
import { STARTING_PIECES } from '../data/pieces';
import PieceIcon from './PieceIcon';
import { useBoardStamps } from './useBoardStamps';
import { useRecentTileFlashes } from './useRecentTileFlashes';
import './Board.css';

interface BoardProps {
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

// Stable per-seat colors for the plain position tokens - not Piece art
// (that's a separate, later pass), just enough to tell players apart on
// the board itself.
const TOKEN_COLORS = [
  '#c9a227',
  '#3f7ca8',
  '#4c6b3a',
  '#b5677f',
  '#8a5a2b',
  '#5b3a73',
  '#2f8f7a',
  '#a3231f',
  '#7a7a3a',
  '#c96a24',
  '#3a5a7a',
  '#6b3a5b',
];

type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner';

function sideOf(id: number): Side {
  if (id === 0 || id === 10 || id === 20 || id === 30) return 'corner';
  if (id >= 1 && id <= 9) return 'bottom';
  if (id >= 11 && id <= 19) return 'left';
  if (id >= 21 && id <= 29) return 'top';
  return 'right';
}

/** Maps a tile ID to its 1-based row/column in the 11x11 board grid - see the comment above BOARD in data/board.ts for why this specific mapping (bottom row right-to-left from STOY, then counterclockwise... actually clockwise - up the left, across the top, down the right) is correct. */
function gridPositionOf(id: number): { row: number; col: number } {
  if (id === 0) return { row: 11, col: 11 };
  if (id >= 1 && id <= 9) return { row: 11, col: 11 - id };
  if (id === 10) return { row: 11, col: 1 };
  if (id >= 11 && id <= 19) return { row: 11 - (id - 10), col: 1 };
  if (id === 20) return { row: 1, col: 1 };
  if (id >= 21 && id <= 29) return { row: 1, col: id - 19 };
  if (id === 30) return { row: 1, col: 11 };
  return { row: id - 29, col: 11 };
}

/** Shrinks tokens when more than one player shares a tile (most obviously everyone starting on STOY), so they still fit within that one square instead of overflowing it - see the --occupant-scale usage on .tile-token/.tile-token-icon in Board.css. */
function occupantScaleFor(occupantCount: number): number {
  if (occupantCount <= 1) return 1;
  if (occupantCount === 2) return 0.72;
  if (occupantCount === 3) return 0.58;
  return 0.48;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

function DeckIcon({ tile }: { tile: BoardTile }) {
  if (tile.kind !== 'card') return null;
  return tile.deck === 'anomalousEvent' ? <HammerIcon className="tile-icon" /> : <ChanceIcon className="tile-icon" />;
}

/** A rubber-stamp-style flourish over a jailed/Terminated player's tile - see useBoardStamps for how the moment is detected. */
function PosterStamp({ kind, style }: { kind: 'jail' | 'disappear'; style: CSSProperties }) {
  return (
    <div className={`board-stamp board-stamp-${kind}`} style={style}>
      {kind === 'jail' ? 'Contained' : 'Terminated'}
    </div>
  );
}

/** A small info bubble anchored over a specific tile - shared by the click-a-piece-for-owner popup and the tap-a-tile-for-its-full-name popup, since both are "a board-level overlay positioned by a tile's grid cell" (see gridPositionOf) rather than nested inside the tile itself, which would get clipped by the tile's own overflow:hidden. */
function BoardPopup({
  tileId,
  onDismiss,
  children,
}: {
  tileId: number;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const { row, col } = gridPositionOf(tileId);
  const side = sideOf(tileId);
  // Centering the popup over a tile in the left/right columns means
  // roughly half of it hangs off the edge of the (often narrow, on
  // mobile) screen. Anchor it to grow inward from the tile's own inner
  // edge instead for those two columns; top/bottom/corner tiles have
  // room on both sides, so those stay centered.
  const leftPercent =
    side === 'left' ? (col / 11) * 100 : side === 'right' ? ((col - 1) / 11) * 100 : ((col - 0.5) / 11) * 100;
  const translateX = side === 'left' ? '8px' : side === 'right' ? 'calc(-100% - 8px)' : '-50%';

  // Growing upward from a top-row tile (the default - see
  // --popup-translate-y below) pushes the popup above the board entirely,
  // clipped by the viewport - there's nothing above row 1 to grow into.
  // Anchor those to the tile's bottom edge and grow downward instead, on
  // both desktop and mobile.
  const isTopRow = row === 1;
  const topPercent = isTopRow ? (row / 11) * 100 : ((row - 0.5) / 11) * 100;
  const translateY = isTopRow ? '12px' : '-160%';

  return (
    <div
      className="board-popup"
      style={{
        top: `${topPercent}%`,
        left: `${leftPercent}%`,
        '--popup-translate-x': translateX,
        '--popup-translate-y': translateY,
      } as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        onDismiss();
      }}
    >
      {children}
    </div>
  );
}

const HOUSE_LABELS = ['No houses', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel'];

/** Rent breakdown shown in a tile's popup - the price on its own wasn't enough for players to know what landing on it actually costs. Wings get the full houses-to-hotel table; Maintenance Tunnels get the by-count table; utilities have dice-roll-multiplier rent, so no fixed table applies. discountedForViewer shows the halved price (Battleship's Tunnel discount, Boot's utility discount) struck through the normal one, rather than silently showing whichever applies - a player switching between Personnel mid-game needs to see both to know what changed. */
function TileRentInfo({ tile, discountedForViewer }: { tile: BoardTile; discountedForViewer: boolean }) {
  if (tile.kind === 'wing') {
    return (
      <>
        <br />
        <span className="board-popup-price">Price: ₡{tile.price}</span>
        <table className="board-popup-rent">
          <tbody>
            {tile.rentTable.map((rent, index) => (
              <tr key={index}>
                <td>{HOUSE_LABELS[index]}</td>
                <td>₡{rent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (tile.kind === 'tunnel') {
    return (
      <>
        <br />
        <span className="board-popup-price">
          Price:{' '}
          {discountedForViewer ? (
            <>
              <span className="board-popup-price-struck">₡{tile.price}</span> ₡{Math.floor(tile.price / 2)}
            </>
          ) : (
            `₡${tile.price}`
          )}
        </span>
        <table className="board-popup-rent">
          <tbody>
            {RAILROAD_RENT_BY_COUNT.map((rent, index) => (
              <tr key={index}>
                <td>{index + 1} owned</td>
                <td>₡{rent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  if (tile.kind === 'utility') {
    return (
      <>
        <br />
        <span className="board-popup-price">
          Price:{' '}
          {discountedForViewer ? (
            <>
              <span className="board-popup-price-struck">₡{tile.price}</span> ₡{Math.floor(tile.price / 2)}
            </>
          ) : (
            `₡${tile.price}`
          )}
        </span>
        <p className="hint">Rent is 4x the dice roll (10x if the owner has both utilities).</p>
      </>
    );
  }

  return null;
}

/**
 * The actual 40-tile board, laid out as a physical Monopoly-style square
 * (not the plain text readout that's still shown below it for actions/
 * decisions). Deliberately CSS/SVG only - no image assets. Sound is a
 * separate, later pass; this one covers the board itself (layout, color
 * groups, tile icons, ownership/houses/mortgages, the two clickable
 * card piles), a distinct token icon per Piece, and tokens stepping
 * tile-by-tile across the board instead of snapping to a new position
 * (that stepping itself is driven by `game` already being the "staged"
 * state from useStagedGame, not anything this component does itself).
 */
function Board({ room, roomCode, playerId, game }: BoardProps) {
  // Which occupant token (if any) currently has its owner label open -
  // a tap/click toggles it, since a hover-only title tooltip doesn't
  // work on touch devices at all, and works well enough on desktop that
  // it's kept alongside this as a bonus.
  const [openTokenId, setOpenTokenId] = useState<string | null>(null);
  // A tile's full name, popped up on tap/click - names truncate to one
  // line on narrow screens (see .tile-name in Board.css), so this is
  // the way to actually read one that got cut off, on mobile or desktop.
  const [openTileId, setOpenTileId] = useState<number | null>(null);

  const tokenColorFor = (id: string) => {
    const index = game.turnOrder.indexOf(id);
    return TOKEN_COLORS[index % TOKEN_COLORS.length];
  };

  const ownerOf = (tileId: number): string | null => {
    for (const id of game.turnOrder) {
      if (game.players[id].ownedTileIds.includes(tileId)) return id;
    }
    return null;
  };

  const currentTurnPlayerId = game.turnOrder[game.currentTurnIndex];
  const isMyTurn = currentTurnPlayerId === playerId;
  // Visible to everyone watching (the glow is shared game state), but
  // only clickable for whoever's turn it actually is.
  const awaitingDeck = game.pendingDecision?.type === 'awaitingCardDraw' ? game.pendingDecision.deck : null;

  const stamps = useBoardStamps(game);
  const tileFlashes = useRecentTileFlashes(game.log);
  // Last one wins if two flashes somehow land on the same tile in the
  // same tick - fine, it's a brief cosmetic flourish either way.
  const flashKindByTileId = new Map(tileFlashes.map((flash) => [flash.tileId, flash.kind]));

  return (
    <div
      className="board"
      onClick={() => {
        setOpenTokenId(null);
        setOpenTileId(null);
      }}
    >
      <div className="board-center">
        <div className="board-center-banner">SCP-OPOLY</div>
        <button
          type="button"
          className={`board-center-deck board-center-deck-communist ${awaitingDeck === 'anomalousEvent' ? 'is-hot' : ''} ${awaitingDeck === 'anomalousEvent' && isMyTurn ? 'is-clickable' : ''}`}
          disabled={!isMyTurn || awaitingDeck !== 'anomalousEvent'}
          onClick={() => drawFromPileAndSync(roomCode, game, playerId)}
        >
          <HammerIcon className="board-center-deck-icon" />
          ANOMALOUS EVENT
        </button>
        <button
          type="button"
          className={`board-center-deck board-center-deck-nochance ${awaitingDeck === 'foundationDirective' ? 'is-hot' : ''} ${awaitingDeck === 'foundationDirective' && isMyTurn ? 'is-clickable' : ''}`}
          disabled={!isMyTurn || awaitingDeck !== 'foundationDirective'}
          onClick={() => drawFromPileAndSync(roomCode, game, playerId)}
        >
          <ChanceIcon className="board-center-deck-icon" />
          FOUNDATION DIRECTIVE
        </button>
      </div>

      {BOARD.map((tile) => {
        const { row, col } = gridPositionOf(tile.id);
        const side = sideOf(tile.id);
        const owner = tile.kind === 'wing' || tile.kind === 'tunnel' || tile.kind === 'utility' ? ownerOf(tile.id) : null;
        const houses = game.houses[tile.id] ?? 0;
        const mortgaged = game.mortgagedTileIds.includes(tile.id);
        const occupants = game.turnOrder.filter(
          (id) => !game.players[id].isSpectating && game.players[id].position === tile.id,
        );
        const flashKind = flashKindByTileId.get(tile.id);

        return (
          <div
            key={tile.id}
            className={`board-tile board-tile-${tile.kind} board-tile-${side} ${flashKind ? `tile-flash-${flashKind}` : ''}`}
            style={{
              gridRow: row,
              gridColumn: col,
              ...(tile.kind === 'wing' ? { '--group-color': `var(--group-${tile.colorGroup})` } : {}),
            } as CSSProperties}
            onClick={(event) => {
              event.stopPropagation();
              setOpenTokenId(null);
              setOpenTileId((current) => (current === tile.id ? null : tile.id));
            }}
          >
            {tile.kind === 'wing' && <div className="tile-colorbar" />}

            {owner && (
              <div className="tile-owner-mark" style={{ background: tokenColorFor(owner) }} title="Owned" />
            )}
            {mortgaged && <div className="tile-mortgaged">MORTGAGED</div>}

            <div className="tile-body">
              {tile.kind === 'card' && <DeckIcon tile={tile} />}
              {tile.kind === 'tunnel' && <TrainIcon className="tile-icon" />}
              {tile.kind === 'utility' && tile.id === 12 && <BulbIcon className="tile-icon" />}
              {tile.kind === 'utility' && tile.id === 28 && <DropletIcon className="tile-icon" />}
              {tile.kind === 'wing' && tile.id === 37 && <StarIcon className="tile-icon" />}
              {tile.kind === 'wing' && tile.id === 39 && <EyeIcon className="tile-icon" />}
              {tile.kind === 'freeParking' && <ParkingIcon className="tile-icon" />}
              {tile.kind === 'goToJail' && <CuffsIcon className="tile-icon" />}
              {tile.kind === 'jail' && <BarsIcon className="tile-icon" />}
              {tile.kind === 'go' && <ArrowIcon className="tile-icon" />}

              <span className="tile-name">{tile.name}</span>
              {(tile.kind === 'wing' || tile.kind === 'tunnel' || tile.kind === 'utility') && (
                <span className="tile-price">₡{tile.price}</span>
              )}
              {tile.kind === 'go' && <span className="tile-price">Collect ₡200</span>}
              {tile.kind === 'jail' && <span className="tile-price">In Jail / Visiting</span>}
            </div>

            {houses > 0 && (
              <div className="tile-houses">
                {houses === 5 ? (
                  <span className="tile-hotel">HOTEL</span>
                ) : (
                  Array.from({ length: houses }).map((_, i) => <span key={i} className="tile-house" />)
                )}
              </div>
            )}

            {occupants.length > 0 && (
              <div
                className="tile-occupants"
                style={{ '--occupant-scale': occupantScaleFor(occupants.length) } as CSSProperties}
              >
                {occupants.map((id) => (
                  <span
                    key={id}
                    className={`tile-token ${id === currentTurnPlayerId ? 'is-current-turn' : ''}`}
                    style={{ background: tokenColorFor(id) }}
                    title={`${room.players[id]?.name} (${pieceName(game.players[id].pieceId)})`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenTileId(null);
                      setOpenTokenId((current) => (current === id ? null : id));
                    }}
                  >
                    <PieceIcon pieceId={game.players[id].pieceId} className="tile-token-icon" />
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {stamps.map((stamp) => {
        const { row, col } = gridPositionOf(stamp.tileId);
        return (
          <PosterStamp
            key={stamp.key}
            kind={stamp.kind}
            style={{
              top: `${((row - 0.5) / 11) * 100}%`,
              left: `${((col - 0.5) / 11) * 100}%`,
            }}
          />
        );
      })}

      {openTokenId && game.players[openTokenId] && (
        <BoardPopup tileId={game.players[openTokenId].position} onDismiss={() => setOpenTokenId(null)}>
          {room.players[openTokenId]?.name}
          <br />
          {pieceName(game.players[openTokenId].pieceId)}
        </BoardPopup>
      )}

      {openTileId !== null && (
        <BoardPopup tileId={openTileId} onDismiss={() => setOpenTileId(null)}>
          {BOARD.find((t) => t.id === openTileId)?.name}
          {(() => {
            const tile = BOARD.find((t) => t.id === openTileId);
            if (!tile) return null;
            const viewerPiece = game.players[playerId]?.pieceId;
            const discountedForViewer =
              (tile.kind === 'tunnel' && viewerPiece === 'battleship') || (tile.kind === 'utility' && viewerPiece === 'boot');
            return <TileRentInfo tile={tile} discountedForViewer={discountedForViewer} />;
          })()}
        </BoardPopup>
      )}
    </div>
  );
}

export default Board;
