import { useState } from 'react';
import './RuleBookButton.css';

interface RuleBookSection {
  title: string;
  body: string[];
}

// Deliberately a condensed quick-reference, not a full rules document -
// the core loop plus this project's own tweaks, but no per-Personnel
// Special Power list (that stays a surprise until you've actually
// picked one - see LobbyScreen/PieceInfoPanel) and no full card list
// (drawing one is the whole point).
const SECTIONS: RuleBookSection[] = [
  {
    title: 'I. The Goal',
    body: [
      "Every player begins equal: 1500 Foundation Credits and a Personnel token with a Special Power that stays hidden until you've actually claimed it. Acquire Wings, collect the rent you're owed, and complete your Sectors. Last one not Terminated wins.",
    ],
  },
  {
    title: 'II. Taking Your Turn',
    body: [
      'Roll two dice and advance that many spaces clockwise. Doubles earn you another roll immediately - but three doubles in a row, and you go straight to the Containment Chamber instead of moving a third time.',
    ],
  },
  {
    title: 'III. Wings & Rent',
    body: [
      "Land on an unclaimed Wing or Maintenance Tunnel and it's yours for the taking, provided you can afford it. Land on one someone else already holds and you owe them rent - more if they hold the whole Sector, more still if they've built houses or a hotel on it.",
    ],
  },
  {
    title: 'IV. Building & Mortgages',
    body: [
      "Own every Wing in a Sector and you can build houses (then a hotel) on them to raise the rent. Short on cash? Mortgage a Wing for half its price - you can't collect rent on it again until you pay the mortgage off, plus a little interest.",
    ],
  },
  {
    title: 'V. The Containment Chamber',
    body: [
      "The Reassigned tile, three doubles, or certain cards can land you here. Roll doubles on your own turn to walk free. Otherwise, a Holding Fee (50 Credits) is charged every turn you stay - or pay the steeper Escape Fee (200 Credits) to leave immediately, no waiting. After 3 turns paying the Holding Fee, you're released for free either way.",
    ],
  },
  {
    title: 'VI. Cards',
    body: [
      'Land on an Anomalous Event or Foundation Directive tile and draw from that pile. Could be a windfall, could cost you.',
    ],
  },
  {
    title: 'VII. Trading',
    body: [
      'Anytime, not just on your turn, you can propose a trade with another player - Wings, Credits, and held cards, in any combination, in either direction. Nothing happens until they accept.',
    ],
  },
  {
    title: 'VIII. Termination',
    body: [
      "Owe more than you can pay, and can't raise the difference by selling houses or mortgaging Wings? You're Terminated - everything you held returns to the Foundation (or whoever you owed), and you're out for the rest of the match. The game ends the instant only one player is left.",
    ],
  },
];

function RuleBookButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="rule-book-toggle" onClick={() => setOpen(true)}>
        📖 Rule Book
      </button>

      {open && (
        <div className="rule-book-overlay" onClick={() => setOpen(false)}>
          <div className="rule-book" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="rule-book-close"
              onClick={() => setOpen(false)}
              aria-label="Close rule book"
            >
              ✕
            </button>

            <p className="rule-book-eyebrow">Cleared for Level 2 Personnel and Above</p>
            <h1 className="rule-book-title">Rules of Dr. Bright's Monopoly</h1>

            <div className="rule-book-sections">
              {SECTIONS.map((section) => (
                <section key={section.title}>
                  <h2>{section.title}</h2>
                  {section.body.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>

            <p className="rule-book-closing">Secure. Contain. Bankrupt.</p>
          </div>
        </div>
      )}
    </>
  );
}

export default RuleBookButton;
