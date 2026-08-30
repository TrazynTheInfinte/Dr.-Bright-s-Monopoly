import { useState } from 'react';
import { getTile } from '../data/board';
import { findCard } from '../data/cards';
import { acceptTradeAndSync, declineTradeAndSync, proposeTradeAndSync, withdrawTradeAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './TradePanel.css';

interface TradePanelProps {
  playerId: string;
  roomCode: string;
  room: Room;
  game: GameState;
}

/** Which of playerId's owned tiles can actually go into a trade right now - no houses on it (sell those first). */
function tradeableOwnedTileIds(game: GameState, playerId: string): number[] {
  return game.players[playerId].ownedTileIds.filter((tileId) => (game.houses[tileId] ?? 0) === 0);
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/**
 * Player-to-player trading (both modes, not turn-gated) - always
 * visible rather than an ActionModal, since trading isn't something
 * the game is waiting on anyone to resolve. A "Propose Trade" builder
 * (pick a player, pick tiles/cards/Credits on each side) plus a list
 * of trades already on the table involving this player, with Accept/
 * Decline (as recipient) or Withdraw (as proposer).
 */
function TradePanel({ playerId, roomCode, room, game }: TradePanelProps) {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [myTileIds, setMyTileIds] = useState<Set<number>>(new Set());
  const [myCardIds, setMyCardIds] = useState<Set<string>>(new Set());
  const [myCredits, setMyCredits] = useState(0);
  const [theirTileIds, setTheirTileIds] = useState<Set<number>>(new Set());
  const [theirCardIds, setTheirCardIds] = useState<Set<string>>(new Set());
  const [theirCredits, setTheirCredits] = useState(0);

  const otherPlayerIds = game.turnOrder.filter((id) => id !== playerId && !game.players[id].isSpectating);
  const effectiveTargetId = otherPlayerIds.includes(targetPlayerId) ? targetPlayerId : (otherPlayerIds[0] ?? '');
  const myTradeableTileIds = tradeableOwnedTileIds(game, playerId);
  const theirTradeableTileIds = effectiveTargetId ? tradeableOwnedTileIds(game, effectiveTargetId) : [];
  const myHeldCardIds = game.players[playerId].heldCardIds;
  const theirHeldCardIds = effectiveTargetId ? game.players[effectiveTargetId].heldCardIds : [];

  const myTrades = game.activeTrades.filter((t) => t.fromPlayerId === playerId || t.toPlayerId === playerId);

  function resetBuilder() {
    setMyTileIds(new Set());
    setMyCardIds(new Set());
    setMyCredits(0);
    setTheirTileIds(new Set());
    setTheirCardIds(new Set());
    setTheirCredits(0);
    setIsBuilderOpen(false);
  }

  async function handlePropose() {
    if (!effectiveTargetId) return;
    await proposeTradeAndSync(roomCode, game, {
      fromPlayerId: playerId,
      toPlayerId: effectiveTargetId,
      offerTileIds: [...myTileIds],
      offerCredits: myCredits,
      offerCardIds: [...myCardIds],
      requestTileIds: [...theirTileIds],
      requestCredits: theirCredits,
      requestCardIds: [...theirCardIds],
    });
    resetBuilder();
  }

  return (
    <div className="trade-panel">
      <button type="button" onClick={() => setIsBuilderOpen((open) => !open)}>
        {isBuilderOpen ? 'Cancel Trade' : 'Propose Trade'}
      </button>

      {isBuilderOpen && (
        <div className="trade-builder">
          <label>
            Trade with:
            <select value={effectiveTargetId} onChange={(event) => setTargetPlayerId(event.target.value)}>
              {otherPlayerIds.map((id) => (
                <option key={id} value={id}>
                  {room.players[id]?.name}
                </option>
              ))}
            </select>
          </label>

          <div className="trade-builder-columns">
            <fieldset>
              <legend>You give</legend>
              {myTradeableTileIds.map((tileId) => (
                <label key={tileId}>
                  <input
                    type="checkbox"
                    checked={myTileIds.has(tileId)}
                    onChange={() => setMyTileIds((current) => toggleInSet(current, tileId))}
                  />
                  {getTile(tileId).name}
                </label>
              ))}
              {myHeldCardIds.map((cardId) => (
                <label key={cardId}>
                  <input
                    type="checkbox"
                    checked={myCardIds.has(cardId)}
                    onChange={() => setMyCardIds((current) => toggleInSet(current, cardId))}
                  />
                  {findCard(cardId).title}
                </label>
              ))}
              <label>
                Credits:
                <input
                  type="number"
                  min={0}
                  max={game.players[playerId].credits}
                  value={myCredits}
                  onChange={(event) => setMyCredits(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>You get</legend>
              {theirTradeableTileIds.map((tileId) => (
                <label key={tileId}>
                  <input
                    type="checkbox"
                    checked={theirTileIds.has(tileId)}
                    onChange={() => setTheirTileIds((current) => toggleInSet(current, tileId))}
                  />
                  {getTile(tileId).name}
                </label>
              ))}
              {theirHeldCardIds.map((cardId) => (
                <label key={cardId}>
                  <input
                    type="checkbox"
                    checked={theirCardIds.has(cardId)}
                    onChange={() => setTheirCardIds((current) => toggleInSet(current, cardId))}
                  />
                  {findCard(cardId).title}
                </label>
              ))}
              <label>
                Credits:
                <input
                  type="number"
                  min={0}
                  value={theirCredits}
                  onChange={(event) => setTheirCredits(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
            </fieldset>
          </div>

          <button type="button" disabled={!effectiveTargetId} onClick={handlePropose}>
            Send Offer
          </button>
        </div>
      )}

      {myTrades.length > 0 && (
        <ul className="trade-list">
          {myTrades.map((trade) => {
            const isRecipient = trade.toPlayerId === playerId;
            const otherId = isRecipient ? trade.fromPlayerId : trade.toPlayerId;
            const giveTileIds = isRecipient ? trade.offerTileIds : trade.requestTileIds;
            const giveCardIds = isRecipient ? trade.offerCardIds : trade.requestCardIds;
            const giveCredits = isRecipient ? trade.offerCredits : trade.requestCredits;
            const getTileIds = isRecipient ? trade.requestTileIds : trade.offerTileIds;
            const getCardIds = isRecipient ? trade.requestCardIds : trade.offerCardIds;
            const getCredits = isRecipient ? trade.requestCredits : trade.offerCredits;
            return (
              <li key={trade.id}>
                <p>
                  {isRecipient ? `${room.players[otherId]?.name} offers you:` : `You offered ${room.players[otherId]?.name}:`}
                </p>
                <p className="trade-side">
                  Them:{' '}
                  {[
                    ...giveTileIds.map((id) => getTile(id).name),
                    ...giveCardIds.map((id) => findCard(id).title),
                    giveCredits > 0 ? `₡${giveCredits}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'nothing'}
                </p>
                <p className="trade-side">
                  You:{' '}
                  {[
                    ...getTileIds.map((id) => getTile(id).name),
                    ...getCardIds.map((id) => findCard(id).title),
                    getCredits > 0 ? `₡${getCredits}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'nothing'}
                </p>
                {isRecipient ? (
                  <div className="purchase-prompt-actions">
                    <button onClick={() => acceptTradeAndSync(roomCode, game, trade.id)}>Accept</button>
                    <button onClick={() => declineTradeAndSync(roomCode, game, trade.id)}>Decline</button>
                  </div>
                ) : (
                  <button onClick={() => withdrawTradeAndSync(roomCode, game, trade.id)}>Withdraw</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default TradePanel;
