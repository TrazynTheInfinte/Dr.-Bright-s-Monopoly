import { useSyncExternalStore } from 'react';
import { getNarrativeMode, subscribeToNarrativeMode, type NarrativeMode } from '../lib/narrativeMode';

/** Re-renders the calling component whenever the Dr. Bright/Dr. Gears toggle (NarrativeModeToggle, in AppHeader) switches - the toggle lives elsewhere in the tree with no shared parent state, so this is a plain external-store subscription rather than context. */
export function useNarrativeMode(): NarrativeMode {
  return useSyncExternalStore(subscribeToNarrativeMode, getNarrativeMode);
}
