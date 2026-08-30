import { useEffect } from 'react';
import { BOARD_SIZE } from '../data/board';
import { setVoicesWarning } from '../lib/sound';
import type { GameState } from '../types/game';

// How many tiles out the effect starts fading in from - beyond this,
// SCP-939 is too far off for its target to notice anything yet.
const WARNING_RANGE = Math.floor(BOARD_SIZE / 2);

function boardDistance(a: number, b: number): number {
  const forward = (b - a + BOARD_SIZE) % BOARD_SIZE;
  return Math.min(forward, BOARD_SIZE - forward);
}

/**
 * SCP-939 gives no warning to the table (see maybeBreachContainment/
 * induceBreach's silence and Board.tsx's hidden marker) - but the one
 * player it's currently approaching gets a private early-warning cue on
 * their own client, nobody else's: a looping sound that gets louder the
 * closer it gets (see setVoicesWarning), and a "closeness" value (0-1)
 * the caller can use to blur the screen by a matching amount, mimicking
 * SCP-939's amnestic secretion. Purely presentational (reads shared game
 * state, doesn't write anything) - every viewer's browser independently
 * decides whether it's the one, so this never needs syncing.
 */
export function useVoicesWarning(game: GameState | undefined, playerId: string): number {
  const voices = game?.looseAnomalies.find((a) => a.anomalyId === 'theVoices');
  const isTarget = voices?.status === 'hunting' && voices.targetPlayerId === playerId;
  const me = game?.players[playerId];
  const linear = isTarget && voices && me ? Math.max(0, 1 - boardDistance(voices.tileId, me.position) / WARNING_RANGE) : 0;
  // Eased (squared) rather than linear - it should stay faint for most of
  // the range and only really ramp up once it's genuinely close, not
  // already be intense while it's still far off.
  const closeness = linear * linear;

  useEffect(() => {
    setVoicesWarning(closeness);
  }, [closeness]);

  useEffect(() => () => setVoicesWarning(0), []);

  return closeness;
}
