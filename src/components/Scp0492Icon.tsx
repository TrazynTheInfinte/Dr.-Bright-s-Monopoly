interface Scp0492IconProps {
  className?: string;
}

// A shambling reanimated corpse left behind by a fatal SCP-049 catch - a
// slumped, lopsided silhouette, distinct from the upright plague-doctor
// mask glyph (AnomalyIcon's theDoctor) so the two are never confused on
// the board.
function Scp0492Icon({ className }: Scp0492IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="5" r="2.6" stroke="currentColor" strokeWidth="2" />
      <path
        d="M10 8 C7 9 6 12 7 15 L6 21 M10 8 C13 9.5 15 11 15 14 L17 20 M8.5 13 L4 15 M11 12 L16 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Scp0492Icon;
