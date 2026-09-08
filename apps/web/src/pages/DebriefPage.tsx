import { useCallback, useEffect, useState } from 'react'
import { CallHeader } from '../components/call/CallHeader'
import { ClaimAlignmentView } from '../components/voice/ClaimAlignmentView'
import { VoiceSession } from '../components/voice/VoiceSession'
import type { VoiceSessionState } from '../components/voice/VoiceSession'
import { Button, ButtonLink, Skeleton } from '../components/ui'
import {
  getCall,
  getDebrief,
  getInterrogationConfig,
  getInterrogationSession,
  startInterrogation,
  submitDebrief,
} from '../lib/api'
import type {
  CallRecord,
  ClaimAlignment,
  DebriefResponse,
  InterrogationConfig,
  InterrogationDimension,
  InterrogationMessage,
  InterrogationSession,
  RepClaim,
} from '../lib/types'
import { callStatusMeta, dimensionLabel, pct } from '../lib/ui'
import { cx } from '../lib/cx'

type Phase = 'loading' | 'idle' | 'active' | 'processing' | 'results' | 'error'

const CANONICAL_DIMENSIONS: InterrogationDimension[] = [
  'primary_objection',
  'buyer_decision_maker',
  'deal_interest_risk',
  'next_step',
]

type DebriefPageProps = {
  callId: string
  onBack: () => void
  onReality: () => void
}

type ProgressStatus = 'Recorded' | 'Current' | 'Upcoming' | 'Complete' | 'Not captured'

const PROGRESS_DOT: Record<ProgressStatus, { dot: string; text: string }> = {
  Recorded: { dot: 'bg-sentiment/70', text: 'text-sentiment' },
  Current: { dot: 'bg-warning animate-pulse motion-reduce:animate-none', text: 'text-warning' },
  Upcoming: { dot: 'bg-ash', text: 'text-subtle' },
  Complete: { dot: 'bg-sentiment', text: 'text-sentiment' },
  'Not captured': { dot: 'bg-faint', text: 'text-faint' },
}

