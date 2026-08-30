export type AnomalyId = 'shyGuy' | 'theSculpture' | 'theOldMan' | 'theVoices' | 'theDoctor';

export interface AnomalyDefinition {
  id: AnomalyId;
  name: string;
  /** The tile it spawns dormant on when it breaches containment. */
  spawnTileId: number;
  flavorText: string;
}

// The hostile-anomaly roster. Every anomaly gets its own bespoke behavior
// hardcoded into game/engine.ts (dormant-until-viewed movement is Shy
// Guy's own thing, not a generic "anomaly behavior" system), so growing
// this roster is real design work per entry, not just adding a row of data.
export const ANOMALIES: AnomalyDefinition[] = [
  {
    id: 'shyGuy',
    name: "SCP-096 \"The Shy Guy\"",
    spawnTileId: 31, // Heavy Containment Zone
    flavorText:
      'Docile and immobile as long as no one looks at it. The instant someone views its face, it starts hunting them down - nothing on the board is fast enough to outrun it for long.',
  },
  {
    id: 'theSculpture',
    name: 'SCP-173 "The Sculpture"',
    spawnTileId: 18, // Testing Chamber 12
    flavorText:
      "Motionless under observation - the instant every eye and camera looks away, it moves faster than anything should be able to. Whoever's nearest when the room goes unwatched won't see it coming - unless they're far enough away to actually outrun it.",
  },
  {
    id: 'theOldMan',
    name: 'SCP-106 "The Old Man"',
    spawnTileId: 34, // Containment Wing A
    flavorText:
      "Corrodes anything it touches and phases through solid matter at will. Never needs to be watched or looked at first - the moment it's loose, it's already coming for whoever's nearest. Slow and patient, but the instant it catches up to someone, it drags them both through into its own Pocket Dimension - and it's an entirely different fight to survive in there.",
  },
  {
    id: 'theVoices',
    name: 'SCP-939 "With Many Voices"',
    spawnTileId: 27, // Amnestics Dispensary
    flavorText:
      "Blind, and already hunting the instant it's loose - same as SCP-106, no viewing required. Unlike every other breach, this one is never announced: nothing appears on the board and nothing gets logged. The first anyone learns it's out is the moment it's already caught someone.",
  },
  {
    id: 'theDoctor',
    name: 'SCP-049 "The Plague Doctor"',
    spawnTileId: 13, // Medical Bay
    flavorText:
      "Calm and cooperative, right up until it diagnoses someone with the Pestilence - a random pick, unrelated to where anyone stands on the board. Its cure only diminishes a first-time patient; anyone it diagnoses a second time is cured for good, reanimated as something that used to be them.",
  },
];

export function findAnomaly(id: AnomalyId): AnomalyDefinition {
  const anomaly = ANOMALIES.find((a) => a.id === id);
  if (!anomaly) throw new Error(`Unknown anomaly id: ${id}`);
  return anomaly;
}
