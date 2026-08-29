import type { PieceDefinition } from '../types/game';

// All 12 tokens, reskinned from Comunopoly's communist-themed roster to
// SCP Foundation personnel types. Originally most Special Powers were
// kept unchanged from the original Piece, just reworded - being
// replaced piece by piece with purpose-built SCP-flavored powers as
// design work continues (see CONTEXT.md's Personnel section for what's
// changed so far: D-Class, Janitor, MTF Operative, Site Director).
// Note: Site Director's "Executive Authority" (choose a card from
// either deck) makes Field Researcher's own power a strict subset of
// it - not fixed, just worth knowing. Specialist (Penguin) is still
// powerless.
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
    powerDescription:
      "Rapid Deployment: Maintenance Tunnels cost half price to requisition, and rent collected on an owned Tunnel is doubled. Show of Force: the first time (per game) another player lands on an owned Wing, may seize one of their other Wings or Tunnels instead of collecting rent.",
  },
  {
    id: 'car',
    name: 'Site Director',
    title: 'Site Director',
    powerDescription:
      'Executive Authority: can choose a card when landing on either deck. Redirect Without Exposure: once per game, after drawing a card, may hand its effect to another player instead - nothing on record shows it was ordered from the top.',
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