export default function DebriefPage({
  callId,
  onBack,
  onReality,
}: DebriefPageProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [call, setCall] = useState<CallRecord | null>(null)
  const [session, setSession] = useState<InterrogationSession | null>(null)
  const [config, setConfig] = useState<InterrogationConfig | null>(null)
  const [claims, setClaims] = useState<RepClaim[]>([])
  const [alignments, setAlignments] = useState<ClaimAlignment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [voice, setVoice] = useState<VoiceSessionState>({
    started: false,
    answered: 0,
  })

  const load = useCallback(async (): Promise<void> => {
    try {
      const loadedCall = await getCall(callId)
      setCall(loadedCall)
      setError(null)
      try {
        const loadedSession = await getInterrogationSession(callId)
        setSession(loadedSession)
        if (loadedSession.status === 'completed') {
          const debrief = await getDebrief(callId)
          setClaims(debrief.session.claims)
          setAlignments(debrief.alignments)
          setPhase('results')
          return
        }
        setPhase('active')
      } catch {
        setPhase('idle')
      }
      try {
        const loadedConfig = await getInterrogationConfig(callId)
        setConfig(loadedConfig)
      } catch {
        setConfig(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
      setPhase('error')
    }
  }, [callId])

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  const pending = call !== null && call.status !== 'ready' && call.status !== 'failed'

  useEffect(() => {
    if (!pending) return
    let active = true
    const timer = window.setInterval(() => {
      void getCall(callId)
        .then((loaded) => {
          if (!active) return
          setCall(loaded)
          setError(null)
        })
        .catch(() => {
          /* transient failure — keep polling */
        })
    }, 4000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [pending, callId])

  const begin = async () => {
    setError(null)
    try {
      const created = await startInterrogation(callId)
      setSession(created)
      setVoice({ started: false, answered: 0 })
      setPhase('active')
      try {
        const loadedConfig = await getInterrogationConfig(callId)
        setConfig(loadedConfig)
      } catch {
        setConfig(null)
      }
    } catch (beginError) {
      setError(beginError instanceof Error ? beginError.message : String(beginError))
      setPhase('error')
    }
  }

  const handleComplete = async (messages: InterrogationMessage[]) => {
    setPhase('processing')
    try {
      const debrief: DebriefResponse = await submitDebrief(callId, messages)
      setSession(debrief.session)
      setClaims(debrief.session.claims)
      setAlignments(debrief.alignments)
      setPhase('results')
    } catch (completeError) {
      setError(
        completeError instanceof Error ? completeError.message : String(completeError),
      )
      setPhase('error')
    }
  }

  if (error && !call) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-subtle transition-colors hover:text-ink"
        >
          ← Calls
        </button>
        <div className="mt-6 rounded-lg border border-rule bg-vessel/40 p-8">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-caution">
            Call unavailable
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            We couldn't open this call
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {error} It may have been removed or the id may be wrong.
          </p>
        </div>
      </main>
    )
  }

  if (!call) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
        <Skeleton className="h-80" />
      </main>
    )
  }

  const dimensions =
    session?.dimensions && session.dimensions.length > 0
      ? session.dimensions
      : CANONICAL_DIMENSIONS

  return (
    <>
      <CallHeader call={call} section="debrief" onBack={onBack} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {call.status === 'failed' && (
          <div
            className="flex items-center gap-3 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3 text-sm text-caution"
            role="alert"
          >
            <span>{call.error_message ?? 'This call failed to process.'}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="ml-auto text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              Retry
            </button>
          </div>
        )}

        {pending && (
          <div className="flex items-center gap-3 rounded-md border border-rule bg-vessel/40 px-4 py-5">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-info" />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">
                This call is still {callStatusMeta(call.status).label.toLowerCase()}.
              </p>
              <p className="text-xs text-subtle">
                The voice debrief opens once the call is transcribed and analyzed.
              </p>
            </div>
          </div>
        )}

        {call.status === 'ready' &&
          (phase === 'idle' || phase === 'active' || phase === 'processing') && (
            <div className="mt-10 animate-fade-cross">
              <PageEyebrow>Voice debrief</PageEyebrow>
              <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
                Let's see what you remember.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                RealityCheck asks the rep the four standard questions before the
                transcript is shown, then tests each answer against the evidence.
                Perception, measured against what actually happened.
              </p>
              <p className="mt-2 text-xs text-subtle">
                The agent never reveals the transcript during the debrief.
              </p>
            </div>
          )}

        {error && (phase === 'active' || phase === 'idle') && (
          <div
            className="mt-6 flex items-center gap-3 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3 text-sm text-caution"
            role="alert"
          >
            <span>{error}</span>
          </div>
        )}

        {call.status === 'ready' &&
          (phase === 'idle' || phase === 'active' || phase === 'processing') && (
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                {phase === 'idle' && (
                  <BeginCard onBegin={begin} busy={false} />
                )}
                {phase === 'active' && (
                  <VoiceSession
                    callId={callId}
                    config={config}
                    onComplete={handleComplete}
                    onError={setError}
                    onStateChange={setVoice}
                  />
                )}
                {phase === 'processing' && (
                  <ProcessingCard />
                )}
              </div>

              <aside className="space-y-6">
                <ProgressPanel
                  dimensions={dimensions}
                  mode={phase === 'processing' ? 'active' : phase}
                  answered={voice.answered}
                  started={voice.started || phase === 'processing'}
                  claims={phase === 'processing' ? [] : claims}
                />
                {phase !== 'processing' && <WorkflowNote />}
              </aside>
            </div>
          )}

        {call.status === 'ready' && phase === 'results' && (
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="animate-fade-cross">
                <PageEyebrow tone="sentiment">Debrief complete</PageEyebrow>
                <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
                  Your perception, measured against the call.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                  We captured your answers before showing the evidence. Here's what
                  your read got right — and where perception and evidence drift.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button size="lg" onClick={onReality}>
                    See Deal Reality
                    <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
                      →
                    </span>
                  </Button>
                  <ButtonLink
                    to={`/calls/${encodeURIComponent(callId)}/transcript`}
                    variant="secondary"
                    size="lg"
                  >
                    Review the call
                  </ButtonLink>
                </div>
              </div>

              <div className="mt-10 animate-fade-cross">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
                  Claim by claim
                </p>
                <div className="mt-3">
                  <ClaimAlignmentView
                    callId={callId}
                    claims={claims}
                    alignments={alignments}
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <ProgressPanel
                dimensions={dimensions}
                mode="results"
                answered={0}
                started
                claims={claims}
              />
              <YourView claims={claims} />
            </aside>
          </div>
        )}

        {phase === 'error' && error && call && (
          <div className="mt-8 animate-fade-cross">
            <div
              className="rounded-lg border border-rule bg-vessel/40 p-6"
              role="alert"
            >
              <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-caution">
                Debrief failed
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{error}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  Try again
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

function PageEyebrow({
  children,
  tone = 'warning',
}: {
  children: string
  tone?: 'warning' | 'sentiment'
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cx(
          'h-[3px] w-[3px] rotate-45',
          tone === 'sentiment' ? 'bg-sentiment' : 'bg-warning',
        )}
        aria-hidden="true"
      />
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">
        {children}
      </p>
    </div>
  )
}

function BeginCard({ onBegin, busy }: { onBegin: () => void; busy: boolean }) {
  return (
    <div className="rounded-lg border border-rule bg-vessel p-5 sm:p-7 animate-fade-cross">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
        <span className="mr-2 text-faint">Step 02</span>
        Ready when you are
      </p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        A voice agent greets the rep, then works through the four dimensions — the
        buyer's main objection, the real decision-maker, deal interest and risk,
        and the agreed next step. Specific claims are checked against the call
        transcript as you answer.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={onBegin} loading={busy}>
          Begin voice debrief
        </Button>
        <p className="text-xs text-subtle">
          You'll be asked to allow microphone access.
        </p>
      </div>
    </div>
  )
}

function ProcessingCard() {
  return (
    <div className="rounded-lg border border-rule bg-vessel p-5 sm:p-7 animate-fade-cross">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
        Processing
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        RealityCheck is aligning your answers against the transcript evidence —
        quote by quote, claim by claim.
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-subtle">
        <svg
          className="h-4 w-4 animate-spin text-warning"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path
            d="M14.5 8 A6.5 6.5 0 0 1 8 14.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Comparing perception with evidence…
      </div>
    </div>
  )
}

function ProgressPanel({
  dimensions,
  mode,
  answered,
  started,
  claims,
}: {
  dimensions: InterrogationDimension[]
  mode: Phase
  answered: number
  started: boolean
  claims: RepClaim[]
}) {
  const claimDimensions = new Set(claims.map((claim) => claim.dimension))

  const statusFor = (dimension: InterrogationDimension, index: number): ProgressStatus => {
    if (mode === 'results') {
      return claimDimensions.has(dimension) ? 'Complete' : 'Not captured'
    }
    if (!started) return 'Upcoming'
    if (index < answered) return 'Recorded'
    if (index === answered && index < dimensions.length) return 'Current'
    return 'Upcoming'
  }

  return (
    <div className="rounded-lg border border-rule bg-vessel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
          Debrief progress
        </p>
        {mode === 'results' ? (
          <span className="font-mono text-[10px] text-faint">
            {claims.length} / {dimensions.length}
          </span>
        ) : (
          started && (
            <span className="font-mono text-[10px] text-faint" role="status">
              {answered} answered
            </span>
          )
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {dimensions.map((dimension, index) => {
          const status = statusFor(dimension, index)
          const meta = PROGRESS_DOT[status]
          return (
            <li key={dimension} className="flex items-center gap-3">
              <span className={cx('inline-block size-2 rounded-full', meta.dot)} aria-hidden="true" />
              <span className="flex-1 text-sm text-ink">{dimensionLabel(dimension)}</span>
              <span className={cx('font-mono text-[10px] uppercase tracking-widest', meta.text)}>
                {status}
              </span>
            </li>
          )
        })}
      </ul>

      {mode !== 'results' && (
        <p className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-faint">
          A full answer records a dimension. Claims are only counted once the
          rep has spoken them.
        </p>
      )}
    </div>
  )
}

function WorkflowNote() {
  return (
    <div className="rounded-lg border border-rule bg-vessel p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
        How this works
      </p>
      <ol className="mt-3 space-y-2.5">
        {[
          'You answer the four questions from memory.',
          'RealityCheck tests specific claims against the call — silently.',
          'Deal Reality shows what matched, and what drifted.',
        ].map((step, index) => (
          <li key={step} className="flex gap-3 text-xs leading-relaxed text-muted">
            <span className="font-mono text-[10px] text-faint">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function YourView({ claims }: { claims: RepClaim[] }) {
  return (
    <div className="rounded-lg border border-rule bg-vessel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
          Your view
        </p>
        <span className="font-mono text-[10px] text-faint">
          {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
        </span>
      </div>

      {claims.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-subtle">
          No claims were extracted from this debrief.
        </p>
      )}

      {claims.length > 0 && (
        <ul className="mt-3 divide-y divide-rule">
          {claims.map((claim) => (
            <li key={claim.id} className="py-3 first:pt-0 last:pb-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
                {dimensionLabel(claim.dimension)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink">“{claim.claim}”</p>
              <p className="mt-1 text-xs text-subtle">
                Confidence {pct(claim.rep_confidence)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}