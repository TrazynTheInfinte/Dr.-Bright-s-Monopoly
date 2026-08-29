import { STARTING_PIECES } from '../data/pieces';
import { chooseNewPersonnelAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';

interface PersonnelChoicePromptProps {
  playerId: string;
  roomCode: string;
  game: GameState;
}

// Shown after a hostile anomaly catches a player with no D-Class second
// life to fall back on - see GameState.pendingPieceChoice. Only the
// caught player sees this; everyone else just sees the log entry.
function PersonnelChoicePrompt({ playerId, roomCode, game }: PersonnelChoicePromptProps) {
  if (!game.pendingPieceChoice || game.pendingPieceChoice.playerId !== playerId) return null;
  const { availablePieceIds } = game.pendingPieceChoice;

  return (
    <div className="purchase-prompt card-prompt">
      <p className="card-title">Reassignment Required</p>
      <p>Your previous Personnel is gone. Pick a replacement from who's still unclaimed:</p>
      <ul className="piece-picker-list">
        {availablePieceIds.map((pieceId) => {
          const piece = STARTING_PIECES.find((p) => p.id === pieceId);
          if (!piece) return null;
          return (
            <li key={pieceId}>
              <button type="button" onClick={() => chooseNewPersonnelAndSync(roomCode, game, playerId, pieceId)}>
                {piece.name}
                <span className="piece-picker-title">{piece.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PersonnelChoicePrompt;
