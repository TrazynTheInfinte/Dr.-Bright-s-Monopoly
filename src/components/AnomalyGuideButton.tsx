import { useState } from 'react';
import type { AnomalyId } from '../data/anomalies';
import { ANOMALIES } from '../data/anomalies';
import AnomalyIcon from './AnomalyIcon';
import InfoModalShell from './InfoModalShell';
import './AnomalyGuideButton.css';

// Deliberately distinct copy from data/anomalies.ts's flavorText (which
// narrates what actually happens on the board, unredacted, for the log/UI
// context where a player is already dealing with the thing). This is meant
// to read like a redacted personnel briefing instead - true, but with the
// specific trigger/mechanic censored out, same spirit as the rest of the
// Foundation-clearance framing.
const REDACTED_BRIEFS: Record<AnomalyId, string> = {
  shyGuy:
    'Docile and non-aggressive provided ▓▓▓▓▓▓▓▓▓▓▓▓ is not observed, by any means. The instant it is, ' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ and pursuit begins immediately. No recorded instance of successful evasion once ' +
    'pursuit has started.',
  theSculpture:
    'Extremely dangerous. Must not be left unwatched under any circumstances - blinking is permitted. The moment ' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ loses line of sight, entity relocates at a speed inconsistent with its construction. ' +
    'Personnel nearest at time of breach are advised to already be moving.',
  theOldMan:
    'Passes through solid matter and corrodes organic tissue on contact. Containment Chamber breaches are ' +
    'self-initiated and require no external stimulus. Entity does not need to see, hear, or otherwise detect a ' +
    'target to begin pursuit. Anyone caught is pulled into a ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ from which escape is not guaranteed.',
};

function AnomalyGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="anomaly-guide-toggle" onClick={() => setOpen(true)}>
        ☣ Anomaly Guide
      </button>

      {open && (
        <InfoModalShell
          eyebrow="Redacted Personnel Briefing - Distribute on a Need-to-Know Basis"
          title="Known Hostile Anomalies"
          closing="If Contained, Report Immediately."
          onClose={() => setOpen(false)}
        >
          <div className="anomaly-guide-entries">
            {ANOMALIES.map((anomaly) => (
              <section key={anomaly.id} className="anomaly-guide-entry">
                <AnomalyIcon anomalyId={anomaly.id} className="anomaly-guide-icon" />
                <div className="anomaly-guide-entry-body">
                  <h2>{anomaly.name}</h2>
                  <p>{REDACTED_BRIEFS[anomaly.id]}</p>
                </div>
              </section>
            ))}
          </div>
        </InfoModalShell>
      )}
    </>
  );
}

export default AnomalyGuideButton;
