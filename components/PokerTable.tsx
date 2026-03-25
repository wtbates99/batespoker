'use client'

import { useEffect, useState } from 'react'
import { GameState, Player, ValidActions, getValidActions } from '@/lib/poker/engine'
import Card, { CardSlot } from './Card'
import BettingControls from './BettingControls'

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

const CHARACTER_CLASSES: Record<string, string> = {
  baron_von_chips: 'baron',
  lucky_mcgee:     'lucky',
  the_duchess:     'duchess',
  the_jester:      'jester',
}

// Seat positions as percentages for an oval table
// Seats are positioned around the oval
const SEAT_POSITIONS = [
  { bottom: '2%',  left: '50%',  transform: 'translateX(-50%)' },  // 0: bottom center (human)
  { bottom: '15%', left: '10%',  transform: 'none' },               // 1: bottom left
  { top: '15%',    left: '5%',   transform: 'none' },               // 2: top left
  { top: '2%',     left: '50%',  transform: 'translateX(-50%)' },   // 3: top center
  { top: '15%',    right: '5%',  transform: 'none' },               // 4: top right
  { bottom: '15%', right: '10%', transform: 'none' },               // 5: bottom right
]

export default function PokerTable({ gameState, currentPlayerId, onAction, dialogue }: PokerTableProps) {
  const [dialogueVisible, setDialogueVisible] = useState<string | null>(null)
  const [dialogueText, setDialogueText] = useState('')
  const [dialogueChar, setDialogueChar] = useState('')

  useEffect(() => {
    if (dialogue) {
      setDialogueVisible(dialogue.characterId)
      setDialogueText(dialogue.text)
      setDialogueChar(dialogue.characterId)
      const t = setTimeout(() => setDialogueVisible(null), 4000)
      return () => clearTimeout(t)
    }
  }, [dialogue])

  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId)
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === currentPlayerId &&
    gameState.stage !== 'showdown' && gameState.stage !== 'ended' && gameState.stage !== 'waiting'

  const validActions = currentPlayer ? getValidActions(gameState, currentPlayerId) : null

  const totalPot = gameState.pot + gameState.players.reduce((s, p) => s + (p.currentBet || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 900, margin: '0 auto' }}>

      {/* Pot info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        fontSize: '0.72rem',
      }}>
        <span style={{ color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Stage: <span style={{ color: 'var(--text)' }}>{gameState.stage.toUpperCase()}</span>
        </span>
        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>
          ♠ POT: {totalPot}
        </span>
        <span style={{ color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Round {gameState.round}
        </span>
      </div>

      {/* TABLE */}
      <div style={{ position: 'relative', paddingBottom: '56%' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, #0d2814 0%, #0a2010 60%, #071508 100%)',
          borderRadius: '50%',
          border: '8px solid #2d1f12',
          boxShadow: `
            inset 0 0 80px rgba(0,0,0,0.6),
            inset 0 0 30px rgba(20,100,40,0.06),
            0 0 0 2px rgba(201,168,76,0.10),
            0 0 60px rgba(0,0,0,0.8)
          `,
          overflow: 'hidden',
        }}>
          {/* Felt texture */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.002) 10px, rgba(255,255,255,0.002) 20px)',
          }} />

          {/* Lamp glow */}
          <div style={{
            position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: '60%', height: '60%',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Table border ring */}
          <div style={{
            position: 'absolute', inset: 8,
            borderRadius: '50%',
            border: '1px solid rgba(201,168,76,0.07)',
            pointerEvents: 'none',
          }} />

          {/* CENTER: community cards + pot */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            {/* Community cards */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const card = gameState.communityCards[i]
                return card
                  ? <Card key={i} card={card} size="md" />
                  : <CardSlot key={i} size="md" />
              })}
            </div>
            {/* Pot */}
            <div style={{
              fontSize: '0.72rem',
              color: 'var(--gold)',
              letterSpacing: '0.12em',
              fontWeight: 700,
              textShadow: '0 0 10px rgba(201,168,76,0.4)',
            }}>
              ♠ {totalPot}
            </div>
            {/* Current bet */}
            {gameState.currentBet > 0 && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                bet: {gameState.currentBet}
              </div>
            )}
          </div>

          {/* PLAYER SEATS */}
          {gameState.players.map((player, idx) => {
            const seatPos = SEAT_POSITIONS[idx % SEAT_POSITIONS.length]
            const isCurrentTurn = gameState.players[gameState.currentPlayerIndex]?.id === player.id
            const charClass = player.characterId ? CHARACTER_CLASSES[player.characterId] ?? 'human' : 'human'
            const emoji = player.characterId ? CHARACTER_EMOJIS[player.characterId] : player.name.charAt(0).toUpperCase()
            const showDialogue = dialogueVisible === player.characterId

            return (
              <div key={player.id} className="player-seat" style={{ ...seatPos as React.CSSProperties, position: 'absolute', zIndex: 10 }}>
                {/* Dialogue */}
                {showDialogue && (
                  <div className={`dialogue-bubble ${charClass}`} style={{ bottom: '100%', transform: 'none', left: '-60px', right: '-60px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                      {player.name}
                    </span>
                    {dialogueText}
                  </div>
                )}

                {/* Portrait */}
                <div className={`seat-portrait ${charClass} ${isCurrentTurn && player.status === 'active' ? 'active-turn' : ''} ${player.status === 'folded' ? 'folded' : ''} ${player.status === 'allin' ? 'allin' : ''}`}>
                  <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
                  {player.isDealer && (
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--gold)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.5rem', fontWeight: 700, color: '#030503',
                    }}>D</div>
                  )}
                  {isCurrentTurn && player.status === 'active' && player.isAI && (
                    <div style={{
                      position: 'absolute', top: -2, right: -2,
                      background: 'rgba(201,168,76,0.9)',
                      borderRadius: 10,
                      padding: '1px 4px',
                      fontSize: '0.45rem',
                      fontWeight: 700,
                      color: '#030503',
                      letterSpacing: '0.05em',
                    }}>...</div>
                  )}
                </div>

                {/* Name + chips */}
                <div className="seat-name" style={{ color: player.id === currentPlayerId ? 'var(--gold)' : undefined }}>
                  {player.name}
                  {player.isSmallBlind && ' SB'}
                  {player.isBigBlind && ' BB'}
                </div>
                <div className="seat-chips">{player.chips} ♠</div>
                {player.currentBet > 0 && (
                  <div className="seat-bet">bet: {player.currentBet}</div>
                )}
                {player.status === 'folded' && (
                  <div className="seat-status-badge badge-folded">FOLD</div>
                )}
                {player.status === 'allin' && (
                  <div className="seat-status-badge badge-allin">ALL IN</div>
                )}

                {/* Hole cards */}
                {player.holeCards.length > 0 && (
                  <div className="seat-hole-cards">
                    {player.holeCards.map((card, ci) => (
                      <Card key={ci} card={card} size="sm" />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* WINNER OVERLAY */}
      {gameState.stage === 'showdown' && gameState.winners && gameState.winners.length > 0 && (
        <div style={{
          background: 'var(--vault-panel)',
          border: '1px solid rgba(201,168,76,0.4)',
          borderRadius: 8,
          padding: '16px 20px',
          textAlign: 'center',
          boxShadow: '0 0 30px rgba(201,168,76,0.1)',
        }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            ♠ showdown ♠
          </div>
          {gameState.winners.map((w, i) => {
            const wPlayer = gameState.players.find(p => p.id === w.playerId)
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1rem' }}>{wPlayer?.name ?? w.playerId}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginLeft: 8 }}>
                  wins {w.amount} · {w.handName}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* YOUR HOLE CARDS (prominent) */}
      {currentPlayer && currentPlayer.holeCards.length > 0 && gameState.stage !== 'waiting' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 20px',
          background: 'var(--vault-panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: 80 }}>
            Your Hand
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {currentPlayer.holeCards.map((card, i) => (
              <Card key={i} card={card} size="lg" />
            ))}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
            {currentPlayer.chips} chips
          </div>
        </div>
      )}

      {/* BETTING CONTROLS */}
      {validActions && gameState.stage !== 'showdown' && gameState.stage !== 'ended' && (
        <BettingControls
          validActions={validActions}
          potSize={totalPot}
          onAction={onAction}
          disabled={!isMyTurn}
          playerChips={currentPlayer?.chips ?? 0}
        />
      )}

      {/* ENDED */}
      {gameState.stage === 'ended' && (
        <div style={{
          textAlign: 'center',
          padding: '24px',
          background: 'var(--vault-panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: '1rem', color: 'var(--gold)', fontWeight: 700, marginBottom: 8 }}>
            ♠ Game Over ♠
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            {gameState.players.filter(p => p.chips > 0).map(p => p.name)[0]} takes the vault.
          </div>
        </div>
      )}
    </div>
  )
}
