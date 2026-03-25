'use client'

import { useState } from 'react'
import { ValidActions } from '@/lib/poker/engine'

interface BettingControlsProps {
  validActions: ValidActions
  potSize: number
  onAction: (type: string, amount?: number) => void
  disabled?: boolean
  playerChips: number
}

export default function BettingControls({
  validActions, potSize, onAction, disabled, playerChips,
}: BettingControlsProps) {
  const [showRaise, setShowRaise] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(validActions.minRaise)

  const presets = [
    { label: '½ pot', value: Math.max(validActions.minRaise, Math.floor(potSize * 0.5)) },
    { label: 'pot',   value: Math.max(validActions.minRaise, potSize) },
    { label: '2× pot', value: Math.max(validActions.minRaise, potSize * 2) },
    { label: 'All In', value: validActions.maxRaise },
  ].filter(p => p.value <= validActions.maxRaise)

  function handleRaise() {
    onAction('raise', raiseAmount)
    setShowRaise(false)
  }

  if (disabled) {
    return (
      <div className="betting-controls" style={{ opacity: 0.5 }}>
        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
          waiting for other players...
        </div>
      </div>
    )
  }

  return (
    <div className="betting-controls">
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>
        YOUR TURN &nbsp;·&nbsp; pot: <span style={{ color: 'var(--gold)' }}>{potSize}</span>
        {validActions.callAmount > 0 && (
          <> &nbsp;·&nbsp; to call: <span style={{ color: '#e0c070' }}>{validActions.callAmount}</span></>
        )}
      </div>

      <div className="action-buttons">
        <button
          className="btn-action btn-fold"
          onClick={() => onAction('fold')}
          disabled={!validActions.canFold}
        >
          Fold
        </button>

        {validActions.canCheck && (
          <button
            className="btn-action btn-check"
            onClick={() => onAction('check')}
          >
            Check
          </button>
        )}

        {validActions.canCall && (
          <button
            className="btn-action btn-call"
            onClick={() => onAction('call')}
          >
            Call {validActions.callAmount}
          </button>
        )}

        {validActions.canRaise && (
          <button
            className="btn-action btn-raise"
            onClick={() => { setRaiseAmount(validActions.minRaise); setShowRaise(!showRaise) }}
          >
            Raise ›
          </button>
        )}

        <button
          className="btn-action btn-allin"
          onClick={() => onAction('allin')}
          disabled={!validActions.canAllIn}
        >
          All In {playerChips}
        </button>
      </div>

      {showRaise && validActions.canRaise && (
        <div className="raise-slider-wrap">
          <div className="raise-row">
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Raise to:
            </span>
            <input
              type="range"
              className="raise-slider"
              min={validActions.minRaise}
              max={validActions.maxRaise}
              step={validActions.minRaise > 0 ? validActions.minRaise : 1}
              value={raiseAmount}
              onChange={e => setRaiseAmount(Number(e.target.value))}
            />
            <span className="raise-amount-display">{raiseAmount}</span>
          </div>

          <div className="raise-row">
            {presets.map(p => (
              <button
                key={p.label}
                className="raise-preset"
                onClick={() => setRaiseAmount(Math.min(p.value, validActions.maxRaise))}
              >
                {p.label}
              </button>
            ))}
            <button
              className="btn-action btn-raise"
              style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '0.7rem' }}
              onClick={handleRaise}
            >
              Confirm ♠ {raiseAmount}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
