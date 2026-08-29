import { useState } from 'react';
import { ANOMALIES } from '../data/anomalies';
import { BOARD } from '../data/board';
import { ALL_CARDS, findCard } from '../data/cards';
import {
  devJumpToTileAndSync,
  devKickPlayerAndSync,
  devRecontainAllAnomaliesAndSync,
  devRevivePlayerAndSync,
  devSetCreditsAndSync,
  devSetForcedCardAndSync,
  devSetForcedRollAndSync,
  devForceSkipTurnAndSync,
  devSpawnAnomalyAndSync,
  endGameEntirely,
} from '../lib/gameSync';
import { isPlayerAway } from '../lib/presence';
import { debugPlayGameTrack, FINAL_TRACKS, STANDARD_TRACKS } from '../lib/sound';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './DevPanel.css';

interface DevPanelProps {
  room: Room;
  roomCode: string;
  game: GameState;
}

function handleEndGameEntirely(roomCode: string) {
  if (!window.confirm('End this game for everyone and return to the Lobby? This cannot be undone.')) {
    return;
  }
  void endGameEntirely(roomCode);
}

// Only reachable by the room's host - see the gating check in
// GameBoard.tsx. Lets us jump straight to an interesting game state (a
// specific roll, a player low on money) instead of grinding turns to
// reach it by hand.
function DevPanel({ room, roomCode, game }: DevPanelProps) {
  const [forcedDie1, setForcedDie1] = useState('');
  const [forcedDie2, setForcedDie2] = useState('');
  const [jumpTileId, setJumpTileId] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState('standard:0');

  return (
    <section className="dev-panel">
      <p className="dev-panel-title">Dev Panel</p>

      <div className="dev-panel-section">
        <p>Set player Credits</p>
        {game.turnOrder.map((id) => (
          <div key={id} className="dev-panel-row">
            <label>{room.players[id]?.name}</label>
            <input
              type="number"
              defaultValue={game.players[id].credits}
              onBlur={(event) =>
                devSetCreditsAndSync(
                  roomCode,
                  game,
                  id,
                  Number(event.target.value),
                )
              }
            />
          </div>
        ))}
      </div>

      <div className="dev-panel-section">
        <p>Force next roll</p>
        <div className="dev-panel-row">
          <input
            type="number"
            min={1}
            max={6}
            placeholder="Die 1"
            value={forcedDie1}
            onChange={(event) => setForcedDie1(event.target.value)}
          />
          <input
            type="number"
            min={1}
            max={6}
            placeholder="Die 2"
            value={forcedDie2}
            onChange={(event) => setForcedDie2(event.target.value)}
          />
          <button
            onClick={() =>
              devSetForcedRollAndSync(roomCode, game, [
                Number(forcedDie1) || 1,
                Number(forcedDie2) || 1,
              ])
            }
          >
            Set
          </button>
          <button onClick={() => devSetForcedRollAndSync(roomCode, game, null)}>
            Clear
          </button>
        </div>
        {game.forcedRoll && (
          <p className="hint">
            Next roll forced to {game.forcedRoll[0]} + {game.forcedRoll[1]}
          </p>
        )}
      </div>

      <div className="dev-panel-section">
        <p>Force next card draw</p>
        <div className="dev-panel-row">
          <select
            value={game.forcedCardId ?? ''}
            onChange={(event) =>
              devSetForcedCardAndSync(roomCode, game, event.target.value || null)
            }
          >
            <option value="">(none - draw normally)</option>
            {ALL_CARDS.map((card) => (
              <option key={card.id} value={card.id}>
                [{card.deck === 'anomalousEvent' ? 'AE' : 'FD'}] {card.title}
              </option>
            ))}
          </select>
        </div>
        {game.forcedCardId && (
          <p className="hint">Next card draw forced to "{findCard(game.forcedCardId).title}"</p>
        )}
      </div>

      <div className="dev-panel-section">
        <p>Jump to a space (resolves landing on it, no rolling)</p>
        <div className="dev-panel-row">
          <select value={jumpTileId} onChange={(event) => setJumpTileId(Number(event.target.value))}>
            {BOARD.map((tile) => (
              <option key={tile.id} value={tile.id}>
                {tile.id}: {tile.name}
              </option>
            ))}
          </select>
          <button onClick={() => devJumpToTileAndSync(roomCode, game, game.turnOrder[game.currentTurnIndex], jumpTileId)}>
            Jump
          </button>
        </div>
        <p className="hint">Moves whoever's turn it currently is.</p>
      </div>

      <div className="dev-panel-section">
        <p>Music track switcher (local only - doesn't sync to other players)</p>
        <div className="dev-panel-row">
          <select value={selectedTrack} onChange={(event) => setSelectedTrack(event.target.value)}>
            <optgroup label="Standard">
              {STANDARD_TRACKS.map((track, index) => (
                <option key={`standard:${index}`} value={`standard:${index}`}>
                  {track.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Final round">
              {FINAL_TRACKS.map((track, index) => (
                <option key={`final:${index}`} value={`final:${index}`}>
                  {track.name}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={() => {
              const [kind, indexStr] = selectedTrack.split(':');
              debugPlayGameTrack(kind as 'standard' | 'final', Number(indexStr));
            }}
          >
            Play
          </button>
        </div>
        <p className="hint">Forces that track to play right now, bypassing the normal shuffle.</p>
      </div>

      <div className="dev-panel-section">
        <p>Unstick the game (a disconnected player)</p>
        <div className="dev-panel-row">
          <button onClick={() => devForceSkipTurnAndSync(roomCode, game)}>
            Force Skip Current Turn
          </button>
        </div>
        <p className="hint">
          {(() => {
            const currentId = game.turnOrder[game.currentTurnIndex];
            const currentPlayer = room.players[currentId];
            return `Current turn: ${currentPlayer?.name ?? currentId}${
              currentPlayer && isPlayerAway(currentPlayer) ? ' (away)' : ''
            }. Abandons anything they had pending (an unresolved buy, card, debt) and ends their turn as normal.`;
          })()}
        </p>
      </div>

      <div className="dev-panel-section">
        <p>Kick a player (permanent - only for someone who's actually gone)</p>
        {game.turnOrder.map((id) => (
          <div key={id} className="dev-panel-row">
            <label>
              {room.players[id]?.name}
              {isPlayerAway(room.players[id]) ? ' (away)' : ''}
              {game.players[id].isAfkSpectating
                ? ' (AFK-benched)'
                : game.players[id].isSpectating
                  ? ' (already spectating)'
                  : ''}
            </label>
            <button
              onClick={() => devKickPlayerAndSync(roomCode, game, id)}
              disabled={game.players[id].isSpectating && !game.players[id].isAfkSpectating}
            >
              Kick
            </button>
          </div>
        ))}
        <p className="hint">
          Returns everything they own to the Foundation and Terminates them - same as a real
          bankruptcy-to-the-bank, and, if it was their turn, forces it to end. Use this for a player
          who's genuinely gone, not just taking their time - it can't be undone.
        </p>
      </div>

      <div className="dev-panel-section">
        <p>Revive a spectating player</p>
        {game.turnOrder.filter((id) => game.players[id].isSpectating).length === 0 ? (
          <p className="hint">Nobody's out.</p>
        ) : (
          game.turnOrder
            .filter((id) => game.players[id].isSpectating)
            .map((id) => (
              <div key={id} className="dev-panel-row">
                <label>{room.players[id]?.name}</label>
                <button onClick={() => devRevivePlayerAndSync(roomCode, game, id)}>Revive</button>
              </div>
            ))
        )}
        <p className="hint">
          Undoes a Termination/kick so this player can act again - doesn't restore any Credits or
          Wings they lost. Not a real game mechanic; recovery only.
        </p>
      </div>

      <div className="dev-panel-section">
        <p>Hostile anomalies</p>
        <div className="dev-panel-row">
          {ANOMALIES.map((anomaly) => (
            <button
              key={anomaly.id}
              onClick={() => devSpawnAnomalyAndSync(roomCode, game, anomaly.id)}
              disabled={game.looseAnomalies.some((a) => a.anomalyId === anomaly.id)}
            >
              Spawn {anomaly.name}
            </button>
          ))}
        </div>
        <div className="dev-panel-row">
          <button onClick={() => devRecontainAllAnomaliesAndSync(roomCode, game)} disabled={game.looseAnomalies.length === 0}>
            Recontain All (free)
          </button>
        </div>
        <p className="hint">
          {game.looseAnomalies.length === 0
            ? 'Nothing loose right now.'
            : `Loose: ${game.looseAnomalies.map((a) => `${a.anomalyId} (${a.status})`).join(', ')}.`}
        </p>
      </div>

      <div className="dev-panel-section dev-panel-section-danger">
        <p>Force End Game Entirely</p>
        <div className="dev-panel-row">
          <button onClick={() => handleEndGameEntirely(roomCode)}>Back to the Lobby, Now</button>
        </div>
        <p className="hint">
          The nuclear option, for a game stuck in a way even kicking a player can't fix. Wipes this
          match entirely and drops everyone straight back to the Lobby - the room, its code, and
          everyone's seat/Personnel assignment all survive, so the host can just hit Start Game again
          right away. Cannot be undone.
        </p>
      </div>
    </section>
  );
}

export default DevPanel;
