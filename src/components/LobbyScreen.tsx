import { useState } from 'react';
import { STARTING_PIECES } from '../data/pieces';
import { startGame } from '../lib/gameSync';
import { isPlayerAway } from '../lib/presence';
import { addBotToLobby, choosePiece, closeLobby, leaveRoom, shufflePieces } from '../lib/rooms';
import type { GameState, PieceId } from '../types/game';
import type { BotDifficulty, Room } from '../types/room';
import RoomQrCode from './RoomQrCode';
import './LobbyScreen.css';

interface LobbyScreenProps {
  room: Room;
  roomCode: string;
  playerId: string;
  /** Navigates this browser back to the landing screen - see RoomView's onLeaveRoom. Closing the lobby (host) doesn't need to call this directly; deleting the Room triggers it automatically for everyone, including the host's own client. */
  onLeave: () => void;
}

function pieceName(pieceId: PieceId): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

/** Flavor names for each session-length preset (see SESSION_LENGTH_MULTIPLIERS in game/engine.ts for the actual scaling each maps to) and a short explainer of what picking it actually changes. */
const SESSION_LENGTH_LABELS: Record<GameState['sessionLengthPreset'], { name: string; hint: string }> = {
  quick: { name: 'Rapid Containment Protocol', hint: 'Steeper rent and fees - bankruptcies (and eliminations) come faster.' },
  standard: { name: 'Standard Operating Procedure', hint: "Today's usual balance, unchanged." },
  extended: { name: 'Extended Field Study', hint: 'Gentler rent and fees, for a longer, slower-burning match.' },
};

