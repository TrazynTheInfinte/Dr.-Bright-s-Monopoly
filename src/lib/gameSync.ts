import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { pickAvailablePiece } from './rooms';
import type { GameState, PieceId, TradeOffer } from '../types/game';
import type { Room } from '../types/room';
import {
  acceptTrade,
  acknowledgeCard,
  afkSkipTurn,
  buildHouse,
  buyTile,
  catRedirectCard,
  chooseCardFromChoices,
  confirmStillHere,
  createInitialGameState,
  declareBankruptcy,
  declinePurchase,
  declineTrade,
  devForceSkipTurn,
  devJumpToTile,
  devKickPlayer,
  devRevivePlayer,
  devSetCredits,
  devSetForcedCard,
  devSetForcedRoll,
  drawFromPile,
  endTurn,
  mortgageProperty,
  payClearanceFee,
  proposeTrade,
  rejoinFromAfk,
  resolveRubberDuckEncounter,
  rollDice,
  sellHouse,
  settleDebt,
  unmortgageProperty,
  useGetOutOfJailCard,
  useJanitorTunnelTravel,
  withdrawTrade,
} from '../game/engine';

// Every function here follows the same shape: take the game state this
// client already has (from its live Firestore subscription), run it
// through a pure function from game/engine.ts, and write the result back.
// This is the "client-authoritative" trust model from
// docs/adr/0001-client-authoritative-sync.md - there's no server checking
// these writes are legal moves.
async function writeGameState(roomCode: string, game: GameState) {
  await updateDoc(doc(db, 'rooms', roomCode), { game });
}

export async function startGame(roomCode: string, playerAssignments: { playerId: string; pieceId: PieceId }[]) {
  await writeGameState(roomCode, createInitialGameState(playerAssignments, Math.random));
}

/**
 * The nuclear option for the host: wipes the room's `game` field
 * entirely (Room.game is optional - "absent while the room is still in
 * its lobby" - so this is the same as the room never having started
 * one), dropping everyone straight back to the Lobby for every
 * connected client at once via their live subscription. For a game
 * that's gotten stuck in a way even kicking a player and force-skipping
 * a turn can't recover from. Players keep their existing seats/Personnel
 * assignments in room.players, so the host can just hit Start Game
 * again immediately rather than everyone re-joining from scratch.
 */
export async function endGameEntirely(roomCode: string) {
  await updateDoc(doc(db, 'rooms', roomCode), { game: deleteField() });
}

/**
 * Starts a fresh match with everyone currently in the room, skipping
 * the Lobby entirely - offered once a match ends so a rematch doesn't
 * mean re-picking Personnel one at a time. Always assigns random
 * Personnel the way "experienced" mode does (and sets the room's mode
 * to match, so it stays consistent if the host ever goes back to a
 * normal Lobby afterward) - everyone here has already played a full
 * game, so there's no reason to make them pick blind again.
 */
export async function startNewMatch(roomCode: string, room: Room) {
  const claimed: PieceId[] = [];
  const assignments: { playerId: string; pieceId: PieceId }[] = [];
  for (const playerId of Object.keys(room.players)) {
    const pieceId = pickAvailablePiece(claimed);
    if (!pieceId) break; // more players than Personnel exist - shouldn't happen, but don't crash if it does
    claimed.push(pieceId);
    assignments.push({ playerId, pieceId });
  }
  await updateDoc(doc(db, 'rooms', roomCode), {
    mode: 'experienced',
    game: createInitialGameState(assignments, Math.random),
  });
}

export async function rollDiceAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, rollDice(game));
}

export async function buyTileAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, buyTile(game, playerId));
}

export async function declinePurchaseAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, declinePurchase(game));
}

export async function endTurnAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, endTurn(game));
}

export async function acknowledgeCardAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, acknowledgeCard(game));
}

export async function chooseCardFromChoicesAndSync(roomCode: string, game: GameState, playerId: string, cardId: string) {
  await writeGameState(roomCode, chooseCardFromChoices(game, playerId, cardId));
}

export async function drawFromPileAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, drawFromPile(game, playerId));
}

