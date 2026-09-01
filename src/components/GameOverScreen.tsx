import { STARTING_PIECES } from '../data/pieces';
import { startNewMatch } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './GameOverScreen.css';

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

function playerName(room: Room, playerId: string): string {
  return room.players[playerId]?.name ?? 'Unknown';
}

/**
 * Shown once only one non-Terminated player is left (see
 * checkWinCondition in game/engine.ts) - real classic-Monopoly
 * bankruptcy, last player standing wins. Built from data every match
 * already tracks for exactly this screen: GameState.eliminations (a
 * bounded, one-entry-per-player timeline - unlike the 20-entry-capped
 * log, it never loses an early-game Termination) and
 * GameState.peakNetWorth (each player's best moment, since their final
 * net worth is almost always 0 by the time the match actually ends).
 */
function GameOverScreen({ room, game, roomCode, playerId, onLeave }: GameOverScreenProps) {
  const winnerId = game.winnerId;
  const isHost = playerId === room.hostId;

  // The elimination timeline only ever records who went OUT - the
  // winner never appears in it, so it's appended separately at the end
  // to read as a complete "how the match went" story.
  const timeline = [
    ...game.eliminations.map((elimination) => ({ ...elimination, isWinner: false })),
    ...(winnerId ? [{ playerId: winnerId, pieceId: game.players[winnerId].pieceId, turnCount: game.turnCount, cause: 'Still standing', isWinner: true }] : []),
  ];

  const peakStandings = Object.keys(room.players)
    .filter((id) => game.players[id])
    .map((id) => ({ playerId: id, pieceId: game.players[id].pieceId, peak: game.peakNetWorth[id] ?? 0 }))
    .sort((a, b) => b.peak - a.peak);

  return (
    <main className="game-board">
      <div className="purchase-prompt card-prompt game-over-screen">
        <p className="card-title">Match Over</p>
        <p>
          {winnerId ? playerName(room, winnerId) : 'Nobody'} ({winnerId ? pieceName(game.players[winnerId].pieceId) : ''}) is the last
          one left - the Foundation has spoken, after {game.turnCount} turns.
        </p>

        <section className="game-over-section">
          <h3>Session Timeline</h3>
          <ol className="game-over-timeline">
            {timeline.map((entry) => (
              <li key={entry.playerId} className={entry.isWinner ? 'game-over-winner-row' : undefined}>
                <span className="game-over-turn">Turn {entry.turnCount}</span>
                <span>
                  {playerName(room, entry.playerId)} ({pieceName(entry.pieceId)})
                </span>
                <span className="game-over-cause">{entry.cause}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="game-over-section">
          <h3>Peak Holdings</h3>
          <p className="hint">Highest net worth (Credits plus everything owned) each player ever reached - not their final tally, which a real Termination always zeroes out.</p>
          <ol className="game-over-standings">
            {peakStandings.map((entry, index) => (
              <li key={entry.playerId}>
                <span className="game-over-rank">#{index + 1}</span>
                <span>
                  {playerName(room, entry.playerId)} ({pieceName(entry.pieceId)})
                </span>
                <span className="game-over-peak">₡{entry.peak.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="purchase-prompt-actions">
          {isHost && <button onClick={() => startNewMatch(roomCode, room)}>Start New Match</button>}
          <button onClick={onLeave}>Leave Room</button>
        </div>
      </div>
    </main>
  );
}

export default GameOverScreen;
