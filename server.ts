import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server, Socket } from 'socket.io'
import {
  GameState, Player,
  createGame, startRound, processAction, processAIAction,
  getValidActions, prepareNextRound, isPlayerTurn,
  CreateGameConfig, PlayerTendencies,
} from './lib/poker/engine'
import { AIDifficulty, getAIDialogue } from './lib/poker/ai'

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)
const app  = next({ dev })
const handle = app.getRequestHandler()

// ─── Room Management ─────────────────────────────────────────

interface PlayerStats {
  actions: number
  raises: number
  folds: number
}

interface Room {
  id: string
  hostSocketId: string
  players: Map<string, { socketId: string; name: string; userId?: number }>
  gameState: GameState | null
  started: boolean
  maxPlayers: number
  // Tracks human player tendencies for AI adaptation
  humanStats: Map<string, PlayerStats>
}

const rooms = new Map<string, Room>()
const socketToRoom = new Map<string, string>()
// Session tokens for reconnect: token → { roomId, playerId }
const sessionTokens = new Map<string, { roomId: string; playerId: string; name: string }>()
// Disconnect timers: playerId → timeout handle (gives 45s grace before folding)
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let t = ''
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)]
  return t
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function getRoomSafeState(room: Room, requestingPlayerId?: string): object {
  if (!room.gameState) return { id: room.id, started: false, players: [] }

  const state = room.gameState
  // Hide AI/opponent hole cards unless showdown
  const safePlayers = state.players.map(p => ({
    ...p,
    holeCards: (p.isAI || (requestingPlayerId && p.id !== requestingPlayerId))
      ? (state.stage === 'showdown'
          ? p.holeCards.map(c => ({ ...c, hidden: false }))
          : p.holeCards.map(() => ({ rank: 0, suit: 'S', hidden: true })))
      : p.holeCards,
  }))

  return { ...state, players: safePlayers }
}

// ─── AI Turn Loop ─────────────────────────────────────────────

async function processAITurns(
  io: Server,
  room: Room,
  depth = 0,
): Promise<void> {
  if (depth > 20 || !room.gameState) return
  const state = room.gameState
  if (state.stage === 'showdown' || state.stage === 'ended' || state.stage === 'waiting') return

  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer || !currentPlayer.isAI) return

  // Character-specific think time: Lucky is impulsive, Baron is deliberate, Jester is erratic
  let thinkMs: number
  switch (currentPlayer.difficulty) {
    case 'easy':      thinkMs = 400 + Math.random() * 700;  break  // Lucky: fast, impulsive
    case 'medium':    thinkMs = 700 + Math.random() * 1000; break  // Duchess: measured
    case 'hard':      thinkMs = 900 + Math.random() * 1400; break  // Baron: deliberate
    case 'legendary': thinkMs = 300 + Math.random() * 2000; break  // Jester: unpredictable
    default:          thinkMs = 700 + Math.random() * 1000
  }
  await new Promise(r => setTimeout(r, thinkMs))

  if (!room.gameState) return

  // Build aggregate human tendencies across all tracked players
  let tendencies: PlayerTendencies | undefined
  if (room.humanStats.size > 0) {
    let totalActions = 0, totalRaises = 0, totalFolds = 0
    for (const s of room.humanStats.values()) {
      totalActions += s.actions; totalRaises += s.raises; totalFolds += s.folds
    }
    if (totalActions >= 5) {
      tendencies = {
        raiseFreq: totalRaises / totalActions,
        foldFreq: totalFolds / totalActions,
      }
    }
  }

  const { state: newState, action, dialogue } = processAIAction(room.gameState, tendencies)
  room.gameState = newState

  // Broadcast dialogue
  if (dialogue && currentPlayer.characterId) {
    io.to(room.id).emit('dialogue', {
      characterId: currentPlayer.characterId,
      playerName: currentPlayer.name,
      text: dialogue,
    })
  }

  // Broadcast updated state (hide cards for each recipient)
  for (const [playerId, playerData] of room.players.entries()) {
    const safeState = getRoomSafeState(room, playerId)
    io.to(playerData.socketId).emit('game_state', safeState)
  }

  // If showdown, emit win/lose dialogue then schedule next round
  if (newState.stage === 'showdown') {
    emitShowdownDialogue(io, room, newState)
    setTimeout(async () => {
      if (!room.gameState) return
      const next = prepareNextRound(room.gameState)
      if (next.players.filter(p => p.chips > 0).length < 2) {
        room.gameState = { ...next, stage: 'ended' }
        io.to(room.id).emit('game_state', room.gameState)
        return
      }
      room.gameState = startRound(next)
      for (const [playerId, playerData] of room.players.entries()) {
        io.to(playerData.socketId).emit('game_state', getRoomSafeState(room, playerId))
      }
      await processAITurns(io, room)
    }, 3500)
    return
  }

  // Continue AI turns
  await processAITurns(io, room, depth + 1)
}

