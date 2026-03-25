import { Card } from './deck'
import { bestHand, preflopStrength, HandRank } from './evaluator'

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'legendary'
export type AIActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export interface AIAction {
  type: AIActionType
  amount?: number
  isBluff?: boolean
}

export interface AIContext {
  holeCards: Card[]
  communityCards: Card[]
  potSize: number
  callAmount: number
  minRaise: number
  maxRaise: number
  stackSize: number
  position: number  // 0=early, 1=middle, 2=late/button
  stage: 'preflop' | 'flop' | 'turn' | 'river'
  difficulty: AIDifficulty
  characterId: string
  activePlayers: number
  previousBettingAction?: string  // 'raised', 'checked', 'called'
}

// ─────────────────────────────────────────────────────────────
// DIALOGUE TABLES
// ─────────────────────────────────────────────────────────────

const DIALOGUE: Record<string, Record<string, string[]>> = {
  baron_von_chips: {
    win:      [
      "Predictable. As all things are, in the end.",
      "Fascinating. Your incompetence has a certain... artistry.",
      "The pot is mine. As it was always destined to be.",
      "I expected nothing less from such... enthusiastic amateurs.",
    ],
    lose:     [
      "A temporary setback. The data will be recalibrated.",
      "Enjoy it. The universe rarely makes such clerical errors twice.",
      "Hmm. A statistical anomaly. Nothing more.",
      "I shall remember this hand. In exquisite detail.",
    ],
    bluff:    [
      "My face is an unreadable manuscript. Observe.",
      "I am... considering my options. Do try to keep up.",
      "Every bet tells a story. You simply lack the vocabulary to read it.",
    ],
    bigRaise: [
      "I suggest you count your chips carefully before proceeding.",
      "The mathematically correct response would be to fold.",
      "Raise. I grow weary of subtlety.",
    ],
    fold:     [
      "A tactical withdrawal. Not a defeat.",
      "This hand lacks... potential.",
      "I choose not to grace this particular round with my presence.",
    ],
    badBeat:  [
      "Preposterous. Absolutely preposterous.",
      "The probability of that outcome was... deeply offensive.",
      "Note to self: have statistician executed.",
    ],
    general:  [
      "Shall we begin? I've an empire to run after this.",
      "Every card is a variable. I have already solved for all of them.",
      "You play with... charming naivety.",
    ],
  },
  lucky_mcgee: {
    win:      [
      "YEEHAW! Hot dog, I knew it! I KNEW IT!",
      "Lady Luck is sittin' right here on my shoulder, boys!",
      "Hot diggity! Didn't I say I had a feelin'?",
      "Wahoo! Rake them chips on over, pardner!",
    ],
    lose:     [
      "Well shoot. Had a real good feelin' about them cards too.",
      "Dagnabbit! You got more luck than a four-leaf clover, I'll give ya that.",
      "Aw shucks. Reckon I'll get 'em next time!",
      "Well butter my biscuit, that stings a little.",
    ],
    bluff:    [
      "Uh... yep. Totally sure about this one. Hundred percent.",
      "Don't you go readin' into nothin' now, you hear?",
      "I got a good feelin'! ...Mostly.",
    ],
    bigRaise: [
      "Well I'm all in on the good Lord's grace and my gut instinct!",
      "Sometimes ya just gotta trust your belly!",
      "Go big or go home, that's what my daddy always said!",
    ],
    fold:     [
      "Welp, discretion's the better part of valor and all that.",
      "I'll sit this dance out, thank ya kindly.",
      "Reckon them cards weren't meant to be.",
    ],
    badBeat:  [
      "YOU GOTTA BE KIDDIN' ME.",
      "THAT IS PHYSICALLY IMPOSSIBLE AND I AM PERSONALLY OFFENDED.",
      "Well I'll be a monkey's uncle... how'd you even DO that?",
    ],
    general:  [
      "Feelin' real lucky today, I tell ya what.",
      "You folks ready to lose some chips to Lucky McGee?",
      "Hot dog! This is gonna be a GREAT round!",
    ],
  },
  the_duchess: {
    win:      [
      "Obviously.",
      "I'd be insulted if I thought you understood the insult.",
      "Do keep your chips tidier when you slide them to me, darling.",
      "Another victory for the competent. How tediously predictable.",
    ],
    lose:     [
      "Enjoy your moment. They're so very rare for people like you.",
      "A gift from the cards. Not from your skill.",
      "Do try not to gloat. It's frightfully common.",
      "How... unexpected. I shall process this indignity privately.",
    ],
    bluff:    [
      "How tedious, explaining every nuance to the uninitiated.",
      "This table is beneath me. I play it regardless.",
      "Do stop trying to read my expressions. You lack the education.",
    ],
    bigRaise: [
      "I raise. Keep up, if you're capable.",
      "The appropriate response is to fold. I won't repeat myself.",
      "Interesting that you're still in this hand. Brave of you.",
    ],
    fold:     [
      "Not worth my time, frankly.",
      "I have standards. This hand doesn't meet them.",
      "I decline to participate in whatever *that* was.",
    ],
    badBeat:  [
      "I find this... profoundly objectionable.",
      "I shall have words with whoever shuffled these cards.",
      "This is why I usually play in better establishments.",
    ],
    general:  [
      "Shall we proceed? Some of us have standards for timekeeping.",
      "I'm told conversation makes the hours pass. I remain skeptical.",
      "I do hope today's company exceeds yesterday's. It could hardly be worse.",
    ],
  },
  the_jester: {
    win:      [
      "HAHAHA WAIT I WON? I wasn't even paying attention!",
      "Yes! Yes yes yes! The chaos gods are PLEASED!",
      "I had ABSOLUTELY no plan and it WORKED. This is my favorite day.",
      "Did everyone see that? Did you SEE THAT?! I'm framing this hand.",
    ],
    lose:     [
      "Okay LISTEN, statistically that was—actually no, I have no defense.",
      "BETRAYED. By the very cards I was miscounting.",
      "You know what, I respect the hustle. I hate it, but I respect it.",
      "This is fine. Everything is fine. *visible sweating*",
    ],
    bluff:    [
      "I am definitely not doing something extremely suspicious right now.",
      "WAIT WAIT WAIT. What are we even—is this still poker?",
      "My face is a mask of pure poker professionalism. Look at it.",
    ],
    bigRaise: [
      "You know what they say: 'go big, go home, also go big'.",
      "MAXIMUM CHAOS. Let's GO.",
      "I'm statistically certain this is going to work. Statistically. Ish.",
    ],
    fold:     [
      "Strategic... folding... for complicated reasons I'll explain never.",
      "I fold! On purpose! I meant to do that!",
      "Okay so I had a PLAN and it's EVOLVING.",
    ],
    badBeat:  [
      "HOLD ON. HOLD ON. THAT CANNOT BE LEGAL.",
      "I need a moment. And a sandwich. And possibly therapy.",
      "THE AUDACITY. THE ABSOLUTE GALAXY-BRAINED AUDACITY.",
    ],
    general:  [
      "Ah, poker! The great equalizer! ...For everyone but me, historically.",
      "Fun fact: I've read seventeen books on poker strategy. They did not help.",
      "Oh interesting, you're using the 'have cards' strategy. Bold.",
      "I wonder if anyone's ever won poker by pure vibes. Testing that today.",
    ],
  },
}

