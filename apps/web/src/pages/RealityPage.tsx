import { useCallback, useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { StatusBadge } from '../components/call/StatusBadge'
import { buildReality, getCall, getReality } from '../lib/api'
import type { CallRecord, DealReality } from '../lib/types'
import { pct, priorityBadgeClass, riskBadgeClass } from '../lib/ui'

type RealityPageProps = {
  callId: string
  onBack: () => void
}

export default function RealityPage({ callId, onBack }: RealityPageProps) {
  const [call, setCall] = useState<CallRecord | null>(null)
  const [reality, setReality] = useState<DealReality | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReality = useCallback(() => {
    setError(null)
    void buildReality(callId)
      .then(setReality)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [callId])

  useEffect(() => {
    let cancelled = false
    void getCall(callId)
      .then((loadedCall) => {
        if (!cancelled) setCall(loadedCall)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    void getReality(callId)
      .then((loaded) => {
        if (!cancelled) setReality(loaded)
      })
      .catch(() => {
        if (!cancelled) loadReality()
      })
    return () => {
      cancelled = true
    }
  }, [callId, loadReality])

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Deal Reality <span className="text-slate-500">· {callId}</span>
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

        {error && (
          <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!reality && !error && <p className="text-sm text-slate-400">Deriving deal reality…</p>}

        {reality && (
          <>
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-semibold text-white">Summary</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${riskBadgeClass(reality.risk_level)}`}
                >
                  {reality.risk_level} risk
                </span>
                <span className="ml-auto rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
                  {reality.prompt_version}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{reality.summary}</p>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Perception ↔ evidence alignment</span>
                  <span>
                    {reality.aligned_count} / {reality.total_count} aligned
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      reality.alignment_score >= 0.75
                        ? 'bg-emerald-500'
                        : reality.alignment_score >= 0.5
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${pct(reality.alignment_score)}` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {pct(reality.alignment_score)} of claims are supported by the original
                  call transcript.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-white">
                Blind spots ({reality.blind_spots.length})
              </h2>
              {reality.blind_spots.length === 0 && (
                <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  None. Every rep claim aligns with what actually happened on the call.
                </p>
              )}
              {reality.blind_spots.map((spot) => (
                <div
                  key={spot.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <h3 className="text-sm font-semibold text-amber-300">{spot.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                    {spot.description}
                  </p>
                  {spot.transcript_evidence.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-indigo-300 hover:text-indigo-200">
                        Show transcript evidence
                      </summary>
                      <ul className="mt-3 space-y-2">
                        {spot.transcript_evidence.map((evidence) => (
                          <li
                            key={evidence.utterance_id}
                            className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                          >
                            <p className="text-xs text-slate-500">
                              {evidence.speaker} · {evidence.timestamp} · {evidence.utterance_id}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">“{evidence.text}”</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-white">
                Recommended actions ({reality.recommendations.length})
              </h2>
              {reality.recommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadgeClass(recommendation.priority)}`}
                    >
                      {recommendation.priority}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{recommendation.action}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {recommendation.rationale}
                  </p>
                </div>
              ))}
            </section>

            <p className="text-center text-[11px] text-slate-600">
              Derived from rep debrief claims vs. ground-truth transcript analysis ·
              {reality.created_at}
            </p>
          </>
        )}
      </main>
    </>
  )
}