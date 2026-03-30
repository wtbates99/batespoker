'use client'

import { useEffect, useState, useRef } from 'react'
import { GameState, Player, getValidActions } from '@/lib/poker/engine'
import { getHandStrength } from '@/lib/poker/ai'
import Card, { CardSlot } from './Card'
import BettingControls from './BettingControls'

const TURN_TIMEOUT_SECONDS = 45  // seconds before auto-fold warning

interface PokerTableProps {
  gameState: GameState
  currentPlayerId: string
  onAction: (type: string, amount?: number) => void
  dialogue?: { characterId: string; playerName: string; text: string } | null
}

const CHARACTER_EMOJIS: Record<string, string> = {
  baron_von_chips: '🎩',
  lucky_mcgee:     '🤠',
  the_duchess:     '👸',
  the_jester:      '🃏',
}

const CHARACTER_COLORS: Record<string, string> = {
  baron_von_chips: 'var(--baron-color)',
  lucky_mcgee:     'var(--lucky-color)',
  the_duchess:     'var(--duchess-color)',
  the_jester:      'var(--jester-color)',
}

const CHARACTER_CLASSES: Record<string, string> = {
  baron_von_chips: 'baron',
  lucky_mcgee:     'lucky',
  the_duchess:     'duchess',
  the_jester:      'jester',
}

// Seat positions as % of table wrapper — seats are OUTSIDE the oval
// so they never get clipped. Points along an ellipse, bottom = human seat.
const SEAT_POSITIONS = [
  { bottom: '-4%',  left: '50%',  transform: 'translateX(-50%)' },   // 0: bottom (human)
  { bottom: '8%',   left: '4%',   transform: 'none' },               // 1: bottom-left
  { top: '12%',     left: '2%',   transform: 'none' },               // 2: top-left
  { top: '-4%',     left: '50%',  transform: 'translateX(-50%)' },   // 3: top (far end)
  { top: '12%',     right: '2%',  transform: 'none' },               // 4: top-right
  { bottom: '8%',   right: '4%',  transform: 'none' },               // 5: bottom-right
]

