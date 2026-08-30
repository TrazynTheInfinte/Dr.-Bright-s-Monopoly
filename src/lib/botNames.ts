// Word list for randomly-generated bot display names ("Agent <word>") -
// added in the lobby by addBotToLobby (rooms.ts). A mix of generic
// Foundation staff roles and Mobile Task Force-style codenames, kept
// deliberately generic rather than anything targeting a real person or
// group.
const BOT_NAME_WORDS = [
  'Warden',
  'Handler',
  'Custodian',
  'Archivist',
  'Sentinel',
  'Auditor',
  'Analyst',
  'Operative',
  'Courier',
  'Technician',
  'Overseer',
  'Liaison',
  'Watcher',
  'Raven',
  'Jackal',
  'Locust',
  'Serpent',
  'Falcon',
  'Wolf',
  'Moth',
];

/** A random "Agent <word>" name for a bot added in the lobby - unique within `takenNames` (the room's other bots) as long as the word list has an unused entry left; falls back to a repeat once every word is already taken. */
export function randomBotName(takenNames: string[] = []): string {
  const available = BOT_NAME_WORDS.filter((word) => !takenNames.includes(`Agent ${word}`));
  const pool = available.length > 0 ? available : BOT_NAME_WORDS;
  const word = pool[Math.floor(Math.random() * pool.length)];
  return `Agent ${word}`;
}
