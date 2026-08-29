import type { PieceDefinition } from '../types/game';

// All 12 tokens, reskinned from Comunopoly's communist-themed roster to
// SCP Foundation personnel types. Most Special Powers are kept
// unchanged from the original Piece they're reskinned from, just
// reworded - see CONTEXT.md's Personnel section. D-Class and Janitor
// are the exceptions: their original powers depended on mechanics this
// build dropped, so they got new, purpose-built powers instead (see
// game/engine.ts's usedExpendabilityClause/usedMasterKey handling and
// useJanitorTunnelTravel). Specialist (Penguin) is still powerless.
export const STARTING_PIECES: PieceDefinition[] = [
  {
    id: 'boot',
    name: 'D-Class',
    title: 'D-Class Personnel',
    powerDescription:
      "Standard Expendability Clause: docile and compliant - never billed the Holding Fee or the Escape Fee for time spent in the Containment Chamber, no questions asked. The first time this D-Class would be Terminated, Personnel Records instead files a requisition for a replacement: they're back in play immediately with reduced starting Credits, no memory of the incident. Doesn't happen twice.",
  },
  {
    id: 'battleship',
    name: 'MTF Operative',
    title: 'Mobile Task Force Operative',
    powerDescription: 'Maintenance Tunnels are half price.',
  },
  {
    id: 'car',
    name: 'Site Director',
    title: 'Site Director',
    powerDescription: 'Can choose a card when landing on an Anomalous Event tile.',
  },
  {
    id: 'iron',
    name: 'Janitor',
    title: 'Janitorial Staff',
    powerDescription:
      'Below the Floor Plan: knows every service corridor the Foundation never bothered to blueprint. Once per turn, from one Maintenance Tunnel, can move directly to any other one for free, and never pays toll on a Tunnel. Keeps a master keyring from decades of unsupervised access - once per game, walks straight out of the Containment Chamber without paying the Escape Fee.',
  },
  {
    id: 'thimble',
    name: 'Intern',
    title: 'Foundation Intern',
    powerDescription: 'Only rolls 1 die.',
  },
  {
    id: 'dog',
    name: 'Field Researcher',
    title: 'Field Researcher',
    powerDescription: 'Can choose a card when landing on a Foundation Directive tile.',
  },
  {
    id: 'wheelBarrel',
    name: 'Logistics Officer',
    title: 'Logistics & Requisitions Officer',
    powerDescription:
      'Automatically takes any purple-Sector Wing you land on - free if unowned, seized (no rent) if someone else owns it.',
  },
  {
    id: 'hat',
    name: 'Administrator',
    title: 'Site Administrator',
    powerDescription: 'When you complete a Sector, get a free house.',
  },
  {
    id: 'penguin',
    name: 'Specialist',
    title: 'Containment Specialist',
    // Comunopoly's Penguin was built entirely around Smuggling money to
    // the West - a house rule this build drops. Powerless until it
    // gets a real one.
    powerDescription: null,
  },
  {
    id: 'cat',
    name: 'Spy',
    title: 'Chaos Insurgency Spy',
    powerDescription:
      'After reading a drawn Anomalous Event/Foundation Directive card, choose to keep it or hand its entire effect to another player instead.',
  },
  {
    id: 'rubberDuck',
    name: 'Security Officer',
    title: 'Internal Security Officer',
    powerDescription:
      'Any time your own move lands you on the same square as another player, you can choose to send them to the Containment Chamber.',
  },
  {
    id: 'trex',
    name: 'Rogue Anomaly',
    title: 'Uncontained Anomaly',
    powerDescription:
      "Can't buy Wings. Landing on one owned by someone else seizes it automatically (no rent paid).",
  },
];
