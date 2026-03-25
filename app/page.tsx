'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── CHARACTERS ──────────────────────────────────────────────
const CHARACTERS = [
  {
    id: 'baron_von_chips',
    name: 'Baron Von Chips',
    title: 'The Aristocrat',
    difficulty: 'Hard',
    emoji: '🎩',
    color: '#4a6a9e',
    glow: 'rgba(74,106,158,0.3)',
    desc: 'Cold, calculating, insufferable. Has won more pots than he has feelings.',
    quote: '"Your incompetence has a certain... artistry."',
    tells: ['never bluffs without a plan', 'three-bets light in position', 'judges you silently'],
  },
  {
    id: 'lucky_mcgee',
    name: 'Lucky McGee',
    title: 'The Gambler',
    difficulty: 'Easy',
    emoji: '🤠',
    color: '#c9843a',
    glow: 'rgba(201,132,58,0.3)',
    desc: 'Calls everything. Wins sometimes. Absolutely devastated by losses.',
    quote: '"YEEHAW! Hot dog, I KNEW it!"',
    tells: ['calls too much', 'folds to triple barrels', 'will tilt on a bad beat'],
  },
  {
    id: 'the_duchess',
    name: 'The Duchess',
    title: 'The Sophisticate',
    difficulty: 'Medium',
    emoji: '👸',
    color: '#8a4a9e',
    glow: 'rgba(138,74,158,0.3)',
    desc: 'Plays technically sound poker with an air of absolute contempt.',
    quote: '"Do try to keep up, darling."',
    tells: ['solid pot odds player', 'cold bluffs with premium holdings', 'hates this table'],
  },
  {
    id: 'the_jester',
    name: 'The Jester',
    title: 'Chaos Incarnate',
    difficulty: 'Legendary',
    emoji: '🃏',
    color: '#c9a84c',
    glow: 'rgba(201,168,76,0.3)',
    desc: 'Near-GTO play wrapped in absolute mania. Unpredictable by design.',
    quote: '"I\'m statistically certain this will work. Statistically. Ish."',
    tells: ['mixed strategies', 'fourth-wall breaker', 'somehow always has it'],
  },
]

// ─── BOOT LINES ──────────────────────────────────────────────
const BOOT_LINES = [
  { t: 0,    s: 'BATESPOKER v1.0.0',                              cls: 'boot-bright' },
  { t: 80,   s: '' },
  { t: 140,  s: '[  0.000 ] Vault: sealed ...........................',               },
  { t: 230,  s: '[  0.021 ] Felt: green ........................ <ok>[  OK  ]</ok>' },
  { t: 320,  s: '[  0.056 ] Deck: 52 cards shuffled ........... <ok>[  OK  ]</ok>' },
  { t: 420,  s: '[  0.112 ] Chips: stacked ...................... <ok>[  OK  ]</ok>' },
  { t: 530,  s: '[  0.201 ] Baron Von Chips: seated ............ <ok>[  OK  ]</ok>' },
  { t: 630,  s: '[  0.244 ] Lucky McGee: seated ................. <ok>[  OK  ]</ok>' },
  { t: 730,  s: '[  0.278 ] The Duchess: seated ................. <ok>[  OK  ]</ok>' },
  { t: 830,  s: '[  0.311 ] The Jester: seated .................. <ok>[  OK  ]</ok>' },
  { t: 950,  s: '' },
  { t: 1700, s: '' },
  { t: 1760, s: '[  1.024 ] RUNE_006  BATESPOKER .............. <ok>[  OK  ]</ok>' },
  { t: 1840, s: '' },
  { t: 1880, s: '[  1.200 ] Ante up.', cls: 'boot-dim' },
  { t: 2050, s: '> ♠ THE VAULT IS OPEN ♠', cls: 'boot-granted' },
]

