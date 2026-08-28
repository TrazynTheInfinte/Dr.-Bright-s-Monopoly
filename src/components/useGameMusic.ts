import { useEffect } from 'react';
import { startGameMusic, startMenuMusic, stopGameMusic, stopMenuMusic } from '../lib/sound';
import type { GameState } from '../types/game';

/**
 * Switches from menu music to the shuffling "standard" in-game tracks
 * the moment GameBoard mounts, and switches back to menu music if this
 * ever unmounts (defensive; nothing currently navigates away from an
 * in-progress game, but the sound engine shouldn't be left thinking a
 * game's still running if that changes).
 */
export function useGameMusic(game: GameState | undefined): void {
  void game; // not currently used - a "final stretch" track swap can hook in here later

  useEffect(() => {
    stopMenuMusic();
    startGameMusic();
    return () => {
      stopGameMusic();
      startMenuMusic();
    };
  }, []);
}
