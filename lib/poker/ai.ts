import { Card } from './deck'
import { bestHand, preflopStrength, HandRank } from './evaluator'

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'legendary'
export type AIActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export interface AIAction {
  type: AIActionType
  amount?: number
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
  // Normalize hand rank to 0-1
  switch (result.rank) {
    case HandRank.ROYAL_FLUSH:     return 1.00
    case HandRank.STRAIGHT_FLUSH:  return 0.97
    case HandRank.FOUR_OF_A_KIND:  return 0.94
    case HandRank.FULL_HOUSE:      return 0.88
    case HandRank.FLUSH:           return 0.80
    case HandRank.STRAIGHT:        return 0.73
    case HandRank.THREE_OF_A_KIND: return 0.63
    case HandRank.TWO_PAIR:        return 0.52
    case HandRank.PAIR:            return 0.38 + (result.tiebreakers[0] - 2) / 100
    case HandRank.HIGH_CARD:       return 0.15 + (result.tiebreakers[0] - 2) / 80
    default: return 0.20
  }
}

function hasDraw(holeCards: Card[], communityCards: Card[]): boolean {
  if (communityCards.length < 3) return false
  const all = [...holeCards, ...communityCards]
  // Flush draw: 4 of same suit
  const suitCounts: Record<string, number> = {}
  for (const c of all) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
  if (Object.values(suitCounts).some(c => c === 4)) return true
  // Straight draw: 4 consecutive or near-consecutive
  const ranks = [...new Set(all.map(c => c.rank))].sort((a, b) => a - b)
  for (let i = 0; i < ranks.length - 3; i++) {
    if (ranks[i + 3] - ranks[i] <= 4) return true
  }
  return false
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
    stackSize, position, stage, difficulty, characterId } = ctx

  const strength = getHandStrength(holeCards, communityCards)
  const draw = hasDraw(holeCards, communityCards)
  const canCheck = callAmount === 0

  // Pot odds (if we need to call)
  const potOdds = callAmount > 0 ? callAmount / (potSize + callAmount) : 0

  switch (difficulty) {
    case 'easy':
      return easyAI(strength, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize)
    case 'medium':
      return mediumAI(strength, draw, potOdds, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position)
    case 'hard':
      return hardAI(strength, draw, potOdds, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage, characterId)
    case 'legendary':
      return legendaryAI(strength, draw, potOdds, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position, stage)
    default:
      return mediumAI(strength, draw, potOdds, canCheck, callAmount, minRaise, maxRaise, stackSize, potSize, position)
  }
}

// ─── EASY: Lucky McGee ─────────────────────────────────────────
function easyAI(
  strength: number, canCheck: boolean, callAmount: number,
  minRaise: number, maxRaise: number, stackSize: number, potSize: number,
): AIAction {
  const rand = Math.random()
  if (canCheck) {
    // Likes to check, occasionally raises with decent hands
    if (strength > 0.7 && rand < 0.5) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.5), minRaise, maxRaise) }
    }
    return { type: 'check' }
  }
  // Calls too much — only folds with truly terrible hands
  if (strength < 0.20 && rand < 0.50) return { type: 'fold' }
  if (strength > 0.80 && rand < 0.30) {
    return { type: 'raise', amount: clamp(Math.floor(potSize * 0.75), minRaise, maxRaise) }
  }
  // Check if we can afford the call
  if (callAmount > stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── MEDIUM: The Duchess ───────────────────────────────────────
function mediumAI(
  strength: number, draw: boolean, potOdds: number, canCheck: boolean,
  callAmount: number, minRaise: number, maxRaise: number, stackSize: number,
  potSize: number, position: number,
): AIAction {
  const positionBonus = position * 0.05
  const effectiveStrength = strength + positionBonus
  const rand = Math.random()

  if (canCheck) {
    if (effectiveStrength > 0.65) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.5, 1.0)), minRaise, maxRaise) }
    }
    // Occasional bluff (15%)
    if (rand < 0.15 && position === 2) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.6), minRaise, maxRaise) }
    }
    return { type: 'check' }
  }

  // Fold with weak hands if pot odds don't justify calling
  if (effectiveStrength < 0.30 && potOdds > 0.25) return { type: 'fold' }
  if (effectiveStrength < 0.20) return { type: 'fold' }

  // Semi-bluff with draws
  if (draw && rand < 0.25 && position >= 1) {
    return { type: 'raise', amount: clamp(Math.floor(potSize * 0.6), minRaise, maxRaise) }
  }

  if (effectiveStrength > 0.75) {
    return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.7, 1.5)), minRaise, maxRaise) }
  }

  if (callAmount > stackSize * 0.8) return { type: 'allin' }
  return { type: 'call' }
}