// ─── Showdown Dialogue ────────────────────────────────────────

function emitShowdownDialogue(io: Server, room: Room, state: GameState) {
  if (!state.winners || state.winners.length === 0) return
  const winnerIds = new Set(state.winners.map(w => w.playerId))

  // Pick one AI character at random to react (avoid dialogue spam from all players)
  const aiPlayers = state.players.filter(p => p.isAI && p.characterId)
  if (aiPlayers.length === 0) return

  const reactor = aiPlayers[Math.floor(Math.random() * aiPlayers.length)]
  if (!reactor.characterId) return

  const won = winnerIds.has(reactor.id)
  const situation = won ? 'win' : 'lose'
  const text = getAIDialogue(reactor.characterId, situation)
  if (text) {
    // Small delay so dialogue shows after showdown renders
    setTimeout(() => {
      io.to(room.id).emit('dialogue', {
        characterId: reactor.characterId,
        playerName: reactor.name,
        text,
      })
    }, 600)
  }
}

// ─── Socket.IO Handlers ───────────────────────────────────────

function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    // ── Create solo game ────────────────────────────────────
    socket.on('create_solo', async (data: {
      playerName: string
      userId?: number
      opponents: { characterId: string; difficulty: AIDifficulty }[]
      smallBlind?: number
      bigBlind?: number
    }) => {
      const roomId = generateRoomCode()
      const humanId = `human_${socket.id}`

      const players: CreateGameConfig['players'] = [
        { id: humanId, name: data.playerName, isAI: false },
        ...data.opponents.map((o, i) => ({
          id: `ai_${i}`,
          name: characterName(o.characterId),
          isAI: true,
          characterId: o.characterId,
          difficulty: o.difficulty,
        })),
      ]

      const config: CreateGameConfig = {
        players,
        smallBlind: data.smallBlind ?? 10,
        bigBlind: data.bigBlind ?? 20,
      }

      const gameState = startRound(createGame(config))

      const room: Room = {
        id: roomId,
        hostSocketId: socket.id,
        players: new Map([[humanId, { socketId: socket.id, name: data.playerName, userId: data.userId }]]),
        gameState,
        started: true,
        maxPlayers: 1,
        humanStats: new Map([[humanId, { actions: 0, raises: 0, folds: 0 }]]),
      }
      rooms.set(roomId, room)
      socketToRoom.set(socket.id, roomId)

      socket.join(roomId)
      const soloToken = generateToken()
      sessionTokens.set(soloToken, { roomId, playerId: humanId, name: data.playerName })
      socket.emit('solo_started', { roomId, playerId: humanId, sessionToken: soloToken })
      socket.emit('game_state', getRoomSafeState(room, humanId))

      // Start AI turns if AI goes first
      if (gameState.players[gameState.currentPlayerIndex]?.isAI) {
        processAITurns(io, room)
      }
    })

    // ── Create multiplayer room ─────────────────────────────
    socket.on('create_room', (data: { playerName: string; userId?: number }) => {
      const roomId = generateRoomCode()
      const playerId = `p_${socket.id}`

      const room: Room = {
        id: roomId,
        hostSocketId: socket.id,
        players: new Map([[playerId, { socketId: socket.id, name: data.playerName, userId: data.userId }]]),
        gameState: null,
        started: false,
        maxPlayers: 6,
        humanStats: new Map(),
      }
      rooms.set(roomId, room)
      socketToRoom.set(socket.id, roomId)

      socket.join(roomId)
      const createToken = generateToken()
      sessionTokens.set(createToken, { roomId, playerId, name: data.playerName })
      socket.emit('room_joined', {
        roomId,
        playerId,
        isHost: true,
        sessionToken: createToken,
        players: Array.from(room.players.entries()).map(([id, p]) => ({ id, name: p.name })),
      })
    })

    // ── Join room ───────────────────────────────────────────
    socket.on('join_room', (data: { roomId: string; playerName: string; userId?: number }) => {
      const room = rooms.get(data.roomId.toUpperCase())
      if (!room) {
        socket.emit('error', { message: 'Room not found. Check the code and try again.' })
        return
      }
      if (room.started) {
        socket.emit('error', { message: 'This game has already started.' })
        return
      }
      if (room.players.size >= room.maxPlayers) {
        socket.emit('error', { message: 'This table is full.' })
        return
      }

      const playerId = `p_${socket.id}`
      room.players.set(playerId, { socketId: socket.id, name: data.playerName, userId: data.userId })
      socketToRoom.set(socket.id, data.roomId.toUpperCase())
      socket.join(data.roomId.toUpperCase())

      room.humanStats.set(playerId, { actions: 0, raises: 0, folds: 0 })
      const playerList = Array.from(room.players.entries()).map(([id, p]) => ({ id, name: p.name }))
      io.to(data.roomId.toUpperCase()).emit('players_updated', playerList)
      const joinToken = generateToken()
      sessionTokens.set(joinToken, { roomId: data.roomId.toUpperCase(), playerId, name: data.playerName })
      socket.emit('room_joined', { roomId: data.roomId.toUpperCase(), playerId, isHost: false, sessionToken: joinToken, players: playerList })
    })

    // ── Start multiplayer game ──────────────────────────────
    socket.on('start_game', (data: {
      roomId: string
      fillWithAI?: boolean
      smallBlind?: number
      bigBlind?: number
    }) => {
      const room = rooms.get(data.roomId)
      if (!room || room.hostSocketId !== socket.id) {
        socket.emit('error', { message: 'Only the host can start the game.' })
        return
      }
      if (room.players.size < 2 && !data.fillWithAI) {
        socket.emit('error', { message: 'Need at least 2 players to start.' })
        return
      }

      const humanPlayers: CreateGameConfig['players'] = Array.from(room.players.entries())
        .map(([id, p]) => ({ id, name: p.name, isAI: false }))

      const aiOpponents: CreateGameConfig['players'] = data.fillWithAI
        ? fillAI(6 - humanPlayers.length)
        : []

      const config: CreateGameConfig = {
        players: [...humanPlayers, ...aiOpponents],
        smallBlind: data.smallBlind ?? 10,
        bigBlind: data.bigBlind ?? 20,
      }

      room.gameState = startRound(createGame(config))
      room.started = true

      for (const [playerId, playerData] of room.players.entries()) {
        io.to(playerData.socketId).emit('game_started', { playerId })
        io.to(playerData.socketId).emit('game_state', getRoomSafeState(room, playerId))
      }

      if (room.gameState.players[room.gameState.currentPlayerIndex]?.isAI) {
        processAITurns(io, room)
      }
    })

    // ── Player action ───────────────────────────────────────
    socket.on('player_action', async (data: {
      roomId: string
      playerId: string
      action: { type: string; amount?: number }
    }) => {
      const room = rooms.get(data.roomId)
      if (!room || !room.gameState) return

      if (!isPlayerTurn(room.gameState, data.playerId)) {
        socket.emit('error', { message: "It's not your turn." })
        return
      }

      room.gameState = processAction(room.gameState, data.playerId, data.action)

      // Track human player tendencies for AI adaptation
      const playerIsHuman = !room.gameState.players.find(p => p.id === data.playerId)?.isAI
      if (playerIsHuman) {
        const stats = room.humanStats.get(data.playerId) ?? { actions: 0, raises: 0, folds: 0 }
        stats.actions++
        if (data.action.type === 'raise' || data.action.type === 'allin') stats.raises++
        if (data.action.type === 'fold') stats.folds++
        room.humanStats.set(data.playerId, stats)
      }

      for (const [playerId, playerData] of room.players.entries()) {
        io.to(playerData.socketId).emit('game_state', getRoomSafeState(room, playerId))
      }

      if (room.gameState.stage === 'showdown') {
        emitShowdownDialogue(io, room, room.gameState)
        setTimeout(async () => {
          if (!room.gameState) return
          const next = prepareNextRound(room.gameState)
          if (next.players.filter(p => p.chips > 0).length < 2) {
            room.gameState = { ...next, stage: 'ended' }
            io.to(room.id).emit('game_state', room.gameState)
            return
          }
          room.gameState = startRound(next)
          for (const [pId, pd] of room.players.entries()) {
            io.to(pd.socketId).emit('game_state', getRoomSafeState(room, pId))
          }
          const nextPlayer = room.gameState.players[room.gameState.currentPlayerIndex]
          if (nextPlayer?.isAI) await processAITurns(io, room)
        }, 3500)
        return
      }

      // Process AI if it's their turn
      const nextPlayer = room.gameState.players[room.gameState.currentPlayerIndex]
      if (nextPlayer?.isAI) {
        await processAITurns(io, room)
      }
    })

    // ── Reconnect via session token ─────────────────────────
    socket.on('reconnect_session', (data: { sessionToken: string }) => {
      const session = sessionTokens.get(data.sessionToken)
      if (!session) {
        socket.emit('error', { message: 'Session expired. Please start a new game.' })
        return
      }

      const room = rooms.get(session.roomId)
      if (!room) {
        sessionTokens.delete(data.sessionToken)
        socket.emit('error', { message: 'Game is no longer active.' })
        return
      }

      const { playerId } = session

      // Cancel any pending disconnect timer
      const timer = disconnectTimers.get(playerId)
      if (timer) {
        clearTimeout(timer)
        disconnectTimers.delete(playerId)
      }

      // Update socket ID in room
      const existing = room.players.get(playerId)
      const wasHost = room.hostSocketId === (existing?.socketId ?? '')
      if (existing) {
        existing.socketId = socket.id
      } else {
        room.players.set(playerId, { socketId: socket.id, name: session.name })
      }
      // Update host socket if this player was the host
      if (wasHost) room.hostSocketId = socket.id
      socketToRoom.set(socket.id, session.roomId)
      socket.join(session.roomId)

      // Resume the game if it's in progress
      if (room.gameState) {
        // Restore the player's status if they were folded due to timeout
        const gPlayer = room.gameState.players.find(p => p.id === playerId)
        if (gPlayer && gPlayer.status === 'folded') {
          // Can't un-fold mid-hand — they'll be back next round
        }
        socket.emit('reconnected', { playerId, roomId: session.roomId, sessionToken: data.sessionToken })
        socket.emit('game_state', getRoomSafeState(room, playerId))
        if (room.started) socket.emit('game_started', { playerId })
      } else {
        const playerList = Array.from(room.players.entries()).map(([id, p]) => ({ id, name: p.name }))
        socket.emit('reconnected', { playerId, roomId: session.roomId, sessionToken: data.sessionToken })
        socket.emit('room_joined', {
          roomId: session.roomId,
          playerId,
          isHost: room.hostSocketId === socket.id,
          sessionToken: data.sessionToken,
          players: playerList,
        })
      }
    })

    // ── Get room info ───────────────────────────────────────
    socket.on('get_rooms', () => {
      const publicRooms = Array.from(rooms.values())
        .filter(r => !r.started)
        .map(r => ({
          id: r.id,
          players: r.players.size,
          maxPlayers: r.maxPlayers,
        }))
      socket.emit('rooms_list', publicRooms)
    })

    // ── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomId = socketToRoom.get(socket.id)
      if (!roomId) return
      socketToRoom.delete(socket.id)

      const room = rooms.get(roomId)
      if (!room) return

      // Find the disconnected player
      let disconnectedPlayerId: string | null = null
      for (const [playerId, playerData] of room.players.entries()) {
        if (playerData.socketId === socket.id) {
          disconnectedPlayerId = playerId
          break
        }
      }

      if (!disconnectedPlayerId) return

      // Give a 45-second grace period to reconnect before folding/removing
      const graceTimer = setTimeout(() => {
        disconnectTimers.delete(disconnectedPlayerId!)
        const currentRoom = rooms.get(roomId)
        if (!currentRoom) return

        // Check if player has already reconnected (socket would differ)
        const playerData = currentRoom.players.get(disconnectedPlayerId!)
        if (playerData && playerData.socketId !== socket.id) return  // reconnected

        // Remove player and fold their hand
        currentRoom.players.delete(disconnectedPlayerId!)

        if (currentRoom.gameState) {
          const player = currentRoom.gameState.players.find(p => p.id === disconnectedPlayerId)
          if (player && player.status === 'active') {
            currentRoom.gameState = processAction(currentRoom.gameState, disconnectedPlayerId!, { type: 'fold' })
            // Broadcast updated state
            for (const [pId, pd] of currentRoom.players.entries()) {
              io.to(pd.socketId).emit('game_state', getRoomSafeState(currentRoom, pId))
            }
            // Continue AI turns if needed
            const nextPlayer = currentRoom.gameState.players[currentRoom.gameState.currentPlayerIndex]
            if (nextPlayer?.isAI) processAITurns(io, currentRoom)
          }
        }

        if (currentRoom.players.size === 0) {
          rooms.delete(roomId)
          return
        }

        // Reassign host if needed
        if (currentRoom.hostSocketId === socket.id) {
          const firstPlayer = Array.from(currentRoom.players.values())[0]
          if (firstPlayer) currentRoom.hostSocketId = firstPlayer.socketId
        }

        io.to(roomId).emit('player_left', {
          players: Array.from(currentRoom.players.entries()).map(([id, p]) => ({ id, name: p.name })),
        })
      }, 45000)  // 45 second grace period

      disconnectTimers.set(disconnectedPlayerId, graceTimer)

      // Notify others that this player might be disconnected
      io.to(roomId).emit('player_disconnected', { playerId: disconnectedPlayerId })
    })
  })
}

