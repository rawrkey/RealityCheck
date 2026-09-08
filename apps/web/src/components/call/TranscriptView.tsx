import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ParticipantInsight,
  Speaker,
  Transcript,
  Utterance,
} from '../../lib/types'
import { formatDuration, formatTimestampMs, pct, speakerDotClass, speakerLabel } from '../../lib/ui'
import { cx } from '../../lib/cx'
import {
  consumeViewInTranscript,
  HIGHLIGHT_EVENT,
} from '../../lib/transcriptHighlight'

type TranscriptViewProps = {
  callId: string
  transcript: Transcript
  participants?: ParticipantInsight[]
}

type RoleMap = Record<Speaker, { role: string; confidence: number } | undefined>

function buildRoleMap(participants?: ParticipantInsight[]): RoleMap {
  const map = {} as RoleMap
  for (const participant of participants ?? []) {
    if (participant.likely_role) {
      map[participant.speaker_id] = {
        role: participant.likely_role,
        confidence: participant.confidence,
      }
    }
  }
  return map
}

export function TranscriptView({ callId, transcript, participants }: TranscriptViewProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Speaker | 'ALL'>('ALL')
  const [matchIndex, setMatchIndex] = useState(0)
  const [highlightId, setHighlightId] = useState<string | null>(() =>
    consumeViewInTranscript(callId) ?? null,
  )
  const highlightTimer = useRef<number | null>(null)

  const roles = useMemo(() => buildRoleMap(participants), [participants])
  const speakers = useMemo(
    () =>
      Array.from(new Set(transcript.utterances.map((u) => u.speaker))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [transcript.utterances],
  )

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      filter === 'ALL'
        ? transcript.utterances
        : transcript.utterances.filter((u) => u.speaker === filter),
    [transcript.utterances, filter],
  )

  const matches = useMemo(
    () => (q ? filtered.filter((u) => u.text.toLowerCase().includes(q)) : []),
    [filtered, q],
  )

  const flash = useCallback((utteranceId: string) => {
    setHighlightId(null)
    requestAnimationFrame(() => {
      setHighlightId(utteranceId)
    })
  }, [])

  useEffect(() => {
    const id = highlightId
    if (!id) return
    const el = document.getElementById(`u-${id}`)
    if (el) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    }
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 2600)
  }, [highlightId])

  useEffect(() => {
    const onHighlight = (event: Event) => {
      const detail = (event as CustomEvent).detail as { utteranceId?: string }
      if (detail?.utteranceId) flash(detail.utteranceId)
    }
    window.addEventListener(HIGHLIGHT_EVENT, onHighlight)
    return () => {
      window.removeEventListener(HIGHLIGHT_EVENT, onHighlight)
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current)
    }
  }, [flash])

  function stepMatch(delta: number) {
    if (matches.length === 0) return
    const next = (matchIndex + delta + matches.length) % matches.length
    setMatchIndex(next)
    flash(matches[next].id)
  }

  const resultCount = q ? matches.length : null

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-subtle">
            Original call · evidence source
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Transcript
          </h2>
        </div>
        <p className="text-xs text-subtle">
          {transcript.utterances.length} utterances ·{' '}
          {formatDuration(transcript.duration_seconds)}
          {transcript.language ? ` · ${transcript.language}` : ''}
        </p>
      </div>

      {/* Search + speaker filter */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setMatchIndex(0)
            }}
            placeholder="Search transcript text, e.g. budget, security…"
            aria-label="Search transcript text"
            className="w-full rounded-md border border-rule bg-vessel px-3.5 py-2 text-sm text-ink placeholder:text-faint focus:border-ash focus:outline-none md:w-72"
          />
          {resultCount !== null && matches.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => stepMatch(-1)}
                aria-label="Previous match"
                className="rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-panel hover:text-ink"
              >
                ‹
              </button>
              <span className="whitespace-nowrap font-mono text-[11px] text-subtle">
                {matches.length === 0 ? '0' : matchIndex + 1}/{matches.length}
              </span>
              <button
                type="button"
                onClick={() => stepMatch(1)}
                aria-label="Next match"
                className="rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-panel hover:text-ink"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Speaker filter */}
        <div
          role="group"
          aria-label="Filter by speaker"
          className="flex items-center gap-1 overflow-x-auto rounded-md border border-rule bg-vessel p-0.5"
        >
          <SpeakerFilterButton
            active={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
            label="All"
            roleLabel={null}
          />
          {speakers.map((speaker) => {
            const role = roles[speaker]
            return (
              <SpeakerFilterButton
                key={speaker}
                active={filter === speaker}
                onClick={() => setFilter(speaker)}
                label={speakerLabel(speaker)}
                roleLabel={
                  role
                    ? `${role.role} · ${pct(role.confidence)}`
                    : null
                }
                dot={speakerDotClass(speaker)}
              />
            )
          })}
        </div>
      </div>

      {q && resultCount === 0 && (
        <p className="mt-4 text-xs text-subtle">No matches in transcript.</p>
      )}

      {/* Utterances */}
      <ol className="mt-5 divide-y divide-rule border-y border-rule">
        {filtered.map((utterance) => (
          <UtteranceRow
            key={utterance.id}
            utterance={utterance}
            role={roles[utterance.speaker]}
            query={q}
            highlighted={highlightId === utterance.id}
          />
        ))}
      </ol>
    </section>
  )
}

function SpeakerFilterButton({
  active,
  onClick,
  label,
  roleLabel,
  dot,
}: {
  active: boolean
  onClick: () => void
  label: string
  roleLabel?: string | null
  dot?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-panel text-ink shadow-[inset_0_0_0_1px_#30363c]' : 'text-muted hover:text-ink',
      )}
    >
      {dot && (
        <span className={cx('size-1.5 rounded-full', dot)} aria-hidden="true" />
      )}
      {label}
      {roleLabel && (
        <span className="font-mono text-[10px] font-normal normal-case tracking-normal text-subtle">
          · {roleLabel}
        </span>
      )}
    </button>
  )
}

function UtteranceRow({
  utterance,
  role,
  query,
  highlighted,
}: {
  utterance: Utterance
  role?: { role: string; confidence: number }
  query: string
  highlighted: boolean
}) {
  return (
    <li
      id={`u-${utterance.id}`}
      className={cx(
        'flex scroll-mt-32 gap-4 rounded-md px-1 py-3.5 transition-colors duration-300 sm:px-2',
        highlighted
          ? 'bg-warning/[0.06] shadow-[inset_0_0_0_1px_rgba(243,201,102,0.3)]'
          : 'bg-transparent',
      )}
    >
      <span className="w-12 shrink-0 pt-2 text-right font-mono text-[11px] text-faint tabular-nums">
        {formatTimestampMs(utterance.start_ms)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className={cx('size-1.5 rounded-full', speakerDotClass(utterance.speaker))}
              aria-hidden="true"
            />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              {speakerLabel(utterance.speaker)}
            </span>
          </span>
          {role && (
            <span className="font-mono text-[10px] normal-case tracking-normal text-subtle">
              {role.role} · {pct(role.confidence)}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
          <HighlightedText text={utterance.text} query={query} />
        </p>
      </div>
    </li>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const index = text.toLowerCase().indexOf(query)
  if (index === -1) return <>{text}</>
  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)
  return (
    <>
      {before}
      <mark className="rounded-[2px] bg-warning/25 px-0.5 text-ink">{match}</mark>
      {after}
    </>
  )
}