export function getAIDialogue(characterId: string, situation: string): string {
  const charDialogue = DIALOGUE[characterId]
  if (!charDialogue) return ''
  const lines = charDialogue[situation] || charDialogue.general || []
  if (!lines.length) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

// ─────────────────────────────────────────────────────────────
// HAND STRENGTH CALCULATOR (post-flop)
// ─────────────────────────────────────────────────────────────

function getHandStrength(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length === 0) {
    return preflopStrength(holeCards)
  }
  const result = bestHand(holeCards, communityCards)
  const tb = result.tiebreakers
  // Normalize hand rank to 0-1 with finer granularity using tiebreakers
  switch (result.rank) {
    case HandRank.ROYAL_FLUSH:     return 1.00
    case HandRank.STRAIGHT_FLUSH:  return 0.975 + (tb[0] ?? 0) / 1000
    case HandRank.FOUR_OF_A_KIND:  return 0.940 + (tb[0] ?? 0) / 500
    case HandRank.FULL_HOUSE:      return 0.870 + (tb[0] ?? 0) / 200   // 0.88-0.94
    case HandRank.FLUSH:           return 0.790 + (tb[0] ?? 0) / 200   // 0.80-0.86
    case HandRank.STRAIGHT:        return 0.720 + (tb[0] ?? 0) / 300   // 0.72-0.77
    case HandRank.THREE_OF_A_KIND: return 0.625 + (tb[0] ?? 0) / 180   // 0.63-0.70
    case HandRank.TWO_PAIR:        return 0.500 + (tb[0] ?? 0) / 140 + (tb[1] ?? 0) / 280  // 0.52-0.65
    case HandRank.PAIR:            return 0.300 + (tb[0] ?? 0) / 50  + (tb[1] ?? 0) / 350  // 0.34-0.62
    case HandRank.HIGH_CARD:       return 0.060 + (tb[0] ?? 0) / 90  + (tb[1] ?? 0) / 450  // 0.09-0.26
    default: return 0.20
  }
}

