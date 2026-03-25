'use client'

import { Card as CardType, RANK_DISPLAY, SUIT_SYMBOLS, isRedSuit } from '@/lib/poker/deck'

interface CardProps {
  card?: CardType
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

export default function Card({ card, size = 'md', className = '', style }: CardProps) {
  const sizeClass = `card-${size}`

  // Hidden / face-down card
  if (!card || card.hidden || (card.rank as number) === 0) {
    return (
      <div className={`card card-back ${sizeClass} ${className}`} style={style}>
        <div className="card-back-pattern">
          <span className="card-back-rune">♠</span>
        </div>
      </div>
    )
  }

  const rankDisplay = RANK_DISPLAY[card.rank]
  const suitSymbol = SUIT_SYMBOLS[card.suit]
  const isRed = isRedSuit(card.suit)

  return (
    <div
      className={`card card-face ${isRed ? 'red' : ''} ${sizeClass} ${className}`}
      style={style}
    >
      <div className="card-rank-suit">
        <span>{rankDisplay}</span>
        <span style={{ fontSize: '0.85em' }}>{suitSymbol}</span>
      </div>
      <span className="card-center-suit">{suitSymbol}</span>
      <div className="card-rank-suit card-rank-suit-bottom">
        <span>{rankDisplay}</span>
        <span style={{ fontSize: '0.85em' }}>{suitSymbol}</span>
      </div>
    </div>
  )
}

// Placeholder / empty card slot
export function CardSlot({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClass = `card-${size}`
  return (
    <div className={`card ${sizeClass} ${className}`} style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(201,168,76,0.15)',
      borderRadius: 4,
    }} />
  )
}
