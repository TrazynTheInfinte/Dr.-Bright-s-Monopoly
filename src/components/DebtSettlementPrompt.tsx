import { getTile } from '../data/board';
import { declareBankruptcyAndSync, mortgageTileAndSync, sellHouseAndSync, settleDebtAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';

interface DebtSettlementPromptProps {
  playerId: string;
  amountOwed: number;
  roomCode: string;
  game: GameState;
}

const HOUSE_LABELS = ['', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel'];

/**
 * Shown when a player can't afford a payment (rent, a card effect, the
 * Holding/Escape Fee...) but has something left to sell/mortgage -
 * sellHouse/mortgageProperty are unrestricted by any pendingDecision,
 * so this just exposes them directly, with a running "can you afford it
 * yet" check and a Pay button that only lights up once you can.
 * Declare Bankruptcy is always available as an opt-out from selling
 * everything.
 */
function DebtSettlementPrompt({ playerId, amountOwed, roomCode, game }: DebtSettlementPromptProps) {
  const player = game.players[playerId];
  const housesToSell = player.ownedTileIds
    .map((tileId) => ({ tileId, houses: game.houses[tileId] ?? 0 }))
    .filter(({ houses }) => houses > 0);
  const mortgageableTiles = player.ownedTileIds.filter((tileId) => {
    const tile = getTile(tileId);
    return (tile.kind === 'wing' || tile.kind === 'tunnel') && !game.mortgagedTileIds.includes(tileId);
  });
  const canPay = player.credits >= amountOwed;

  return (
    <div className="purchase-prompt card-prompt">
      <p className="card-title">Insufficient Credits</p>
      <p>
        You owe {amountOwed} Credits but only have {player.credits}. Sell houses or mortgage Wings to raise
        cash, or declare bankruptcy.
      </p>

      {housesToSell.length > 0 && (
        <div className="liquidation-choice-group">
          <p className="hint">Sell a house:</p>
          {housesToSell.map(({ tileId, houses }) => (
            <button key={tileId} onClick={() => sellHouseAndSync(roomCode, game, playerId, tileId)}>
              {getTile(tileId).name} ({HOUSE_LABELS[houses]})
            </button>
          ))}
        </div>
      )}

      {mortgageableTiles.length > 0 && (
        <div className="liquidation-choice-group">
          <p className="hint">Mortgage a Wing:</p>
          {mortgageableTiles.map((tileId) => (
            <button key={tileId} onClick={() => mortgageTileAndSync(roomCode, game, playerId, tileId)}>
              {getTile(tileId).name}
            </button>
          ))}
        </div>
      )}

      <div className="purchase-prompt-actions">
        <button disabled={!canPay} onClick={() => settleDebtAndSync(roomCode, game, playerId)}>
          Pay {amountOwed} Credits
        </button>
        <button onClick={() => declareBankruptcyAndSync(roomCode, game, playerId)}>Declare Bankruptcy</button>
      </div>
    </div>
  );
}

export default DebtSettlementPrompt;
