import { useRef, useState } from 'react'
import { executeVoiceTool } from '../../lib/api'
import type {
  InterrogationConfig,
  InterrogationMessage,
} from '../../lib/types'
import { VoiceAgentClient, type VoiceAgentLogEntry } from '../../lib/voiceAgent'

const MANUAL_QUESTIONS = [
  'What was the buyer’s primary objection to moving forward?',
  'Who was the decision maker on the buyer’s side?',
  'How engaged was the buyer, and what risks did you sense?',
  'What is the agreed next step?',
]

type VoiceSessionProps = {
  callId: string
  config: InterrogationConfig | null
  onComplete: (messages: InterrogationMessage[]) => void
  onError: (message: string) => void
}

export function VoiceSession({ callId, config, onComplete, onError }: VoiceSessionProps) {
  const live = config !== null

  if (live) {
    return (
      <LiveVoiceSession
        callId={callId}
        config={config}
        onComplete={onComplete}
        onError={onError}
      />
    )
  }
  return <ManualVoiceSession onComplete={onComplete} onError={onError} />
}

type LiveVoiceSessionProps = VoiceSessionProps & {
  config: InterrogationConfig
}

function LiveVoiceSession({ callId, config, onComplete, onError }: LiveVoiceSessionProps) {
  const clientRef = useRef<VoiceAgentClient | null>(null)
  const [log, setLog] = useState<VoiceAgentLogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [ending, setEnding] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const logRef = useRef<VoiceAgentLogEntry[]>([])

  const appendLog = (entry: VoiceAgentLogEntry) => {
    logRef.current = [...logRef.current, entry]
    setLog(logRef.current)
  }

  const connect = async () => {
    const wsUrl = `${config.websocket_url}?token=${encodeURIComponent(config.token)}`
    const client = new VoiceAgentClient(
      wsUrl,
      config.session,
      {
        onLog: appendLog,
        onStatus: (text) => appendLog({ kind: 'system', text }),
        onError: (message) => onError(message),
        onToolCall: async (call) => {
          const response = await executeVoiceTool(callId, {
            name: call.name,
            arguments: call.arguments,
          })
          return response.result
        },
      },
    )
    clientRef.current = client
    try {
      await client.connect()
      setConnected(true)
      try {
        await client.startMic()
      } catch {
        setMicError('Could not open the microphone. The agent is still connected but cannot hear you.')
      }
    } catch (error) {
      client.close()
      clientRef.current = null
      onError(error instanceof Error ? error.message : String(error))
    }
  }

  const endSession = () => {
    const client = clientRef.current
    if (!client) return
    setEnding(true)
    client.end()
    setTimeout(() => {
      client.close()
      clientRef.current = null
      setConnected(false)
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
    setConnected(false)
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-white">Live voice interrogation</h3>
        <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
          AssemblyAI Voice Agent
        </span>
        {connected && !ending && (
          <button
            type="button"
            onClick={endSession}
            className="ml-auto rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/30"
          >
            End session
          </button>
        )}
        {connected && ending && (
          <span className="ml-auto text-xs text-slate-400">Finishing…</span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        The agent greets the rep, then asks questions about the four interrogation
        dimensions. Every claim it probes (“Who was the decision maker?”, “What was
        the main obstacle?”) is checked against the original call transcript.
      </p>

      {!connected && !ending && (
        <button
          type="button"
          onClick={connect}
          className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          Connect & start mic
        </button>
      )}

      {micError && <p className="mt-3 text-xs text-amber-300">{micError}</p>}

      {log.length > 0 && (
        <div className="mt-4 space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs">
          {log.map((entry, index) => (
            <p key={`${entry.kind}-${index}`} className="leading-relaxed">
              <span
                className={
                  entry.kind === 'rep'
                    ? 'text-sky-300'
                    : entry.kind === 'agent'
                      ? 'text-emerald-300'
                      : entry.kind === 'tool'
                        ? 'text-indigo-300'
                        : 'text-slate-500'
                }
              >
                {entry.kind === 'rep' ? 'rep' : entry.kind === 'agent' ? 'agent' : entry.kind}:
              </span>{' '}
              <span className="text-slate-200">{entry.text}</span>
            </p>
          ))}
        </div>
      )}

      {connected && !ending && (
        <button
          type="button"
          onClick={disconnect}
          className="mt-3 text-xs text-slate-400 transition hover:text-slate-200"
        >
          Disconnect without ending
        </button>
      )}
    </div>
  )
}

function ManualVoiceSession({
  onComplete,
  onError,
}: {
  onComplete: (messages: InterrogationMessage[]) => void
  onError: (message: string) => void
}) {
  const [answers, setAnswers] = useState<string[]>(MANUAL_QUESTIONS.map(() => ''))

  const ready = answers.every((answer) => answer.trim().length > 0)

  const submit = () => {
    if (!ready) {
      onError('Answer every question before submitting the debrief.')
      return
    }
    const messages: InterrogationMessage[] = []
    MANUAL_QUESTIONS.forEach((question, index) => {
      messages.push({ role: 'agent', text: question })
      messages.push({ role: 'rep', text: answers[index].trim() })
    })
    onComplete(messages)
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-white">Manual debrief (no API key)</h3>
        <span className="rounded-full border border-amber-700 px-2.5 py-0.5 text-xs text-amber-300">
          Demo mode
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        This environment has no AssemblyAI API key. Type the rep’s answers to the
        interrogation as if they'd been spoken, then submit. The debrief is processed
        exactly like a live session.
      </p>

      <div className="mt-4 space-y-4">
        {MANUAL_QUESTIONS.map((question, index) => (
          <label key={question} className="block">
            <span className="text-xs font-medium text-slate-300">{question}</span>
            <textarea
              value={answers[index]}
              onChange={(event) => {
                const next = [...answers]
                next[index] = event.target.value
                setAnswers(next)
              }}
              rows={2}
              className="mt-1.5 w-full resize-y rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
              placeholder="Type the rep’s answer…"
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        className={`mt-4 rounded-lg px-4 py-2 text-sm font-medium transition ${
          ready
            ? 'bg-indigo-500 text-white hover:bg-indigo-400'
            : 'cursor-not-allowed bg-slate-800 text-slate-500'
        }`}
      >
        Submit debrief
      </button>
    </div>
  )
}