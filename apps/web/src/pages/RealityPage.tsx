import { useCallback, useEffect, useState } from 'react'
import { CallHeader } from '../components/call/CallHeader'
import { EvidenceBox } from '../components/call/EvidenceBox'
import { ButtonLink, Dot, Elapsed, Eyebrow, Skeleton } from '../components/ui'
import { buildReality, getCall, getDebrief, getReality } from '../lib/api'
import type {
  AlignmentVerdict,
  CallRecord,
  ClaimAlignment,
  DealReality,
  DealRiskLevel,
  DebriefResponse,
  InterrogationDimension,
  Priority,
  RepClaim,
} from '../lib/types'
import { callStatusMeta, dimensionLabel, formatDate, pct } from '../lib/ui'
import { cx } from '../lib/cx'

type RealityPageProps = {
  callId: string
  onBack: () => void
}

const CANONICAL_DIMENSIONS: InterrogationDimension[] = [
  'primary_objection',
  'buyer_decision_maker',
  'deal_interest_risk',
  'next_step',
]

const ROW_GRID =
  'md:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,10.5rem)]'

const VERDICT_LABEL: Record<AlignmentVerdict, string> = {
  aligned: 'ALIGNED',
  misaligned: 'CONTRADICTED',
  unsupported: 'NO SUPPORTING EVIDENCE',
}

const VERDICT_STYLE: Record<
  AlignmentVerdict,
  { text: string; accent: string; dot: string }
> = {
  aligned: {
    text: 'text-sentiment',
    accent: 'border-l-sentiment/60',
    dot: 'bg-sentiment',
  },
  misaligned: {
    text: 'text-caution',
    accent: 'border-l-caution/60',
    dot: 'bg-caution',
  },
  unsupported: {
    text: 'text-subtle',
    accent: 'border-l-rule-strong',
    dot: 'bg-ash',
  },
}

const RISK_META: Record<
  DealRiskLevel,
  { word: string; text: string; dot: string; tag: string }
> = {
  low: {
    word: 'LOW',
    text: 'text-sentiment',
    dot: 'bg-sentiment',
    tag: 'DEAL ON TRACK',
  },
  medium: {
    word: 'MEDIUM',
    text: 'text-warning',
    dot: 'bg-warning',
    tag: 'PARTLY VERIFIED',
  },
  high: {
    word: 'HIGH',
    text: 'text-caution',
    dot: 'bg-caution',
    tag: 'NEEDS RE-VERIFICATION',
  },
}

const RISK_VERDICT: Record<DealRiskLevel, string> = {
  low: "The rep's read matches the call.",
  medium: "The rep's read is only partly supported.",
  high: "The rep's read diverges from the evidence.",
}

const RISK_VERDICT_UNKNOWN = "The rep's read couldn't be fully verified."

const PRIORITY_META: Record<Priority, { label: string; chip: string }> = {
  high: {
    label: 'HIGH PRIORITY',
    chip: 'bg-warning/10 text-warning border-warning/30',
  },
  medium: {
    label: 'MEDIUM PRIORITY',
    chip: 'bg-info/10 text-info border-info/30',
  },
  low: {
    label: 'LOW PRIORITY',
    chip: 'bg-panel text-subtle border-rule-strong',
  },
}

