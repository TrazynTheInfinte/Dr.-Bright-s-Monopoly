import { useEffect, useRef, useState } from 'react';

const FLASH_LIFETIME_MS = 500;

/**
 * True for a brief moment right after the Site Warhead activates -
 * drives a full-screen flash overlay (see the .warhead-flash render in
 * GameBoard.tsx) so a purge reads as a real event for everyone in the
 * room, not just a log line. Diffs log CONTENT the same way
 * useSoundEvents/useRecentTileFlashes do, not array reference -
 * Firestore reconstructs the whole document on every snapshot.
 */
export function useWarheadFlash(log: string[]): boolean {
  const prevLogRef = useRef<string[]>(log);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    const prevLog = prevLogRef.current;
    prevLogRef.current = log;
    if (log === prevLog) return;

    const lastPrevEntry = prevLog[prevLog.length - 1];
    const matchIndex = lastPrevEntry ? log.lastIndexOf(lastPrevEntry) : -1;
    const newEntries = matchIndex === -1 ? [] : log.slice(matchIndex + 1);
    if (!newEntries.some((entry) => entry.startsWith('Site Warhead activated'))) return;

    setIsFlashing(true);
    const timer = setTimeout(() => setIsFlashing(false), FLASH_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [log]);

  return isFlashing;
}
