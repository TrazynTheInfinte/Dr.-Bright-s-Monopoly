import { useCallback, useEffect, useRef, useState } from 'react';
import { recordSnakeHighScore } from '../lib/rooms';
import type { Room } from '../types/room';
import './SnakeGame.css';

interface SnakeGameProps {
  room: Room;
  roomCode: string;
  playerId: string;
  /** Shows an on-screen D-pad instead of relying on arrow/WASD keys - same responsive split GameBoard already uses for DiceRoller. */
  isDesktop: boolean;
  /** Returns the log terminal to showing the actual game log. */
  onExit: () => void;
}

const COLS = 18;
const ROWS = 12;
const TICK_MS = 130;

type Cell = [number, number];
type Direction = [number, number];

const UP: Direction = [0, -1];
const DOWN: Direction = [0, 1];
const LEFT: Direction = [-1, 0];
const RIGHT: Direction = [1, 0];

interface SnakeState {
  snake: Cell[];
  direction: Direction;
  food: Cell;
  score: number;
  status: 'playing' | 'gameOver';
}

function randomFood(snake: Cell[]): Cell {
  let candidate: Cell;
  do {
    candidate = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
  } while (snake.some(([c, r]) => c === candidate[0] && r === candidate[1]));
  return candidate;
}

function initialState(): SnakeState {
  const snake: Cell[] = [
    [Math.floor(COLS / 2), Math.floor(ROWS / 2)],
    [Math.floor(COLS / 2) - 1, Math.floor(ROWS / 2)],
    [Math.floor(COLS / 2) - 2, Math.floor(ROWS / 2)],
  ];
  return { snake, direction: RIGHT, food: randomFood(snake), score: 0, status: 'playing' };
}

/**
 * SCP-SL's own "inspect your radio, play Snake" easter egg, reskinned
 * with this game's terminal look - see log idea/ for the reference
 * images this was built from (not shipped as assets, just inspiration).
 * Renders as ASCII characters in the same monospace font the log itself
 * uses, since this takes over that same "screen" rather than being a
 * separate minigame bolted on. High scores are synced to the Room (see
 * lib/rooms.ts's recordSnakeHighScore) so anyone else currently in the
 * Room can see them too - purely a fun side stat, no bearing on the
 * actual match.
 */
function SnakeGame({ room, roomCode, playerId, isDesktop, onExit }: SnakeGameProps) {
  const [state, setState] = useState<SnakeState>(initialState);
  const reportedScoreRef = useRef(0);

  const trySetDirection = useCallback((dir: Direction) => {
    setState((prev) => {
      if (prev.status !== 'playing') return prev;
      if (dir[0] === -prev.direction[0] && dir[1] === -prev.direction[1]) return prev; // no instant reverse
      return { ...prev, direction: dir };
    });
  }, []);

  const restart = useCallback(() => {
    reportedScoreRef.current = 0;
    setState(initialState());
  }, []);

  useEffect(() => {
    if (state.status !== 'playing') return;
    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.status !== 'playing') return prev;
        const [dx, dy] = prev.direction;
        const head = prev.snake[0];
        const newHead: Cell = [head[0] + dx, head[1] + dy];
        if (newHead[0] < 0 || newHead[0] >= COLS || newHead[1] < 0 || newHead[1] >= ROWS) {
          return { ...prev, status: 'gameOver' };
        }
        const ateFood = newHead[0] === prev.food[0] && newHead[1] === prev.food[1];
        const body = ateFood ? prev.snake : prev.snake.slice(0, -1);
        if (body.some(([c, r]) => c === newHead[0] && r === newHead[1])) {
          return { ...prev, status: 'gameOver' };
        }
        const newSnake = [newHead, ...body];
        return {
          ...prev,
          snake: newSnake,
          score: ateFood ? prev.score + 1 : prev.score,
          food: ateFood ? randomFood(newSnake) : prev.food,
        };
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'gameOver' || reportedScoreRef.current >= state.score) return;
    reportedScoreRef.current = state.score;
    const currentBest = room.players[playerId]?.snakeHighScore ?? 0;
    if (state.score > currentBest) {
      recordSnakeHighScore(roomCode, playerId, state.score).catch(() => {
        // A missed write here just means the leaderboard doesn't reflect
        // this run - not worth surfacing to the player over a fun stat.
      });
    }
  }, [state.status, state.score, room.players, playerId, roomCode]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          trySetDirection(UP);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          trySetDirection(DOWN);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          trySetDirection(LEFT);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          trySetDirection(RIGHT);
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (state.status === 'gameOver') restart();
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trySetDirection, restart, state.status]);

  const grid: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let row = '';
    for (let c = 0; c < COLS; c++) {
      if (state.snake[0][0] === c && state.snake[0][1] === r) row += '@';
      else if (state.snake.some(([sc, sr]) => sc === c && sr === r)) row += '#';
      else if (state.food[0] === c && state.food[1] === r) row += '*';
      else row += '.';
    }
    grid.push(row);
  }

  const leaderboard = Object.entries(room.players)
    .filter(([, p]) => typeof p.snakeHighScore === 'number')
    .sort(([, a], [, b]) => (b.snakeHighScore ?? 0) - (a.snakeHighScore ?? 0));

  return (
    <div className="snake-game">
      <div className="snake-header">
        <span>SCORE: {state.score}</span>
        <button className="snake-exit" onClick={onExit}>
          Exit
        </button>
      </div>

      <pre className="snake-grid">{grid.join('\n')}</pre>

      {state.status === 'gameOver' && (
        <div className="snake-game-over">
          <p>SIGNAL LOST</p>
          <p className="hint">Final score: {state.score}</p>
          <button onClick={restart}>Retry</button>
        </div>
      )}

      {!isDesktop && state.status === 'playing' && (
        <div className="snake-dpad">
          <button className="snake-dpad-up" onClick={() => trySetDirection(UP)}>
            ▲
          </button>
          <button className="snake-dpad-left" onClick={() => trySetDirection(LEFT)}>
            ◀
          </button>
          <button className="snake-dpad-right" onClick={() => trySetDirection(RIGHT)}>
            ▶
          </button>
          <button className="snake-dpad-down" onClick={() => trySetDirection(DOWN)}>
            ▼
          </button>
        </div>
      )}

      {leaderboard.length > 0 && (
        <ul className="snake-leaderboard">
          {leaderboard.map(([id, p]) => (
            <li key={id} className={id === playerId ? 'is-me' : ''}>
              {p.name}: {p.snakeHighScore}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SnakeGame;
