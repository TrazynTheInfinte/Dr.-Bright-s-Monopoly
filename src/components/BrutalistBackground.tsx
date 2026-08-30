import './BrutalistBackground.css';

// Purely decorative backdrop (concrete grain, bold diagonal bars, an
// SCP Foundation insignia, a ring) sitting fixed behind every screen.
// Rendered once at the App root so it never remounts/flickers between
// the landing screen, the lobby, and an in-progress game.
function BrutalistBackground() {
  return (
    <div className="brutalist-bg" aria-hidden="true">
      <div className="brutalist-bg-texture" />
      <div className="brutalist-bg-bar brutalist-bg-bar--tl" />
      <div className="brutalist-bg-bar brutalist-bg-bar--br" />
      {/* The Foundation insignia - a circle with three arrows radiating
          outward at 120 degrees apart, same line-art convention as
          BoardTileIcon/PieceIcon (a single arrow shape drawn once, then
          rotated twice) rather than a communist star. */}
      <svg className="brutalist-bg-star" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="50" cy="50" r="4" fill="currentColor" />
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 46 L50 14 M41 23 L50 10 L59 23" />
          <path d="M50 46 L50 14 M41 23 L50 10 L59 23" transform="rotate(120 50 50)" />
          <path d="M50 46 L50 14 M41 23 L50 10 L59 23" transform="rotate(240 50 50)" />
        </g>
      </svg>
      <div className="brutalist-bg-ring" />
    </div>
  );
}

export default BrutalistBackground;