function LobbyScreen({ room, roomCode, playerId, onLeave }: LobbyScreenProps) {
  const [error, setError] = useState('');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal');
  const [terminationRule, setTerminationRule] = useState<GameState['terminationRule']>('terminate');
  const [sessionLengthPreset, setSessionLengthPreset] = useState<GameState['sessionLengthPreset']>('standard');
  // Object.entries(room.players) isn't a stable order across Firestore
  // snapshots - a write touching only one player's sub-field can come
  // back with the whole map re-serialized in a different key order,
  // making the roster visibly shuffle. joinedAt gives a real, stable
  // order to sort by instead.
  const players = Object.entries(room.players).sort(
    ([, a], [, b]) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0),
  );
  const isHost = room.hostId === playerId;
  const me = room.players[playerId];
  const claimedPieceIds = players.map(([, player]) => player.pieceId);
  const everyoneHasAPiece = players.every(([, player]) => player.pieceId !== null);
  const selectablePieces = STARTING_PIECES;

  async function handleChoosePiece(pieceId: PieceId) {
    setError('');
    try {
      await choosePiece(roomCode, playerId, pieceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  function handleStartGame() {
    const assignments = players
      .filter(([, player]) => player.pieceId !== null)
      .map(([id, player]) => ({ playerId: id, pieceId: player.pieceId! }));
    void startGame(roomCode, assignments, { terminationRule, sessionLengthPreset });
  }

  function handleCloseLobby() {
    if (!window.confirm('Close this Room for everyone? This cannot be undone.')) return;
    void closeLobby(roomCode);
  }

  async function handleLeaveLobby() {
    await leaveRoom(roomCode, playerId);
    onLeave();
  }

  async function handleRemoveBot(botId: string) {
    await leaveRoom(roomCode, botId);
  }

  async function handleAddBot() {
    setError('');
    try {
      await addBotToLobby(roomCode, botDifficulty);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  async function handleShufflePieces() {
    setError('');
    try {
      await shufflePieces(roomCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <main className="lobby">
      <p className="lobby-label">Room Code</p>
      <h1 className="lobby-code">
        {roomCode}
        <span className="lobby-code-cursor" />
      </h1>
      <p className="lobby-hint">Send this code to your fellow agents.</p>
      <RoomQrCode roomCode={roomCode} />

      <p className="lobby-label lobby-roster-label">Personnel Roster</p>
      <ul className="player-list">
        {players.map(([id, player], index) => (
          <li key={id} className={id === playerId ? 'is-you' : ''}>
            <span className="player-list-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="player-list-name">
              <span className={`presence-dot ${isPlayerAway(player) ? 'is-away' : ''}`} title={isPlayerAway(player) ? 'Away' : 'Online'} />
              {player.name}
              {id === playerId ? ' (you)' : ''}
              {id === room.hostId ? ' ★' : ''}
              {isHost && player.isBot && (
                <button
                  type="button"
                  className="lobby-remove-bot"
                  onClick={() => handleRemoveBot(id)}
                >
                  Remove
                </button>
              )}
            </span>
            <span className="player-list-status">
              {player.isBot ? `[BOT ${player.botDifficulty}]` : isPlayerAway(player) ? '[AWAY]' : '[ONLINE]'}
            </span>
            <span className="player-list-piece">
              {player.pieceId ? pieceName(player.pieceId) : 'choosing...'}
            </span>
          </li>
        ))}
        {players.length === 0 && <li className="player-list-empty">Waiting for players...</li>}
      </ul>

      {isHost && claimedPieceIds.length < STARTING_PIECES.length && (
        <div className="lobby-add-bot">
          <label>
            Bot difficulty
            <select value={botDifficulty} onChange={(event) => setBotDifficulty(event.target.value as BotDifficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <button type="button" onClick={handleAddBot}>
            Add Bot
          </button>
        </div>
      )}

      {isHost && players.length > 0 && (
        <button type="button" onClick={handleShufflePieces}>
          Shuffle Pieces
        </button>
      )}

      {room.mode === 'beginner' && me && !me.pieceId && (
        <div className="piece-picker">
          <p className="lobby-hint">
            Choose your Personnel - its Special Power stays hidden until the game starts.
          </p>
          <ul className="piece-picker-list">
            {selectablePieces.map((piece, index) => {
              const taken = claimedPieceIds.includes(piece.id);
              return (
                <li key={piece.id}>
                  <button
                    type="button"
                    className="piece-dossier"
                    disabled={taken}
                    onClick={() => handleChoosePiece(piece.id)}
                  >
                    <span className="piece-dossier-file">FILE {String(index + 1).padStart(2, '0')}</span>
                    <span className="piece-dossier-name">{piece.name}</span>
                    <span className="piece-picker-title">{piece.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {isHost && (
        <div className="lobby-match-settings">
          <label>
            Session Length
            <select
              value={sessionLengthPreset}
              onChange={(event) => setSessionLengthPreset(event.target.value as GameState['sessionLengthPreset'])}
            >
              {(Object.keys(SESSION_LENGTH_LABELS) as GameState['sessionLengthPreset'][]).map((preset) => (
                <option key={preset} value={preset}>
                  {SESSION_LENGTH_LABELS[preset].name}
                </option>
              ))}
            </select>
            <span className="lobby-hint">{SESSION_LENGTH_LABELS[sessionLengthPreset].hint}</span>
          </label>

          <label>
            Termination Rule
            <select value={terminationRule} onChange={(event) => setTerminationRule(event.target.value as GameState['terminationRule'])}>
              <option value="terminate">Standard Termination Protocol</option>
              <option value="jail">Jailed, Not Terminated</option>
            </select>
            <span className="lobby-hint">
              {terminationRule === 'jail'
                ? 'A would-be Termination sends that player to the Containment Chamber instead - everything they own stays theirs.'
                : 'A real Termination seizes everything and either reassigns a new Personnel or ends that player for good.'}
            </span>
          </label>
        </div>
      )}

      {isHost && (
        <button onClick={handleStartGame} disabled={players.length < 2 || !everyoneHasAPiece}>
          Start Game
        </button>
      )}
      {isHost && players.length > 0 && players.length < 2 && (
        <p className="lobby-hint">Need at least 2 players to start.</p>
      )}
      {isHost && players.length >= 2 && !everyoneHasAPiece && (
        <p className="lobby-hint">Waiting for everyone to have a Piece.</p>
      )}

      <div className="lobby-leave-actions">
        {isHost ? (
          <button className="danger-button" onClick={handleCloseLobby}>
            Close Lobby
          </button>
        ) : (
          <button onClick={handleLeaveLobby}>Leave Lobby</button>
        )}
      </div>
    </main>
  );
}

export default LobbyScreen;