export default function RealityPage({ callId, onBack }: RealityPageProps) {
  const [call, setCall] = useState<CallRecord | null>(null)
  const [reality, setReality] = useState<DealReality | null>(null)
  const [debrief, setDebrief] = useState<DebriefResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debriefError, setDebriefError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setError(null)
    setDebriefError(null)
    try {
      const loadedCall = await getCall(callId)
      setCall(loadedCall)
      if (loadedCall.status !== 'ready') return

      let loadedDebrief: DebriefResponse | null = null
      try {
        loadedDebrief = await getDebrief(callId)
      } catch (debriefLoadError) {
        const status = (debriefLoadError as { status?: number })?.status
        if (status === 404) {
          loadedDebrief = null
        } else {
          setDebriefError(
            debriefLoadError instanceof Error
              ? debriefLoadError.message
              : String(debriefLoadError),
          )
        }
      }

      let loadedReality: DealReality | null = null
      try {
        const existing = await getReality(callId)
        const hasClaims = (loadedDebrief?.session.claims.length ?? 0) > 0
        const realityCreated = Date.parse(existing.created_at)
        const sessionUpdated = loadedDebrief
          ? Date.parse(loadedDebrief.session.updated_at)
          : 0
        loadedReality =
          hasClaims && sessionUpdated > realityCreated
            ? await buildReality(callId)
            : existing
      } catch {
        loadedReality = await buildReality(callId)
      }

      setDebrief(loadedDebrief)
      setReality(loadedReality)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    }
  }, [callId])

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

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
          /* transient failure — keep polling */
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
        <Skeleton className="h-64" />
        <Skeleton className="h-80" />
      </main>
    )
  }

  return (
    <>
      <CallHeader call={call} section="reality" onBack={onBack} />

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
                The Deal Reality opens once the call is transcribed and analyzed.
              </p>
            </div>
            <Elapsed fromIso={call.created_at} className="text-xs" />
          </div>
        )}

        {call.status === 'ready' && (
          <>
            {error && (
              <div
                className="flex items-center gap-3 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3 text-sm text-caution"
                role="alert"
              >
                <span>Deal Reality couldn't be loaded. {error}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="ml-auto text-xs font-medium text-muted transition-colors hover:text-ink"
                >
                  Retry
                </button>
              </div>
            )}

            {debriefError && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3 text-sm text-caution"
                role="alert"
              >
                <span>The debrief couldn't be retrieved: {debriefError}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-ink"
                >
                  Retry
                </button>
              </div>
            )}

            {!reality && !error && <RealitySkeleton />}

            {reality && !debriefError && (
              <RealityContent callId={callId} reality={reality} debrief={debrief} />
            )}

            {reality && debriefError && reality.total_count > 0 && (
              <RealityContent callId={callId} reality={reality} debrief={debrief} />
            )}
          </>
        )}
      </main>
    </>
  )
}

function RealitySkeleton() {
  return (
    <div className="mt-10 space-y-6">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-40" />
      <Skeleton className="h-80" />
    </div>
  )
}

function RealityContent({
  callId,
  reality,
  debrief,
}: {
  callId: string
  reality: DealReality
  debrief: DebriefResponse | null
}) {
  const claims = debrief?.session.claims ?? []
  const alignments = debrief?.alignments ?? []

  if (reality.total_count === 0) {
    return <EmptyReality reality={reality} debrief={debrief} />
  }

  return (
    <div className="animate-fade-cross">
      <div>
        <Eyebrow knob={<Dot className="mr-2 bg-warning" />}>
          Deal reality
        </Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
          Here's what the call actually tells us.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Your assessment, checked against the conversation. The rep's captured
          claims are compared with evidence from the original call — what held up,
          what drifted, and what to do about it.
        </p>
      </div>

      <RealityHero reality={reality} />

      <section className="mt-14">
        <SectionTitle eyebrow="Perception vs evidence" title="What the rep believed, against the record." />
        <div className="mt-4">
          <PerceptionEvidence callId={callId} claims={claims} alignments={alignments} />
        </div>
      </section>

      <WhatChanged claims={claims} alignments={alignments} />

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <BlindSpotList reality={reality} />
        <RecommendationList reality={reality} />
      </div>

      <DealHealth reality={reality} />

      <CompletionCta callId={callId} />

      <p className="mt-10 text-center font-mono text-[11px] text-faint">
        Rep debrief claims vs. ground-truth transcript analysis
        {reality.prompt_version ? ` · ${reality.prompt_version}` : ''}
        {reality.created_at ? ` · ${formatDate(reality.created_at)}` : ''}
      </p>
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  count,
}: {
  eyebrow: string
  title: string
  count?: number
}) {
  return (
    <div>
      <Eyebrow knob={<Dot className="mr-2 bg-warning" />}>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {title}
        {count !== undefined && (
          <span className="ml-2 align-top font-mono text-sm font-medium text-muted">
            {count}
          </span>
        )}
      </h2>
    </div>
  )
}

function RealityHero({ reality }: { reality: DealReality }) {
  const risk = RISK_META[reality.risk_level] ?? {
    word: 'UNKNOWN',
    text: 'text-muted',
    dot: 'bg-ash',
    tag: 'UNVERIFIED',
  }
  const riskVerdict = RISK_VERDICT[reality.risk_level] ?? RISK_VERDICT_UNKNOWN
  const score = pct(reality.alignment_score)
  const track =
    reality.alignment_score >= 0.75
      ? 'bg-sentiment'
      : reality.alignment_score >= 0.5
        ? 'bg-warning'
        : 'bg-caution'

  return (
    <section className="mt-10 grid gap-8 rounded-lg border border-rule bg-vessel p-6 animate-fade-cross sm:p-8 md:grid-cols-2">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
          Alignment
        </p>
        <p className="mt-3 text-6xl font-semibold tracking-tight text-ink tabular-nums sm:text-7xl">
          {score}
        </p>
        <div className="mt-4 h-0.5 max-w-64 rounded-full bg-panel" aria-hidden="true">
          <div className={cx('h-full rounded-full', track)} style={{ width: score }} />
        </div>
        <p className="mt-3 text-xs text-muted">
          {reality.aligned_count} of {reality.total_count} claims supported
        </p>
      </div>

      <div className="md:text-right">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-subtle">
          Deal risk
        </p>
        <p className={cx('mt-3 text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl', risk.text)}>
          {risk.word}
        </p>
        <p className={cx('mt-4 font-mono text-[11px] font-semibold uppercase tracking-widest', risk.text)}>
          {risk.tag}
        </p>
      </div>

      <div className="md:col-span-2 md:border-t md:border-rule md:pt-6">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {riskVerdict}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
          {reality.summary}
        </p>
      </div>
    </section>
  )
}

