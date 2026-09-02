import { getTile } from '../data/board';
import { ROGUE_SEIZE_PREMIUM_MULTIPLIER } from '../game/engine';
import type { ColorGroup, GamePlayerState, GameState } from '../types/game';
import type { BotDifficulty } from '../types/room';
import {
  acknowledgePocketDimensionLandingAndSync,
  buildHouseAndSync,
  buyAdministratorRemoteTileAndSync,
  buyTileAndSync,
  catRedirectCardAndSync,
  chooseCardFromChoicesAndSync,
  chooseNewPersonnelAndSync,
  declareBankruptcyAndSync,
  declineAdministratorRemoteBuyAndSync,
  declinePurchaseAndSync,
  declineRecontainmentAndSync,
  drawFromPileAndSync,
  endTurnAndSync,
  mortgageTileAndSync,
  movePocketDimensionAndSync,
  payRentInsteadOfSeizingAndSync,
  payToRecontainAndSync,
  resolveMtfEncounterAndSync,
  resolveRubberDuckEncounterAndSync,
  rollDiceAndSync,
  seizeRogueAnomalyTileAndSync,
  sellHouseAndSync,
  settleDebtAndSync,
} from './gameSync';

export type { BotDifficulty };

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shouldBuy(difficulty: BotDifficulty, credits: number, price: number): boolean {
  if (credits < price) return false;
  if (difficulty === 'easy') return Math.random() < 0.5;
  const buffer = difficulty === 'hard' ? 50 : 150;
  return credits - price >= buffer;
}

function ownsFullSector(game: GameState, playerId: string, group: ColorGroup): boolean {
  for (let id = 0; id < 40; id++) {
    const tile = getTile(id);
    if (tile.kind === 'wing' && tile.colorGroup === group && !game.players[playerId].ownedTileIds.includes(id)) {
      return false;
    }
  }
  return true;
}

