import { useEffect } from 'react';
import { setVoicesWarning } from '../lib/sound';
import type { GameState } from '../types/game';

/**
 * SCP-939 gives no warning to the table (see maybeBreachContainment/
 * induceBreach's silence and Board.tsx's hidden marker) - but the one
 * player it's currently approaching gets a private early-warning loop
 * on their own client, nobody else's. Purely presentational (reads
 * shared game state, doesn't write anything) - every viewer's browser
 * independently decides whether it's the one, so this never needs
 * syncing.
 */
export function useVoicesWarning(game: GameState | undefined, playerId: string): void {
  const isBeingApproached = !!game?.looseAnomalies.some(
    (a) => a.anomalyId === 'theVoices' && a.status === 'hunting' && a.targetPlayerId === playerId,
  );

  useEffect(() => {
    setVoicesWarning(isBeingApproached);
  }, [isBeingApproached]);

  useEffect(() => () => setVoicesWarning(false), []);
}
