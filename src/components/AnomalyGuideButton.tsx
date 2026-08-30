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
  theVoices:
    'Blind. Locates prey by ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ and begins pursuit immediately upon breach - no visual ' +
    'confirmation required or possible. Breach events involving this entity are not to be logged through standard ' +
    'channels; the first reliable indicator of an active breach is a missing person. Personnel who report an ' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ sensation of their own accord, unprompted, should be evacuated immediately rather than ' +
    'questioned.',
  theDoctor:
    'Cooperative under normal circumstances. Periodically and unpredictably identifies a specific individual as ' +
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓, with no observable pattern to the selection. A first identification is non-fatal but ' +
    'debilitating; personnel already once identified are not to be reintroduced to its presence under any ' +
    'circumstances, as a second identification does not end the same way. Site-wide notice: any ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ' +
    'produced by this entity remains mobile and hazardous independent of the entity itself, and should be reported ' +
    'and avoided on sight, not approached.',
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
  evasionHat:
    'Renders the wearer ▓▓▓▓▓▓▓▓▓▓▓▓ to on-site hostile entities for a limited window. Effective against every ' +
    'known threat class without exception - the mechanism is not understood well enough to explain why.',
  microHid:
    'A directed-energy termination tool. Rated output reaches a limited distance reliably; exceeding rated output ' +
    'reaches much further, at a real risk of ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ instead of the intended target.',
  jailbird:
    "Melee-range containment equipment, already past its certified service life. Every deployment carries an " +
    "increasing risk of catastrophic failure - personnel are reminded it is authorized for exactly three more " +
    "uses before mandatory decommissioning, malfunction or not.",
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
