'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { GameState } from '@/lib/poker/engine'
import PokerTable from '@/components/PokerTable'
import Link from 'next/link'

export default function MultiplayerGamePage() {
  const { roomId: rawRoomId } = useParams<{ roomId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const isNew = rawRoomId === 'new'
  const initialName = searchParams.get('name') ?? 'Guest'

  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([])
  const [gameStarted, setGameStarted] = useState(false)
  const [playerName, setPlayerName] = useState(initialName)
  const [actualRoomId, setActualRoomId] = useState<string>(isNew ? '' : rawRoomId.toUpperCase())
  const [joined, setJoined] = useState(false)
  const [dialogue, setDialogue] = useState<{ characterId: string; playerName: string; text: string } | null>(null)
  const [error, setError] = useState('')
  const [fillAI, setFillAI] = useState(false)
  const [connecting, setConnecting] = useState(true)

  // Ref so socket callbacks always see latest playerName
  const playerNameRef = useRef(playerName)
  useEffect(() => { playerNameRef.current = playerName }, [playerName])

  // Socket setup — stays alive for entire session
  useEffect(() => {
    const s = io({ path: '/api/socket.io' })

    s.on('connect', () => {
      setConnecting(false)
      // Auto-create or auto-join on connect
      if (isNew) {
        s.emit('create_room', { playerName: playerNameRef.current })
      } else {
        s.emit('join_room', { roomId: rawRoomId.toUpperCase(), playerName: playerNameRef.current })
      }
    })

    s.on('room_joined', (data: { roomId: string; playerId: string; isHost: boolean; players: { id: string; name: string }[] }) => {
      setActualRoomId(data.roomId)
      setPlayerId(data.playerId)
      setIsHost(data.isHost)
      setPlayers(data.players)
      setJoined(true)
      // Update URL to reflect actual room code without remounting
      if (isNew) {
        router.replace(`/game/${data.roomId}`)
      }
    })

    s.on('players_updated', (pl: { id: string; name: string }[]) => setPlayers(pl))

    s.on('game_started', () => setGameStarted(true))

    s.on('game_state', (state: GameState) => {
      setGameState(state)
      if (state.stage !== 'waiting') setGameStarted(true)
    })

    s.on('dialogue', (d: { characterId: string; playerName: string; text: string }) => {
      setDialogue(d)
      setTimeout(() => setDialogue(null), 4500)
    })

    s.on('player_left', (data: { players: { id: string; name: string }[] }) => setPlayers(data.players))
    s.on('error', (e: { message: string }) => setError(e.message))

    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  function startGame() {
    if (!socket || !actualRoomId) return
    socket.emit('start_game', { roomId: actualRoomId, fillWithAI: fillAI })
  }

  function handleAction(type: string, amount?: number) {
    if (!socket || !playerId || !gameState) return
    socket.emit('player_action', { roomId: actualRoomId, playerId, action: { type, amount } })
  }

  // Connecting state
  if (connecting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--gold)', marginBottom: 16, animation: 'float 2s ease-in-out infinite' }}>♠</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>CONNECTING TO VAULT...</div>
        </div>
      </div>
    )
  }

  // Waiting room
  if (!gameStarted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vault-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <nav className="vault-nav">
          <div className="vault-nav-inner">
            <Link href="/" className="nav-logo">♠ BATESPOKER</Link>
          </div>
        </nav>

        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--gold)', marginBottom: 16 }}>♠</div>

          {!joined ? (
            // Joining...
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {isNew ? 'Creating table...' : (
                  <>Joining <span style={{ color: 'var(--gold)', letterSpacing: '0.15em' }}>{rawRoomId.toUpperCase()}</span></>
                )}
              </h2>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', animation: 'float 2s ease-in-out infinite', marginTop: 16 }}>♠</div>
              {error && (
                <div style={{ marginTop: 24 }}>
                  <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>
                  <Link href="/lobby" style={{ fontSize: '0.7rem', color: 'var(--gold)' }}>← Back to Lobby</Link>
                </div>
              )}
            </div>
          ) : (
            // Lobby waiting room
            <>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                Room: <span style={{ color: 'var(--gold)', letterSpacing: '0.15em' }}>{actualRoomId}</span>
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 32 }}>
                Share this code with friends to invite them to the table.
              </p>

              {/* Players list */}
              <div style={{
                background: 'var(--vault-panel)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '20px',
                marginBottom: 24,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Seated Players ({players.length}/6)
                </div>
                {players.map(p => (
                  <div key={p.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.8rem',
                  }}>
                    <span style={{ color: 'var(--gold)' }}>♠</span>
                    <span style={{ color: p.id === playerId ? 'var(--gold)' : 'var(--text)' }}>
                      {p.name}{p.id === playerId && ' (you)'}
                    </span>
                    {isHost && p.id === playerId && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>HOST</span>
                    )}
                  </div>
                ))}
              </div>

              {isHost && (
                <>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: '0.7rem', color: 'var(--text-dim)',
                    cursor: 'pointer', marginBottom: 16, justifyContent: 'center',
                  }}>
                    <input
                      type="checkbox"
                      checked={fillAI}
                      onChange={e => setFillAI(e.target.checked)}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                    Fill empty seats with AI opponents
                  </label>
                  <button
                    className="btn-primary"
                    onClick={startGame}
                    disabled={players.length < 1}
                    style={{ fontSize: '0.8rem', letterSpacing: '0.15em', padding: '14px' }}
                  >
                    ♠ Start Game
                  </button>
                </>
              )}
              {!isHost && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  Waiting for the host to start the game...
                </p>
              )}

              {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

              <div style={{ marginTop: 24 }}>
                <Link href="/lobby" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  ← Back to Lobby
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // Waiting for game_state after start
  if (!gameState) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--gold)', marginBottom: 16, animation: 'float 2s ease-in-out infinite' }}>♠</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>DEALING...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vault-bg)', padding: '20px 16px 40px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, padding: '8px 0',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.1em' }}>
          ♠ THE VAULT · {actualRoomId}
        </div>
        <Link href="/lobby" style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.65rem',
          color: 'var(--text-dim)',
          border: '1px solid var(--border)',
          padding: '4px 12px',
          borderRadius: 4,
        }}>
          ← Lobby
        </Link>
      </div>

      {playerId && (
        <PokerTable
          gameState={gameState}
          currentPlayerId={playerId}
          onAction={handleAction}
          dialogue={dialogue}
        />
      )}
    </div>
  )
}
