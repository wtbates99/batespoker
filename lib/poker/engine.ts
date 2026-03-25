import { Card, createDeck, shuffle, dealCards } from './deck'
import { bestHand, compareHands, HandResult } from './evaluator'
import { AIDifficulty, AIContext, AIAction, getAIAction, getAIDialogue } from './ai'

export type GameStage = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended'
export type PlayerStatus = 'active' | 'folded' | 'allin' | 'out' | 'sitting_out'

export interface Player {
  id: string
  name: string
  isAI: boolean
  characterId?: string
  difficulty?: AIDifficulty
  chips: number
  holeCards: Card[]
  status: PlayerStatus
  currentBet: number
  totalBetThisRound: number
  totalBetThisHand: number
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  handResult?: HandResult
  seatIndex: number
}

export interface SidePot {
  amount: number
  eligiblePlayers: string[]
}

export interface Winner {
  playerId: string
  amount: number
  handName: string
  cards?: Card[]
}

export interface GameState {
  id: string
  stage: GameStage
  players: Player[]
  deck: Card[]
  communityCards: Card[]
  pot: number
  sidePots: SidePot[]
  currentPlayerIndex: number
  dealerIndex: number
  smallBlind: number
  bigBlind: number
  currentBet: number
  minRaise: number
  lastRaiseAmount: number
  round: number
  actionsThisRound: number
  lastActionPlayerId?: string
  lastActionType?: string
  lastActionAmount?: number
  winners?: Winner[]
  dialogue?: { characterId: string; text: string; timestamp: number }
  bettingRoundComplete: boolean
}

export interface CreateGameConfig {
  players: { id: string; name: string; isAI: boolean; characterId?: string; difficulty?: AIDifficulty; chips?: number }[]
  smallBlind?: number
  bigBlind?: number
}

// ─────────────────────────────────────────────────────────────
// CREATE GAME
// ─────────────────────────────────────────────────────────────

export function createGame(config: CreateGameConfig): GameState {
  const smallBlind = config.smallBlind ?? 10
  const bigBlind = config.bigBlind ?? 20

  const players: Player[] = config.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    isAI: p.isAI,
    characterId: p.characterId,
    difficulty: p.difficulty,
    chips: p.chips ?? 1000,
    holeCards: [],
    status: 'active',
    currentBet: 0,
    totalBetThisRound: 0,
    totalBetThisHand: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    seatIndex: i,
  }))

  return {
    id: Math.random().toString(36).slice(2),
    stage: 'waiting',
    players,
    deck: [],
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentPlayerIndex: 0,
    dealerIndex: 0,
    smallBlind,
    bigBlind,
    currentBet: 0,
    minRaise: bigBlind,
    lastRaiseAmount: bigBlind,
    round: 0,
    actionsThisRound: 0,
    bettingRoundComplete: false,
  }
}

// ─────────────────────────────────────────────────────────────
// START ROUND
// ─────────────────────────────────────────────────────────────

