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
    case 'evasionHat': // SCP-268 - a wide-brimmed hat
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <ellipse cx="12" cy="16" rx="10" ry="2.6" stroke="currentColor" strokeWidth="2" />
          <path d="M7 16 C7 10 9 6 12 6 C15 6 17 10 17 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'microHid': // Micro H.I.D. - a beam weapon
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="10" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="2" />
          <path d="M12 12.5 H22 M17 9 L22 12.5 L17 16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case 'jailbird': // Jailbird - a shock baton
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20 L15 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" transform="rotate(45 17.5 6.5)" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
}

export default ObjectAnomalyIcon;
