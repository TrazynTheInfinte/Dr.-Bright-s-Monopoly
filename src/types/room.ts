import type { Timestamp } from 'firebase/firestore';
import type { GameState, PieceId } from './game';

/**
 * Set once by the host at room creation, controlling how Personnel get
 * assigned as players join: "beginner" lets each player pick their own
 * (without seeing its Special Power), "experienced" assigns a random
 * unclaimed one automatically.
 */
export type RoomMode = 'beginner' | 'experienced';

/** How cautiously a bot plays - see lib/botAi.ts for what each level actually changes (buy thresholds, whether it proactively builds houses). Chosen once, when the bot is added in the Lobby (see lib/rooms.ts's addBotToLobby). */
export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface RoomPlayer {
  name: string;
  // Firestore fills this in on the server once the write lands - it's
  // briefly null in our own optimistic UI state before that happens.
  joinedAt: Timestamp | null;
  /** Null until chosen (beginner mode) or auto-assigned (experienced mode, immediately on joining). */
  pieceId: PieceId | null;
  /** Client epoch-ms timestamp from this player's own last heartbeat (see lib/presence.ts) - absent for a player who joined before this existed, or hasn't sent one yet. Used to show an "away" indicator, not for anything the game logic depends on. */
  lastSeenAt?: number;
  /** True for a bot added in the lobby (see lib/rooms.ts's addBotToLobby) - absent for a real player. */
  isBot?: boolean;
  /** Set alongside isBot, chosen when the bot was added - see lib/botAi.ts. */
  botDifficulty?: BotDifficulty;
}

export interface Room {
  code: string;
  createdAt: Timestamp | null;
  /** The player who created the room - the only one who can start the game or use the dev panel. */
  hostId: string;
  mode: RoomMode;
  players: Record<string, RoomPlayer>;
  /** Absent while the room is still in its lobby; present once the host starts the game. */
  game?: GameState;
}
