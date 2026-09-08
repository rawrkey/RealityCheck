import type { ReactNode } from 'react'

/**
 * State machine for the debrief voice stage. The orb is always paired with
 * an explicit, readable state label rendered by `VoiceSession`, so the orb
 * itself is decorative.
 */
export type VoiceOrbState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'tool'
  | 'completed'
  | 'error'

type OrbSpec = {
  /** Renders the expanding "signal" ping around the bulb. */
  glowing?: boolean
  ringClass: string
  bulbClass: string
  tickClass: string
  /** Extra decorative layer rendered inside the static ring, behind the bulb. */
  overlay?: ReactNode
}

const SPECS: Record<VoiceOrbState, OrbSpec> = {
  idle: {
    ringClass: 'border-tone',
    bulbClass: 'bg-vessel ring-1 ring-rule-strong',
    tickClass: 'bg-warning/70',
  },
  connecting: {
    ringClass: 'border-tone',
    bulbClass: 'bg-vessel ring-1 ring-rule-strong',
    tickClass: 'bg-warning/60',
    overlay: (
      <span className="absolute inset-[10px] rounded-full border-2 border-transparent border-t-rule-strong animate-spin motion-reduce:animate-none" />
    ),
  },
  listening: {
    glowing: true,
    ringClass: 'border-info/25',
    bulbClass: 'bg-info/10 ring-1 ring-info/30 animate-breath motion-reduce:animate-none',
    tickClass: 'bg-warning',
  },
  thinking: {
    ringClass: 'border-warning/30',
    bulbClass: 'bg-warning-tint/55 ring-1 ring-warning/25',
    tickClass: 'bg-warning animate-pulse motion-reduce:animate-none',
  },
  speaking: {
    glowing: true,
    ringClass: 'border-info/35',
    bulbClass: 'bg-info/15 ring-1 ring-info/40 animate-breath motion-reduce:animate-none',
    tickClass: 'bg-warning',
  },
  tool: {
    ringClass: 'border-info/30',
    bulbClass: 'bg-info-tint ring-1 ring-info/30',
    tickClass: 'bg-warning/80',
    overlay: (
      <span
        className="absolute inset-[6px] rounded-full border-2 border-transparent border-t-info/60 animate-spin motion-reduce:animate-none"
        style={{ animationDuration: '1.5s' }}
      />
    ),
  },
  completed: {
    ringClass: 'border-sentiment/30',
    bulbClass: 'bg-sentiment-tint/50 ring-1 ring-sentiment/30',
    tickClass: 'bg-sentiment',
  },
  error: {
    ringClass: 'border-caution/40',
    bulbClass: 'bg-caution-tint/50 ring-1 ring-caution/35',
    tickClass: 'bg-caution',
  },
}

export function VoiceOrb({
  state,
  className = '',
}: {
  state: VoiceOrbState
  className?: string
}) {
  const spec = SPECS[state]
  return (
    <div
      className={`relative flex h-40 w-40 items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {spec.glowing && (
        <span
          className={`absolute inset-0 rounded-full border ${spec.ringClass} animate-signal-ping motion-reduce:animate-none`}
        />
      )}
      <span
        className={`absolute inset-3 rounded-full border bg-transparent transition-colors duration-300 ${spec.ringClass}`}
      />
      <span className="relative z-10">{spec.overlay}</span>
      <span
        className={`relative z-20 flex h-[76px] w-[76px] items-center justify-center rounded-full transition-colors duration-300 ${spec.bulbClass}`}
      >
        <span
          className={`h-[6px] w-[6px] rotate-45 transition-colors duration-300 ${spec.tickClass}`}
        />
      </span>
    </div>
  )
}