export function startRound(state: GameState): GameState {
  let s = { ...state }

  // Remove busted players
  const activePlayers = s.players.filter(p => p.chips > 0)
  if (activePlayers.length < 2) {
    return { ...s, stage: 'ended' }
  }

  // Reset player state
  s.players = s.players.map(p => ({
    ...p,
    holeCards: [],
    status: p.chips > 0 ? 'active' : 'out',
    currentBet: 0,
    totalBetThisRound: 0,
    totalBetThisHand: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    handResult: undefined,
  }))

  // Advance dealer
  const eligibleIndices = s.players
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.chips > 0)
    .map(x => x.i)

  const currentDealerPos = eligibleIndices.indexOf(
    eligibleIndices.find(i => i >= s.dealerIndex) ?? eligibleIndices[0]
  )
  const nextDealerPos = (currentDealerPos + 1) % eligibleIndices.length
  s.dealerIndex = eligibleIndices[nextDealerPos]
  s.players[s.dealerIndex].isDealer = true

  // Small blind = next after dealer
  const sbPos = (nextDealerPos + 1) % eligibleIndices.length
  const sbIndex = eligibleIndices[sbPos]
  // Big blind = next after SB
  const bbPos = (sbPos + 1) % eligibleIndices.length
  const bbIndex = eligibleIndices[bbPos]

  s.players[sbIndex].isSmallBlind = true
  s.players[bbIndex].isBigBlind = true

  // Post blinds
  const sbAmount = Math.min(s.smallBlind, s.players[sbIndex].chips)
  const bbAmount = Math.min(s.bigBlind, s.players[bbIndex].chips)

  s.players[sbIndex].chips -= sbAmount
  s.players[sbIndex].currentBet = sbAmount
  s.players[sbIndex].totalBetThisRound = sbAmount
  s.players[sbIndex].totalBetThisHand = sbAmount
  if (s.players[sbIndex].chips === 0) s.players[sbIndex].status = 'allin'

  s.players[bbIndex].chips -= bbAmount
  s.players[bbIndex].currentBet = bbAmount
  s.players[bbIndex].totalBetThisRound = bbAmount
  s.players[bbIndex].totalBetThisHand = bbAmount
  if (s.players[bbIndex].chips === 0) s.players[bbIndex].status = 'allin'

  s.pot = sbAmount + bbAmount
  s.currentBet = bbAmount
  s.minRaise = bbAmount
  s.lastRaiseAmount = bbAmount

  // Shuffle and deal
  s.deck = shuffle(createDeck())
  for (let i = 0; i < 2; i++) {
    for (const player of s.players) {
      if (player.status === 'active' || player.status === 'allin') {
        const [cards, remaining] = dealCards(s.deck, 1)
        player.holeCards = [...player.holeCards, ...cards]
        s.deck = remaining
      }
    }
  }

  s.communityCards = []
  s.stage = 'preflop'
  s.sidePots = []
  s.winners = undefined
  s.round += 1
  s.actionsThisRound = 0
  s.bettingRoundComplete = false
  s.lastActionPlayerId = undefined
  s.lastActionType = undefined
  s.lastActionAmount = undefined

  // First to act preflop: player after BB
  const utgPos = (bbPos + 1) % eligibleIndices.length
  s.currentPlayerIndex = eligibleIndices[utgPos]

  return s
}

// ─────────────────────────────────────────────────────────────
// GET VALID ACTIONS
// ─────────────────────────────────────────────────────────────

export interface ValidActions {
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  callAmount: number
  canRaise: boolean
  minRaise: number
  maxRaise: number
  canAllIn: boolean
}

export function getValidActions(state: GameState, playerId: string): ValidActions {
  const player = state.players.find(p => p.id === playerId)
  if (!player) {
    return { canFold: false, canCheck: false, canCall: false, callAmount: 0, canRaise: false, minRaise: 0, maxRaise: 0, canAllIn: false }
  }

  const callAmount = Math.max(0, state.currentBet - player.currentBet)
  const canCheck = callAmount === 0
  const canCall = callAmount > 0 && callAmount < player.chips
  const minRaiseTotal = state.currentBet + state.minRaise
  const minRaiseAmount = Math.max(state.minRaise, minRaiseTotal - player.currentBet)
  const maxRaise = player.chips

  return {
    canFold: true,
    canCheck,
    canCall,
    callAmount: Math.min(callAmount, player.chips),
    canRaise: player.chips > callAmount,
    minRaise: Math.min(minRaiseAmount, player.chips),
    maxRaise,
    canAllIn: player.chips > 0,
  }
}

// ─────────────────────────────────────────────────────────────
// PROCESS ACTION
// ─────────────────────────────────────────────────────────────

