import { useState } from 'react'
import { getEvidence } from '../../lib/api'
import type { EvidenceItem } from '../../lib/types'
import { speakerBadgeClass, speakerLabel } from '../../lib/ui'

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

  return (
    <div>
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:text-slate-500"
      >
        {loading ? 'Loading evidence...' : open ? 'Hide evidence' : idleLabel}
      </button>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      {open && (
        <div className="mt-3 space-y-2">
          {items && items.length === 0 && (
            <p className="text-xs text-slate-500">No transcript evidence found.</p>
          )}
          {items?.map((item) => (
            <div
              key={item.utterance_id}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded border px-1.5 py-0.5 font-semibold ${speakerBadgeClass(item.speaker)}`}
                >
                  {speakerLabel(item.speaker)}
                </span>
                <span className="font-mono text-slate-500">{item.timestamp}</span>
                <span className="font-mono text-slate-600">{item.utterance_id}</span>
                <span className="text-slate-500">{item.matched_reason}</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">“{item.text}”</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}