// ─── Helpers ─────────────────────────────────────────────────

const CHARACTER_NAMES: Record<string, string> = {
  baron_von_chips: 'Baron Von Chips',
  lucky_mcgee:     'Lucky McGee',
  the_duchess:     'The Duchess',
  the_jester:      'The Jester',
}

function characterName(id: string): string {
  return CHARACTER_NAMES[id] ?? id
}

const AI_FILL_ORDER = [
  { characterId: 'baron_von_chips', difficulty: 'hard' as AIDifficulty },
  { characterId: 'lucky_mcgee',     difficulty: 'easy' as AIDifficulty },
  { characterId: 'the_duchess',     difficulty: 'medium' as AIDifficulty },
  { characterId: 'the_jester',      difficulty: 'legendary' as AIDifficulty },
]

function fillAI(count: number): CreateGameConfig['players'] {
  return AI_FILL_ORDER.slice(0, Math.max(0, count)).map((o, i) => ({
    id: `ai_fill_${i}`,
    name: characterName(o.characterId),
    isAI: true,
    characterId: o.characterId,
    difficulty: o.difficulty,
  }))
}

// ─── Bootstrap ───────────────────────────────────────────────

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  setupSocket(io)

  httpServer.listen(port, () => {
    console.log(`♠ BATESPOKER — THE VAULT is open on http://localhost:${port}`)
  })
})
