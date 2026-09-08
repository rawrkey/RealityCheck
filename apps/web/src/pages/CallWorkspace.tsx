import { useCallback, useEffect, useRef, useState } from 'react'
import { GroundTruthView } from '../components/call/GroundTruthView'
import { TranscriptView } from '../components/call/TranscriptView'
import { UploadCall } from '../components/call/UploadCall'
import { Button, ButtonLink, Dot, Eyebrow, Panel } from '../components/ui'
import { cx } from '../lib/cx'
import { getCall, listCalls } from '../lib/api'
import type { CallRecord, CallStatus, CallSummary } from '../lib/types'
import { callStatusMeta, formatDate } from '../lib/ui'

function toSummary(call: CallRecord): CallSummary {
  return {
    id: call.id,
    original_filename: call.original_filename,
    created_at: call.created_at,
    status: call.status,
    error_message: call.error_message,
  }
}

function StatusPill({ status }: { status: CallStatus }) {
  const meta = callStatusMeta(status)
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rule bg-vessel px-2.5 py-1">
      <span className={cx('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
      <span
        className={cx(
          'font-mono text-[10px] font-semibold uppercase tracking-widest',
          meta.text,
        )}
      >
        {meta.label}
      </span>
    </span>
  )
}

type CallWorkspaceProps = {
  onBack: () => void
}

export default function CallWorkspace({ onBack }: CallWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [calls, setCalls] = useState<CallSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CallSummary | null>(null)
  const [details, setDetails] = useState<CallRecord | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setCalls(await listCalls())
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load calls.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listCalls()
      .then((items) => {
        if (!cancelled) {
          setCalls(items)
          setLoadError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load calls.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const anyPending =
    calls?.some((c) => c.status !== 'ready' && c.status !== 'failed') ?? false

  useEffect(() => {
    if (!anyPending) return
    const timer = window.setInterval(() => {
      void refresh()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [anyPending, refresh])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 5000)
    return () => window.clearTimeout(timer)
  }, [flash])

  async function openCall(call: CallSummary) {
    setSelected(call)
    setDetails(null)
    if (call.status !== 'ready') return
    try {
      setDetails(await getCall(call.id))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not open the call.')
    }
  }

  function closeCall() {
    setSelected(null)
    setDetails(null)
  }

  function handleProcessed(call: CallRecord) {
    setCalls((prev) =>
      prev
        ? [toSummary(call), ...prev.filter((c) => c.id !== call.id)]
        : [toSummary(call)],
    )
    setDetails(call)
    setSelected(toSummary(call))
    setFlash(call.original_filename)
  }

  const ready = details?.transcript && details?.analysis

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Post-call intelligence</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Calls
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Upload a recorded call. RealityCheck transcribes it, extracts the ground
            truth, and reads the rep's debrief against it.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-subtle transition-colors hover:text-ink"
          >
            Home
          </button>
          <Button onClick={() => inputRef.current?.click()}>
            Analyze a call
            <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
              →
            </span>
          </Button>
        </div>
      </div>

      {/* Upload */}
      <UploadCall onProcessed={handleProcessed} inputRef={inputRef} />

      {/* Success flash */}
      {flash && (
        <div
          className="flex items-center gap-2.5 rounded-md border border-sentiment/25 bg-sentiment/[0.06] px-4 py-3"
          role="status"
        >
          <Dot className="bg-sentiment" />
          <p className="text-sm text-sentiment">
            Call ready — <span className="font-medium">{flash}</span> is in your list.
          </p>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-caution">{loadError}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Retry
          </button>
        </div>
      )}

      {/* Call list */}
      {calls === null ? (
        <div className="flex items-center gap-3 rounded-md border border-rule bg-vessel/40 px-4 py-5 text-sm text-subtle">
          <span className="size-3 animate-spin rounded-full border border-rule-strong border-t-ink" />
          Loading calls…
        </div>
      ) : calls.length === 0 ? (
        <Panel className="py-14 text-center">
          <p className="mx-auto inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-subtle">
            <Dot className="bg-info" />
            No calls yet
          </p>
          <h2 className="mx-auto mt-4 max-w-md text-xl font-semibold tracking-tight text-white">
            Start with a real call
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Drop a recording above — or upload your first one now. RealityCheck transcribes
            it and prepares the ground truth for the debrief.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition-all hover:bg-white/95 active:scale-[0.98]"
          >
            Analyze a call
          </button>
        </Panel>
      ) : (
        <section aria-label="Calls">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">All calls</h2>
            <span className="font-mono text-[11px] uppercase tracking-widest text-subtle">
              {calls.length} {calls.length === 1 ? 'call' : 'calls'}
            </span>
          </div>

          <ul className="mt-3 divide-y divide-rule rounded-lg border border-rule">
            {calls.map((call) => {
              const isOpen = selected?.id === call.id
              return (
                <li key={call.id}>
                  <button
                    type="button"
                    onClick={() => (isOpen ? closeCall() : void openCall(call))}
                    aria-expanded={isOpen}
                    className={cx(
                      'group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors sm:gap-4 sm:px-5',
                      isOpen ? 'bg-panel' : 'hover:bg-panel/60',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm font-medium text-ink">
                        {call.original_filename}
                      </span>
                      <span className="mt-1 block text-xs text-subtle">
                        {formatDate(call.created_at)}
                      </span>
                    </span>

                    <StatusPill status={call.status} />

                    <span className="flex shrink-0 items-center justify-center">
                      {details?.id === call.id && !ready ? (
                        <span className="size-3 animate-spin rounded-full border border-rule-strong border-t-ink" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={cx(
                            'text-lg leading-none transition-transform',
                            isOpen
                              ? 'rotate-90 text-ink'
                              : 'text-subtle group-hover:text-ink',
                          )}
                        >
                          ›
                        </span>
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="space-y-5 border-t border-rule bg-panel/40 px-4 py-5 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Eyebrow>Call details</Eyebrow>
                        <div className="flex items-center gap-3">
                          <StatusPill status={call.status} />
                          {details?.status === 'ready' && (
                            <ButtonLink to={`/calls/${call.id}/debrief`} size="sm">
                              Debrief this call
                              <span
                                className="text-[10px] leading-none opacity-70"
                                aria-hidden="true"
                              >
                                →
                              </span>
                            </ButtonLink>
                          )}
                          <button
                            type="button"
                            onClick={closeCall}
                            className="rounded-md px-2 py-1 text-xs text-subtle transition-colors hover:text-ink"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      {call.status === 'failed' && call.error_message && (
                        <div
                          className="rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3 text-sm text-caution"
                          role="alert"
                        >
                          {call.error_message} — re-upload the file above.
                        </div>
                      )}

                      {call.status !== 'ready' && (
                        <div className="flex items-center gap-3 rounded-md border border-rule bg-vessel/40 px-4 py-5">
                          <span className="relative flex size-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-info" />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-ink">
                              This call is still{' '}
                              {callStatusMeta(call.status).label.toLowerCase()}.
                            </p>
                            <p className="text-xs text-subtle">
                              The list updates automatically once processing finishes.
                            </p>
                          </div>
                        </div>
                      )}

                      {details?.transcript && details?.analysis && (
                        <>
                          <TranscriptView
                            callId={details.id}
                            transcript={details.transcript}
                          />
                          <GroundTruthView
                            callId={details.id}
                            analysis={details.analysis}
                          />
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}