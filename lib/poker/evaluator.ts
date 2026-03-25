import { Card } from './deck'

export enum HandRank {
  HIGH_CARD      = 0,
  PAIR           = 1,
  TWO_PAIR       = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT       = 4,
  FLUSH          = 5,
  FULL_HOUSE     = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH    = 9,
}

export const HAND_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]:       'High Card',
  [HandRank.PAIR]:            'One Pair',
  [HandRank.TWO_PAIR]:        'Two Pair',
  [HandRank.THREE_OF_A_KIND]: 'Three of a Kind',
  [HandRank.STRAIGHT]:        'Straight',
  [HandRank.FLUSH]:           'Flush',
  [HandRank.FULL_HOUSE]:      'Full House',
  [HandRank.FOUR_OF_A_KIND]:  'Four of a Kind',
  [HandRank.STRAIGHT_FLUSH]:  'Straight Flush',
  [HandRank.ROYAL_FLUSH]:     'Royal Flush',
}

export interface HandResult {
  rank: HandRank
  name: string
  tiebreakers: number[]
}

// Evaluate exactly 5 cards
export function evaluate5(cards: Card[]): HandResult {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)

  const isFlush = suits.every(s => s === suits[0])
  const rankCounts: Record<number, number> = {}
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1

  const counts = Object.entries(rankCounts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)

  // Check straight (including A-2-3-4-5 wheel)
  let isStraight = false
  let straightHigh = 0
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a)
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true
      straightHigh = uniqueRanks[0]
    } else if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true
      straightHigh = 5 // wheel
    }
  }

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: HandRank.ROYAL_FLUSH, name: HAND_NAMES[HandRank.ROYAL_FLUSH], tiebreakers: [14] }
    }
    return { rank: HandRank.STRAIGHT_FLUSH, name: HAND_NAMES[HandRank.STRAIGHT_FLUSH], tiebreakers: [straightHigh] }
  }

  if (counts[0].count === 4) {
    const kicker = counts[1].rank
    return { rank: HandRank.FOUR_OF_A_KIND, name: HAND_NAMES[HandRank.FOUR_OF_A_KIND], tiebreakers: [counts[0].rank, kicker] }
  }

  if (counts[0].count === 3 && counts[1].count === 2) {
    return { rank: HandRank.FULL_HOUSE, name: HAND_NAMES[HandRank.FULL_HOUSE], tiebreakers: [counts[0].rank, counts[1].rank] }
  }

  if (isFlush) {
    return { rank: HandRank.FLUSH, name: HAND_NAMES[HandRank.FLUSH], tiebreakers: ranks }
  }

  if (isStraight) {
    return { rank: HandRank.STRAIGHT, name: HAND_NAMES[HandRank.STRAIGHT], tiebreakers: [straightHigh] }
  }

  if (counts[0].count === 3) {
    const kickers = counts.slice(1).map(c => c.rank)
    return { rank: HandRank.THREE_OF_A_KIND, name: HAND_NAMES[HandRank.THREE_OF_A_KIND], tiebreakers: [counts[0].rank, ...kickers] }
  }

  if (counts[0].count === 2 && counts[1].count === 2) {
    const kicker = counts[2].rank
    return {
      rank: HandRank.TWO_PAIR,
      name: HAND_NAMES[HandRank.TWO_PAIR],
      tiebreakers: [Math.max(counts[0].rank, counts[1].rank), Math.min(counts[0].rank, counts[1].rank), kicker],
    }
  }

  if (counts[0].count === 2) {
    const kickers = counts.slice(1).map(c => c.rank)
    return { rank: HandRank.PAIR, name: HAND_NAMES[HandRank.PAIR], tiebreakers: [counts[0].rank, ...kickers] }
  }

  return { rank: HandRank.HIGH_CARD, name: HAND_NAMES[HandRank.HIGH_CARD], tiebreakers: ranks }
}

// Get best 5-card hand from 5-7 cards
export function bestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const all = [...holeCards, ...communityCards]
  if (all.length < 5) return evaluate5(all.concat(Array(5 - all.length).fill({ rank: 2, suit: 'S' })))
  if (all.length === 5) return evaluate5(all)

  let best: HandResult | null = null
  // Generate all C(n,5) combinations
  for (let i = 0; i < all.length - 4; i++) {
    for (let j = i + 1; j < all.length - 3; j++) {
      for (let k = j + 1; k < all.length - 2; k++) {
        for (let l = k + 1; l < all.length - 1; l++) {
          for (let m = l + 1; m < all.length; m++) {
            const hand = evaluate5([all[i], all[j], all[k], all[l], all[m]])
            if (!best || compareHands(hand, best) > 0) {
              best = hand
            }
          }
        }
      }
    }
  }
  return best!
}

// Returns 1 if a > b, -1 if a < b, 0 if equal
export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const av = a.tiebreakers[i] ?? 0
    const bv = b.tiebreakers[i] ?? 0
    if (av !== bv) return av > bv ? 1 : -1
  }
  return 0
}

// Simple preflop hand strength (0-1) for AI decisions
export function preflopStrength(holeCards: Card[]): number {
  if (holeCards.length < 2) return 0
  const [c1, c2] = holeCards
  const r1 = Math.max(c1.rank, c2.rank)
  const r2 = Math.min(c1.rank, c2.rank)
  const suited = c1.suit === c2.suit
  const paired = r1 === r2
  const gap = r1 - r2

  if (paired) {
    if (r1 >= 14) return 1.0   // AA
    if (r1 >= 13) return 0.95  // KK
    if (r1 >= 12) return 0.90  // QQ
    if (r1 >= 11) return 0.85  // JJ
    if (r1 >= 10) return 0.80  // TT
    if (r1 >= 9)  return 0.70  // 99
    if (r1 >= 8)  return 0.62  // 88
    if (r1 >= 7)  return 0.54  // 77
    if (r1 >= 6)  return 0.47  // 66
    return 0.40                // 22-55
  }

  // Suited
  if (suited) {
    if (r1 === 14 && r2 === 13) return 0.88  // AKs
    if (r1 === 14 && r2 === 12) return 0.82  // AQs
    if (r1 === 14 && r2 === 11) return 0.78  // AJs
    if (r1 === 14 && r2 >= 10)  return 0.74  // ATs
    if (r1 === 14)               return 0.60 + r2 / 100  // Axs
    if (r1 === 13 && r2 === 12) return 0.76  // KQs
    if (r1 === 13 && r2 === 11) return 0.72  // KJs
    if (r1 === 13 && r2 >= 10)  return 0.68  // KTs
    if (r1 === 12 && r2 === 11) return 0.70  // QJs
    if (r1 === 12 && r2 >= 10)  return 0.65  // QTs
    if (gap <= 1 && r1 >= 10)   return 0.62  // connected broadways suited
    if (gap <= 2 && r1 >= 8)    return 0.52  // suited connectors
    return 0.40
  }

  // Offsuit
  if (r1 === 14 && r2 === 13) return 0.82  // AKo
  if (r1 === 14 && r2 === 12) return 0.74  // AQo
  if (r1 === 14 && r2 === 11) return 0.70  // AJo
  if (r1 === 14 && r2 >= 10)  return 0.66  // ATo
  if (r1 === 14)               return 0.50 + r2 / 100
  if (r1 === 13 && r2 === 12) return 0.68  // KQo
  if (r1 === 13 && r2 === 11) return 0.63  // KJo
  if (r1 >= 12 && r2 >= 10)   return 0.58
  if (r1 >= 10 && gap <= 1)   return 0.50  // connected tens
  return 0.30
}
