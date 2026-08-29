import type { PieceDefinition } from '../types/game';

// All 12 tokens, reskinned from Comunopoly's communist-themed roster to
// SCP Foundation personnel types. Every power below is purpose-built
// for this game (not a straight port of the old communist-themed
// Piece it replaces) - see CONTEXT.md's Personnel section for the
// vocabulary. Note: Site Director's "Executive Authority" (choose a
// card from either deck) makes Field Researcher's own power a strict
// subset of it - not fixed, just worth knowing. Specialist (Penguin)
// is still powerless, pending a power of its own.
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
      "Rapid Deployment: trained to move through the tunnel network faster than anyone should legally be allowed to - requisitions Maintenance Tunnels at half price, and collects double toll from anyone who uses one they hold. Show of Force: the first time another player wanders onto a Wing they've secured, can make an example of them instead of billing rent - seizing one of that player's other holdings on the spot.",
  },
  {
    id: 'car',
    name: 'Site Director',
    title: 'Site Director',
    powerDescription:
      "Executive Authority: sees every incoming report before anyone else does, and pulls whichever card they like off either deck. Redirect Without Exposure: once per game, quietly reroutes a drawn card's consequences onto someone else's desk - the paperwork never shows whose call it really was.",
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
    powerDescription: "Still Learning the Ropes: hasn't been cleared to handle both dice unsupervised yet - rolls only 1.",
  },
  {
    id: 'dog',
    name: 'Field Researcher',
    title: 'Field Researcher',
    powerDescription:
      "Peer Review: reads every Foundation Directive before it's filed - gets to pick which one actually goes through when landing on that tile. Grant Funding: cleared for a modest research stipend (25 Credits) any time fieldwork puts them on a card tile, Directive or Event alike, whatever the card turns out to say.",
  },
  {
    id: 'wheelBarrel',
    name: 'Logistics Officer',
    title: 'Logistics & Requisitions Officer',
    powerDescription:
      "Requisition Priority: the cheapest Wings on Site fall under Logistics' jurisdiction by default - automatically claims any purple-Sector Wing landed on, free if it's unclaimed, repossessed without payment if someone else already holds it. Bulk Requisition: orders houses and hotels in bulk, at a standing 25% discount. Overstock: keeps a private stockpile off the books - builds are never blocked by, or counted against, the Foundation's shared house/hotel supply.",
  },
  {
    id: 'hat',
    name: 'Administrator',
    title: 'Site Administrator',
    powerDescription:
      'Fast-Tracked Permits: completing a Sector under their signature means the paperwork for its first house clears same-day, free of charge.',
  },
  {
    id: 'penguin',
    name: 'Specialist',
    title: 'Containment Specialist',
    // Comunopoly's Penguin was built entirely around Smuggling money to
    // the West - a house rule this build drops. Personnel file still
    // pending a Special Power of its own.
    powerDescription: null,
  },
  {
    id: 'cat',
    name: 'Spy',
    title: 'Chaos Insurgency Spy',
    powerDescription:
      "Plausible Deniability: after reading a drawn card, decides whether to act on it personally or make sure it lands on someone else's file instead.",
  },
  {
    id: 'rubberDuck',
    name: 'Security Officer',
    title: 'Internal Security Officer',
    powerDescription:
      "Standard Patrol: if their rounds happen to put them on the same square as someone else, can have that person hauled off to the Containment Chamber on the spot.",
  },
  {
    id: 'trex',
    name: 'Rogue Anomaly',
    title: 'Uncontained Anomaly',
    powerDescription:
      "Uncontained: can't be trusted to file a purchase request through normal channels - anything it steps on that's already claimed gets consumed outright, no rent, no receipt.",
  },
];
