import { STARTING_PIECES } from '../data/pieces';
import type { PieceId } from '../types/game';
import { useNarrativeMode } from './useNarrativeMode';
import './PieceInfoPanel.css';

interface PieceInfoPanelProps {
  pieceId: PieceId;
}

// Every powerDescription in data/pieces.ts is written as one or more
// "Named Power: what it does." sentences run together in a single
// paragraph - readable as prose, but it reads as one dense block at a
// glance. Splits right before each named power starts (a capitalized
// run of words immediately followed by a colon, right after a
// sentence boundary) so each power renders as its own line instead.
export function splitPowerText(text: string): string[] {
  return text.split(/(?<=\.)\s+(?=[A-Z][A-Za-z' -]*:)/);
}

// Shows the viewing player's own Personnel once the game has actually
// started - the Special Power stays hidden during beginner-mode
// selection (LobbyScreen only shows name/title), but once play begins
// everyone already knows their own Personnel, so there's no reason to
// keep hiding it from them here.
function PieceInfoPanel({ pieceId }: PieceInfoPanelProps) {
  const mode = useNarrativeMode();
  const piece = STARTING_PIECES.find((p) => p.id === pieceId);
  if (!piece) return null;

  const text = (mode === 'gears' ? piece.powerDescriptionGears : piece.powerDescription) ?? 'None yet - to be designed.';
  const powers = splitPowerText(text);

  return (
    <aside className="piece-info-panel">
      <p className="piece-info-name">{piece.name}</p>
      <p className="piece-info-title">{piece.title}</p>
      <p className="piece-info-label">Power</p>
      {powers.map((power, index) => (
        <p key={index} className="piece-info-text">
          {power}
        </p>
      ))}
    </aside>
  );
}

export default PieceInfoPanel;
