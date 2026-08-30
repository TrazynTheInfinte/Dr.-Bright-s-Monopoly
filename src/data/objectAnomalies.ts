export type ObjectAnomalyId = 'gamersFuel' | 'badComposition' | 'countermeasure';

export interface ObjectAnomalyDefinition {
  id: ObjectAnomalyId;
  name: string;
  flavorText: string;
}

export const OBJECT_ANOMALIES: ObjectAnomalyDefinition[] = [
  {
    id: 'gamersFuel',
    name: 'SCP-207 "Gamer\'s Fuel"',
    flavorText:
      "A bottle of stimulant cola. Drink it for a real burst of speed - but the strain on the body is just as real, and it isn't free.",
  },
  {
    id: 'badComposition',
    name: 'SCP-012 "Bad Composition"',
    flavorText:
      "An unfinished musical score. Studying it is compelling, and usually harmless - but the closer it gets to finished, the worse an idea that is.",
  },
  {
    id: 'countermeasure',
    name: 'SCP-963 "Countermeasure"',
    flavorText:
      "An amber ring. Worn continuously, it carries its wearer's mind into whoever's touching it the instant the wearer would otherwise die - so long as someone else is close enough when it happens.",
  },
];

export function findObjectAnomaly(id: ObjectAnomalyId): ObjectAnomalyDefinition {
  const found = OBJECT_ANOMALIES.find((o) => o.id === id);
  if (!found) throw new Error(`Unknown object anomaly id: ${id}`);
  return found;
}
