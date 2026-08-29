import { useState } from 'react';
import { BOARD, getTile } from '../data/board';
import { findCard } from '../data/cards';
import {
  buildHouseAndSync,
  mortgageTileAndSync,
  sellHouseAndSync,
  unmortgageTileAndSync,
  useGetOutOfJailCardAndSync,
} from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './Hand.css';

function houseCountLabel(count: number): string {
  if (count === 5) return 'Hotel';
  if (count === 0) return 'No houses';
  return `${count} house${count === 1 ? '' : 's'}`;
}

interface HandProps {
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

/**
 * Everything the viewing player is holding - owned Wings/Tunnels/
 * utilities and kept "Get Out of Containment Free" cards - shown as a
 * strip of cards along the bottom of the screen. Click a card to
 * expand it (full details, and a use-action if applicable); click
 * again to collapse.
 */
function Hand({ roomCode, playerId, game }: HandProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const me = game.players[playerId];
  if (!me || (me.ownedTileIds.length === 0 && me.heldCardIds.length === 0)) {
    return null;
  }

  function toggle(key: string) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  return (
    <div className="hand">
      {me.ownedTileIds.map((tileId) => {
        const tile = getTile(tileId);
        const key = `wing-${tileId}`;
        const isExpanded = expandedKey === key;
        return (
          <div key={key} className={`hand-card hand-card-special ${isExpanded ? 'is-expanded' : ''}`}>
            <button type="button" className="hand-card-header" onClick={() => toggle(key)}>
              <span className="hand-card-name">{tile.name}</span>
            </button>
            {isExpanded && (
              <div className="hand-card-detail">
                {tile.kind === 'wing' && (
                  <>
                    <p>
                      Price: ₡{tile.price}
                      <br />
                      {houseCountLabel(game.houses[tileId] ?? 0)}
                      {game.mortgagedTileIds.includes(tileId) && ' (mortgaged)'}
                    </p>
                    <HouseControls roomCode={roomCode} playerId={playerId} game={game} tileId={tileId} />
                  </>
                )}
                {tile.kind === 'tunnel' && (
                  <p>
                    Price: ₡{tile.price}
                    {game.mortgagedTileIds.includes(tileId) && ' (mortgaged)'}
                  </p>
                )}
                {tile.kind === 'utility' && <p>Price: ₡{tile.price}</p>}
                {(tile.kind === 'wing' || tile.kind === 'tunnel') && (
                  <MortgageControls roomCode={roomCode} playerId={playerId} game={game} tileId={tileId} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {me.heldCardIds.map((cardId, index) => {
        const card = findCard(cardId);
        const key = `card-${cardId}-${index}`;
        const isExpanded = expandedKey === key;
        return (
          <div key={key} className={`hand-card hand-card-special ${isExpanded ? 'is-expanded' : ''}`}>
            <button type="button" className="hand-card-header" onClick={() => toggle(key)}>
              <span className="hand-card-name">{card.title}</span>
            </button>
            {isExpanded && (
              <div className="hand-card-detail">
                <p>{card.text}</p>
                {me.inJail ? (
                  <button type="button" onClick={() => useGetOutOfJailCardAndSync(roomCode, game, playerId, cardId)}>
                    Use to Leave the Containment Chamber
                  </button>
                ) : (
                  <p className="hint">Usable while you're in the Containment Chamber.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface HouseControlsProps {
  roomCode: string;
  playerId: string;
  game: GameState;
  tileId: number;
}

// Build/sell houses on a Wing card - only shown once the viewing
// player owns every Wing in that Sector (standard Monopoly rule; no
// even-building requirement across the Sector in this variant).
function HouseControls({ roomCode, playerId, game, tileId }: HouseControlsProps) {
  const tile = getTile(tileId);
  if (tile.kind !== 'wing') return null;

  const me = game.players[playerId];
  const ownsFullSector = BOARD.filter(
    (t) => t.kind === 'wing' && t.colorGroup === tile.colorGroup,
  ).every((t) => me.ownedTileIds.includes(t.id));

  if (!ownsFullSector) {
    return <p className="hint">Own the whole Sector to build.</p>;
  }

  const houses = game.houses[tileId] ?? 0;
  const isHotel = houses === 5;
  // Logistics Officer's "Bulk Requisition" (25% off) and "Overstock"
  // (never blocked by the shared supply) - mirrors buildHouse in
  // game/engine.ts exactly, so this button's price/enabled state don't
  // silently disagree with what actually gets charged.
  const isLogisticsOfficer = me.pieceId === 'wheelBarrel';
  const buildCost = isLogisticsOfficer ? Math.floor(tile.houseCost * 0.75) : tile.houseCost;
  const canBuild =
    !isHotel &&
    me.credits >= buildCost &&
    (isLogisticsOfficer || (houses === 4 ? game.hotelsRemaining > 0 : game.housesRemaining > 0));
  const canSell = houses > 0 && (isLogisticsOfficer || !(isHotel && game.housesRemaining < 4));

  return (
    <div className="hand-card-action">
      <button
        type="button"
        onClick={() => buildHouseAndSync(roomCode, game, playerId, tileId)}
        disabled={!canBuild}
      >
        {houses === 4 ? `Build Hotel (₡${buildCost})` : `Build House (₡${buildCost})`}
      </button>
      <button
        type="button"
        onClick={() => sellHouseAndSync(roomCode, game, playerId, tileId)}
        disabled={!canSell}
      >
        Sell {isHotel ? 'Hotel' : 'House'} (₡{Math.floor(tile.houseCost / 2)})
      </button>
    </div>
  );
}

interface MortgageControlsProps {
  roomCode: string;
  playerId: string;
  game: GameState;
  tileId: number;
}

// Mortgage/unmortgage a Wing or Tunnel card. Blocked from mortgaging
// while houses are on it or anywhere else in its Sector (standard
// Monopoly rule) - the engine already enforces this and just no-ops
// otherwise, but the button here is disabled up front too so it
// doesn't look like nothing happened.
function MortgageControls({ roomCode, playerId, game, tileId }: MortgageControlsProps) {
  const tile = getTile(tileId);
  if (tile.kind !== 'wing' && tile.kind !== 'tunnel') return null;

  const me = game.players[playerId];
  const isMortgaged = game.mortgagedTileIds.includes(tileId);
  const mortgageValue = Math.floor(tile.price / 2);
  const payoff = Math.round(mortgageValue * 1.1);

  const sectorHasHouses =
    tile.kind === 'wing' &&
    BOARD.filter((t) => t.kind === 'wing' && t.colorGroup === tile.colorGroup).some(
      (t) => (game.houses[t.id] ?? 0) > 0,
    );

  return (
    <div className="hand-card-action">
      {isMortgaged ? (
        <button
          type="button"
          onClick={() => unmortgageTileAndSync(roomCode, game, playerId, tileId)}
          disabled={me.credits < payoff}
        >
          Pay Off Mortgage (₡{payoff})
        </button>
      ) : (
        <button
          type="button"
          onClick={() => mortgageTileAndSync(roomCode, game, playerId, tileId)}
          disabled={sectorHasHouses}
        >
          Mortgage (₡{mortgageValue})
        </button>
      )}
    </div>
  );
}

export default Hand;
