import { findAnomaly, type AnomalyId } from '../data/anomalies';
import { declineRecontainmentAndSync, payToRecontainAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';

interface SpecialistRecontainBannerProps {
  playerId: string;
  roomCode: string;
  game: GameState;
}

// Specialist's Special Power: shown only to Specialist, only the instant
// a Hostile Anomaly catch just landed on them (see specialistRecontainOffer
// in game/engine.ts). Independent of whose turn it technically is to
// resolve, same reasoning as RubberDuckEncounterBanner/MtfEncounterBanner -
// blocks endTurn globally until answered either way.
function SpecialistRecontainBanner({ playerId, roomCode, game }: SpecialistRecontainBannerProps) {
  const offer = game.specialistRecontainOffer;
  if (!offer || offer.playerId !== playerId) return null;

  const anomalyName = findAnomaly(offer.anomalyId as AnomalyId).name;
  const canAfford = game.players[playerId].credits >= offer.fee;

  return (
    <div className="purchase-prompt card-prompt">
      <p>
        {anomalyName} just caught you. Pay {offer.fee} Credits to recontain it immediately?
      </p>
      <div className="purchase-prompt-actions">
        <button disabled={!canAfford} onClick={() => payToRecontainAndSync(roomCode, game, playerId)}>
          Pay {offer.fee} Credits
        </button>
        <button onClick={() => declineRecontainmentAndSync(roomCode, game)}>Leave It</button>
      </div>
    </div>
  );
}

export default SpecialistRecontainBanner;
