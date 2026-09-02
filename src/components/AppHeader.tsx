import AnomalyGuideButton from './AnomalyGuideButton';
import NarrativeModeToggle from './NarrativeModeToggle';
import RuleBookButton from './RuleBookButton';
import SoundToggle from './SoundToggle';
import './AppHeader.css';

interface AppHeaderProps {
  /** The Rule Book and Anomaly Guide only make sense once you're in a Room (lobby or in-game) - the landing screen renders this without either. */
  showRuleBook?: boolean;
}

// The fixed top-left corner cluster (mobile: a full-width header bar
// instead - see AppHeader.css) shared by every screen. Owns the
// positioning; SoundToggle/RuleBookButton/AnomalyGuideButton/
// NarrativeModeToggle just lay out their own content within it.
function AppHeader({ showRuleBook = false }: AppHeaderProps) {
  return (
    <div className="app-header">
      <SoundToggle />
      {showRuleBook && <RuleBookButton />}
      {showRuleBook && <AnomalyGuideButton />}
      {showRuleBook && <NarrativeModeToggle />}
    </div>
  );
}

export default AppHeader;
