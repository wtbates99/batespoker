'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { GameState, getValidActions } from '@/lib/poker/engine'
import PokerTable from '@/components/PokerTable'
import Link from 'next/link'

const CHARACTERS = [
  { id: 'baron_von_chips', name: 'Baron Von Chips', emoji: '🎩', difficulty: 'hard', color: '#4a6a9e', desc: 'Hard · Calculating, positional, merciless.' },
  { id: 'lucky_mcgee',     name: 'Lucky McGee',     emoji: '🤠', difficulty: 'easy', color: '#c9843a', desc: 'Easy · Calls everything. Somehow wins sometimes.' },
  { id: 'the_duchess',     name: 'The Duchess',     emoji: '👸', difficulty: 'medium', color: '#8a4a9e', desc: 'Medium · Solid fundamentals, cold contempt.' },
  { id: 'the_jester',      name: 'The Jester',      emoji: '🃏', difficulty: 'legendary', color: '#c9a84c', desc: 'Legendary · Near-GTO, complete chaos.' },
]

type SetupStep = 'setup' | 'playing'

export default function SoloGamePage() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>('setup')
  const [playerName, setPlayerName] = useState('You')
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>(['baron_von_chips'])
  const [smallBlind, setSmallBlind] = useState(10)
  const [bigBlind, setBigBlind] = useState(20)

  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState<{ characterId: string; playerName: string; text: string } | null>(null)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)

  // Connect user name from auth
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setPlayerName(d.user.username)
    }).catch(() => {})
  }, [])

  // Setup socket
  useEffect(() => {
    const s = io({ path: '/api/socket.io' })
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    s.on('solo_started', (data: { roomId: string; playerId: string }) => {
      setRoomId(data.roomId)
      setPlayerId(data.playerId)
    })

    s.on('game_state', (state: GameState) => {
      setGameState(state)
    })

    s.on('dialogue', (d: { characterId: string; playerName: string; text: string }) => {
      setDialogue(d)
      setTimeout(() => setDialogue(null), 4500)
    })

    s.on('error', (e: { message: string }) => setError(e.message))

    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  function toggleOpponent(id: string) {
    setSelectedOpponents(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 5 ? [...prev, id] : prev
    )
  }

  function startGame() {
    if (!socket || !connected) { setError('Connecting...'); return }
    if (selectedOpponents.length === 0) { setError('Select at least one opponent.'); return }
    const opponents = selectedOpponents.map(id => {
      const c = CHARACTERS.find(x => x.id === id)!
      return { characterId: id, difficulty: c.difficulty }
    })
    socket.emit('create_solo', { playerName, opponents, smallBlind, bigBlind })
    setStep('playing')
    setError('')
  }

  function handleAction(type: string, amount?: number) {
    if (!socket || !playerId || !roomId || !gameState) return
    socket.emit('player_action', { roomId, playerId, action: { type, amount } })
  }

  // Setup screen
  if (step === 'setup') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vault-bg)', padding: '80px 24px 40px' }}>
        {/* Nav */}
        <nav className="vault-nav">
          <div className="vault-nav-inner">
            <Link href="/" className="nav-logo">
              <span>♠</span><span>BATESPOKER</span>
            </Link>
            <div className="nav-links">
              <Link href="/lobby" className="nav-link">Multiplayer</Link>
            </div>
          </div>
        </nav>

        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ marginBottom: 40, textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
              ♠ solo game ♠
            </p>
            <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 700, color: 'var(--text)' }}>
              Take Your Seat
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 10 }}>
              Choose your opponents, set the stakes, and enter the vault.
            </p>
          </div>

          {/* Player name */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
              Your Name at the Table
            </label>
            <input
              className="form-input"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Your name"
              style={{ maxWidth: 280 }}
            />
          </div>

          {/* Opponent selection */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 12 }}>
              Choose Opponents (1-{CHARACTERS.length})
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {CHARACTERS.map(c => {
                const selected = selectedOpponents.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleOpponent(c.id)}
                    style={{
                      fontFamily: 'var(--mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      background: selected ? `rgba(${hexToRgb(c.color)},0.12)` : 'var(--vault-panel)',
                      border: `1px solid ${selected ? c.color : 'var(--border)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      boxShadow: selected ? `0 0 20px rgba(${hexToRgb(c.color)},0.15)` : 'none',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{c.emoji}</span>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selected ? c.color : 'var(--text)' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{c.desc}</div>
                    </div>
                    <div style={{
                      marginLeft: 'auto',
                      width: 18, height: 18,
                      borderRadius: '50%',
                      border: `2px solid ${selected ? c.color : 'var(--border)'}`,
                      background: selected ? c.color : 'transparent',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6rem', color: '#030503',
                    }}>
                      {selected && '✓'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Blinds */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
                Small Blind
              </label>
              <select
                className="form-input"
                value={smallBlind}
                onChange={e => { setSmallBlind(Number(e.target.value)); setBigBlind(Number(e.target.value) * 2) }}
                style={{ minWidth: 120 }}
              >
                {[5, 10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
                Big Blind
              </label>
              <div className="form-input" style={{ minWidth: 120, opacity: 0.7, cursor: 'default' }}>
                {bigBlind}
              </div>
            </div>
            <div style={{ alignSelf: 'flex-end', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Starting chips: <span style={{ color: 'var(--gold)' }}>1,000</span>
            </div>
          </div>

          {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

          <button
            className="btn-primary"
            style={{ maxWidth: 300, fontSize: '0.8rem', letterSpacing: '0.15em', padding: '14px' }}
            onClick={startGame}
            disabled={selectedOpponents.length === 0}
          >
            ♠ Enter The Vault
          </button>
        </div>
      </div>
    )
  }

  // Playing screen
  if (!gameState) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--gold)', marginBottom: 16, animation: 'float 2s ease-in-out infinite' }}>♠</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>SHUFFLING DECK...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vault-bg)', padding: '20px 16px 40px' }}>
      {/* Compact nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, padding: '8px 0',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.1em' }}>
          ♠ THE VAULT
        </div>
        <button
          onClick={() => { setStep('setup'); setGameState(null) }}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '0.65rem',
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-dim)',
            padding: '4px 12px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          ← New Game
        </button>
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

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
