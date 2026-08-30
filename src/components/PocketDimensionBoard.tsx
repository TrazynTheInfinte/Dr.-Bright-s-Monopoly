import type { GameState, PocketDimensionTile } from '../types/game';
import type { Room } from '../types/room';
import PieceIcon from './PieceIcon';
import './PocketDimensionBoard.css';

interface PocketDimensionBoardProps {
  room: Room;
  game: GameState;
}

const TILE_LABELS: Record<PocketDimensionTile, string> = {
  neutral: 'Empty Corridor',
  fracturePoint: 'Fracture Point',
  decayingPassage: 'Decaying Passage',
};

// Replaces the main Board entirely for whoever's currently trapped -
// there's nothing on the main board relevant to them until this ends
// (escape or Termination both return them to it). Read-only: the
// actual "Move" action lives in GameBoard's turn-actions panel, same
// as every other turn action.
function PocketDimensionBoard({ room, game }: PocketDimensionBoardProps) {
  const ordeal = game.pocketDimensionOrdeal;
  if (!ordeal) return null;
  const trappedPlayer = game.players[ordeal.trappedPlayerId];
  const trappedName = room.players[ordeal.trappedPlayerId]?.name ?? 'Someone';

  return (
    <div className="pocket-dimension-board">
      <p className="pocket-dimension-title">SCP-106&rsquo;s Pocket Dimension</p>
      <p className="pocket-dimension-subtitle">
        {trappedName} was dragged in and is being chased down. Escape through a Fracture Point, or run out of
        Credits or road - either way, SCP-106 gets recontained the instant this ends.
      </p>

      <div className="pocket-dimension-track">
        {ordeal.track.map((tile, index) => (
          <div key={index} className={`pocket-dimension-tile pocket-dimension-tile-${tile}`}>
            <span className="pocket-dimension-tile-index">{index === 0 ? 'Entry' : index}</span>
            <span className="pocket-dimension-tile-label">{TILE_LABELS[tile]}</span>
            <div className="pocket-dimension-tile-occupants">
              {index === ordeal.playerTrackPosition && trappedPlayer && (
                <span className="pocket-dimension-token pocket-dimension-token-player" title={trappedName}>
                  <PieceIcon pieceId={trappedPlayer.pieceId} className="pocket-dimension-token-icon" />
                </span>
              )}
              {index === ordeal.anomalyTrackPosition && (
                <span className="pocket-dimension-token pocket-dimension-token-anomaly" title="SCP-106">
                  ☣
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="pocket-dimension-legend">
        <span className="pocket-dimension-legend-swatch pocket-dimension-tile-fracturePoint" /> Fracture Point - free escape
        &nbsp;&nbsp;
        <span className="pocket-dimension-legend-swatch pocket-dimension-tile-decayingPassage" /> Decaying Passage - costs
        Credits (or worse)
      </p>
    </div>
  );
}

export default PocketDimensionBoard;
