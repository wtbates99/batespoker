import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server, Socket } from 'socket.io'
import {
  GameState, Player,
  createGame, startRound, processAction, processAIAction,
  getValidActions, prepareNextRound, isPlayerTurn,
  CreateGameConfig,
} from './lib/poker/engine'
import { AIDifficulty } from './lib/poker/ai'

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)
const app  = next({ dev })
const handle = app.getRequestHandler()

// ─── Room Management ─────────────────────────────────────────

interface Room {
  id: string
  hostSocketId: string
  players: Map<string, { socketId: string; name: string; userId?: number }>
  gameState: GameState | null
  started: boolean
  maxPlayers: number
}

const rooms = new Map<string, Room>()
const socketToRoom = new Map<string, string>()

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

  // Realistic thinking delay
  const delay = 1000 + Math.random() * 1500
  await new Promise(r => setTimeout(r, delay))

  if (!room.gameState) return

  const { state: newState, action, dialogue } = processAIAction(room.gameState)
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

  // If showdown, schedule next round
  if (newState.stage === 'showdown') {
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
      }
      rooms.set(roomId, room)
      socketToRoom.set(socket.id, roomId)

      socket.join(roomId)
      socket.emit('solo_started', { roomId, playerId: humanId })
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
      }
      rooms.set(roomId, room)
      socketToRoom.set(socket.id, roomId)

      socket.join(roomId)
      socket.emit('room_joined', {
        roomId,
        playerId,
        isHost: true,
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

      const playerList = Array.from(room.players.entries()).map(([id, p]) => ({ id, name: p.name }))
      io.to(data.roomId.toUpperCase()).emit('players_updated', playerList)
      socket.emit('room_joined', { roomId: data.roomId.toUpperCase(), playerId, isHost: false, players: playerList })
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

      for (const [playerId, playerData] of room.players.entries()) {
        io.to(playerData.socketId).emit('game_state', getRoomSafeState(room, playerId))
      }

      if (room.gameState.stage === 'showdown') {
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

      // Remove disconnected player
      for (const [playerId, playerData] of room.players.entries()) {
        if (playerData.socketId === socket.id) {
          room.players.delete(playerId)
          // Mark as folded in active game
          if (room.gameState) {
            const player = room.gameState.players.find(p => p.id === playerId)
            if (player && player.status === 'active') {
              room.gameState = processAction(room.gameState, playerId, { type: 'fold' })
            }
          }
          break
        }
      }

      if (room.players.size === 0) {
        rooms.delete(roomId)
        return
      }

      // Reassign host if needed
      if (room.hostSocketId === socket.id) {
        const firstPlayer = Array.from(room.players.values())[0]
        if (firstPlayer) room.hostSocketId = firstPlayer.socketId
      }

      io.to(roomId).emit('player_left', {
        players: Array.from(room.players.entries()).map(([id, p]) => ({ id, name: p.name })),
      })
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
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  setupSocket(io)

  httpServer.listen(port, () => {
    console.log(`♠ BATESPOKER — THE VAULT is open on http://localhost:${port}`)
  })
})
