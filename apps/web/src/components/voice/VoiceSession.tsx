import { useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { executeVoiceTool } from '../../lib/api'
import type {
  InterrogationConfig,
  InterrogationMessage,
} from '../../lib/types'
import { VoiceAgentClient, type VoiceAgentLogEntry } from '../../lib/voiceAgent'
import { Button } from '../ui'
import { EvidenceBox } from '../call/EvidenceBox'
import { VoiceOrb, type VoiceOrbState } from './VoiceOrb'

const MANUAL_QUESTIONS: { label: string; question: string }[] = [
  {
    label: 'Primary objection',
    question: 'What was the buyer’s primary objection to moving forward?',
  },
  {
    label: 'Decision maker',
    question: 'Who was the decision maker on the buyer’s side?',
  },
  {
    label: 'Deal interest & risk',
    question: 'How engaged was the buyer, and what risks did you sense?',
  },
  {
    label: 'Next step',
    question: 'What is the agreed next step?',
  },
]

export type VoiceSessionState = { started: boolean; answered: number }

type VoiceSessionProps = {
  callId: string
  config: InterrogationConfig | null
  onComplete: (messages: InterrogationMessage[]) => void
  onError: (message: string) => void
  onStateChange?: (state: VoiceSessionState) => void
}

export function VoiceSession({
  callId,
  config,
  onComplete,
  onError,
  onStateChange,
}: VoiceSessionProps) {
  if (config !== null) {
    return (
      <LiveVoiceSession
        callId={callId}
        config={config}
        onComplete={onComplete}
        onError={onError}
        onStateChange={onStateChange}
      />
    )
  }
  return (
    <ManualVoiceSession
      onComplete={onComplete}
      onError={onError}
      onStateChange={onStateChange}
    />
  )
}

type LiveVoiceSessionProps = VoiceSessionProps & {
  config: InterrogationConfig
}

type LivePhase =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'tool'
  | 'completed'
  | 'error'

const LIVE_STATUS: Record<
  LivePhase,
  { label: string; note: string; orb: VoiceOrbState }
> = {
  idle: {
    label: 'Ready to debrief',
    note: 'A few questions on how you read the call. Your answers are checked against the transcript after — never during the debrief.',
    orb: 'idle',
  },
  connecting: {
    label: 'Connecting',
    note: 'Starting the voice session…',
    orb: 'connecting',
  },
  listening: {
    label: 'Listening',
    note: 'RealityCheck is listening. Speak as you would on the call.',
    orb: 'listening',
  },
  thinking: {
    label: 'Thinking',
    note: 'RealityCheck is weighing your answer before asking the next question.',
    orb: 'thinking',
  },
  speaking: {
    label: 'Speaking',
    note: 'RealityCheck is asking the next question.',
    orb: 'speaking',
  },
  tool: {
    label: 'Checking the call',
    note: 'RealityCheck is testing a claim against the transcript.',
    orb: 'tool',
  },
  completed: {
    label: 'Debrief complete',
    note: 'Recording your answers and ending the session…',
    orb: 'completed',
  },
  error: {
    label: 'Voice session failed',
    note: 'The voice connection dropped. Retry, or continue with written answers.',
    orb: 'error',
  },
}

type ToolEvidence = {
  query: string
  found: boolean
  count: number
  utteranceIds: string[]
}

function LiveVoiceSession({
  callId,
  config,
  onComplete,
  onError,
  onStateChange,
}: LiveVoiceSessionProps) {
  const clientRef = useRef<VoiceAgentClient | null>(null)
  const logRef = useRef<VoiceAgentLogEntry[]>([])
  const answeredRef = useRef(0)

  const [log, setLog] = useState<VoiceAgentLogEntry[]>([])
  const [phase, setPhase] = useState<LivePhase>('idle')
  const [ending, setEnding] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<ToolEvidence | null>(null)
  const [fallback, setFallback] = useState(false)

  const appendLog = (entry: VoiceAgentLogEntry) => {
    logRef.current = [...logRef.current, entry]
    setLog(logRef.current)
    if (entry.kind === 'rep') {
      answeredRef.current += 1
      onStateChange?.({ started: true, answered: answeredRef.current })
    }
  }

  const connect = async () => {
    setConnectError(null)
    setMicError(null)
    setEvidence(null)
    setPhase('connecting')

    const wsUrl = `${config.websocket_url}?token=${encodeURIComponent(config.token)}`
    const client = new VoiceAgentClient(
      wsUrl,
      config.session,
      {
        onLog: appendLog,
        onStatus: (text) => appendLog({ kind: 'system', text }),
        onError: (message) => {
          setConnectError(message)
          setPhase('error')
          const failed = clientRef.current
          if (failed) {
            failed.close()
            clientRef.current = null
          }
        },
        onPhase: (p) => setPhase(p === 'completed' ? 'completed' : p),
        onToolCall: async (call) => {
          const response = await executeVoiceTool(callId, {
            name: call.name,
            arguments: call.arguments,
          })
          let query = ''
          let found = false
          let count = 0
          const utteranceIds: string[] = []
          try {
            const parsed: unknown = JSON.parse(response.result)
            if (parsed && typeof parsed === 'object') {
              const record = parsed as Record<string, unknown>
              found = Boolean(record.found)
              count = Number(record.count) || 0
              query = String(record.query ?? call.arguments?.query ?? '')
              if (Array.isArray(record.evidence)) {
                for (const item of record.evidence) {
                  const id = (item as Record<string, unknown>).utterance_id
                  if (typeof id === 'string' && id) utteranceIds.push(id)
                }
              }
            }
          } catch {
            /* evidence snapshot is best-effort; the raw result is relayed */
          }
          setEvidence({ query, found, count, utteranceIds })
          return response.result
        },
      },
    )
    clientRef.current = client
    try {
      await client.connect()
      onStateChange?.({ started: true, answered: answeredRef.current })
      setPhase('listening')
      onLogSystem('Session ready. You can speak now.')
      try {
        await client.startMic()
      } catch (error) {
        const name = error instanceof DOMException ? error.name : ''
        setMicError(
          name === 'NotAllowedError'
            ? 'Microphone access is blocked. Allow microphone access for this site, then try again.'
            : 'A microphone couldn’t be opened. Check your device, then try again.',
        )
      }
    } catch (error) {
      client.close()
      clientRef.current = null
      setConnectError(error instanceof Error ? error.message : String(error))
      setPhase('error')
    }
  }

  const onLogSystem = (text: string) => appendLog({ kind: 'system', text })

  const endSession = () => {
    const client = clientRef.current
    if (!client) return
    setEnding(true)
    setPhase('completed')
    client.end()
    setTimeout(() => {
      client.close()
      clientRef.current = null
      const messages = logRef.current
        .filter(
          (entry): entry is { kind: 'rep' | 'agent'; text: string } =>
            entry.kind === 'rep' || entry.kind === 'agent',
        )
        .map((entry) => ({ role: entry.kind, text: entry.text }))
      onComplete(messages)
    }, 500)
  }

  const disconnect = () => {
    clientRef.current?.close()
    clientRef.current = null
    setPhase('idle')
  }

  const retry = () => {
    clientRef.current?.close()
    clientRef.current = null
    setConnectError(null)
    setMicError(null)
    setPhase('idle')
  }

  if (fallback) {
    return (
      <ManualVoiceSession
        onComplete={onComplete}
        onError={onError}
        onStateChange={onStateChange}
        note="Voice isn't available in this session, so the debrief was captured in writing."
      />
    )
  }

  const status = LIVE_STATUS[phase]
  const currentQuestion = [...log]
    .reverse()
    .find((entry) => entry.kind === 'agent' && entry.text.includes('?'))

  return (
    <section className="rounded-lg border border-rule bg-vessel p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">
          <span className="mr-2 inline-block h-[3px] w-[3px] rotate-45 bg-warning align-middle" />
          RealityCheck / Live voice debrief
        </p>
        {phase === 'connecting' && (
          <span className="rounded-full border border-rule-strong px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
            Connecting…
          </span>
        )}
        {isLive(phase) && !ending && (
          <span className="rounded-full border border-rule-strong px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
            <span className="mr-1.5 inline-block size-[5px] rounded-full bg-sentiment align-middle animate-pulse motion-reduce:animate-none" />
            Microphone live
          </span>
        )}
        {ending && (
          <span className="rounded-full border border-rule-strong px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
            Finishing…
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr] md:gap-x-10">
        <div className="flex flex-col items-center gap-4">
          <VoiceOrb state={status.orb} />
          <div className="text-center" aria-live="polite" aria-atomic="true">
            <p className="text-sm font-semibold text-ink">{status.label}</p>
            <p className="mx-auto mt-1 max-w-[240px] text-xs leading-relaxed text-subtle">
              {status.note}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          {phase === 'idle' && !ending && (
            <div className="animate-fade-cross">
              <button
                type="button"
                onClick={() => void connect()}
                className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-semibold tracking-tight text-canvas transition-all hover:bg-white/95 focus-visible:outline-2 focus-visible:outline-warning"
              >
                Start conversation
              </button>
              <p className="mt-3 text-xs leading-relaxed text-subtle">
                You’ll be asked to allow microphone access. Use headphones if you
                can.
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-md border border-caution/40 bg-caution-tint/40 p-4 animate-fade-cross">
              <p className="text-sm font-medium text-caution">{status.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {connectError ?? 'The voice connection could not be established.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={retry}>
                  Try again
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFallback(true)}
                >
                  Continue with typed responses →
                </Button>
              </div>
            </div>
          )}

          {micError && phase !== 'error' && phase !== 'idle' && (
            <div className="rounded-md border border-warning/40 bg-warning-tint/40 p-4 animate-fade-cross">
              <p className="text-sm font-medium text-warning">{micError}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={retry}>
                  Try again
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFallback(true)}>
                  Continue with typed responses →
                </Button>
              </div>
            </div>
          )}

          {(phase === 'listening' ||
            phase === 'thinking' ||
            phase === 'speaking' ||
            phase === 'tool') && (
            <div className="border-l-2 border-warning/50 pl-4 animate-fade-cross">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
                Current question
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">
                {currentQuestion?.text ??
                  'What do you think was the buyer’s main objection?'}
              </p>
            </div>
          )}

          <div className="mt-6">
            {isLive(phase) && !ending && (
              <div className="flex items-center gap-3">
                <Button size="sm" variant="secondary" onClick={endSession}>
                  End session
                </Button>
                <Button size="sm" variant="ghost" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            )}
            {ending && (
              <p className="text-xs font-medium text-muted">
                Finishing the debrief…
              </p>
            )}
          </div>
        </div>
      </div>

      {phase === 'tool' && (
        <div className="mt-6 animate-fade-cross">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-info">
            Checking the call
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            RealityCheck is searching the transcript for what you just claimed.
          </p>
        </div>
      )}

      {evidence && phase !== 'tool' && (phase === 'listening' || phase === 'speaking' || phase === 'thinking') && (
        <div className="mt-6 rounded-md border border-rule bg-vessel p-4 animate-fade-cross">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                'inline-block size-[5px] rounded-full',
                evidence.found ? 'bg-sentiment' : 'bg-subtle',
              )}
              aria-hidden="true"
            />
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
              {evidence.found
                ? `Evidence found · ${evidence.count} ${evidence.count === 1 ? 'quote' : 'quotes'}`
                : 'No matching evidence'}
            </p>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {evidence.found
              ? `The agent checked the call for “${evidence.query}”.`
              : `RealityCheck searched the call for “${evidence.query}” and found no supporting evidence.`}
          </p>
          {evidence.found && evidence.utteranceIds.length > 0 && (
            <EvidenceBox
              callId={callId}
              utteranceIds={evidence.utteranceIds}
              idleLabel="See what the call shows"
            />
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-8 border-t border-rule pt-6">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">
            Conversation
          </p>
          <ol className="mt-2 divide-y divide-rule">
            {log.map((entry, index) => (
              <RailRow
                key={`${entry.kind}-${index}`}
                entry={entry}
                latest={index === log.length - 1}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function isLive(phase: LivePhase): boolean {
  return (
    phase === 'listening' ||
    phase === 'thinking' ||
    phase === 'speaking' ||
    phase === 'tool'
  )
}

function toolQuery(entry: VoiceAgentLogEntry): string | null {
  if (entry.kind !== 'tool') return null
  try {
    const match = /^Tool call: (\w+)\((.+)\)$/.exec(entry.text)
    if (!match) return null
    const args = JSON.parse(match[2] ?? '{}') as Record<string, unknown>
    return typeof args.query === 'string' ? args.query : null
  } catch {
    return null
  }
}

function RailRow({
  entry,
  latest,
}: {
  entry: VoiceAgentLogEntry
  latest: boolean
}) {
  if (entry.kind === 'system') {
    return (
      <li className="py-3">
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">
          {entry.text}
        </p>
      </li>
    )
  }

  if (entry.kind === 'tool') {
    const query = toolQuery(entry)
    return (
      <li className="py-3 text-center">
        <p className="text-xs text-subtle">
          <span className="mr-1.5 inline-block h-[3px] w-[3px] rotate-45 bg-warning align-middle" />
          {query ? `Checked the call for “${query}”` : 'Checked the call'}
        </p>
      </li>
    )
  }

  const isAgent = entry.kind === 'agent'
  return (
    <li className="flex gap-4 py-3.5">
      <div className="w-32 shrink-0">
        <p
          className={cx(
            'font-mono text-[10px] font-semibold uppercase tracking-widest',
            isAgent ? 'text-warning' : 'text-subtle',
          )}
        >
          {isAgent ? 'RealityCheck' : 'You'}
        </p>
        {!isAgent && (
          <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-sentiment">
            <span className="inline-block size-[5px] rounded-full bg-sentiment" />
            Claim captured
          </p>
        )}
      </div>
      <p
        className={cx(
          'min-w-0 flex-1 text-sm leading-relaxed',
          latest ? 'font-medium text-ink' : 'text-muted',
        )}
      >
        {entry.text}
      </p>
    </li>
  )
}

function ManualVoiceSession({
  onComplete,
  onError,
  onStateChange,
  note,
}: {
  onComplete: (messages: InterrogationMessage[]) => void
  onError: (message: string) => void
  onStateChange?: (state: VoiceSessionState) => void
  note?: string
}) {
  const [answers, setAnswers] = useState<string[]>(
    MANUAL_QUESTIONS.map(() => ''),
  )

  const ready = answers.every((answer) => answer.trim().length > 0)

  const setAnswer = (index: number, value: string) => {
    const next = [...answers]
    next[index] = value
    setAnswers(next)
    const answered = next.filter((answer) => answer.trim().length > 0).length
    onStateChange?.({ started: true, answered })
  }

  const submit = () => {
    if (!ready) {
      onError('Answer every question before submitting the debrief.')
      return
    }
    const messages: InterrogationMessage[] = []
    MANUAL_QUESTIONS.forEach((question, index) => {
      messages.push({ role: 'agent', text: question.question })
      messages.push({ role: 'rep', text: answers[index].trim() })
    })
    onComplete(messages)
  }

  return (
    <section className="rounded-lg border border-rule bg-vessel p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">
          <span className="mr-2 inline-block h-[3px] w-[3px] rotate-45 bg-warning align-middle" />
          RealityCheck / Manual debrief
        </p>
        <span className="rounded-full border border-rule-strong px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
          Typed responses
        </span>
      </div>

      {note && (
        <p className="mt-4 rounded-md border border-info/30 bg-info-tint/40 p-3 text-xs leading-relaxed text-muted">
          {note}
        </p>
      )}

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
        Live voice isn’t configured in this environment. Answer the same four
        questions in writing — your debrief is processed exactly like a live
        session.
      </p>

      <div className="mt-6 space-y-5">
        {MANUAL_QUESTIONS.map((item, index) => {
          const filled = answers[index].trim().length > 0
          return (
            <div key={item.label}>
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={`manual-${index}`}
                  className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle"
                >
                  <span className="mr-2 text-faint">{`0${index + 1}`}</span>
                  {item.label}
                </label>
                {filled && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-sentiment">
                    <span className="inline-block size-[5px] rounded-full bg-sentiment" />
                    Claim captured
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted">{item.question}</p>
              <textarea
                id={`manual-${index}`}
                value={answers[index]}
                onChange={(event) => setAnswer(index, event.target.value)}
                rows={2}
                className="mt-2 w-full resize-y rounded-md border border-rule bg-panel px-3 py-2 text-sm leading-relaxed text-ink outline-none transition placeholder:text-faint focus:border-ash"
                placeholder="Type the rep’s answer…"
              />
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={submit} disabled={!ready}>
          Submit debrief
        </Button>
        {!ready && (
          <p className="text-xs text-subtle">
            Answer every question to submit the debrief.
          </p>
        )}
      </div>
    </section>
  )
}