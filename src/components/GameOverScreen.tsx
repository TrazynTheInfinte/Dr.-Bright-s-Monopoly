import { STARTING_PIECES } from '../data/pieces';
import { startNewMatch } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

interface GameOverScreenProps {
  room: Room;
  game: GameState;
  roomCode: string;
  playerId: string;
  onLeave: () => void;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

/** Shown once only one non-Terminated player is left (see checkWinCondition in game/engine.ts) - real classic-Monopoly bankruptcy, last player standing wins. */
function GameOverScreen({ room, game, roomCode, playerId, onLeave }: GameOverScreenProps) {
  const winnerId = game.winnerId;
  const winnerName = winnerId ? (room.players[winnerId]?.name ?? 'Unknown') : 'Nobody';
  const isHost = playerId === room.hostId;

  return (
    <main className="game-board">
      <div className="purchase-prompt card-prompt">
        <p className="card-title">Match Over</p>
        <p>
          {winnerName} ({winnerId ? pieceName(game.players[winnerId].pieceId) : ''}) is the last one left - the
          Foundation has spoken.
        </p>
        <div className="purchase-prompt-actions">
          {isHost && <button onClick={() => startNewMatch(roomCode, room)}>Start New Match</button>}
          <button onClick={onLeave}>Leave Room</button>
        </div>
      </div>
    </main>
  );
}

export default GameOverScreen;
