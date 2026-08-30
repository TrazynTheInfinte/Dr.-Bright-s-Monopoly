import type { PieceId } from '../types/game';

interface PieceIconProps {
  pieceId: PieceId;
  className?: string;
}

// One small terminal-glyph icon per Piece - line art (stroke, not fill),
// matching BoardTileIcon's schematic style, and actually drawn to match
// each Personnel's real role rather than the literal old Monopoly token
// shape its pieceId is named after (a leftover from the pre-SCP reskin:
// 'boot' draws D-Class, 'battleship' draws MTF Operative, and so on -
// see data/pieces.ts for the full id-to-Personnel mapping). No image
// assets. Since Room assignment never lets two active players hold the
// same Piece at once, the icon alone is enough to tell players apart on
// the board (the colored circle behind it is just a bit of extra
// at-a-glance seat color, not load-bearing for identity).
function PieceIcon({ pieceId, className }: PieceIconProps) {
  switch (pieceId) {
    case 'boot': // D-Class Personnel - an ID tag on a lanyard, numbered and disposable
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6.5 19 C6.5 14.8 8.8 12.5 12 12.5 C15.2 12.5 17.5 14.8 17.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="9.5" y="18.5" width="5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'battleship': // MTF Operative - a targeting reticle
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'car': // Site Director - command star on a shield
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 L19 6.2 V12 C19 16.5 16 19.5 12 21 C8 19.5 5 16.5 5 12 V6.2 Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M12 8 L13.1 10.5 L15.8 10.8 L13.8 12.6 L14.4 15.3 L12 13.9 L9.6 15.3 L10.2 12.6 L8.2 10.8 L10.9 10.5 Z" fill="currentColor" />
        </svg>
      );
    case 'iron': // Janitor - a service key
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="7" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10.3 12 H19 M15.2 12 V15 M18 12 V14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'thimble': // Intern - an onboarding checklist
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="6" y="5" width="12" height="16" rx="1" stroke="currentColor" strokeWidth="1.7" />
          <rect x="9" y="3.2" width="6" height="3" rx="0.7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 11.5 H15 M9 14.8 H15 M9 18 H12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'dog': // Field Researcher - a magnifying glass
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.9" />
          <path d="M15 15 L20.5 20.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      );
    case 'wheelBarrel': // Logistics Officer - a supply crate
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="6" width="14" height="14" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5 6 L12 3 L19 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 3 V20 M5 13 H19" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case 'hat': // Administrator - an approval stamp
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="8.5" y="3" width="7" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 7.5 V12.5 H14.5 V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="5.5" y="12.5" width="13" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.5 16 L10.4 17.9 L15.5 13.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'penguin': // Specialist - a containment shield
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 L19 6.2 V12 C19 16.5 16 19.5 12 21 C8 19.5 5 16.5 5 12 V6.2 Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.6" fill="currentColor" />
        </svg>
      );
    case 'cat': // Spy - a watching eye, slit pupil
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12 C 6 7, 18 7, 21 12 C 18 17, 6 17, 3 12 Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <ellipse cx="12" cy="12" rx="1.3" ry="2.8" fill="currentColor" />
        </svg>
      );
    case 'rubberDuck': // Security Officer - handcuffs
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="8" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11 12 H13" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'trex': // Rogue Anomaly - a breached, glitching containment cell
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M4 9 H10 L8 12 H14 L11 15 H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default PieceIcon;
