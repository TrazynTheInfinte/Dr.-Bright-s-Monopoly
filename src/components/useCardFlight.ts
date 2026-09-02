import { useEffect, useRef } from 'react';
import { ANOMALOUS_EVENT_CARDS } from '../data/cards';
import type { CardDeck, GameState } from '../types/game';

const DECK_SELECTOR: Record<CardDeck, string> = {
  anomalousEvent: '.board-center-deck-anomalousEvent',
  foundationDirective: '.board-center-deck-foundationDirective',
};

/**
 * Watches game.lastDrawnCard for a fresh draw and reports the matching
 * deck pile's on-screen position, so GameBoard can fly a card from
 * there to the reveal panel. Driven by the synced GameState (not a DOM
 * click event, the previous approach) specifically so this fires for
 * every viewer watching a draw, not just whoever clicked the pile - a
 * plain onClick handler only ever runs on the clicker's own browser.
 * Reads the pile's position by class name rather than needing a ref
 * threaded down from Board, since which pile matters is determined by
 * the drawn card's own deck, not by anything Board.tsx knows locally.
 * Keyed off `sequence`, not `cardId` - the exact same card can be drawn
 * twice in a row (a small enough remaining pile), which a plain cardId
 * comparison would treat as already seen and skip the flight for.
 */
export function useCardFlight(
  game: GameState | undefined,
  targetEl: HTMLElement | null,
  onFlight: (deck: CardDeck, from: DOMRect, to: DOMRect) => void,
) {
  const seenSequenceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!game || !game.lastDrawnCard) return;
    const { cardId, sequence } = game.lastDrawnCard;
    if (seenSequenceRef.current === sequence) return;
    seenSequenceRef.current = sequence;

    const deck: CardDeck = ANOMALOUS_EVENT_CARDS.some((card) => card.id === cardId) ? 'anomalousEvent' : 'foundationDirective';
    const pileEl = document.querySelector(DECK_SELECTOR[deck]);
    if (!pileEl || !targetEl) return;

    onFlight(deck, pileEl.getBoundingClientRect(), targetEl.getBoundingClientRect());
  }, [game, targetEl, onFlight]);
}