function sectorHasHouses(game: GameState, group: ColorGroup): boolean {
  for (let id = 0; id < 40; id++) {
    const tile = getTile(id);
    if (tile.kind === 'wing' && tile.colorGroup === group && (game.houses[id] ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

/** Normal/Hard only (see Easy's "no proactive house-building" scope boundary) - the first affordable house build on a fully-owned, unmortgaged Sector, or null if nothing qualifies right now. One build per call, same as a human clicking the button once. */
function pickHouseToBuild(game: GameState, botId: string, difficulty: BotDifficulty): number | null {
  const player = game.players[botId];
  const buffer = difficulty === 'hard' ? 50 : 200;
  for (const tileId of player.ownedTileIds) {
    const tile = getTile(tileId);
    if (tile.kind !== 'wing') continue;
    if (game.mortgagedTileIds.includes(tileId)) continue;
    const current = game.houses[tileId] ?? 0;
    if (current >= 5) continue;
    if (player.credits - tile.houseCost < buffer) continue;
    if (!ownsFullSector(game, botId, tile.colorGroup)) continue;
    return tileId;
  }
  return null;
}

async function resolveDebt(
  roomCode: string,
  game: GameState,
  botId: string,
  amountOwed: number,
  forceFallback: boolean,
): Promise<void> {
  if (forceFallback) {
    await declareBankruptcyAndSync(roomCode, game, botId);
    return;
  }

  const player = game.players[botId];
  if (player.credits >= amountOwed) {
    await settleDebtAndSync(roomCode, game, botId);
    return;
  }

  // Real Monopoly liquidation order: sell houses in a Sector before
  // mortgaging anything in it (mortgageProperty itself refuses otherwise).
  const withHouse = player.ownedTileIds.find((id) => (game.houses[id] ?? 0) > 0);
  if (withHouse !== undefined) {
    await sellHouseAndSync(roomCode, game, botId, withHouse);
    return;
  }

  const mortgageable = player.ownedTileIds.find((id) => {
    const tile = getTile(id);
    if (tile.kind !== 'wing' && tile.kind !== 'tunnel') return false;
    if (game.mortgagedTileIds.includes(id)) return false;
    return tile.kind !== 'wing' || !sectorHasHouses(game, tile.colorGroup);
  });
  if (mortgageable !== undefined) {
    await mortgageTileAndSync(roomCode, game, botId, mortgageable);
    return;
  }

  await declareBankruptcyAndSync(roomCode, game, botId);
}

/**
 * Runs one bot decision and writes it to Firestore - called by
 * useBotDriver, host-only, on a "thinking delay" timer per tick. Always
 * takes exactly one action per call, same granularity as a human clicking
 * one button, so the UI can visibly show a bot's turn unfolding rather
 * than resolving it all at once.
 *
 * `forceFallback`, set by the caller's stuck-action safety net when the
 * previous tick's attempt against this exact decision didn't change
 * game.log.length (a no-op write - a mismatched guard here versus
 * engine.ts), skips every heuristic and takes the one response that's
 * always guaranteed to actually resolve the decision.
 *
 * Covers every decision the current engine actually has; nothing here
 * handles trading, since proposing/negotiating one is out of scope for
 * a bot.
 */
export async function runBotStep(
  roomCode: string,
  game: GameState,
  botId: string,
  difficulty: BotDifficulty,
  forceFallback: boolean,
): Promise<void> {
  const player: GamePlayerState | undefined = game.players[botId];
  if (!player) return;

  const decision = game.pendingDecision;
  const isBotTurn = game.turnOrder[game.currentTurnIndex] === botId;

  if (decision) {
    const decisionIsForBot = 'forPlayerId' in decision ? decision.forPlayerId === botId : isBotTurn;
    if (!decisionIsForBot) return;

    switch (decision.type) {
      case 'purchase': {
        if (forceFallback) {
          await declinePurchaseAndSync(roomCode, game);
          return;
        }
        const tile = getTile(decision.tileId);
        const price = tile.kind === 'wing' || tile.kind === 'tunnel' || tile.kind === 'utility' ? tile.price : 0;
        const discounted =
          (tile.kind === 'tunnel' && player.pieceId === 'battleship') || (tile.kind === 'utility' && player.pieceId === 'boot')
            ? Math.floor(price / 2)
            : price;
        if (shouldBuy(difficulty, player.credits, discounted)) {
          await buyTileAndSync(roomCode, game, botId);
        } else {
          await declinePurchaseAndSync(roomCode, game);
        }
        return;
      }

      case 'awaitingCardDraw':
        await drawFromPileAndSync(roomCode, game, botId);
        return;

      case 'cardChoice':
        await chooseCardFromChoicesAndSync(roomCode, game, botId, randomPick(decision.choiceCardIds));
        return;

      case 'catRedirect':
        // Always kept, never handed off - proposing/negotiating handoffs
        // to a specific opponent is out of scope, same as trading.
        await catRedirectCardAndSync(roomCode, game, botId, null);
        return;

      case 'debtSettlement':
        await resolveDebt(roomCode, game, botId, decision.amountOwed, forceFallback);
        return;

      case 'rogueSeizure': {
        if (forceFallback) {
          await payRentInsteadOfSeizingAndSync(roomCode, game, botId);
          return;
        }
        const tile = getTile(decision.tileId);
        const price = tile.kind === 'wing' || tile.kind === 'tunnel' || tile.kind === 'utility' ? tile.price : 0;
        const premium = Math.ceil(price * ROGUE_SEIZE_PREMIUM_MULTIPLIER);
        if (shouldBuy(difficulty, player.credits, premium)) {
          await seizeRogueAnomalyTileAndSync(roomCode, game, botId);
        } else {
          await payRentInsteadOfSeizingAndSync(roomCode, game, botId);
        }
        return;
      }

      case 'pocketDimensionLanded':
        await acknowledgePocketDimensionLandingAndSync(roomCode, game);
        return;

      case 'administratorRemoteBuy': {
        if (forceFallback) {
          await declineAdministratorRemoteBuyAndSync(roomCode, game);
          return;
        }
        const affordable = decision.sectorTileIds
          .map((tileId) => ({ tileId, price: getTile(tileId).kind === 'wing' ? (getTile(tileId) as { price: number }).price : 0 }))
          .filter(({ price }) => shouldBuy(difficulty, player.credits, price))
          .sort((a, b) => a.price - b.price)[0];
        if (affordable) {
          await buyAdministratorRemoteTileAndSync(roomCode, game, botId, affordable.tileId);
        } else {
          await declineAdministratorRemoteBuyAndSync(roomCode, game);
        }
        return;
      }
    }
    return;
  }

  // Independent of pendingDecision, same reasoning as GameBoard.tsx's
  // encounter banners - each of these can be open at the same time as
  // something else entirely, and blocks endTurn globally until answered.
  if (game.mtfEncounter?.mtfPlayerId === botId) {
    await resolveMtfEncounterAndSync(roomCode, game, !forceFallback);
    return;
  }
  if (game.rubberDuckEncounter?.rubberDuckPlayerId === botId) {
    await resolveRubberDuckEncounterAndSync(roomCode, game, !forceFallback);
    return;
  }
  if (game.pendingPieceChoice?.playerId === botId) {
    await chooseNewPersonnelAndSync(roomCode, game, botId, randomPick(game.pendingPieceChoice.availablePieceIds));
    return;
  }
  if (game.specialistRecontainOffer?.playerId === botId) {
    if (!forceFallback && player.credits >= game.specialistRecontainOffer.fee + 100) {
      await payToRecontainAndSync(roomCode, game, botId);
    } else {
      await declineRecontainmentAndSync(roomCode, game);
    }
    return;
  }

  if (!isBotTurn) return;

  // The trapped player's own turn is entirely replaced by the Pocket
  // Dimension mini-game (see movePocketDimension in game/engine.ts) -
  // rollDice itself now refuses to act for them, so this has to be
  // checked before the normal inJail/roll logic below, not folded into it.
  if (game.pocketDimensionOrdeal?.trappedPlayerId === botId) {
    await movePocketDimensionAndSync(roomCode, game, botId);
    return;
  }

  if (player.inJail) {
    await rollDiceAndSync(roomCode, game);
    return;
  }

  if (!game.lastRoll || game.lastRollWasDoubles) {
    await rollDiceAndSync(roomCode, game);
    return;
  }

  if (!forceFallback && difficulty !== 'easy') {
    const houseTileId = pickHouseToBuild(game, botId, difficulty);
    if (houseTileId !== null) {
      await buildHouseAndSync(roomCode, game, botId, houseTileId);
      return;
    }
  }

  await endTurnAndSync(roomCode, game);
}

/** A fingerprint for "what runBotStep is about to attempt" - used by useBotDriver's stuck-action safety net alongside gameProgressSignature to detect a repeat attempt against unchanged state (a no-op write) and force a fallback next time. Doesn't need to be exhaustive per-option, just fine-grained enough that a genuinely different situation gets a different fingerprint. */
export function botDecisionFingerprint(game: GameState, botId: string): string {
  if (game.pendingDecision) return game.pendingDecision.type;
  if (game.mtfEncounter?.mtfPlayerId === botId) return 'mtfEncounter';
  if (game.rubberDuckEncounter?.rubberDuckPlayerId === botId) return 'rubberDuckEncounter';
  if (game.pendingPieceChoice?.playerId === botId) return 'pendingPieceChoice';
  if (game.specialistRecontainOffer?.playerId === botId) return 'specialistRecontainOffer';
  if (game.turnOrder[game.currentTurnIndex] === botId) {
    if (game.pocketDimensionOrdeal?.trappedPlayerId === botId) return 'pocketDimension';
    return !game.lastRoll || game.lastRollWasDoubles ? 'roll' : 'endTurn';
  }
  return 'idle';
}

/**
 * A signature of every part of GameState that a bot's decision could
 * possibly change - used by useBotDriver both to know when to re-check
 * what a bot should do next, and (paired with botDecisionFingerprint) to
 * detect a genuine no-op write. Deliberately does NOT use game.log for
 * either purpose: logEvent caps the log at its last 20 entries
 * (game/engine.ts), so in any game past its first ~20 events, log.length
 * stops changing at all - relying on it here would silently stop
 * re-triggering the bot driver entirely partway through a normal game.
 */
export function gameProgressSignature(game: GameState): string {
  return JSON.stringify(game);
}