// Draw equity: returns approximate winning equity from the draw (0 = no draw)
function drawEquity(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length < 3) return 0
  const all = [...holeCards, ...communityCards]
  let equity = 0
  const onTurn = communityCards.length === 3  // 1 card to come after this vs 2

  // Flush draw: 4 of same suit
  const suitCounts: Record<string, number> = {}
  for (const c of all) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
  if (Object.values(suitCounts).some(c => c === 4)) {
    equity = Math.max(equity, onTurn ? 0.35 : 0.19)
  }

  const ranks = [...new Set(all.map(c => c.rank))].sort((a, b) => a - b)
  for (let i = 0; i + 3 < ranks.length; i++) {
    const span = ranks[i + 3] - ranks[i]
    if (span === 3) {
      // Open-ended straight draw
      equity = Math.max(equity, onTurn ? 0.31 : 0.17)
    } else if (span === 4) {
      // Gutshot straight draw
      equity = Math.max(equity, onTurn ? 0.16 : 0.09)
    }
  }
  return equity
}

// ─────────────────────────────────────────────────────────────
// AI DECISION ENGINE
// ─────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

export function getAIAction(ctx: AIContext): AIAction {
  const { holeCards, communityCards, potSize, callAmount, minRaise, maxRaise,
    stackSize, position, stage, difficulty, activePlayers } = ctx

  const strength = getHandStrength(holeCards, communityCards)
  const drawEq = drawEquity(holeCards, communityCards)
  const canCheck = callAmount === 0
  const potOdds = callAmount > 0 ? callAmount / (potSize + callAmount) : 0
  const spr = potSize > 0 ? stackSize / potSize : 50  // stack-to-pot ratio

  // Multi-way penalty: need stronger hands in multi-way pots
  const multiWayPenalty = activePlayers > 2 ? (activePlayers - 2) * 0.04 : 0
  const adjustedStrength = Math.max(0, strength - multiWayPenalty)

  switch (difficulty) {
    case 'easy':
      return easyAI(adjustedStrength, drawEq, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize)
    case 'medium':
      return mediumAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage)
    case 'hard':
      return hardAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage)
    case 'legendary':
      return legendaryAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage)
    default:
      return mediumAI(adjustedStrength, drawEq, potOdds, spr, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage)
  }
}

// ─── EASY: Lucky McGee ─────────────────────────────────────────
// Calls way too much, raises randomly, gets excited by anything decent
function easyAI(
  strength: number, drawEq: number, canCheck: boolean, callAmount: number,
  minRaise: number, maxRaise: number, stackSize: number, potSize: number,
): AIAction {
  const rand = Math.random()

  if (canCheck) {
    // Raise fairly often with decent hands (doesn't know pot sizing)
    if (strength > 0.60 && rand < 0.55) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.4, 0.9)), minRaise, maxRaise) }
    }
    // Random donk bet ~12% of the time regardless of hand
    if (rand < 0.12) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.25, 0.6)), minRaise, maxRaise) }
    }
    return { type: 'check' }
  }

  // Lucky barely folds — only absolute air under real pressure
  if (strength < 0.13 && drawEq < 0.08 && rand < 0.55) return { type: 'fold' }
  if (strength < 0.08) return { type: 'fold' }

  // Gets excited and raises with strong hands
  if (strength > 0.72 && rand < 0.40) {
    return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.5, 1.0)), minRaise, maxRaise) }
  }

  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── MEDIUM: The Duchess ───────────────────────────────────────
