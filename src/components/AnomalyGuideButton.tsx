import { useState } from 'react';
import type { AnomalyId } from '../data/anomalies';
import { ANOMALIES } from '../data/anomalies';
import type { ObjectAnomalyId } from '../data/objectAnomalies';
import { OBJECT_ANOMALIES } from '../data/objectAnomalies';
import AnomalyIcon from './AnomalyIcon';
import InfoModalShell from './InfoModalShell';
import ObjectAnomalyIcon from './ObjectAnomalyIcon';
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

// Same redaction convention as REDACTED_BRIEFS above, applied to Object
// Anomalies instead - true, but with the specific mechanism censored.
const OBJECT_REDACTED_BRIEFS: Record<ObjectAnomalyId, string> = {
  gamersFuel:
    'A stimulant, effective and immediate. Prolonged or repeated use inflicts ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ proportional to ' +
    'exertion - fatal past a threshold that has never been formally established, because nobody has stopped ' +
    'drinking long enough to find it.',
  badComposition:
    'An unfinished score, safe to study in small doses. Sessions grow progressively more compelling regardless of ' +
    'who studies it, and its rate of ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ is cumulative across every attempt made on it. Assume every ' +
    'session brings it measurably closer to something none of them will be present to regret.',
  countermeasure:
    'A wearable countermeasure against ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓, of a kind that should not exist and is not to be ' +
    'relied upon. Requires proximity to another living subject at the moment of failure - alone, it does nothing ' +
    'at all.',
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
          title="Anomaly Guide"
          closing="If Contained, or Recovered, Report Immediately."
          onClose={() => setOpen(false)}
        >
          <h2 className="anomaly-guide-group-heading">Hostile Anomalies</h2>
          <div className="anomaly-guide-entries">
            {ANOMALIES.map((anomaly) => (
              <section key={anomaly.id} className="anomaly-guide-entry">
                <AnomalyIcon anomalyId={anomaly.id} className="anomaly-guide-icon" />
                <div className="anomaly-guide-entry-body">
                  <h3>{anomaly.name}</h3>
                  <p>{REDACTED_BRIEFS[anomaly.id]}</p>
                </div>
              </section>
            ))}
          </div>

          <h2 className="anomaly-guide-group-heading">Object Anomalies</h2>
          <div className="anomaly-guide-entries">
            {OBJECT_ANOMALIES.map((object) => (
              <section key={object.id} className="anomaly-guide-entry">
                <ObjectAnomalyIcon objectId={object.id} className="anomaly-guide-icon" />
                <div className="anomaly-guide-entry-body">
                  <h3>{object.name}</h3>
                  <p>{OBJECT_REDACTED_BRIEFS[object.id]}</p>
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
