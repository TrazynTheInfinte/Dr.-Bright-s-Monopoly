// A per-browser (not per-room, not synced) reading preference: "Dr.
// Bright" is the game's usual in-universe flavor text everywhere it
// appears (piece powers, the Anomaly Guide); "Dr. Gears" swaps in a
// blunt, mechanical rewrite of the exact same information instead, for
// anyone who'd rather skip the narration. Same persistence pattern as
// lib/sound.ts's mute flag - module-level state seeded from
// localStorage once, read/written directly rather than through React
// state, since this doesn't need to trigger a re-render on its own
// (components read it fresh whenever they render).

export type NarrativeMode = 'bright' | 'gears';

const STORAGE_KEY = 'narrativeMode';

let mode: NarrativeMode = localStorage.getItem(STORAGE_KEY) === 'gears' ? 'gears' : 'bright';

// Every component that displays mode-dependent text (PieceInfoPanel,
// AnomalyGuideButton) needs to re-render the instant the toggle button
// (which lives elsewhere in the tree, with no shared parent state)
// switches it - see useNarrativeMode below, built on this the same way
// any external-store subscription would be.
const listeners = new Set<() => void>();

export function getNarrativeMode(): NarrativeMode {
  return mode;
}

export function toggleNarrativeMode(): NarrativeMode {
  mode = mode === 'bright' ? 'gears' : 'bright';
  localStorage.setItem(STORAGE_KEY, mode);
  listeners.forEach((listener) => listener());
  return mode;
}

export function subscribeToNarrativeMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
