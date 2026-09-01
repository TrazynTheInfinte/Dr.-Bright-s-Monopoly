import type { PieceDefinition } from '../types/game';

// All 12 tokens, reskinned from Comunopoly's communist-themed roster to
// SCP Foundation personnel types. Every power below is purpose-built
// for this game (not a straight port of the old communist-themed
// Piece it replaces) - see CONTEXT.md's Personnel section for the
// vocabulary. Note: Site Director's "Executive Authority" (choose a
// card from either deck) makes Field Researcher's own power a strict
// subset of it - not fixed, just worth knowing.
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
    powerDescription:
      "On a Learning Curve: hasn't been cleared to handle both dice unsupervised yet - rolls only 1, until a full lap past the Site Entrance earns them clearance to roll normally for the rest of the game. Unpaid Overtime: the Foundation works interns hardest and reimburses them least - collects an extra 100 Credits every time they pass the Site Entrance, graduated or not.",
  },
  {
    id: 'dog',
    name: 'Field Researcher',
    title: 'Field Researcher',
    powerDescription:
      "Peer Review: reads every Foundation Directive before it's filed - gets to pick which one actually goes through when landing on that tile. Grant Funding: cleared for a research stipend (200 Credits) any time fieldwork puts them on a card tile, Directive or Event alike, whatever the card turns out to say.",
  },
  {
    id: 'wheelBarrel',
    name: 'Logistics Officer',
    title: 'Logistics & Requisitions Officer',
    powerDescription:
      "Universal Requisition: every Sector on Site falls under Logistics' jurisdiction, not just the cheap ones - automatically claims any Wing landed on, anywhere on the board, free if it's unclaimed, repossessed without payment if someone else already holds it. Bulk Requisition: orders houses and hotels in bulk, at a standing 35% discount. Overstock: keeps a private stockpile off the books - builds are never blocked by, or counted against, the Foundation's shared house/hotel supply.",
  },
  {
    id: 'hat',
    name: 'Administrator',
    title: 'Site Administrator',
    powerDescription:
      "Remote Acquisition: re-landing on a Wing they already hold, in a Sector they don't yet fully own, opens a direct requisition on any other still-unowned Wing in that same Sector, at its listed price - no need to physically land on every last tile first. Zoning Authority: doesn't need to own a whole Sector to start building there - a variance is granted for one house per Wing already held (two Wings owned means two houses total across the Sector, and so on), until the Sector's fully theirs, at which point construction proceeds without limit, hotels included. Fast-Tracked Permits: completing a Sector under their signature means the paperwork clears same-day, free of charge - a free house on every Wing in it at once.",
  },
  {
    id: 'penguin',
    name: 'Specialist',
    title: 'Containment Specialist',
    powerDescription:
      "Recontainment: the instant a Hostile Anomaly catches them personally, gets first crack at paying a fee to immediately purge that exact anomaly right back into containment, rather than leaving it loose for someone else to deal with. Containment Insurance: collects a flat payout from Foundation contingency funds any time anyone else at all is caught by a Hostile Anomaly - a breach anywhere on Site is still, technically, a Containment Specialist's business.",
  },
  {
    id: 'cat',
    name: 'Spy',
    title: 'Chaos Insurgency Spy',
    powerDescription:
      "Plausible Deniability: after reading a drawn card, decides whether to act on it personally or make sure it lands on someone else's file instead. Field Expenses: fieldwork isn't free - skims a flat amount of Credits off anyone actually found sharing a tile with them. Sabotage: skims a further cut off anyone else at all, anywhere on the board, the moment their construction budget clears - a quiet tax on every house and hotel built that isn't theirs.",
  },
  {
    id: 'rubberDuck',
    name: 'Security Officer',
    title: 'Internal Security Officer',
    powerDescription:
      "Standard Patrol: if their rounds happen to put them on the same square as someone else, can have that person hauled off to the Containment Chamber on the spot. Apprehension Bounty: an actual jailing pays out a flat Credit reward, straight from Foundation coffers. Security Clearance: the paperwork always clears in their favor - never billed the Holding Fee or the Escape Fee for their own time in the Containment Chamber.",
  },
  {
    id: 'trex',
    name: 'Rogue Anomaly',
    title: 'Uncontained Anomaly',
    powerDescription:
      "Uncontained: can't be trusted to file a purchase request through normal channels - anything it steps on that's already claimed, it can seize outright at a premium over the usual asking price, no rent paid to the owner either way - or just pay rent instead if seizing isn't worth it (or affordable). Fellow anomalies don't see it as prey: hostile breaches never target it, any that were already hunting it lose interest the moment it's reassigned here, and it can always tell where every one of them is actually hiding, concealed or not. Induce a Breach: once per game, doesn't wait around for containment to fail on its own - forces a breach right now, unleashing a random anomaly nobody's currently dealing with. Containment Overhead: none of this comes free - keeping something this dangerous tracked costs the Foundation real resources, billed straight to it at the end of every one of its own turns.",
  },
];