// ─── HARD: Baron Von Chips ─────────────────────────────────────
function hardAI(
  strength: number, draw: boolean, potOdds: number, canCheck: boolean,
  callAmount: number, minRaise: number, maxRaise: number, stackSize: number,
  potSize: number, position: number, stage: string, characterId: string,
): AIAction {
  const positionBonus = position * 0.08
  const stageBonus = stage === 'river' ? 0 : 0.03  // less speculative on river
  const effectiveStrength = clamp(strength + positionBonus + stageBonus, 0, 1)
  const rand = Math.random()

  if (canCheck) {
    // C-bet: bet frequently when in position with any strength
    if (position === 2 && effectiveStrength > 0.30 && rand < 0.75) {
      const betSize = effectiveStrength > 0.65 ? randomBetween(0.75, 1.2) : randomBetween(0.4, 0.7)
      return { type: 'raise', amount: clamp(Math.floor(potSize * betSize), minRaise, maxRaise) }
    }
    // Semi-bluff
    if (draw && rand < 0.45) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.6), minRaise, maxRaise) }
    }
    return { type: 'check' }
  }

  // Fold marginal hands with bad pot odds
  if (effectiveStrength < 0.25 && potOdds > 0.20 && !draw) return { type: 'fold' }
  if (effectiveStrength < 0.15) return { type: 'fold' }

  // 3-bet with strong hands
  if (effectiveStrength > 0.80) {
    if (rand < 0.70) {
      return { type: 'raise', amount: clamp(Math.floor((potSize + callAmount * 2) * 1.0), minRaise, maxRaise) }
    }
    if (callAmount > stackSize * 0.7) return { type: 'allin' }
  }

  // Semi-bluff re-raise
  if (draw && position === 2 && rand < 0.30) {
    return { type: 'raise', amount: clamp(Math.floor(potSize * 0.8), minRaise, maxRaise) }
  }

  if (callAmount > stackSize * 0.9) return { type: 'allin' }
  if (callAmount > stackSize) return { type: 'allin' }
  return { type: 'call' }
}

// ─── LEGENDARY: The Jester ────────────────────────────────────
function legendaryAI(
  strength: number, draw: boolean, potOdds: number, canCheck: boolean,
  callAmount: number, minRaise: number, maxRaise: number, stackSize: number,
  potSize: number, position: number, stage: string,
): AIAction {
  const rand = Math.random()
  const positionBonus = position * 0.10
  const effectiveStrength = clamp(strength + positionBonus, 0, 1)

  // Mixed strategy frequencies based on GTO-ish thinking
  const bluffFreq = stage === 'river' ? 0.25 : 0.35
  const raiseForValue = effectiveStrength > 0.60
  const polarizedBluff = effectiveStrength < 0.25 && rand < bluffFreq

  if (canCheck) {
    if (raiseForValue) {
      // Size based on streets
      const sizeMult = stage === 'river' ? randomBetween(0.6, 1.1)
        : stage === 'turn' ? randomBetween(0.5, 0.9)
        : randomBetween(0.3, 0.7)
      return { type: 'raise', amount: clamp(Math.floor(potSize * sizeMult), minRaise, maxRaise) }
    }
    if (polarizedBluff) {
      return { type: 'raise', amount: clamp(Math.floor(potSize * randomBetween(0.5, 1.0)), minRaise, maxRaise) }
    }
    if (draw && rand < 0.55 && stage !== 'river') {
      return { type: 'raise', amount: clamp(Math.floor(potSize * 0.5), minRaise, maxRaise) }
    }
    return { type: 'check' }
  }

  // Fold very weak hands facing a bet (not a bluff)
  if (effectiveStrength < 0.18 && potOdds > 0.25) {
    if (rand > bluffFreq) return { type: 'fold' }
  }
  if (effectiveStrength < 0.10) return { type: 'fold' }

  // Value re-raise
  if (effectiveStrength > 0.75) {
    const sizeMult = stage === 'river' ? randomBetween(1.0, 1.5) : randomBetween(0.8, 1.2)
    const amount = clamp(Math.floor((callAmount + potSize) * sizeMult), minRaise, maxRaise)
    if (rand < 0.65) return { type: 'raise', amount }
    if (callAmount > stackSize * 0.8) return { type: 'allin' }
  }

  // Bluff-raise
  if (polarizedBluff && stage !== 'river') {
    return { type: 'raise', amount: clamp(Math.floor(potSize * 0.75), minRaise, maxRaise) }
  }

  if (callAmount > stackSize) return { type: 'allin' }
  return { type: 'call' }
}