export function processAction(
  state: GameState,
  playerId: string,
  action: { type: string; amount?: number },
): GameState {
  let s = deepCopy(state)
  const playerIndex = s.players.findIndex(p => p.id === playerId)
  if (playerIndex === -1) return s

  const player = s.players[playerIndex]
  if (player.status !== 'active') return s

  s.lastActionPlayerId = playerId
  s.lastActionType = action.type
  s.lastActionAmount = action.amount
  s.actionsThisRound++

  switch (action.type) {
    case 'fold':
      player.status = 'folded'
      break

    case 'check':
      // no change
      break

    case 'call': {
      const callAmount = Math.min(
        Math.max(0, s.currentBet - player.currentBet),
        player.chips,
      )
      player.chips -= callAmount
      player.currentBet += callAmount
      player.totalBetThisRound += callAmount
      player.totalBetThisHand += callAmount
      s.pot += callAmount
      if (player.chips === 0) player.status = 'allin'
      break
    }

    case 'raise': {
      const raiseAmount = action.amount ?? s.minRaise
      const actualAmount = Math.min(raiseAmount, player.chips)
      player.chips -= actualAmount
      player.currentBet += actualAmount
      player.totalBetThisRound += actualAmount
      player.totalBetThisHand += actualAmount
      s.pot += actualAmount

      if (player.chips === 0) {
        player.status = 'allin'
      }

      if (player.currentBet > s.currentBet) {
        const raiseSize = player.currentBet - s.currentBet
        s.lastRaiseAmount = Math.max(raiseSize, s.bigBlind)
        s.minRaise = s.lastRaiseAmount
        s.currentBet = player.currentBet
      }
      break
    }

    case 'allin': {
      const amount = player.chips
      player.currentBet += amount
      player.totalBetThisRound += amount
      player.totalBetThisHand += amount
      s.pot += amount
      player.chips = 0
      player.status = 'allin'

      if (player.currentBet > s.currentBet) {
        const raiseSize = player.currentBet - s.currentBet
        s.minRaise = Math.max(raiseSize, s.bigBlind)
        s.currentBet = player.currentBet
      }
      break
    }
  }

  // Check if betting round is complete
  s = advanceAfterAction(s)
  return s
}

// ─────────────────────────────────────────────────────────────
// ADVANCE GAME STATE
// ─────────────────────────────────────────────────────────────

function advanceAfterAction(s: GameState): GameState {
  const activePlayers = s.players.filter(p => p.status === 'active' || p.status === 'allin')
  const foldedOrOut = s.players.filter(p => p.status === 'folded' || p.status === 'out')

  // Only one player left
  if (s.players.filter(p => p.status !== 'folded' && p.status !== 'out').length <= 1) {
    return resolveShowdown(s)
  }

  // Check if betting round is complete
  const activeNonAllin = activePlayers.filter(p => p.status === 'active')
  const allCalled = activeNonAllin.every(p => p.currentBet === s.currentBet)
  const everyoneActed = s.actionsThisRound >= activeNonAllin.length || activeNonAllin.length === 0

  if (allCalled && everyoneActed && activeNonAllin.length > 0) {
    s.bettingRoundComplete = true
    return advanceStage(s)
  }
  if (activeNonAllin.length === 0) {
    // All remaining players are all-in
    s.bettingRoundComplete = true
    return advanceStage(s)
  }

  // Move to next active player
  s = moveToNextPlayer(s)
  return s
}

function moveToNextPlayer(s: GameState): GameState {
  let next = (s.currentPlayerIndex + 1) % s.players.length
  let loops = 0
  while (s.players[next].status !== 'active' && loops < s.players.length) {
    next = (next + 1) % s.players.length
    loops++
  }
  s.currentPlayerIndex = next
  return s
}

