import type { AnomalyId } from '../data/anomalies';

interface AnomalyIconProps {
  anomalyId: AnomalyId;
  className?: string;
}

// A distinct glyph per Hostile Anomaly, replacing the shared ☣ marker -
// same line-art convention as PieceIcon/BoardTileIcon, but bolder/
// simpler (these render tiny, staggered on a board tile, so fine
// detail would just blur away). No image assets.
function AnomalyIcon({ anomalyId, className }: AnomalyIconProps) {
  switch (anomalyId) {
    case 'shyGuy': // SCP-096 - a watched eye, crossed out (don't look at it)
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path d="M4 4 L20 20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'theSculpture': // SCP-173 - a standing statue silhouette
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="3.2" />
          <path d="M7 21 L8.5 12 C8.8 9.5 10.2 8 12 8 C13.8 8 15.2 9.5 15.5 12 L17 21 Z" />
        </svg>
      );
    case 'theOldMan': // SCP-106 - a spiral, the Pocket Dimension's own gateway
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8 A7 7 0 1 0 19 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'theVoices': // SCP-939 - blind, hunts by sound
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9 4 C5 4 3 8 3 12 C3 16 5 20 9 20 C9 16 6 15 6 12 C6 9 9 8 9 4 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M13 8 C15 9.5 15 14.5 13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M17 5 C21 8.5 21 15.5 17 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'theDoctor': // SCP-049 - a plague doctor's beaked mask
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 10 C6 6 8.5 3 12 3 C15.5 3 18 6 18 10 C18 11 21 12.5 21 14.5 C21 16 18.5 16.5 17 15.5 C16 18 14 20 12 20 C10 20 8 18 7 15.5 C5.5 16.5 3 16 3 14.5 C3 12.5 6 11 6 10 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="10" r="1.1" fill="currentColor" />
          <circle cx="14.5" cy="10" r="1.1" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

export default AnomalyIcon;