export default function HomePage() {
  const router = useRouter()
  const [booted, setBooted] = useState(false)
  const [showBoot, setShowBoot] = useState(true)
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const bootRef = useRef<HTMLPreElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Check auth
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user)
    }).catch(() => {})
  }, [])

  // Boot sequence
  useEffect(() => {
    const alreadyBooted = sessionStorage.getItem('vault_booted')
    if (alreadyBooted) {
      setBooted(true)
      setShowBoot(false)
      return
    }
    sessionStorage.setItem('vault_booted', '1')

    const pre = bootRef.current
    if (!pre) return

    function appendLine(raw: string, cls?: string) {
      const html = raw.replace(/<ok>(.*?)<\/ok>/g, '<span class="boot-ok">$1</span>')
      const s = document.createElement('span')
      if (cls) s.className = cls
      s.innerHTML = html + '\n'
      pre!.appendChild(s)
      pre!.scrollTop = pre!.scrollHeight
    }

    BOOT_LINES.forEach(({ t, s, cls }) => {
      setTimeout(() => appendLine(s, cls), t)
    })

    // Progress bar
    setTimeout(() => {
      let pct = 0
      const iv = setInterval(() => {
        pct = Math.min(pct + 1.2, 100)
        if (barRef.current) barRef.current.style.width = pct + '%'
        if (pct >= 100) clearInterval(iv)
      }, 10)
    }, 950)

    // Fade out
    const bootEl = document.getElementById('boot-screen')
    setTimeout(() => {
      if (bootEl) bootEl.classList.add('fade-out')
      setTimeout(() => {
        setShowBoot(false)
        setBooted(true)
      }, 700)
    }, 2700)
  }, [])

  // Canvas floating cards
  useEffect(() => {
    if (!booted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const SUITS = ['♠', '♥', '♦', '♣']
    const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7']
    const particles = Array.from({ length: 25 }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 0.3,
      suit: SUITS[Math.floor(Math.random() * SUITS.length)],
      rank: RANKS[Math.floor(Math.random() * RANKS.length)],
      alpha: Math.random() * 0.15 + 0.03,
      size: Math.random() * 14 + 10,
    }))

    let raf: number
    function resize() {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot * Math.PI) / 180)
        ctx.font = `${p.size}px monospace`
        ctx.fillStyle = ['♥', '♦'].includes(p.suit) ? '#9b1c1c' : '#c9a84c'
        ctx.fillText(p.suit, 0, 0)
        ctx.globalAlpha = p.alpha * 0.6
        ctx.font = `${p.size * 0.7}px monospace`
        ctx.fillStyle = '#d4d9c6'
        ctx.fillText(p.rank, p.size * 0.8, 0)
        ctx.restore()

        p.x += p.vx
        p.y += p.vy
        p.rot += p.rotV
        if (p.y < -30) { p.y = canvas.height + 30; p.x = Math.random() * canvas.width }
        if (p.x < -30) p.x = canvas.width + 30
        if (p.x > canvas.width + 30) p.x = -30
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [booted])

  // Auth handlers
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm),
    })
    const data = await res.json()
    if (!res.ok) { setAuthError(data.error ?? 'Something went wrong'); return }
    setUser(data.user)
    setShowAuth(false)
    setAuthForm({ username: '', password: '' })
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <>
      {/* BOOT SCREEN */}
      {showBoot && <div className="boot" id="boot-screen">
        <div className="boot-inner">
          <div className="boot-rune">♠ BATESPOKER ♠</div>
          <pre className="boot-lines" ref={bootRef} />
          <div className="boot-bar-wrap">
            <div className="boot-bar" ref={barRef} />
          </div>
        </div>
      </div>}

      {/* MAIN CONTENT */}
      <div style={{ opacity: booted ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }}>

        {/* NAV */}
        <nav className="vault-nav" id="vault-nav">
          <div className="vault-nav-inner">
            <div className="nav-logo">
              <span style={{ fontSize: '1.2rem' }}>♠</span>
              <span>BATESPOKER</span>
              <span className="cursor-blink">_</span>
            </div>
            <div className="nav-links">
              <Link href="/game/solo" className="nav-link">Solo</Link>
              <Link href="/lobby" className="nav-link">Multiplayer</Link>
              {user ? (
                <>
                  <span className="nav-link" style={{ color: 'var(--gold)', cursor: 'default' }}>
                    {user.username}
                  </span>
                  <button className="nav-link" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <button className="nav-link" onClick={() => setShowAuth(true)}>
                  Sign In
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

          {/* Overhead lamp effect */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(3,5,3,0.75) 100%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 3, textAlign: 'center', padding: '0 24px', maxWidth: 700 }}>
            {/* Rune */}
            <div style={{
              fontSize: '3rem',
              letterSpacing: '0.5em',
              color: 'var(--gold)',
              textShadow: '0 0 40px rgba(201,168,76,0.5), 0 0 80px rgba(201,168,76,0.2)',
              marginBottom: 16,
              animation: 'glow-pulse 4s ease-in-out infinite',
            }}>
              ♠ ♥ ♦ ♣
            </div>

            <h1 style={{
              fontSize: 'clamp(4rem, 16vw, 10rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 0.9,
              color: 'var(--text)',
              marginBottom: 16,
              textShadow: '0 0 60px rgba(201,168,76,0.15)',
            }}>
              THE VAULT
            </h1>

            <p style={{
              fontSize: '0.85rem',
              letterSpacing: '0.2em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              marginBottom: 48,
            }}>
              ♠ underground poker club · texas hold&apos;em ♠
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/game/solo" style={{
                fontFamily: 'var(--mono)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                padding: '14px 32px',
                background: 'rgba(201,168,76,0.15)',
                border: '1px solid rgba(201,168,76,0.5)',
                color: 'var(--gold)',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'inline-block',
              }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.background = 'rgba(201,168,76,0.28)'
                  ;(e.target as HTMLElement).style.boxShadow = '0 0 30px rgba(201,168,76,0.25)'
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.background = 'rgba(201,168,76,0.15)'
                  ;(e.target as HTMLElement).style.boxShadow = 'none'
                }}
              >
                ♠ Solo Game
              </Link>
              <Link href="/lobby" style={{
                fontFamily: 'var(--mono)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                padding: '14px 32px',
                background: 'rgba(155,28,28,0.15)',
                border: '1px solid rgba(155,28,28,0.4)',
                color: '#e07070',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'inline-block',
              }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.background = 'rgba(155,28,28,0.28)'
                  ;(e.target as HTMLElement).style.boxShadow = '0 0 30px rgba(155,28,28,0.25)'
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.background = 'rgba(155,28,28,0.15)'
                  ;(e.target as HTMLElement).style.boxShadow = 'none'
                }}
              >
                ♥ Multiplayer
              </Link>
            </div>

            <p style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              marginTop: 24,
              letterSpacing: '0.08em',
            }}>
              open source · self-hosted · no subscriptions
            </p>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-muted)',
            fontSize: '0.6rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            <span>take a seat</span>
            <div style={{
              width: 1,
              height: 40,
              background: 'linear-gradient(to bottom, rgba(201,168,76,0.3), transparent)',
              animation: 'float 2s ease-in-out infinite',
            }} />
          </div>
        </section>

        {/* CHARACTERS */}
        <section style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
              ♠ residents of the vault ♠
            </p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Know Your Opponents
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 12, maxWidth: 500, margin: '12px auto 0' }}>
              Four degenerate AI characters, each with distinct personalities, tells, and strategies.
              Study them. Fear them. Tilt at them.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 20,
          }}>
            {CHARACTERS.map(c => (
              <div key={c.id} style={{
                background: `linear-gradient(135deg, #0c0e09 0%, #090b07 100%)`,
                border: `1px solid rgba(${hexToRgb(c.color)},0.15)`,
                borderRadius: 8,
                padding: '24px 20px',
                transition: 'all 0.2s ease',
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = `rgba(${hexToRgb(c.color)},0.45)`
                  el.style.boxShadow = `0 0 30px rgba(${hexToRgb(c.color)},0.08), 0 0 0 1px rgba(${hexToRgb(c.color)},0.2)`
                  el.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = `rgba(${hexToRgb(c.color)},0.15)`
                  el.style.boxShadow = 'none'
                  el.style.transform = 'translateY(0)'
                }}
              >
                {/* Accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: 3, height: '100%',
                  background: `linear-gradient(to bottom, ${c.color}, transparent)`,
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: '1.8rem' }}>{c.emoji}</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: c.color, letterSpacing: '0.06em' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {c.title} · {c.difficulty}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 14 }}>
                  {c.desc}
                </p>

                <div style={{
                  fontSize: '0.68rem',
                  fontStyle: 'italic',
                  color: c.color,
                  opacity: 0.8,
                  borderLeft: `2px solid rgba(${hexToRgb(c.color)},0.3)`,
                  paddingLeft: 10,
                  marginBottom: 14,
                  lineHeight: 1.5,
                }}>
                  {c.quote}
                </div>

                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {c.tells.map((t, i) => (
                    <li key={i} style={{
                      fontSize: '0.62rem',
                      color: 'var(--text-muted)',
                      padding: '2px 0',
                      paddingLeft: 12,
                      position: 'relative',
                    }}>
                      <span style={{ position: 'absolute', left: 0, color: c.color }}>›</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section style={{
          padding: '80px 24px 120px',
          background: 'linear-gradient(to bottom, transparent, rgba(10,32,16,0.06), transparent)',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                ♠ the vault amenities ♠
              </p>
              <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', fontWeight: 700, color: 'var(--text)' }}>
                Everything You Need
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {[
                { icon: '♠', label: 'Solo vs AI', desc: 'Four unique opponents, each with distinct strategies and dialogue. Choose your poison.' },
                { icon: '♥', label: 'Multiplayer Rooms', desc: 'Generate a room code, share it with friends. Up to 6 players per table.' },
                { icon: '♦', label: 'Adjustable Stakes', desc: 'Custom blind levels. Start small, go big, lose everything. It\'s all part of the experience.' },
                { icon: '♣', label: 'Open Source', desc: 'Self-hosted. No cloud. No subscriptions. Deploy your own vault on your own terms.' },
              ].map(f => (
                <div key={f.label} style={{
                  padding: '20px',
                  background: 'var(--vault-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 10, color: 'var(--gold)' }}>{f.icon}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '0.05em' }}>{f.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GITHUB / OPEN SOURCE CTA */}
        <section style={{ padding: '40px 24px 100px', textAlign: 'center' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16 }}>
              ♠ open source ♠
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.8, marginBottom: 28 }}>
              This is a demo hosted at <code>poker.palanbates.com</code>.
              The full source is on GitHub — fork it, self-host it, run your own vault.
            </p>
            <a
              href="https://github.com/wtbates99/batespoker"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '12px 28px',
                background: 'var(--vault-panel)',
                border: '1px solid var(--border-h)',
                color: 'var(--text)',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'inline-block',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'rgba(201,168,76,0.5)'; (e.target as HTMLElement).style.color = 'var(--gold)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-h)'; (e.target as HTMLElement).style.color = 'var(--text)' }}
            >
              ⌥ github.com/wtbates99/batespoker
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{
          padding: '24px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            <span style={{ color: 'var(--gold)' }}>RUNE_006</span>
            <span style={{ margin: '0 12px' }}>·</span>
            <a href="https://palanbates.com" style={{ color: 'var(--text-muted)' }}>palanbates.com</a>
            <span style={{ margin: '0 12px' }}>·</span>
            <a href="https://github.com/wtbates99/batespoker" target="_blank" rel="noopener" style={{ color: 'var(--text-muted)' }}>
              github
            </a>
          </div>
        </footer>
      </div>

      {/* AUTH MODAL */}
      {showAuth && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAuth(false) }}>
          <div className="modal-box">
            <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
              {(['login', 'register'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setAuthMode(mode); setAuthError('') }}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: authMode === mode ? 'var(--gold)' : 'var(--text-muted)',
                    borderBottom: authMode === mode ? '2px solid var(--gold)' : '2px solid transparent',
                    padding: '4px 0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mode === 'login' ? '♠ Sign In' : '♦ Register'}
                </button>
              ))}
            </div>
            <form onSubmit={handleAuth}>
              <div className="form-field">
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  type="text"
                  value={authForm.username}
                  onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="dealer_7"
                  autoComplete="username"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={authForm.password}
                  onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
              {authError && <p className="form-error">{authError}</p>}
              <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                {authMode === 'login' ? '♠ Enter The Vault' : '♦ Claim Your Seat'}
              </button>
            </form>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
              {authMode === 'login' ? 'No account? ' : 'Already a member? '}
              <button
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}
                style={{ fontFamily: 'var(--mono)', background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.65rem' }}
              >
                {authMode === 'login' ? 'Register here' : 'Sign in here'}
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
