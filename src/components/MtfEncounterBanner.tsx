import { getTile } from '../data/board';
import { resolveMtfEncounterAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

interface MtfEncounterBannerProps {
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

// MTF Operative's "Show of Force": shown only to MTF Operative, only
// when another player just landed on a Wing they own (see mtfEncounter
// in game/engine.ts). Independent of whose turn it technically is to
// resolve, same reasoning as RubberDuckEncounterBanner.
function MtfEncounterBanner({ room, roomCode, playerId, game }: MtfEncounterBannerProps) {
  const encounter = game.mtfEncounter;
  if (!encounter || encounter.mtfPlayerId !== playerId) return null;

  const targetName = room.players[encounter.targetPlayerId]?.name ?? 'them';
  const tileName = getTile(encounter.tileId).name;

  return (
    <div className="purchase-prompt card-prompt">
      <p>
        {targetName} landed on {tileName}. Collect the normal rent, or make a Show of Force (seize one of
        their other Wings/Tunnels instead - once per game)?
      </p>
      <button onClick={() => resolveMtfEncounterAndSync(roomCode, game, false)}>Collect Rent</button>
      <button onClick={() => resolveMtfEncounterAndSync(roomCode, game, true)}>Show of Force</button>
    </div>
  );
}

export default MtfEncounterBanner;
