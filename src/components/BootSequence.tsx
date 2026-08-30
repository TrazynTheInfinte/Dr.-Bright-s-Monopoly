import { useEffect, useRef, useState } from 'react';
import './BootSequence.css';

interface BootSequenceProps {
  onComplete: () => void;
}

const BOOT_LINES = [
  'FOUNDATION SECURE TERMINAL - SITE NETWORK ACCESS',
  'BOOT SEQUENCE INITIATED...',
  'LOADING CONTAINMENT DATABASE.......... OK',
  'LOADING PERSONNEL REGISTRY............ OK',
  'ESTABLISHING SECURE UPLINK............ OK',
  'AUTHENTICATING CLEARANCE...',
  'CLEARANCE LEVEL 2 VERIFIED',
  'ACCESS GRANTED',
];

const LINE_DELAY_MS = 260;
const FINAL_HOLD_MS = 550;

/**
 * A full-screen, non-skippable boot log, shown every time the player
 * opens the main menu or returns to it from a game (App.tsx toggles
 * isBooting on mount and again in handleLeaveRoom) - never on the
 * in-between landing/name-entry navigation within that same visit, and
 * never when restoring straight into an existing Room/game.
 *
 * onComplete is read through a ref rather than being a direct effect
 * dependency - App re-renders for unrelated reasons while this is on
 * screen (useVersionWatcher polls in the background), and a fresh
 * closure identity on every one of those would otherwise reset
 * whichever line's timer was already in flight, potentially never
 * letting the sequence finish.
 */
function BootSequence({ onComplete }: BootSequenceProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (visibleCount >= BOOT_LINES.length) {
      const timer = setTimeout(() => onCompleteRef.current(), FINAL_HOLD_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setVisibleCount((n) => n + 1), LINE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  const isDone = visibleCount >= BOOT_LINES.length;

  return (
    <div className="boot-sequence" role="status" aria-live="polite">
      <div className="boot-sequence-lines">
        {BOOT_LINES.slice(0, visibleCount).map((line, index) => (
          <p key={index} className={index === BOOT_LINES.length - 1 ? 'boot-sequence-line-final' : ''}>
            {line}
          </p>
        ))}
        {!isDone && <span className="boot-sequence-cursor" />}
      </div>
    </div>
  );
}

export default BootSequence;
