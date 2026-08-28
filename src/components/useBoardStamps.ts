import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';

export interface BoardStamp {
  key: number;
  playerId: string;
  kind: 'jail' | 'disappear';
  tileId: number;
}

const STAMP_LIFETIME_MS = 1400;
let nextStampKey = 0;

/**
 * Detects the moment a player gets jailed or Terminated by diffing
 * consecutive (already-staged) game snapshots, and returns the
 * currently-active poster-stamp overlays to render on the board.
 *
 * Diffs actual state transitions rather than parsing game.log text -
 * unlike useSoundEvents, which can get away with log-text matching
 * because a sound effect doesn't need to be positioned over anyone,
 * most jail/Termination log lines don't actually name who it happened
 * to (they're written from "the acting player's" perspective, e.g.
 * "Rolled doubles three times - sent to jail!").
 */
export function useBoardStamps(game: GameState | undefined): BoardStamp[] {
  const previousRef = useRef<GameState | undefined>(undefined);
  const [stamps, setStamps] = useState<BoardStamp[]>([]);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = game;
    if (!previous || !game) return;

    const fresh: BoardStamp[] = [];

    for (const playerId of game.turnOrder) {
      const prevPlayer = previous.players[playerId];
      const nextPlayer = game.players[playerId];
      if (!prevPlayer || !nextPlayer) continue;
      if (!prevPlayer.inJail && nextPlayer.inJail) {
        fresh.push({ key: nextStampKey++, playerId, kind: 'jail', tileId: nextPlayer.position });
      }
      if (!prevPlayer.isSpectating && nextPlayer.isSpectating) {
        fresh.push({ key: nextStampKey++, playerId, kind: 'disappear', tileId: prevPlayer.position });
      }
    }

    if (fresh.length === 0) return;

    setStamps((current) => [...current, ...fresh]);
    // Each stamp removes itself independently of this effect's own
    // lifecycle - a fast-moving multiplayer game triggers this effect
    // constantly, and cancelling an already-scheduled removal just
    // because another update arrived would leave old stamps stuck.
    for (const stamp of fresh) {
      setTimeout(() => {
        setStamps((current) => current.filter((s) => s.key !== stamp.key));
      }, STAMP_LIFETIME_MS);
    }
  }, [game]);

  return stamps;
}