// Solid fundamentals, good pot odds, position-aware, infrequent bluffs
function mediumAI(
  strength: number, drawEq: number, potOdds: number, spr: number,
  canCheck: boolean, callAmount: number, minRaise: number, maxRaise: number,
  stackSize: number, potSize: number, position: number, stage: string,
): AIAction {
  const posBonus = position * 0.06
  const eff = clamp(strength + posBonus, 0, 1)
  const rand = Math.random()

  // SPR adjustments: short-stack → polarize; deep → more speculative
  const sprAdjusted = spr < 3 ? eff + 0.05 : spr > 12 ? eff - 0.03 : eff

  if (canCheck) {
    if (sprAdjusted > 0.60) {
      const sizeMult = stage === 'river' ? randomBetween(0.6, 1.0) : randomBetween(0.5, 0.9)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
    }
    // Pot-sized semi-bluff with strong draws from position
    if (drawEq > 0.20 && position === 2 && rand < 0.30) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.65), minRaise, maxRaise), isBluff: true }
    }
    // Late-position steal ~15%
    if (position === 2 && stage !== 'river' && rand < 0.15) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.55), minRaise, maxRaise), isBluff: true }
    }
    return { type: 'check' }
  }

  // Pot odds + draw: call when draw equity covers the odds
  if (drawEq > potOdds + 0.04 && rand < 0.80) {
    if (callAmount >= stackSize) return { type: 'allin' }
    return { type: 'call' }
  }

  // Fold weak hands when pot odds don't justify
  if (sprAdjusted < 0.28 && potOdds > 0.22) return { type: 'fold' }
  if (sprAdjusted < 0.20) return { type: 'fold' }

  // Low SPR commit: strong hand + committed → allin
  if (spr < 2.5 && sprAdjusted > 0.55) return { type: 'allin' }

  // Value raise with strong hands
  if (sprAdjusted > 0.72) {
    const sizeMult = stage === 'river' ? randomBetween(0.8, 1.4) : randomBetween(0.7, 1.2)
    return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount) * sizeMult), minRaise, maxRaise) }
  }

  // Semi-bluff raise with draws in position
  if (drawEq > 0.25 && position >= 1 && rand < 0.28) {
    return { type: 'raise', amount: clamp(Math.floor(potSize * 0.65), minRaise, maxRaise), isBluff: true }
  }

  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── HARD: Baron Von Chips ─────────────────────────────────────
// Position play, heavy c-betting, polarized 3-bets, SPR-aware commitment
function hardAI(
  strength: number, drawEq: number, potOdds: number, spr: number,
  canCheck: boolean, callAmount: number, minRaise: number, maxRaise: number,
  stackSize: number, potSize: number, position: number, stage: string,
): AIAction {
  const posBonus = position * 0.09
  const eff = clamp(strength + posBonus, 0, 1)
  const rand = Math.random()

  // C-bet frequencies by position and street
  const cbetFreq = position === 2 ? 0.78 : position === 1 ? 0.55 : 0.35

  if (canCheck) {
    // Value bet strong hands
    if (eff > 0.58) {
      // Size up on later streets for value
      const sizeMult = stage === 'river' ? randomBetween(0.7, 1.1)
        : stage === 'turn' ? randomBetween(0.6, 0.9)
        : randomBetween(0.5, 0.8)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
    }
    // C-bet (semi-bluff / probe)
    if (rand < cbetFreq && stage !== 'river') {
      const isBluffBet = eff < 0.40
      const sizeMult = randomBetween(0.45, 0.70)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise), isBluff: isBluffBet }
    }
    // River bluff with polarized range (give up on missed draws unless strong)
    if (stage === 'river' && eff < 0.30 && position === 2 && rand < 0.35) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.6, 1.0)), minRaise, maxRaise), isBluff: true }
    }
    return { type: 'check' }
  }

  // Draw semi-bluff call/raise
  if (drawEq > potOdds + 0.06) {
    if (drawEq > 0.28 && position === 2 && rand < 0.40) {
      // Semi-bluff raise
      return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount) * 0.9), minRaise, maxRaise), isBluff: true }
    }
    if (callAmount < stackSize) return { type: 'call' }
  }

  // Fold weak hands without sufficient odds
  if (eff < 0.22 && potOdds > 0.20 && drawEq < 0.15) return { type: 'fold' }
  if (eff < 0.16) return { type: 'fold' }

  // Low SPR polarization: commit or fold
  if (spr < 2.0) {
    if (eff > 0.50) return { type: 'allin' }
    if (eff < 0.35) return { type: 'fold' }
  }

  // 3-bet with strong hands
  if (eff > 0.75) {
    if (rand < 0.72) {
      const amount = clamp(Math.floor((potSize + callAmount * 3) * 0.85), minRaise, maxRaise)
      return { type: 'raise', amount }
    }
    if (callAmount > stackSize * 0.65) return { type: 'allin' }
  }

  // Light 3-bet bluff with best position
  if (position === 2 && stage === 'preflop' && eff < 0.30 && rand < 0.18) {
    return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount * 3) * 0.75), minRaise, maxRaise), isBluff: true }
  }

  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── LEGENDARY: The Jester ────────────────────────────────────
