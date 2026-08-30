import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';

interface PurgeBurst {
  key: number;
  tileId: number;
}

const BURST_LIFETIME_MS = 900;
let nextBurstKey = 0;

/**
 * Detects the Site Warhead recontaining one or more loose anomalies and
 * returns which tiles should currently be bursting because of it.
 * Diffs game.looseAnomalies directly (previous snapshot vs current)
 * rather than trying to regex a tile list out of one log line - a
 * purge can recontain several anomalies at once, and only the ones
 * actually reachable (see purgeAnomalies in game/engine.ts - SCP-106
 * mid-Pocket-Dimension-chase never leaves looseAnomalies), so comparing
 * the real before/after state is the only reliable way to know which
 * tiles actually cleared.
 */
export function usePurgeBursts(game: GameState): PurgeBurst[] {
  const prevRef = useRef<GameState>(game);
  const [bursts, setBursts] = useState<PurgeBurst[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = game;
    if (prev === game) return;

    const lastEntry = game.log[game.log.length - 1];
    if (!lastEntry?.startsWith('Site Warhead activated')) return;

    const stillLooseIds = new Set(game.looseAnomalies.map((a) => a.anomalyId));
    const purgedTileIds = prev.looseAnomalies.filter((a) => !stillLooseIds.has(a.anomalyId)).map((a) => a.tileId);
    if (purgedTileIds.length === 0) return;

    const fresh = purgedTileIds.map((tileId) => ({ key: nextBurstKey++, tileId }));
    setBursts((current) => [...current, ...fresh]);
    for (const burst of fresh) {
      setTimeout(() => {
        setBursts((current) => current.filter((b) => b.key !== burst.key));
      }, BURST_LIFETIME_MS);
    }
  }, [game]);

  return bursts;
}
