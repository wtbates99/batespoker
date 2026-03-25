'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import Link from 'next/link'

export default function LobbyPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('Guest')
  const [joinCode, setJoinCode] = useState('')
  const [socket, setSocket] = useState<Socket | null>(null)
  const [publicRooms, setPublicRooms] = useState<{ id: string; players: number; maxPlayers: number }[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setPlayerName(d.user.username)
    }).catch(() => {})

    const s = io({ path: '/api/socket.io' })
    s.on('connect', () => { s.emit('get_rooms') })
    s.on('rooms_list', (rooms: { id: string; players: number; maxPlayers: number }[]) => {
      setPublicRooms(rooms)
    })
    s.on('room_joined', (data: { roomId: string }) => {
      router.push(`/game/${data.roomId}`)
    })
    s.on('error', (e: { message: string }) => { setError(e.message); setCreating(false) })
    setSocket(s)

    const iv = setInterval(() => s.emit('get_rooms'), 5000)
    return () => { s.disconnect(); clearInterval(iv) }
  }, [])

  function createRoom() {
    if (!socket) return
    setCreating(true)
    setError('')
    socket.emit('create_room', { playerName })
  }

  function joinRoom(code?: string) {
    if (!socket) return
    const roomId = (code ?? joinCode).trim().toUpperCase()
    if (!roomId || roomId.length !== 6) { setError('Enter a valid 6-character room code.'); return }
    setError('')
    socket.emit('join_room', { roomId, playerName })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vault-bg)', padding: '80px 24px 40px' }}>
      <nav className="vault-nav">
        <div className="vault-nav-inner">
          <Link href="/" className="nav-logo">♠ BATESPOKER</Link>
          <div className="nav-links">
            <Link href="/game/solo" className="nav-link">Solo</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            ♥ multiplayer ♥
          </p>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 700, color: 'var(--text)' }}>
            The Lobby
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 10 }}>
            Create a room and share the code, or join an existing table.
          </p>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 40 }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
            Your Name
          </label>
          <input
            className="form-input"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>
          {/* Create room */}
          <div style={{
            background: 'var(--vault-panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '24px',
          }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              ♠ Create Room
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
              Host a new table. A 6-character code will be generated — share it with friends.
            </p>
            <button
              className="btn-primary"
              onClick={createRoom}
              disabled={creating}
              style={{ fontSize: '0.75rem', letterSpacing: '0.12em' }}
            >
              {creating ? 'Creating...' : '♠ Create Table'}
            </button>
          </div>

          {/* Join room */}
          <div style={{
            background: 'var(--vault-panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '24px',
          }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              ♥ Join Room
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
              Enter the 6-character code from your friend.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                style={{ flex: 1, letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase' }}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
              />
              <button
                onClick={() => joinRoom()}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0 16px',
                  background: 'rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.35)',
                  color: 'var(--gold)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Join ♥
              </button>
            </div>
          </div>
        </div>

        {error && <p className="form-error" style={{ marginBottom: 20 }}>{error}</p>}

        {/* Public rooms */}
        {publicRooms.length > 0 && (
          <div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
              Open Tables ({publicRooms.length})
            </div>
            {publicRooms.map(room => (
              <div key={room.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--vault-panel)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                marginBottom: 8,
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.15em', marginRight: 16 }}>
                    {room.id}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {room.players}/{room.maxPlayers} players
                  </span>
                </div>
                <button
                  onClick={() => joinRoom(room.id)}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '0.65rem',
                    padding: '5px 14px',
                    background: 'rgba(201,168,76,0.1)',
                    border: '1px solid rgba(201,168,76,0.3)',
                    color: 'var(--gold)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Join ♥
                </button>
              </div>
            ))}
          </div>
        )}

        {publicRooms.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 24px',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            fontSize: '0.72rem',
          }}>
            No open tables. Create one and deal in your friends.
          </div>
        )}
      </div>
    </div>
  )
}