// Near-GTO mixed strategies, balanced value/bluff ratios, polarized river play
function legendaryAI(
  strength: number, drawEq: number, potOdds: number, spr: number,
  canCheck: boolean, callAmount: number, minRaise: number, maxRaise: number,
  stackSize: number, potSize: number, position: number, stage: string,
): AIAction {
  const rand = Math.random()
  const posBonus = position * 0.10
  const eff = clamp(strength + posBonus, 0, 1)

  // GTO bluff frequency varies by street (balanced ranges)
  const bluffFreq = stage === 'river' ? 0.28 : stage === 'turn' ? 0.33 : 0.38

  // Value threshold: adjust down to incentivize mixed strategies
  const valueThresh = stage === 'river' ? 0.58 : 0.55

  if (canCheck) {
    if (eff > valueThresh) {
      // Size up on river for max value; use smaller sizes on earlier streets to induce
      const sizeMult = stage === 'river' ? randomBetween(0.65, 1.15)
        : stage === 'turn' ? randomBetween(0.50, 0.85)
        : randomBetween(0.30, 0.65)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
    }
    // Polarized bluff with air (GTO balance)
    if (eff < 0.28 && rand < bluffFreq) {
      const sizeMult = stage === 'river' ? randomBetween(0.75, 1.10) : randomBetween(0.50, 0.85)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise), isBluff: true }
    }
    // Semi-bluff with draws (high equity)
    if (drawEq > 0.18 && rand < 0.60 && stage !== 'river') {
      const sizeMult = drawEq > 0.28 ? randomBetween(0.55, 0.90) : randomBetween(0.35, 0.65)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise), isBluff: true }
    }
    return { type: 'check' }
  }

  // Call with draws when getting correct odds (include implied odds)
  const impliedOdds = spr > 5 ? drawEq * 1.3 : drawEq
  if (impliedOdds > potOdds + 0.02 && rand < 0.85) {
    if (drawEq > 0.22 && rand < 0.35) {
      // Semi-bluff raise instead of just calling
      const amount = clamp(Math.floor((potSize + callAmount) * randomBetween(0.8, 1.1)), minRaise, maxRaise)
      return { type: 'raise', amount, isBluff: true }
    }
    if (callAmount < stackSize) return { type: 'call' }
  }

  // Fold weak air when facing bets (balanced — not always fold)
  if (eff < 0.16 && potOdds > 0.22) {
    if (rand > bluffFreq) return { type: 'fold' }  // sometimes call anyway to stay balanced
  }
  if (eff < 0.10) return { type: 'fold' }

  // Low SPR: commit or fold — no middle ground
  if (spr < 1.8) {
    if (eff > 0.48) return { type: 'allin' }
    if (eff < 0.32 && drawEq < 0.20) return { type: 'fold' }
  }

  // Value 3-bet with top of range
  if (eff > 0.78) {
    const sizeMult = stage === 'river' ? randomBetween(1.0, 1.6) : randomBetween(0.85, 1.25)
    const amount = clamp(Math.floor((callAmount + potSize) * sizeMult), minRaise, maxRaise)
    if (rand < 0.68) return { type: 'raise', amount }
    if (callAmount > stackSize * 0.75) return { type: 'allin' }
  }

  // Bluff-raise with bottom of range (polarized 3-bet)
  if (eff < 0.26 && rand < bluffFreq * 0.6 && stage !== 'river') {
    const amount = clamp(Math.floor((potSize + callAmount * 3) * 0.75), minRaise, maxRaise)
    return { type: 'raise', amount, isBluff: true }
  }

  if (callAmount >= stackSize) return { type: 'allin' }
  return { type: 'call' }
}
