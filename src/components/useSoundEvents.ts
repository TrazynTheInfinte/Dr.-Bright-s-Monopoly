import { useEffect, useRef } from 'react';
import { playCash, playDisappear, playEnterRageStinger, playExplosion, playJail, playSeize } from '../lib/sound';

// Rogue Anomaly's auto-consume, Logistics Officer's auto-requisition,
// and MTF Operative's Show of Force all force a Wing to change hands
// with no Credits involved, so none of them match playCash's "Credits"
// check below - this is their own catch, checked first so they don't
// also (redundantly) match anything else. See useRecentTileFlashes for
// the matching tile-flash.
const SEIZE_PATTERN = /^Automatically seized |^Logistics Officer automatically requisitioned |^Show of Force:/;

/**
 * Watches the shared event log for newly-appended entries and plays a
 * matching sound - covers money changing hands, forced seizures (no
 * money involved), the Containment Chamber, and Termination, for every
 * viewer (not just whoever caused it), since the log is shared game
 * state. Dice and card sounds are handled separately (DiceRoller, the
 * card-reveal banner) since those already have their own more precise
 * animation-synced triggers.
 *
 * Diffs by comparing log CONTENT (finding where the previous log's last
 * entry still appears), not array reference - Firestore reconstructs
 * the whole document from scratch on every snapshot, so log would
 * otherwise look "new" on every unrelated update too (the same trap
 * that broke the dice tumble animation before it was fixed).
 */
export function useSoundEvents(log: string[]): void {
  const prevLogRef = useRef<string[]>(log);

  useEffect(() => {
    const prevLog = prevLogRef.current;
    prevLogRef.current = log;

    if (log === prevLog) return;

    const lastPrevEntry = prevLog[prevLog.length - 1];
    const matchIndex = lastPrevEntry ? log.lastIndexOf(lastPrevEntry) : -1;
    // If nothing matches, either this is the very first real log (fine
    // to skip - nothing to announce yet) or the whole previous tail got
    // evicted by the log's 20-entry cap (rare) - either way, falling
    // back to "no new entries" beats replaying a huge backlog of sound.
    const newEntries = matchIndex === -1 ? [] : log.slice(matchIndex + 1);

    for (const entry of newEntries) {
      if (entry.startsWith('Site Warhead activated')) {
        playExplosion();
      } else if (entry.includes('noticed it was being watched')) {
        // Only SCP-096 ("The Shy Guy") ever triggers this, via viewAnomaly
        // - the moment it locks onto a target and starts hunting.
        playEnterRageStinger();
      } else if (/Terminated/.test(entry)) {
        playDisappear();
      } else if (/to the Containment Chamber/i.test(entry)) {
        playJail();
      } else if (SEIZE_PATTERN.test(entry)) {
        playSeize();
      } else if (/Credits/i.test(entry)) {
        playCash();
      }
    }
  }, [log]);
}
