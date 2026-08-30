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
    default:
      return null;
  }
}

export default AnomalyIcon;