function advanceStage(s: GameState): GameState {
  // Reset bets
  for (const p of s.players) {
    p.currentBet = 0
    p.totalBetThisRound = 0
  }
  s.currentBet = 0
  s.minRaise = s.bigBlind
  s.actionsThisRound = 0
  s.bettingRoundComplete = false

  switch (s.stage) {
    case 'preflop': {
      // Deal flop
      const [flop, remaining] = dealCards(s.deck, 3)
      s.communityCards = flop
      s.deck = remaining
      s.stage = 'flop'
      break
    }
    case 'flop': {
      const [turn, remaining] = dealCards(s.deck, 1)
      s.communityCards = [...s.communityCards, ...turn]
      s.deck = remaining
      s.stage = 'turn'
      break
    }
    case 'turn': {
      const [river, remaining] = dealCards(s.deck, 1)
      s.communityCards = [...s.communityCards, ...river]
      s.deck = remaining
      s.stage = 'river'
      break
    }
    case 'river':
      return resolveShowdown(s)
  }

  // First to act post-flop: first active player left of dealer
  const eligibleIndices = s.players
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.status === 'active' || x.p.status === 'allin')
    .map(x => x.i)

  if (eligibleIndices.length === 0) return resolveShowdown(s)

  let startIdx = (s.dealerIndex + 1) % s.players.length
  let loops = 0
  while (s.players[startIdx].status !== 'active' && loops < s.players.length) {
    startIdx = (startIdx + 1) % s.players.length
    loops++
  }
  s.currentPlayerIndex = startIdx

  // If only all-in players, skip to next stage
  if (s.players.filter(p => p.status === 'active').length === 0) {
    return advanceStage(s)
  }

  return s
}

// ─────────────────────────────────────────────────────────────
// SHOWDOWN
// ─────────────────────────────────────────────────────────────

function resolveShowdown(s: GameState): GameState {
  s.stage = 'showdown'

  const contenders = s.players.filter(p => p.status !== 'folded' && p.status !== 'out')

  // Reveal all hands
  for (const p of contenders) {
    if (p.holeCards.length >= 2) {
      p.holeCards = p.holeCards.map(c => ({ ...c, hidden: false }))
      p.handResult = bestHand(p.holeCards, s.communityCards)
    }
  }

  // If only one contender, they win everything
  if (contenders.length === 1) {
    const winner = contenders[0]
    s.winners = [{ playerId: winner.id, amount: s.pot, handName: winner.handResult?.name ?? 'Last one standing' }]
    winner.chips += s.pot
    s.pot = 0
    return s
  }

  // Calculate side pots — if only one contender per pot with no all-ins, use s.pot directly
  const hasAllIn = contenders.some(p => p.status === 'allin')
  let pots = calculatePots(s.players)
  // Sanity check: pots total should equal s.pot
  const potsTotal = pots.reduce((sum, p) => sum + p.amount, 0)
  if (!hasAllIn || potsTotal === 0) {
    pots = [{ amount: s.pot, eligiblePlayers: contenders.map(p => p.id) }]
  }
  const winners: Winner[] = []

  for (const pot of pots) {
    const eligible = contenders.filter(p => pot.eligiblePlayers.includes(p.id))
    if (eligible.length === 0) continue

    // Find winner(s) of this pot
    let best = eligible[0]
    for (const p of eligible.slice(1)) {
      if (!best.handResult || !p.handResult) continue
      if (compareHands(p.handResult, best.handResult) > 0) {
        best = p
      }
    }

    // Check for ties
    const potWinners = eligible.filter(p => {
      if (!p.handResult || !best.handResult) return false
      return compareHands(p.handResult, best.handResult) === 0
    })

    const share = Math.floor(pot.amount / potWinners.length)
    let remainder = pot.amount - share * potWinners.length

    for (const w of potWinners) {
      const amount = share + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--
      w.chips += amount
      winners.push({ playerId: w.id, amount, handName: w.handResult?.name ?? '', cards: w.holeCards })
    }
  }

  s.winners = winners
  s.pot = 0
  return s
}