export default function PokerTable({ gameState, currentPlayerId, onAction, dialogue }: PokerTableProps) {
  const [dialogueState, setDialogueState] = useState<{
    characterId: string; text: string; name: string
  } | null>(null)
  const [winnerVisible, setWinnerVisible] = useState(false)
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null)
  const dialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (dialogue) {
      if (dialogueTimer.current) clearTimeout(dialogueTimer.current)
      setDialogueState({ characterId: dialogue.characterId, text: dialogue.text, name: dialogue.playerName })
      dialogueTimer.current = setTimeout(() => setDialogueState(null), 4200)
    }
    return () => { if (dialogueTimer.current) clearTimeout(dialogueTimer.current) }
  }, [dialogue])

  useEffect(() => {
    if (gameState.stage === 'showdown' && gameState.winners && gameState.winners.length > 0) {
      setWinnerVisible(true)
    } else {
      setWinnerVisible(false)
    }
  }, [gameState.stage, gameState.winners])

  // Turn timer: counts down when it's the human player's turn
  const isMyTurnNow = gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId &&
    gameState.stage !== 'showdown' && gameState.stage !== 'ended' && gameState.stage !== 'waiting'

  useEffect(() => {
    if (turnTimerRef.current) clearInterval(turnTimerRef.current)

    if (isMyTurnNow) {
      setTurnSecondsLeft(TURN_TIMEOUT_SECONDS)
      turnTimerRef.current = setInterval(() => {
        setTurnSecondsLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(turnTimerRef.current!)
            return null
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setTurnSecondsLeft(null)
    }

    return () => { if (turnTimerRef.current) clearInterval(turnTimerRef.current) }
  }, [isMyTurnNow, gameState.currentPlayerIndex, gameState.round])

  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId)
  const isMyTurn = isMyTurnNow
  const validActions = currentPlayer ? getValidActions(gameState, currentPlayerId) : null
  const totalPot = gameState.pot + gameState.players.reduce((s, p) => s + (p.currentBet || 0), 0)

  const numPlayers = gameState.players.length
  const seats = SEAT_POSITIONS.slice(0, Math.max(numPlayers, 2))

  // Turn timer urgency thresholds
  const timerUrgent = turnSecondsLeft !== null && turnSecondsLeft <= 10
  const timerCritical = turnSecondsLeft !== null && turnSecondsLeft <= 5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 860, margin: '0 auto' }}>

      {/* Stage + round info bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 14px',
        background: 'rgba(12,14,9,0.9)',
        border: `1px solid ${timerCritical ? 'rgba(220,80,80,0.5)' : timerUrgent ? 'rgba(220,160,50,0.4)' : 'var(--border)'}`,
        borderRadius: 5,
        fontSize: '0.68rem',
        letterSpacing: '0.08em',
        transition: 'border-color 0.3s ease',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          ROUND <span style={{ color: 'var(--text-dim)' }}>{gameState.round}</span>
        </span>
        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.82rem' }}>
          ♠ {totalPot}
        </span>
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {gameState.stage.toUpperCase()}
          {gameState.currentBet > 0 && (
            <span style={{ color: 'var(--text-dim)' }}>· bet {gameState.currentBet}</span>
          )}
          {turnSecondsLeft !== null && (
            <span style={{
              color: timerCritical ? '#e05555' : timerUrgent ? '#e0a030' : 'var(--text-dim)',
              fontWeight: timerUrgent ? 700 : 400,
              animation: timerCritical ? 'blink 0.5s step-end infinite' : 'none',
              minWidth: 28,
            }}>
              {turnSecondsLeft}s
            </span>
          )}
        </span>
      </div>

      {/* TABLE WRAPPER — seats positioned relative to this, not inside the oval */}
      <div style={{ position: 'relative', paddingBottom: '52%', userSelect: 'none' }}>

        {/* THE OVAL TABLE */}
        <div style={{
          position: 'absolute',
          top: '8%', left: '8%', right: '8%', bottom: '8%',
          background: 'radial-gradient(ellipse at 50% 35%, #0f2e18 0%, #0a2010 55%, #060e08 100%)',
          borderRadius: '50%',
          border: '10px solid #1e150b',
          boxShadow: `
            inset 0 0 100px rgba(0,0,0,0.7),
            inset 0 0 40px rgba(201,168,76,0.03),
            0 0 0 2px rgba(201,168,76,0.08),
            0 0 0 4px rgba(0,0,0,0.5),
            0 8px 40px rgba(0,0,0,0.9),
            0 20px 80px rgba(0,0,0,0.6)
          `,
        }}>
          {/* Felt weave texture */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.007) 3px, rgba(255,255,255,0.007) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.005) 3px, rgba(255,255,255,0.005) 4px)
            `,
          }} />
          {/* Overhead lamp */}
          <div style={{
            position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)',
            width: '70%', height: '70%',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.07) 0%, transparent 65%)',
            pointerEvents: 'none',
          }} />
          {/* Inner ring */}
          <div style={{
            position: 'absolute', inset: 12, borderRadius: '50%',
            border: '1px solid rgba(201,168,76,0.06)',
            pointerEvents: 'none',
          }} />

          {/* CENTER: community cards + pot */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const card = gameState.communityCards[i]
                return card
                  ? <Card key={i} card={card} size="md" style={{ animation: 'deal-in 0.25s ease' }} />
                  : <CardSlot key={i} size="md" />
              })}
            </div>
            <div style={{
              fontSize: '0.7rem', color: 'var(--gold)',
              letterSpacing: '0.15em', fontWeight: 700,
              textShadow: '0 0 12px rgba(201,168,76,0.5)',
            }}>
              ♠ {totalPot}
            </div>
          </div>
        </div>

        {/* PLAYER SEATS — outside the oval, no clipping */}
        {gameState.players.map((player, idx) => {
          const seatPos = seats[idx % seats.length]
          const isCurrentTurn = gameState.players[gameState.currentPlayerIndex]?.id === player.id
          const charClass = player.characterId ? CHARACTER_CLASSES[player.characterId] ?? 'human' : 'human'
          const charColor = player.characterId ? CHARACTER_COLORS[player.characterId] : 'var(--gold)'
          const emoji = player.characterId ? CHARACTER_EMOJIS[player.characterId] : player.name.charAt(0).toUpperCase()
          const showDialogue = dialogueState?.characterId === player.characterId
          const isMe = player.id === currentPlayerId
          const isTurn = isCurrentTurn && player.status === 'active'

          return (
            <div
              key={player.id}
              style={{
                position: 'absolute',
                ...seatPos as React.CSSProperties,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                zIndex: 20,
                minWidth: 80,
              }}
            >
              {/* Dialogue bubble */}
              {showDialogue && dialogueState && (
                <div
                  className={`dialogue-bubble ${charClass}`}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 10px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    animation: 'deal-in 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    {dialogueState.name}
                  </span>
                  {dialogueState.text}
                </div>
              )}

              {/* Portrait circle */}
              <div
                className={`seat-portrait ${charClass} ${isTurn ? 'active-turn' : ''} ${player.status === 'folded' ? 'folded' : ''} ${player.status === 'allin' ? 'allin' : ''}`}
                style={{ '--char-color': charColor } as React.CSSProperties}
              >
                <span style={{ fontSize: '1.2rem' }}>{emoji}</span>
                {player.isDealer && (
                  <div style={{
                    position: 'absolute', bottom: -3, right: -3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--gold)', color: '#020302',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.5rem', fontWeight: 900, letterSpacing: 0,
                    boxShadow: '0 0 6px rgba(201,168,76,0.6)',
                  }}>D</div>
                )}
                {isTurn && player.isAI && (
                  <div style={{
                    position: 'absolute', top: -5, right: -5,
                    background: 'rgba(201,168,76,0.95)',
                    borderRadius: 8, padding: '2px 5px',
                    fontSize: '0.56rem', fontWeight: 700, color: '#020302',
                    letterSpacing: '0.04em', animation: 'blink 0.8s step-end infinite',
                    whiteSpace: 'nowrap',
                  }}>THINKING</div>
                )}
              </div>

              {/* Name */}
              <div
                title={player.name}
                style={{
                  fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: isMe ? 'var(--gold)' : 'var(--text-dim)',
                  whiteSpace: 'nowrap', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis',
                  textAlign: 'center',
                }}
              >
                {player.name}
                {player.isSmallBlind && <span style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}> SB</span>}
                {player.isBigBlind && <span style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}> BB</span>}
              </div>

              {/* Chips */}
              <div style={{
                fontSize: '0.62rem', color: player.chips < 100 ? '#e07070' : 'var(--gold)',
                fontWeight: 600, letterSpacing: '0.04em',
              }}>
                {player.chips} ♠
              </div>

              {/* Current bet */}
              {player.currentBet > 0 && (
                <div style={{
                  fontSize: '0.55rem', color: 'var(--text-dim)',
                  background: 'rgba(0,0,0,0.6)', padding: '1px 6px',
                  borderRadius: 10, border: '1px solid var(--border)',
                }}>
                  {player.currentBet}
                </div>
              )}

              {/* Status badges */}
              {player.status === 'folded' && (
                <div className="seat-status-badge badge-folded">FOLD</div>
              )}
              {player.status === 'allin' && (
                <div className="seat-status-badge badge-allin">ALL IN</div>
              )}
              {/* Last action indicator */}
              {gameState.lastActionPlayerId === player.id && gameState.lastActionType && player.status !== 'folded' && (
                <div style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: gameState.lastActionType === 'raise' ? '#e0c060'
                    : gameState.lastActionType === 'allin' ? '#f07070'
                    : gameState.lastActionType === 'call' ? '#70c0e0'
                    : gameState.lastActionType === 'check' ? 'var(--text-dim)'
                    : 'var(--text-muted)',
                  background: 'rgba(0,0,0,0.75)',
                  padding: '2px 6px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {gameState.lastActionType === 'raise' && gameState.lastActionAmount
                    ? `+${gameState.lastActionAmount}`
                    : gameState.lastActionType}
                </div>
              )}

              {/* Hole cards */}
              {player.holeCards.length > 0 && (
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  {player.holeCards.map((card, ci) => (
                    <Card key={ci} card={card} size="sm" />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* WINNER ANNOUNCEMENT */}
      {winnerVisible && gameState.winners && gameState.winners.length > 0 && (
        <div style={{
          background: 'rgba(8,12,6,0.97)',
          border: '1px solid rgba(201,168,76,0.35)',
          borderRadius: 8,
          padding: '18px 24px',
          textAlign: 'center',
          boxShadow: '0 0 40px rgba(201,168,76,0.12), inset 0 0 30px rgba(0,0,0,0.4)',
          animation: 'winner-pop 0.35s ease',
        }}>
          <div style={{ fontSize: '0.58rem', letterSpacing: '0.25em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            ♠ SHOWDOWN ♠
          </div>
          {gameState.winners.map((w, i) => {
            const wPlayer = gameState.players.find(p => p.id === w.playerId)
            const isWinnerMe = w.playerId === currentPlayerId
            return (
              <div key={i} style={{ marginBottom: i < gameState.winners!.length - 1 ? 10 : 0 }}>
                <span style={{
                  color: isWinnerMe ? '#7de87d' : 'var(--gold)',
                  fontWeight: 700, fontSize: '1.1rem',
                  textShadow: `0 0 20px ${isWinnerMe ? 'rgba(125,232,125,0.5)' : 'rgba(201,168,76,0.5)'}`,
                }}>
                  {wPlayer?.name ?? w.playerId}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginLeft: 10 }}>
                  +{w.amount} · <span style={{ color: 'var(--text-muted)' }}>{w.handName}</span>
                </span>
              </div>
            )
          })}
          {/* Show community + winner cards */}
          {gameState.communityCards.length > 0 && (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              {gameState.communityCards.map((card, i) => (
                <Card key={i} card={card} size="sm" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* YOUR HOLE CARDS */}
      {currentPlayer && currentPlayer.holeCards.length > 0 && gameState.stage !== 'waiting' && (() => {
        const strength = getHandStrength(currentPlayer.holeCards, gameState.communityCards)
        const strengthPct = Math.round(strength * 100)
        const strengthColor = strength > 0.75 ? '#7de87d' : strength > 0.55 ? '#c9a84c' : strength > 0.35 ? '#c9843a' : '#e07070'
        const strengthLabel = strength > 0.87 ? 'Monster' : strength > 0.72 ? 'Strong' : strength > 0.55 ? 'Good' : strength > 0.38 ? 'Marginal' : strength > 0.22 ? 'Weak' : 'Trash'
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 20px',
            background: 'rgba(8,12,6,0.95)',
            border: `1px solid ${isMyTurn ? 'rgba(201,168,76,0.4)' : 'var(--border)'}`,
            borderRadius: 8,
            boxShadow: isMyTurn ? '0 0 20px rgba(201,168,76,0.1)' : 'none',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', minWidth: 72 }}>
              Your Hand
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {currentPlayer.holeCards.map((card, i) => (
                <Card key={i} card={card} size="lg" />
              ))}
            </div>
            {/* Hand strength indicator */}
            <div style={{ flex: 1, padding: '0 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STRENGTH</span>
                <span style={{ fontSize: '0.6rem', color: strengthColor, fontWeight: 700 }}>{strengthLabel}</span>
              </div>
              <div style={{
                height: 3, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${strengthPct}%`,
                  background: `linear-gradient(to right, #e07070, #c9843a, #c9a84c, #7de87d)`,
                  backgroundSize: '300px 100%',
                  backgroundPosition: `${(1 - strength) * -200}px 0`,
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 2 }}>stack</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 700 }}>{currentPlayer.chips}</div>
            </div>
          </div>
        )
      })()}

      {/* BETTING CONTROLS */}
      {validActions && gameState.stage !== 'showdown' && gameState.stage !== 'ended' && gameState.stage !== 'waiting' && (
        <BettingControls
          validActions={validActions}
          potSize={totalPot}
          onAction={onAction}
          disabled={!isMyTurn}
          playerChips={currentPlayer?.chips ?? 0}
        />
      )}

      {/* GAME OVER */}
      {gameState.stage === 'ended' && (
        <div style={{
          textAlign: 'center', padding: '28px',
          background: 'rgba(8,12,6,0.97)',
          border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: 8,
          animation: 'winner-pop 0.4s ease',
        }}>
          <div style={{ fontSize: '1.2rem', color: 'var(--gold)', fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>
            ♠ The Vault Closes ♠
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 6 }}>
            {(gameState.players.find(p => p.chips > 0)?.name ?? '—')} takes everything.
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {gameState.players.find(p => p.id === currentPlayerId)?.chips ?? 0 > 0
              ? 'Well played.'
              : 'The house always wins.'}
          </div>
        </div>
      )}
    </div>
  )
}
