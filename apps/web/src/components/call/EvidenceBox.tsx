import { useState } from 'react'
import { getEvidence } from '../../lib/api'
import type { EvidenceItem } from '../../lib/types'
import { speakerLabel } from '../../lib/ui'
import { navigate, useHashPath } from '../../lib/router'
import {
  emitHighlight,
  requestViewInTranscript,
} from '../../lib/transcriptHighlight'

type EvidenceBoxProps = {
  callId: string
  itemId?: string
  utteranceIds?: string[]
  query?: string
  idleLabel: string
}

export function EvidenceBox({
  callId,
  itemId,
  utteranceIds,
  query,
  idleLabel,
}: EvidenceBoxProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<EvidenceItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const pathname = useHashPath()
  const isTranscriptView = pathname.endsWith('/transcript')

  async function load() {
    if (items !== null) {
      setOpen((value) => !value)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await getEvidence(callId, {
        analysis_item_id: itemId,
        utterance_ids: utteranceIds,
        query,
      })
      setItems(result)
      setOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence.')
    } finally {
      setLoading(false)
    }
  }

  function jumpToTranscript(utteranceId: string) {
    if (isTranscriptView) {
      emitHighlight(utteranceId)
      return
    }
    requestViewInTranscript(callId, utteranceId)
    navigate(`/calls/${callId}/transcript`)
  }

  const refCount = items?.length
  const expandLabel =
    refCount !== undefined ? `${idleLabel} · ${refCount} ref${refCount === 1 ? '' : 's'}` : idleLabel

  return (
    <div>
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        aria-expanded={open}
        className="text-xs font-medium text-subtle transition-colors hover:text-ink disabled:text-faint"
      >
        {loading
          ? 'Loading evidence…'
          : open
            ? 'Hide evidence'
            : expandLabel}
        {!loading && (
          <span className="ml-1.5 inline-block text-faint" aria-hidden="true">
            {open ? '–' : '+'}
          </span>
        )}
      </button>

      {error && <p className="mt-2 text-xs text-caution">{error}</p>}

      {open && (
        <div className="mt-3 rounded-md border border-rule border-l-2 border-l-warning/50 bg-vessel/60 p-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
            Evidence
          </p>

          {(!items || items.length === 0) && (
            <p className="mt-2 text-xs text-muted">No transcript evidence found.</p>
          )}

          {items && items.length > 0 && (
            <ul className="mt-3 divide-y divide-rule">
              {items.map((item) => (
                <li key={item.utterance_id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {speakerLabel(item.speaker)}
                    </span>
                    <span className="font-mono text-[10px] text-faint">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-ink">“{item.text}”</p>
                  {item.matched_reason && (
                    <p className="text-xs leading-relaxed text-subtle">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
                        Why this matters:{' '}
                      </span>
                      {item.matched_reason}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => jumpToTranscript(item.utterance_id)}
                    className="self-start text-xs font-medium text-info transition-colors hover:text-ink"
                  >
                    View in transcript →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}