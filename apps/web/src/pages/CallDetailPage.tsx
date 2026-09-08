import { useCallback, useEffect, useState } from 'react'
import { getCall } from '../lib/api'
import type { CallRecord } from '../lib/types'
import { CallHeader } from '../components/call/CallHeader'
import { TranscriptView } from '../components/call/TranscriptView'
import { GroundTruthView } from '../components/call/GroundTruthView'
import { callStatusMeta } from '../lib/ui'
import { Elapsed, Skeleton } from '../components/ui'

type CallDetailPageProps = {
  callId: string
  section: 'transcript' | 'ground-truth'
  onBack: () => void
}

export default function CallDetailPage({
  callId,
  section,
  onBack,
}: CallDetailPageProps) {
  const [call, setCall] = useState<CallRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const loaded = await getCall(callId)
      setCall(loaded)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the call.')
    }
  }, [callId])

  useEffect(() => {
    let cancelled = false
    void getCall(callId)
      .then((loaded) => {
        if (cancelled) return
        setCall(loaded)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load the call.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [callId])

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
          // transient failure — keep polling
        })
    }, 4000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [pending, callId])

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
        <Skeleton className="h-64" />
      </main>
    )
  }

  const content =
    call.status === 'ready' && call.transcript && call.analysis ? (
      section === 'ground-truth' ? (
        <GroundTruthView callId={call.id} analysis={call.analysis} />
      ) : (
        <TranscriptView
          callId={call.id}
          transcript={call.transcript}
          participants={call.analysis.participants}
        />
      )
    ) : null

  return (
    <>
      <CallHeader call={call} section={section} onBack={onBack} />

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

        {call && pending && (
          <div className="flex items-center gap-3 rounded-md border border-rule bg-vessel/40 px-4 py-5">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-info" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                This call is still {callStatusMeta(call.status).label.toLowerCase()}.
              </p>
              <p className="text-xs text-subtle">
                Transcript and ground truth appear here once processing finishes.
              </p>
            </div>
            <Elapsed fromIso={call.created_at} className="text-xs" />
          </div>
        )}

        {content && <div className="animate-fade-cross">{content}</div>}
      </main>
    </>
  )
}