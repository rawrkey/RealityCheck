import { useState } from 'react'
import type { Transcript } from '../../lib/types'
import { speakerBadgeClass, speakerLabel } from '../../lib/ui'
import { EvidenceBox } from './EvidenceBox'

type TranscriptViewProps = {
  callId: string
  transcript: Transcript
}

export function TranscriptView({ callId, transcript }: TranscriptViewProps) {
  const [query, setQuery] = useState('')

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Transcript</h2>
        <span className="text-xs text-slate-500">
          {transcript.utterances.length} utterances ·{' '}
          {formatDuration(transcript.duration_seconds)}
        </span>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="mt-4 flex items-center gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcript evidence, e.g. budget, security..."
          className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
        />
        {query.trim() && (
          <EvidenceBox
            callId={callId}
            query={query.trim()}
            idleLabel="Search"
          />
        )}
      </form>

      <ol className="mt-4 space-y-3">
        {transcript.utterances.map((utterance) => (
          <li key={utterance.id} className="flex gap-3">
            <span className="w-16 shrink-0 pt-1 text-right font-mono text-xs text-slate-600">
              {formatMs(utterance.start_ms)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${speakerBadgeClass(utterance.speaker)}`}
                >
                  {speakerLabel(utterance.speaker)}
                </span>
                <span className="font-mono text-[11px] text-slate-600">
                  {utterance.id}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {utterance.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s}s`
}