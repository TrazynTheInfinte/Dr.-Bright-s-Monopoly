import type { BoardTile } from '../types/game';

// Classic Monopoly railroad rent: doubles with each additional
// Maintenance Tunnel the same owner has. All 4 are priced 200, same as
// the classic board, so we can reuse this table directly.
export const RAILROAD_RENT_BY_COUNT = [25, 50, 100, 200];

// The full 40-tile board. Reskinned from Comunopoly's communist-themed
// board to SCP Foundation flavor - see CONTEXT.md's Board & tiles
// section. Every Wing's price/rent/house cost matches classic Monopoly
// exactly, group for group; the two tiles Comunopoly gave standalone
// special mechanics (The Kremlin, NKVD HQ) are reverted here to plain
// ownable Wings in their own two-tile Sector, using real Monopoly's
// Park Place/Boardwalk numbers, per the decision to drop all four
// special-tile mechanics and go back to textbook rules.
//
// rentTable is [0 houses, 1, 2, 3, 4, hotel].
export const BOARD: BoardTile[] = [
  { id: 0, kind: 'go', name: 'Site Entrance' },
  {
    id: 1,
    kind: 'wing',
    name: 'Storage Closet',
    price: 50,
    colorGroup: 'purple',
    houseCost: 50,
    rentTable: [2, 10, 30, 90, 160, 250],
  },
  { id: 2, kind: 'card', name: 'Anomalous Event', deck: 'anomalousEvent' },
  {
    id: 3,
    kind: 'wing',
    name: 'Old Records Wing',
    price: 60,
    colorGroup: 'purple',
    houseCost: 50,
    rentTable: [4, 20, 60, 180, 320, 450],
  },
  { id: 4, kind: 'card', name: 'Foundation Directive', deck: 'foundationDirective' },
  {
    id: 5,
    kind: 'tunnel',
    name: 'Maintenance Tunnel Alpha',
    price: 200,
  },
  {
    id: 6,
    kind: 'wing',
    name: 'Communications Room',
    price: 100,
    colorGroup: 'lightBlue',
    houseCost: 50,
    rentTable: [6, 30, 90, 270, 400, 550],
  },
  { id: 7, kind: 'card', name: 'Foundation Directive', deck: 'foundationDirective' },
  {
    id: 8,
    kind: 'wing',
    name: 'Server Room',
    price: 100,
    colorGroup: 'lightBlue',
    houseCost: 50,
    rentTable: [6, 30, 90, 270, 400, 550],
  },
  {
    id: 9,
    kind: 'wing',
    name: 'Observation Deck',
    price: 120,
    colorGroup: 'lightBlue',
    houseCost: 50,
    rentTable: [8, 40, 100, 300, 450, 600],
  },
  { id: 10, kind: 'jail', name: 'Containment Chamber' },
  {
    id: 11,
    kind: 'wing',
    name: 'Decontamination Chamber',
    price: 140,
    colorGroup: 'pink',
    houseCost: 100,
    rentTable: [10, 50, 150, 450, 625, 750],
  },
  { id: 12, kind: 'utility', name: 'Site Warhead', price: 150 },
  {
    id: 13,
    kind: 'wing',
    name: 'Medical Bay',
    price: 140,
    colorGroup: 'pink',
    houseCost: 100,
    rentTable: [10, 50, 150, 450, 625, 750],
  },
  {
    id: 14,
    kind: 'wing',
    name: 'Containment Wing C',
    price: 160,
    colorGroup: 'pink',
    houseCost: 100,
    rentTable: [12, 60, 180, 500, 700, 900],
  },
  {
    id: 15,
    kind: 'tunnel',
    name: 'Maintenance Tunnel Beta',
    price: 200,
  },
  {
    id: 16,
    kind: 'wing',
    name: 'Research Wing B',
    price: 180,
    colorGroup: 'orange',
    houseCost: 100,
    rentTable: [14, 70, 200, 550, 750, 950],
  },
  { id: 17, kind: 'card', name: 'Anomalous Event', deck: 'anomalousEvent' },
  {
    id: 18,
    kind: 'wing',
    name: 'Testing Chamber 12',
    price: 180,
    colorGroup: 'orange',
    houseCost: 100,
    rentTable: [14, 70, 200, 550, 750, 950],
  },
  {
    id: 19,
    kind: 'wing',
    name: 'Anomalous Materials Vault',
    price: 200,
    colorGroup: 'orange',
    houseCost: 100,
    rentTable: [16, 80, 220, 600, 800, 1000],
  },
  { id: 20, kind: 'freeParking', name: 'Break Room' },
  {
    id: 21,
    kind: 'wing',
    name: 'Site Security HQ',
    price: 220,
    colorGroup: 'red',
    houseCost: 150,
    rentTable: [18, 90, 250, 700, 875, 1050],
  },
  { id: 22, kind: 'card', name: 'Foundation Directive', deck: 'foundationDirective' },
  {
    id: 23,
    kind: 'wing',
    name: 'Armory',
    price: 220,
    colorGroup: 'red',
    houseCost: 150,
    rentTable: [18, 90, 250, 700, 875, 1050],
  },
  {
    id: 24,
    kind: 'wing',
    name: 'Containment Wing B',
    price: 240,
    colorGroup: 'red',
    houseCost: 150,
    rentTable: [20, 100, 300, 750, 925, 1100],
  },
  {
    id: 25,
    kind: 'tunnel',
    name: 'Maintenance Tunnel Gamma',
    price: 200,
  },
  {
    id: 26,
    kind: 'wing',
    name: 'Genetics Lab',
    price: 260,
    colorGroup: 'yellow',
    houseCost: 150,
    rentTable: [22, 110, 330, 800, 975, 1150],
  },
  {
    id: 27,
    kind: 'wing',
    name: 'Amnestics Dispensary',
    price: 260,
    colorGroup: 'yellow',
    houseCost: 150,
    rentTable: [22, 110, 330, 800, 975, 1150],
  },
  { id: 28, kind: 'utility', name: 'Site Coolant', price: 150 },
  {
    id: 29,
    kind: 'wing',
    name: 'Research Wing A',
    price: 280,
    colorGroup: 'yellow',
    houseCost: 150,
    rentTable: [24, 120, 360, 850, 1025, 1200],
  },
  { id: 30, kind: 'goToJail', name: 'Reassigned' },
  {
    id: 31,
    kind: 'wing',
    name: 'Heavy Containment Zone',
    price: 300,
    colorGroup: 'green',
    houseCost: 200,
    rentTable: [26, 130, 390, 900, 1100, 1275],
  },
  {
    id: 32,
    kind: 'wing',
    name: 'High-Value Target Storage',
    price: 300,
    colorGroup: 'green',
    houseCost: 200,
    rentTable: [26, 130, 390, 900, 1100, 1275],
  },
  { id: 33, kind: 'card', name: 'Anomalous Event', deck: 'anomalousEvent' },
  {
    id: 34,
    kind: 'wing',
    name: 'Containment Wing A',
    price: 320,
    colorGroup: 'green',
    houseCost: 200,
    rentTable: [28, 150, 450, 1000, 1200, 1400],
  },
  {
    id: 35,
    kind: 'tunnel',
    name: 'Maintenance Tunnel Delta',
    price: 200,
  },
  { id: 36, kind: 'card', name: 'Foundation Directive', deck: 'foundationDirective' },
  {
    id: 37,
    kind: 'wing',
    name: 'O5 Council Chamber',
    price: 350,
    colorGroup: 'darkBlue',
    houseCost: 200,
    rentTable: [35, 175, 500, 1100, 1300, 1500],
  },
  { id: 38, kind: 'card', name: 'Anomalous Event', deck: 'anomalousEvent' },
  {
    id: 39,
    kind: 'wing',
    name: 'Site-01',
    price: 400,
    colorGroup: 'darkBlue',
    houseCost: 200,
    rentTable: [50, 200, 600, 1400, 1700, 2000],
  },
];

export const BOARD_SIZE = BOARD.length;

/** Looks up a tile by position, wrapping around the board (e.g. -1 -> 39). */
export function getTile(position: number): BoardTile {
  const wrapped = ((position % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  return BOARD[wrapped];
}
