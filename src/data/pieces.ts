import type { PieceDefinition } from '../types/game';

// All 12 tokens, reskinned from Comunopoly's communist-themed roster to
// SCP Foundation personnel types. Every Special Power that still
// functions standalone under classic Monopoly rules (no Win
// Conditions/Score, no West/Smuggling stash, no Stalin-only STOY fee)
// is kept unchanged, just reworded. Two powers (Janitor, Cryptid
// Handler) depended entirely on removed mechanics and are left
// powerless for now - see CONTEXT.md's Personnel section - rather than
// inventing new mechanics in what's meant to be a pure reskinning pass.
export const STARTING_PIECES: PieceDefinition[] = [
  {
    id: 'boot',
    name: 'D-Class',
    title: 'D-Class Personnel',
    powerDescription: 'Utilities are half price.',
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
    // Comunopoly's Iron never had to pay the bribe to pass STOY - a
    // Stalin-only fee that classic rules never charge anyone, so this
    // Piece is powerless until it gets a real one.
    powerDescription: null,
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
    name: 'Cryptid Handler',
    title: 'Anomalous Cryptid Handler',
    // Comunopoly's Penguin was built entirely around Smuggling money to
    // the West - a house rule this build drops. Powerless until it
    // gets a real one.
    powerDescription: null,
  },
  {
    id: 'cat',
    name: 'Ethics Liaison',
    title: 'Ethics Committee Liaison',
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