function calculatePots(players: Player[]): SidePot[] {
  const contributions = players
    .filter(p => p.totalBetThisHand > 0 || (p.status !== 'folded' && p.status !== 'out'))
    .map(p => ({ id: p.id, amount: p.totalBetThisHand, status: p.status }))
    .sort((a, b) => a.amount - b.amount)

  if (contributions.length === 0) {
    const total = players.reduce((sum, p) => sum + (p.totalBetThisHand || 0), 0)
    return [{ amount: total, eligiblePlayers: players.filter(p => p.status !== 'folded' && p.status !== 'out').map(p => p.id) }]
  }

  const pots: SidePot[] = []
  let processed = 0

  const active = contributions.filter(c => c.status !== 'folded' && c.status !== 'out')

  // Collect all unique bet amounts
  const allAmounts = [...new Set(contributions.map(c => c.amount))].sort((a, b) => a - b)

  let prevLevel = 0
  for (const level of allAmounts) {
    if (level <= prevLevel) continue
    const diff = level - prevLevel
    const potAmount = contributions
      .filter(c => c.amount > prevLevel)
      .reduce((sum, c) => sum + Math.min(diff, c.amount - prevLevel), 0)

    if (potAmount > 0) {
      const eligible = active
        .filter(c => c.amount >= level)
        .map(c => c.id)

      pots.push({ amount: potAmount, eligiblePlayers: eligible })
    }
    prevLevel = level
  }

  // Any leftover (folded players' contributions beyond allin levels)
  if (pots.length === 0) {
    const total = players.reduce((sum, p) => sum + (p.totalBetThisRound || 0), 0)
    pots.push({ amount: total, eligiblePlayers: active.map(c => c.id) })
  }

  return pots
}

// ─────────────────────────────────────────────────────────────
// AI TURN PROCESSOR
// ─────────────────────────────────────────────────────────────

export function processAIAction(state: GameState): { state: GameState; action: AIAction; dialogue?: string } {
  const player = state.players[state.currentPlayerIndex]
  if (!player || !player.isAI) return { state, action: { type: 'check' } }

  const activePlayers = state.players.filter(p => p.status !== 'folded' && p.status !== 'out')
  const validActions = getValidActions(state, player.id)

  // Determine position (0=early, 1=middle, 2=late)
  const activeIndices = activePlayers.map(p => state.players.indexOf(p))
  const myPos = activeIndices.indexOf(state.currentPlayerIndex)
  const position = myPos >= activeIndices.length - 2 ? 2 : myPos <= 1 ? 0 : 1

  const ctx: AIContext = {
    holeCards: player.holeCards,
    communityCards: state.communityCards,
    potSize: state.pot,
    callAmount: validActions.callAmount,
    minRaise: validActions.minRaise,
    maxRaise: validActions.maxRaise,
    stackSize: player.chips,
    position,
    stage: state.stage as AIContext['stage'],
    difficulty: player.difficulty ?? 'medium',
    characterId: player.characterId ?? 'baron_von_chips',
    activePlayers: activePlayers.length,
  }

  const action = getAIAction(ctx)

  // Get situational dialogue
  let dialogueSituation = 'general'
  if (action.type === 'fold') dialogueSituation = 'fold'
  else if (action.isBluff) dialogueSituation = 'bluff'
  else if (action.type === 'raise' && action.amount && action.amount > state.pot * 0.8) dialogueSituation = 'bigRaise'
  else if (Math.random() < 0.2) dialogueSituation = 'general'

  const dialogue = Math.random() < 0.35 ? getAIDialogue(player.characterId ?? '', dialogueSituation) : undefined

  const newState = processAction(state, player.id, action)
  return { state: newState, action, dialogue }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function isPlayerTurn(state: GameState, playerId: string): boolean {
  return state.players[state.currentPlayerIndex]?.id === playerId &&
    state.stage !== 'showdown' && state.stage !== 'ended' && state.stage !== 'waiting'
}

export function getPlayerById(state: GameState, playerId: string): Player | undefined {
  return state.players.find(p => p.id === playerId)
}

export function prepareNextRound(state: GameState): GameState {
  let s = deepCopy(state)
  // Reset pot, clear community cards for next round display
  s.stage = 'waiting'
  s.winners = undefined
  s.dialogue = undefined
  s.communityCards = []
  for (const p of s.players) {
    p.holeCards = []
    p.handResult = undefined
    p.isDealer = false
    p.isSmallBlind = false
    p.isBigBlind = false
    p.currentBet = 0
    p.totalBetThisRound = 0
    p.totalBetThisHand = 0
    if (p.chips <= 0) p.status = 'out'
    else p.status = 'active'
  }
  return s
}