export async function catRedirectCardAndSync(roomCode: string, game: GameState, playerId: string, targetPlayerId: string | null) {
  await writeGameState(roomCode, catRedirectCard(game, playerId, targetPlayerId));
}

export async function resolveRubberDuckEncounterAndSync(roomCode: string, game: GameState, sendToJailChoice: boolean) {
  await writeGameState(roomCode, resolveRubberDuckEncounter(game, sendToJailChoice));
}

export async function buildHouseAndSync(roomCode: string, game: GameState, playerId: string, tileId: number) {
  await writeGameState(roomCode, buildHouse(game, playerId, tileId));
}

export async function sellHouseAndSync(roomCode: string, game: GameState, playerId: string, tileId: number) {
  await writeGameState(roomCode, sellHouse(game, playerId, tileId));
}

export async function mortgageTileAndSync(roomCode: string, game: GameState, playerId: string, tileId: number) {
  await writeGameState(roomCode, mortgageProperty(game, playerId, tileId));
}

export async function unmortgageTileAndSync(roomCode: string, game: GameState, playerId: string, tileId: number) {
  await writeGameState(roomCode, unmortgageProperty(game, playerId, tileId));
}

export async function payClearanceFeeAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, payClearanceFee(game, playerId));
}

export async function useGetOutOfJailCardAndSync(roomCode: string, game: GameState, playerId: string, cardId: string) {
  await writeGameState(roomCode, useGetOutOfJailCard(game, playerId, cardId));
}

export async function useJanitorTunnelTravelAndSync(roomCode: string, game: GameState, playerId: string, targetTileId: number) {
  await writeGameState(roomCode, useJanitorTunnelTravel(game, playerId, targetTileId));
}

/** Pays off a pending debtSettlement, if selling/mortgaging (sellHouseAndSync/mortgageTileAndSync above) has raised enough since it opened. */
export async function settleDebtAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, settleDebt(game, playerId));
}

/** Gives up on a pending debtSettlement rather than keep selling/mortgaging - real bankruptcy/Termination. */
export async function declareBankruptcyAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, declareBankruptcy(game, playerId));
}

// --- Trading -------------------------------------------------------------

export async function proposeTradeAndSync(roomCode: string, game: GameState, offer: Omit<TradeOffer, 'id'>) {
  await writeGameState(roomCode, proposeTrade(game, offer));
}

export async function acceptTradeAndSync(roomCode: string, game: GameState, tradeId: string) {
  await writeGameState(roomCode, acceptTrade(game, tradeId));
}

export async function declineTradeAndSync(roomCode: string, game: GameState, tradeId: string) {
  await writeGameState(roomCode, declineTrade(game, tradeId));
}

export async function withdrawTradeAndSync(roomCode: string, game: GameState, tradeId: string) {
  await writeGameState(roomCode, withdrawTrade(game, tradeId));
}

export async function afkSkipTurnAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, afkSkipTurn(game));
}

export async function confirmStillHereAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, confirmStillHere(game, playerId));
}

export async function rejoinFromAfkAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, rejoinFromAfk(game, playerId));
}

// --- Dev panel -------------------------------------------------------------

export async function devSetCreditsAndSync(roomCode: string, game: GameState, playerId: string, credits: number) {
  await writeGameState(roomCode, devSetCredits(game, playerId, credits));
}

export async function devSetForcedRollAndSync(roomCode: string, game: GameState, roll: [number, number] | null) {
  await writeGameState(roomCode, devSetForcedRoll(game, roll));
}

export async function devSetForcedCardAndSync(roomCode: string, game: GameState, cardId: string | null) {
  await writeGameState(roomCode, devSetForcedCard(game, cardId));
}

export async function devJumpToTileAndSync(roomCode: string, game: GameState, playerId: string, tileId: number) {
  await writeGameState(roomCode, devJumpToTile(game, playerId, tileId));
}

export async function devForceSkipTurnAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, devForceSkipTurn(game));
}

export async function devKickPlayerAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, devKickPlayer(game, playerId));
}

export async function devRevivePlayerAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, devRevivePlayer(game, playerId));
}
