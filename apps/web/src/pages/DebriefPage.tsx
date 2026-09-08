import { useEffect, useState } from 'react'
import { StatusBadge } from '../components/call/StatusBadge'
import { ClaimAlignmentView } from '../components/voice/ClaimAlignmentView'
import { VoiceSession } from '../components/voice/VoiceSession'
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
  InterrogationMessage,
  InterrogationSession,
  RepClaim,
} from '../lib/types'

type Phase = 'loading' | 'idle' | 'active' | 'processing' | 'results' | 'error'

type DebriefPageProps = {
  callId: string
  onBack: () => void
  onReality: () => void
}

export default function DebriefPage({ callId, onBack, onReality }: DebriefPageProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [call, setCall] = useState<CallRecord | null>(null)
  const [session, setSession] = useState<InterrogationSession | null>(null)
  const [config, setConfig] = useState<InterrogationConfig | null>(null)
  const [claims, setClaims] = useState<RepClaim[]>([])
  const [alignments, setAlignments] = useState<ClaimAlignment[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const loadedCall = await getCall(callId)
        if (cancelled) return
        setCall(loadedCall)

        try {
          const loadedSession = await getInterrogationSession(callId)
          if (cancelled) return
          setSession(loadedSession)
          if (loadedSession.status === 'completed') {
            const debrief = await getDebrief(callId)
            if (cancelled) return
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
          if (!cancelled) setConfig(loadedConfig)
        } catch {
          setConfig(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError))
          setPhase('error')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [callId])

  const begin = async () => {
    setError(null)
    try {
      const created = await startInterrogation(callId)
      setSession(created)
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
      setError(completeError instanceof Error ? completeError.message : String(completeError))
      setPhase('error')
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Voice Interrogation <span className="text-slate-500">· {callId}</span>
          </h1>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-slate-400 transition hover:text-slate-200"
          >
            ← Back
          </button>
        </div>

        {call && <StatusBadge status={call.status} errorMessage={call.error_message} />}

        {phase === 'loading' && <p className="text-sm text-slate-400">Loading…</p>}

        {phase === 'idle' && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-sm font-semibold text-white">Interrogate the rep</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              A Voice Agent will ask the rep the four standard questions — primary
              objection, buyer / decision-maker, deal interest &amp; risk, and next
              step — about this call. Each claim is aligned against the ground-truth
              transcript so you can see where perception and evidence drift apart.
            </p>
            <button
              type="button"
              onClick={begin}
              className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              Start interrogation
            </button>
          </div>
        )}

        {phase === 'active' && session && (
          <VoiceSession
            callId={callId}
            config={config}
            onComplete={handleComplete}
            onError={setError}
          />
        )}

        {phase === 'processing' && <p className="text-sm text-slate-400">Processing debrief…</p>}

        {phase === 'results' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">
                Rep perception vs. transcript evidence
              </h2>
              <span className="text-xs text-slate-400">
                {claims.length} claims · {alignments.length} alignments
              </span>
            </div>
            <ClaimAlignmentView claims={claims} alignments={alignments} />
          </>
        )}

        {phase === 'results' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onReality}
              className="ml-auto rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
            >
              View Deal Reality →
            </button>
          </div>
        )}

        {phase === 'error' && error && (
          <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}
      </main>
  )
}