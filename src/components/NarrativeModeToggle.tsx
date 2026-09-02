import { toggleNarrativeMode } from '../lib/narrativeMode';
import { useNarrativeMode } from './useNarrativeMode';
import './NarrativeModeToggle.css';

// A single button labeled with whichever mode is currently active -
// clicking it switches to the other. Per-browser preference, not
// synced to the room - see lib/narrativeMode.ts.
function NarrativeModeToggle() {
  const mode = useNarrativeMode();

  return (
    <button type="button" className="narrative-mode-toggle" onClick={() => toggleNarrativeMode()}>
      {mode === 'bright' ? '📋 Dr. Bright' : '🔧 Dr. Gears'}
    </button>
  );
}

export default NarrativeModeToggle;
