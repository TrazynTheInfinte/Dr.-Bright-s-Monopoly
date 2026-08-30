import type { ObjectAnomalyId } from '../data/objectAnomalies';

interface ObjectAnomalyIconProps {
  objectId: ObjectAnomalyId;
  className?: string;
}

function ObjectAnomalyIcon({ objectId, className }: ObjectAnomalyIconProps) {
  switch (objectId) {
    case 'gamersFuel': // SCP-207 - a bottle
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10 2 H14 V6 L17 10 V21 C17 21.5 16.5 22 16 22 H8 C7.5 22 7 21.5 7 21 V10 L10 6 Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M8 14 H16" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'badComposition': // SCP-012 - a music staff, unfinished
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 7 H21 M3 11 H21 M3 15 H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="17" cy="17" r="2.4" fill="currentColor" />
          <path d="M19.2 17 V8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'countermeasure': // SCP-963 - a ring
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="2.2" />
          <path d="M9 6.5 L12 2 L15 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default ObjectAnomalyIcon;
