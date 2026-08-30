import { useEffect } from 'react';
import { setAmbience, startGameMusic, stopGameMusic } from '../lib/sound';
import type { GameState } from '../types/game';

/**
 * Switches from menu music to the shuffling "standard" in-game tracks
 * the moment GameBoard mounts, and switches back to menu music if this
 * ever unmounts (defensive; nothing currently navigates away from an
 * in-progress game, but the sound engine shouldn't be left thinking a
 * game's still running if that changes).
 *
 * Also drives the ambience layer (see lib/sound.ts's setAmbience):
 * 'general' for ordinary play, switching to 'pocketDimension' for as
 * long as SCP-106's Pocket Dimension ordeal is underway, and back to
 * 'menu' once this unmounts. The pocketDimensionOrdeal-driven effect
 * covers the initial mount too (game may briefly be undefined on the
 * first render, same as an ordeal not being active - both fall through
 * to 'general'), so there's no separate "set it to general on mount" step.
 */
export function useGameMusic(game: GameState | undefined): void {
  useEffect(() => {
    startGameMusic();
    return () => {
      stopGameMusic();
      setAmbience('menu');
    };
  }, []);

  useEffect(() => {
    setAmbience(game?.pocketDimensionOrdeal ? 'pocketDimension' : 'general');
  }, [game?.pocketDimensionOrdeal]);
}
