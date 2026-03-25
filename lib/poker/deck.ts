export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface Card {
  rank: Rank
  suit: Suit
  hidden?: boolean
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  S: '♠', H: '♥', D: '♦', C: '♣',
}

export const SUIT_NAMES: Record<Suit, string> = {
  S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs',
}

export const RANK_DISPLAY: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
}

export const RED_SUITS: Suit[] = ['H', 'D']

export function isRedSuit(suit: Suit): boolean {
  return RED_SUITS.includes(suit)
}

export function createDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C']
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function dealCards(deck: Card[], n: number): [Card[], Card[]] {
  return [deck.slice(0, n), deck.slice(n)]
}

export function cardToString(card: Card): string {
  return `${RANK_DISPLAY[card.rank]}${SUIT_SYMBOLS[card.suit]}`
}
