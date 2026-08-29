export type AnomalyId = 'shyGuy';

export interface AnomalyDefinition {
  id: AnomalyId;
  name: string;
  /** The tile it spawns dormant on when it breaches containment. */
  spawnTileId: number;
  flavorText: string;
}

// The hostile-anomaly roster. Deliberately starts with just one - every
// anomaly gets its own bespoke behavior hardcoded into game/engine.ts
// (dormant-until-viewed movement is Shy Guy's own thing, not a generic
// "anomaly behavior" system), so growing this roster is real design
// work per entry, not just adding a row of data.
export const ANOMALIES: AnomalyDefinition[] = [
  {
    id: 'shyGuy',
    name: "SCP-096 \"The Shy Guy\"",
    spawnTileId: 31, // Heavy Containment Zone
    flavorText:
      'Docile and immobile as long as no one looks at it. The instant someone views its face, it starts hunting them down - nothing on the board is fast enough to outrun it for long.',
  },
];

export function findAnomaly(id: AnomalyId): AnomalyDefinition {
  const anomaly = ANOMALIES.find((a) => a.id === id);
  if (!anomaly) throw new Error(`Unknown anomaly id: ${id}`);
  return anomaly;
}
