import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCall } from '../components/call/UploadCall'
import { StatusPill } from '../components/call/StatusPill'
import { Button, Dot, Elapsed, Eyebrow, Panel } from '../components/ui'
import { cx } from '../lib/cx'
import { navigate } from '../lib/router'
import { isSampleCall, listCalls } from '../lib/api'
import type { CallRecord, CallSummary } from '../lib/types'
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

function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-rule-strong bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-subtle">
      Sample
    </span>
  )
}

type CallWorkspaceProps = {
  onBack: () => void
  onStartDemo: () => Promise<void>
}

export default function CallWorkspace({ onBack, onStartDemo }: CallWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [calls, setCalls] = useState<CallSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CallSummary | null>(null)
  const [flash, setFlash] = useState<{
    filename: string
    failed?: boolean
  } | null>(null)
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

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

  function openCall(call: CallSummary) {
    if (call.status === 'ready') {
      navigate(`/calls/${encodeURIComponent(call.id)}/transcript`)
      return
    }
    setSelected((current) => (current?.id === call.id ? null : call))
  }

  function handleProcessed(call: CallRecord) {
    setCalls((prev) =>
      prev
        ? [toSummary(call), ...prev.filter((c) => c.id !== call.id)]
        : [toSummary(call)],
    )
    setFlash({
      filename: call.original_filename,
      failed: call.status === 'failed',
    })
  }

  async function handleStartDemo() {
    setDemoBusy(true)
    setDemoError(null)
    try {
      await onStartDemo()
    } catch (error) {
      setDemoError(
        error instanceof Error ? error.message : 'Could not load the sample call.',
      )
    } finally {
      setDemoBusy(false)
    }
  }

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
          <Button variant="secondary" onClick={() => void handleStartDemo()} loading={demoBusy}>
            Load sample call
          </Button>
          <Button onClick={() => inputRef.current?.click()}>
            Analyze a call
            <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
              →
            </span>
          </Button>
        </div>
      </div>

      {demoError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-caution">{demoError}</p>
          <button
            type="button"
            onClick={() => void handleStartDemo()}
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Retry
          </button>
        </div>
      )}

      {/* Upload */}
      <UploadCall onProcessed={handleProcessed} inputRef={inputRef} />

      {/* Success flash */}
      {flash && (
        <div
          className={cx(
            'flex items-center gap-2.5 rounded-md border px-4 py-3',
            flash.failed
              ? 'border-caution/30 bg-caution/[0.06]'
              : 'border-sentiment/25 bg-sentiment/[0.06]',
          )}
          role={flash.failed ? 'alert' : 'status'}
        >
          <Dot className={flash.failed ? 'bg-caution' : 'bg-sentiment'} />
          {flash.failed ? (
            <p className="text-sm text-caution">
              Call failed — <span className="font-medium">{flash.filename}</span> wasn't
              processed. See its details below.
            </p>
          ) : (
            <p className="text-sm text-sentiment">
              Call ready — <span className="font-medium">{flash.filename}</span> is in your
              list.
            </p>
          )}
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
            Start with the sample call — or your own recording
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Explore the full flow against a bundled, pre-analyzed call, or upload a
            recording and let RealityCheck transcribe, analyze, and prepare the debrief.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => void handleStartDemo()} loading={demoBusy}>
              Load sample call
              <span className="text-[12px] leading-none opacity-70" aria-hidden="true">
                →
              </span>
            </Button>
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>
              Analyze a call
            </Button>
          </div>
          {demoError && (
            <p className="mt-4 text-sm text-caution" role="alert">
              {demoError}
            </p>
          )}
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
              const isReady = call.status === 'ready'
              return (
                <li key={call.id}>
                  <button
                    type="button"
                    onClick={() => openCall(call)}
                    aria-expanded={isOpen}
                    className={cx(
                      'group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors sm:gap-4 sm:px-5',
                      isOpen ? 'bg-panel' : 'hover:bg-panel/60',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block truncate font-mono text-sm font-medium text-ink">
                          {call.original_filename}
                        </span>
                        {isSampleCall(call.id) && <SampleBadge />}
                      </span>
                      <span className="mt-1 block text-xs text-subtle">
                        {formatDate(call.created_at)}
                      </span>
                    </span>

                    <StatusPill status={call.status} />

                    <span className="flex shrink-0 items-center justify-center">
                      {isReady ? (
                        <span className="text-xs font-medium text-subtle transition-colors group-hover:text-ink">
                          Open
                        </span>
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

                  {isOpen && !isReady && (
                    <div className="space-y-4 border-t border-rule bg-panel/40 px-4 py-5 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={call.status} />
                        <span className="text-xs text-subtle">
                          {formatDate(call.created_at)}
                        </span>
                      </div>

                      {call.status === 'failed' && call.error_message && (
                        <div
                          className="rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3 text-sm text-caution"
                          role="alert"
                        >
                          {call.error_message} — re-upload the file above.
                        </div>
                      )}

                      {call.status !== 'failed' && (
                        <div className="flex items-center gap-3 rounded-md border border-rule bg-vessel/40 px-4 py-5">
                          <span className="relative flex size-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-info" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink">
                              This call is still{' '}
                              {callStatusMeta(call.status).label.toLowerCase()}.
                            </p>
                            <p className="text-xs text-subtle">
                              The list updates automatically once processing finishes.
                            </p>
                          </div>
                          <Elapsed fromIso={call.created_at} className="text-xs" />
                        </div>
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