function PerceptionEvidence({
  callId,
  claims,
  alignments,
}: {
  callId: string
  claims: RepClaim[]
  alignments: ClaimAlignment[]
}) {
  if (alignments.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-vessel p-6 text-sm text-muted">
        No claims were extracted from the debrief yet, so there is nothing to
        compare.
      </div>
    )
  }

  const rows = CANONICAL_DIMENSIONS.map((dim) => ({
    dim,
    claim: claims.find((claim) => claim.dimension === dim) ?? null,
    alignment: alignments.find((alignment) => alignment.dimension === dim) ?? null,
  }))

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-vessel">
      <div
        className={cx(
          'hidden border-b border-rule px-5 py-3 md:grid md:gap-3',
          ROW_GRID,
        )}
      >
        {['Dimension', 'Rep believed', 'Evidence', 'Alignment'].map((heading) => (
          <p
            key={heading}
            className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle"
          >
            {heading}
          </p>
        ))}
      </div>
      <div className="divide-y divide-rule">
        {rows.map((row) => (
          <ComparisonRow key={row.dim} callId={callId} {...row} />
        ))}
      </div>
    </div>
  )
}

function ComparisonRow({
  callId,
  dim,
  claim,
  alignment,
}: {
  callId: string
  dim: InterrogationDimension
  claim: RepClaim | null
  alignment: ClaimAlignment | null
}) {
  const [open, setOpen] = useState(false)

  if (claim === null || alignment === null) {
    return (
      <div
        className={cx(
          'border-l-2 border-l-rule-strong/60 px-5 py-4 md:grid md:items-center md:gap-3',
          ROW_GRID,
        )}
      >
        <span className="block">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-faint md:hidden">
            Dimension
          </span>
          <span className="mt-1 block text-sm font-medium text-ink md:mt-0">
            {dimensionLabel(dim)}
          </span>
        </span>
        <span className="block">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-faint md:hidden">
            Rep believed
          </span>
          <span className="mt-1 block text-sm text-muted italic md:mt-0">
            No rep view
          </span>
        </span>
        <span className="block">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-faint md:hidden">
            Evidence
          </span>
          <span className="mt-1 block text-sm text-faint md:mt-0">—</span>
        </span>
        <span className="mt-2 flex items-center gap-1.5 text-subtle md:mt-0 md:justify-end">
          <span className="font-mono text-[11px] font-semibold tracking-widest" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-widest">
            NO REP VIEW
          </span>
        </span>
      </div>
    )
  }

  const verdict = VERDICT_STYLE[alignment.verdict]
  const evidence = alignment.transcript_evidence
  const preview =
    alignment.verdict === 'unsupported'
      ? 'No clear signal on the call.'
      : evidence.length > 0
        ? `“${evidence[0].text}”${
            evidence.length > 1 ? ` · ${evidence.length} references` : ''
          }`
        : alignment.summary

  return (
    <div className={cx('border-l-2', verdict.accent)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`cmp-${dim}`}
        className={cx(
          'block w-full px-5 py-4 text-left transition-colors hover:bg-soft/40 md:grid md:items-start md:gap-3',
          ROW_GRID,
        )}
      >
        <span className="block">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-faint md:hidden">
            Dimension
          </span>
          <span className="mt-1 block text-sm font-medium text-ink md:mt-0">
            {dimensionLabel(dim)}
          </span>
        </span>
        <span className="block">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-faint md:hidden">
            Rep believed
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-ink md:mt-0 md:line-clamp-2">
            {claim.claim}
          </span>
        </span>
        <span className="block">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-faint md:hidden">
            Evidence
          </span>
          <span
            className={cx(
              'mt-1 block text-sm leading-relaxed md:mt-0 md:line-clamp-2',
              evidence.length === 0 ? 'text-faint' : 'text-muted',
            )}
          >
            {preview}
          </span>
        </span>
        <span className="mt-2 flex items-center gap-1.5 md:mt-0 md:items-end md:justify-end">
          <span className={cx('font-mono text-[11px] font-semibold tracking-widest', verdict.text)}>
            {VERDICT_LABEL[alignment.verdict]}
          </span>
          <span className="font-mono text-[10px] text-faint" aria-hidden="true">
            {open ? '–' : '+'}
          </span>
        </span>
      </button>

      {open && (
        <div
          id={`cmp-${dim}`}
          className="grid gap-5 px-5 pb-6 pt-1 md:grid-cols-2 md:gap-8 animate-fade-cross"
        >
          <div className="rounded-md border border-rule bg-canvas/50 p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
              Rep claim
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">“{claim.claim}”</p>
            <p className="mt-2 text-xs text-subtle">
              Confidence {pct(claim.rep_confidence)}
            </p>
            {claim.question && (
              <p className="mt-3 text-xs leading-relaxed text-muted">{claim.question}</p>
            )}
          </div>
          <div className="rounded-md border border-rule bg-canvas/50 p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
              Evidence
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{alignment.summary}</p>
            {alignment.matched_analysis_ids.length > 0 && (
              <p className="mt-2 text-xs text-sentiment">
                Matches {alignment.matched_analysis_ids.length} ground-truth{' '}
                {alignment.matched_analysis_ids.length === 1 ? 'item' : 'items'}
              </p>
            )}
            <div className="mt-3">
              <EvidenceBox
                callId={callId}
                utteranceIds={evidence.map((item) => item.utterance_id)}
                idleLabel="Show evidence from the call"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WhatChanged({
  claims,
  alignments,
}: {
  claims: RepClaim[]
  alignments: ClaimAlignment[]
}) {
  if (alignments.length === 0) return null

  const items = CANONICAL_DIMENSIONS.map((dim) => ({
    dim,
    claim: claims.find((claim) => claim.dimension === dim) ?? null,
    alignment: alignments.find((alignment) => alignment.dimension === dim) ?? null,
  }))

  return (
    <section className="mt-12">
      <SectionTitle eyebrow="What changed" title="Where perception and evidence drift" />
      <ul className="mt-4 space-y-3 rounded-lg border border-rule bg-vessel p-5">
        {items.map((item) => (
          <ChangeRow key={item.dim} {...item} />
        ))}
      </ul>
    </section>
  )
}

function ChangeRow({
  dim,
  claim,
  alignment,
}: {
  dim: InterrogationDimension
  claim: RepClaim | null
  alignment: ClaimAlignment | null
}) {
  const label = dimensionLabel(dim)

  if (claim === null || alignment === null) {
    return (
      <li className="flex gap-3">
        <Dot className="mt-1.5 bg-faint" aria-hidden="true" />
        <div>
          <p className="text-sm leading-relaxed text-ink">
            <span className="text-muted">{label}: </span>No rep view captured
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-subtle">
            The rep didn't state a position on {label.toLowerCase()}.
          </p>
        </div>
      </li>
    )
  }

  const confidence = pct(claim.rep_confidence)
  let phrase: string
  let sub: string
  let dot: string
  if (alignment.verdict === 'aligned') {
    phrase = 'read correctly'
    sub = `The transcript supports this claim — confidence ${confidence}.`
    dot = 'bg-sentiment'
  } else if (alignment.verdict === 'misaligned') {
    phrase = 'read differently than the evidence'
    sub = `The call records something that doesn't match the rep's recall — confidence ${confidence}.`
    dot = 'bg-caution'
  } else {
    phrase = 'has no supporting evidence'
    sub = `The transcript has no clear signal for this dimension — confidence ${confidence}.`
    dot = 'bg-ash'
  }

  return (
    <li className="flex gap-3">
      <Dot className={cx('mt-1.5', dot)} aria-hidden="true" />
      <div>
        <p className="text-sm leading-relaxed text-ink">
          <span className="text-muted">{label}: </span>
          {phrase}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-subtle">{sub}</p>
      </div>
    </li>
  )
}

function BlindSpotList({ reality }: { reality: DealReality }) {
  return (
    <section>
      <SectionTitle
        eyebrow="Blind spots"
        title="What the rep missed"
        count={reality.blind_spots.length}
      />
      {reality.blind_spots.length === 0 && (
        <p className="mt-4 rounded-lg border border-rule bg-vessel p-5 text-sm leading-relaxed text-muted">
          No blind spots. Every claim the rep made was backed by the transcript.
        </p>
      )}
      {reality.blind_spots.length > 0 && (
        <ul className="mt-4 space-y-4">
          {reality.blind_spots.map((spot) => (
            <li key={spot.id} className="rounded-lg border border-rule bg-vessel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink">
                  {spot.title}
                </p>
                {spot.dimension && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
                    {dimensionLabel(spot.dimension)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{spot.description}</p>
              {spot.transcript_evidence.length > 0 && (
                <div className="mt-3">
                  <EvidenceBox
                    callId={reality.call_id}
                    utteranceIds={spot.transcript_evidence.map((item) => item.utterance_id)}
                    idleLabel="Show evidence from the call"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecommendationList({ reality }: { reality: DealReality }) {
  return (
    <section>
      <SectionTitle
        eyebrow="Recommended next actions"
        title="What to do about it"
        count={reality.recommendations.length}
      />
      {reality.recommendations.length === 0 && (
        <p className="mt-4 rounded-lg border border-rule bg-vessel p-5 text-sm leading-relaxed text-muted">
          No recommended actions. The rep's read held up against the evidence.
        </p>
      )}
      {reality.recommendations.length > 0 && (
        <ul className="mt-4 space-y-3">
          {reality.recommendations.map((recommendation) => {
            const priority = PRIORITY_META[recommendation.priority] ?? PRIORITY_META.low
            return (
              <li key={recommendation.id} className="rounded-lg border border-rule bg-vessel p-5">
                <span
                  className={cx(
                    'inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest',
                    priority.chip,
                  )}
                >
                  {priority.label}
                </span>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-ink">
                  {recommendation.action}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-faint">
                    Why ·{' '}
                  </span>
                  {recommendation.rationale}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function DealHealth({ reality }: { reality: DealReality }) {
  const risk = RISK_META[reality.risk_level] ?? {
    word: 'UNKNOWN',
    text: 'text-muted',
    dot: 'bg-ash',
    tag: 'UNVERIFIED',
  }
  const stats = [
    { label: 'Deal risk', value: risk.word, text: risk.text },
    { label: 'Alignment', value: pct(reality.alignment_score) },
    {
      label: 'Claims supported',
      value: `${reality.aligned_count} / ${reality.total_count}`,
    },
  ]

  return (
    <section className="mt-12">
      <SectionTitle eyebrow="Deal health" title="The deal at a glance" />
      <div className="mt-4 rounded-lg border border-rule bg-vessel p-5 sm:p-7">
        <div className="grid gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
                {stat.label}
              </p>
              <p
                className={cx(
                  'mt-2 text-3xl font-semibold tracking-tight tabular-nums',
                  stat.text ?? 'text-ink',
                )}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-rule pt-4 text-xs leading-relaxed text-subtle">
          Alignment is the share of the rep's captured claims the transcript
          evidence supported ({reality.aligned_count} of {reality.total_count}) — a
          count of verified claims, not an ML probability.
        </p>
      </div>
    </section>
  )
}

function CompletionCta({ callId }: { callId: string }) {
  const transcript = `/calls/${encodeURIComponent(callId)}/transcript`
  return (
    <section className="mt-14">
      <Eyebrow knob={<Dot className="mr-2 bg-warning" />}>
        Next: the evidence review
      </Eyebrow>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Close it out at the source.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        Every claim in this verdict points to a moment in the call. Follow the
        evidence back to the original conversation before the next touchpoint.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ButtonLink to={transcript} size="lg">
          Review the call
          <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
            →
          </span>
        </ButtonLink>
        <ButtonLink to={transcript} variant="secondary" size="lg">
          Back to Transcript
        </ButtonLink>
      </div>
    </section>
  )
}

function EmptyReality({
  reality,
  debrief,
}: {
  reality: DealReality
  debrief: DebriefResponse | null
}) {
  const hasSession = debrief !== null
  const label = hasSession ? 'Resume the voice debrief' : 'Begin the voice debrief'
  return (
    <section className="mt-10 rounded-lg border border-rule bg-vessel p-6 animate-fade-cross sm:p-10">
      <Eyebrow knob={<Dot className="mr-2 bg-warning" />}>Deal reality</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
        No Deal Reality yet.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        {reality.summary}
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-subtle">
        {hasSession
          ? 'The verdict appears here once the rep answers are captured and checked against the call.'
          : "The rep hasn't run the voice debrief yet. Capture their answers before showing the transcript, then the verdict appears here."}
      </p>
      <div className="mt-6">
        <ButtonLink
          to={`/calls/${encodeURIComponent(reality.call_id)}/debrief`}
          size="lg"
        >
          {label}
          <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
            →
          </span>
        </ButtonLink>
      </div>
    </section>
  )
}