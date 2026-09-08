import type { ReactNode } from 'react'
import type {
  BuyerSignal,
  Commitment,
  CompetitorMention,
  ConfidenceLevel,
  GroundTruthAnalysis,
  NextStep,
  Objection,
  ParticipantInsight,
  PricingSignal,
  Sentiment,
  StakeholderInsight,
  TimelineSignal,
} from '../../lib/types'
import {
  pct,
  speakerDotClass,
  speakerLabel,
} from '../../lib/ui'
import { EvidenceBox } from './EvidenceBox'
import { Dot, Eyebrow } from '../ui'
import { cx } from '../../lib/cx'

type GroundTruthViewProps = {
  callId: string
  analysis: GroundTruthAnalysis
}

export function GroundTruthView({ callId, analysis }: GroundTruthViewProps) {
  const primary = pickPrimaryConcern(analysis)

  return (
    <section aria-label="Ground truth">
      <div className="max-w-2xl">
        <Eyebrow knob={<Dot className="mr-2 bg-warning" />}>Ground truth</Eyebrow>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          What the conversation tells us before the rep debrief.
        </h2>
      </div>

      {primary && <PrimaryConcern callId={callId} item={primary} />}

      <div className="mt-8">
        <Assessment assessment={analysis.initial_ground_truth_assessment} />
      </div>

      {analysis.participants.length > 0 && (
        <div className="mt-8">
          <ParticipantsSection callId={callId} participants={analysis.participants} />
        </div>
      )}

      <div className="mt-10 space-y-9">
        {analysis.objections.length > 0 && (
          <AnalysisSection title="Objections" count={analysis.objections.length}>
            {analysis.objections.map((item) => (
              <ObjectionRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        )}

        {analysis.buyer_signals.length > 0 && (
          <AnalysisSection title="Buyer Signals" count={analysis.buyer_signals.length}>
            {analysis.buyer_signals.map((item) => (
              <BuyerSignalRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        )}

        {analysis.stakeholders.length > 0 && (
          <AnalysisSection title="Stakeholders" count={analysis.stakeholders.length}>
            {analysis.stakeholders.map((item) => (
              <StakeholderRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        )}

        {analysis.commitments.length > 0 && (
          <AnalysisSection title="Commitments" count={analysis.commitments.length}>
            {analysis.commitments.map((item) => (
              <CommitmentRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        )}

        {analysis.next_steps.length > 0 && (
          <AnalysisSection title="Agreed Next Steps" count={analysis.next_steps.length}>
            {analysis.next_steps.map((item) => (
              <NextStepRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        )}

        {analysis.pricing_signals.length > 0 ? (
          <AnalysisSection title="Pricing / Budget" count={analysis.pricing_signals.length}>
            {analysis.pricing_signals.map((item) => (
              <PricingRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        ) : (
          <AnalysisSection
            title="Pricing / Budget"
            note="No explicit pricing discussion found."
          />
        )}

        {analysis.timeline_signals.length > 0 && (
          <AnalysisSection title="Timeline" count={analysis.timeline_signals.length}>
            {analysis.timeline_signals.map((item) => (
              <TimelineRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        )}

        {analysis.competitor_mentions.length > 0 && (
          <AnalysisSection title="Competition" count={analysis.competitor_mentions.length}>
            {analysis.competitor_mentions.map((item) => (
              <CompetitorRow key={item.id} callId={callId} item={item} />
            ))}
          </AnalysisSection>
        )}
      </div>
    </section>
  )
}

/* ---- Featured insight ---- */

function pickPrimaryConcern(analysis: GroundTruthAnalysis): Objection | null {
  if (analysis.objections.length === 0) return null
  return [...analysis.objections].sort((a, b) => {
    const diff = b.confidence - a.confidence
    if (diff !== 0) return diff
    return b.evidence_utterance_ids.length - a.evidence_utterance_ids.length
  })[0]
}

function PrimaryConcern({ callId, item }: { callId: string; item: Objection }) {
  const refs = item.evidence_utterance_ids.length
  return (
    <figure className="mt-7 rounded-lg border border-rule border-l-2 border-l-warning/60 bg-vessel/60 p-6">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-warning">
        Primary concern
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {formatCategory(item.category)}
      </h3>
      {item.description && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {item.description}
        </p>
      )}
      <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-subtle">
        {refs} supporting reference{refs === 1 ? '' : 's'} · {pct(item.confidence)} confidence
      </p>
      <div className="mt-3">
        <EvidenceBox callId={callId} itemId={item.id} idleLabel="Show evidence" />
      </div>
    </figure>
  )
}

/* ---- Initial assessment ---- */

const LEVEL_STYLES: Record<ConfidenceLevel, string> = {
  high: 'border-sentiment/30 bg-sentiment/[0.07] text-sentiment',
  medium: 'border-warning/30 bg-warning/[0.07] text-warning',
  low: 'border-caution/30 bg-caution/[0.07] text-caution',
  unknown: 'border-rule bg-panel text-muted',
}

function levelChip(level: ConfidenceLevel): string {
  return LEVEL_STYLES[level] ?? LEVEL_STYLES.unknown
}

function Assessment({ assessment }: { assessment: GroundTruthAnalysis['initial_ground_truth_assessment'] }) {
  const rows: Array<{ label: string; value: string; chip: string }> = [
    { label: 'Interest', value: assessment.interest_level, chip: levelChip(assessment.interest_level) },
    { label: 'Risk', value: assessment.risk_level, chip: levelChip(assessment.risk_level) },
    { label: 'Urgency', value: assessment.urgency_level, chip: levelChip(assessment.urgency_level) },
  ]
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-subtle">
        Initial assessment
      </p>
      <div className="mt-3 grid gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="bg-vessel p-4">
            <p className="text-[11px] uppercase tracking-widest text-subtle">{row.label}</p>
            <span
              className={cx(
                'mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium',
                row.chip,
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
        <div className="bg-vessel p-4">
          <p className="text-[11px] uppercase tracking-widest text-subtle">Confidence</p>
          <span className="mt-1.5 inline-block rounded-full border border-rule bg-panel px-2.5 py-0.5 font-mono text-xs text-ink">
            {pct(assessment.confidence)}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-subtle">
        Early evidence-based estimation — not the final Deal Reality verdict.
      </p>
    </div>
  )
}

/* ---- Participants ---- */

function ParticipantsSection({
  callId,
  participants,
}: {
  callId: string
  participants: ParticipantInsight[]
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">Participants</h3>
        <span className="font-mono text-[11px] uppercase tracking-widest text-subtle">
          Who was on the call
        </span>
      </div>
      <div className="mt-3 divide-y divide-rule rounded-md border border-rule bg-vessel/40">
        {participants.map((item) => (
          <div key={item.speaker_id} className="p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span
                  className={cx('size-1.5 rounded-full', speakerDotClass(item.speaker_id))}
                  aria-hidden="true"
                />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {speakerLabel(item.speaker_id)}
                </span>
              </span>
              {item.likely_role && (
                <span className="text-sm font-medium text-ink">{item.likely_role}</span>
              )}
              <span className="font-mono text-[11px] text-subtle">
                {pct(item.confidence)}
              </span>
            </div>
            {item.evidence && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.evidence}</p>
            )}
            <div className="mt-2.5">
              <EvidenceBox
                callId={callId}
                utteranceIds={item.evidence_utterance_ids}
                idleLabel={
                  item.evidence_utterance_ids.length
                    ? 'Show evidence'
                    : 'No transcript evidence'
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---- Shared section shell ---- */

function AnalysisSection({
  title,
  count,
  children,
  note,
}: {
  title: string
  count?: number
  children?: ReactNode
  note?: string
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {count !== undefined && (
          <span className="font-mono text-[11px] text-subtle">{count}</span>
        )}
      </div>
      {children ? (
        <div className="mt-3 divide-y divide-rule rounded-md border border-rule bg-vessel/40">
          {children}
        </div>
      ) : (
        note && <p className="mt-3 text-xs text-subtle">{note}</p>
      )}
    </section>
  )
}

function RowMeta({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-widest text-subtle">
      {children}
    </div>
  )
}

function ConfidenceLabel({ confidence }: { confidence: number }) {
  return <span className="font-mono text-[11px] normal-case tracking-normal text-subtle">
    {pct(confidence)}
  </span>
}

function EvidenceFoot({ callId, itemId }: { callId: string; itemId: string }) {
  return (
    <div className="mt-2.5">
      <EvidenceBox callId={callId} itemId={itemId} idleLabel="Show evidence" />
    </div>
  )
}

/* ---- Renderers ---- */

function ObjectionRow({ callId, item }: { callId: string; item: Objection }) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium capitalize text-ink">
          {formatCategory(item.category)}
        </span>
        <ConfidenceLabel confidence={item.confidence} />
      </div>
      {item.description && (
        <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

const SENTIMENT_CHIPS: Record<Sentiment, string> = {
  positive: 'border-sentiment/30 bg-sentiment/[0.07] text-sentiment',
  negative: 'border-caution/30 bg-caution/[0.07] text-caution',
  neutral: 'border-info/30 bg-info/[0.07] text-info',
}

function BuyerSignalRow({ callId, item }: { callId: string; item: BuyerSignal }) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium capitalize text-ink">
          {formatSignalType(item.type)}
        </span>
        <span
          className={cx(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium',
            SENTIMENT_CHIPS[item.sentiment],
          )}
        >
          {item.sentiment}
        </span>
        <span className="ml-auto">
          <ConfidenceLabel confidence={item.confidence} />
        </span>
      </div>
      {item.description && (
        <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

function StakeholderRow({ callId, item }: { callId: string; item: StakeholderInsight }) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium capitalize text-ink">
          {formatCategory(item.stakeholder_type)}
        </span>
        <ConfidenceLabel confidence={item.confidence} />
      </div>
      {item.description && (
        <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

function CommitmentRow({ callId, item }: { callId: string; item: Commitment }) {
  return (
    <div className="p-4">
      <RowMeta>
        <span className="flex items-center gap-1.5">
          <span
            className={cx('size-1.5 rounded-full', speakerDotClass(item.speaker_id))}
            aria-hidden="true"
          />
          {speakerLabel(item.speaker_id)}
        </span>
        <ConfidenceLabel confidence={item.confidence} />
      </RowMeta>
      <p className="mt-1.5 text-sm font-medium text-ink">{item.commitment}</p>
      {item.deadline && (
        <p className="mt-0.5 text-xs text-muted">Deadline: {item.deadline}</p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

function NextStepRow({ callId, item }: { callId: string; item: NextStep }) {
  const agreed = item.step_type === 'AGREED_NEXT_STEP'
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cx(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium',
            agreed
              ? 'border-sentiment/30 bg-sentiment/[0.07] text-sentiment'
              : 'border-info/30 bg-info/[0.07] text-info',
          )}
        >
          {agreed ? 'Agreed' : 'Suggested'}
        </span>
        <span className="ml-auto">
          <ConfidenceLabel confidence={item.confidence} />
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium text-ink">{item.description}</p>
      {(item.owner || item.deadline) && (
        <p className="mt-0.5 text-xs text-muted">
          {item.owner ? `${speakerLabel(item.owner)}` : ''}
          {item.owner && item.deadline ? ' · ' : ''}
          {item.deadline ? `Deadline: ${item.deadline}` : ''}
        </p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

function PricingRow({ callId, item }: { callId: string; item: PricingSignal }) {
  return (
    <div className="p-4">
      <RowMeta>
        <span>{item.pricing_discussed ? 'Pricing discussed' : 'No pricing'}</span>
      </RowMeta>
      {item.stated_budget && (
        <p className="mt-1.5 text-sm text-muted">
          Budget: <span className="font-medium text-ink">{item.stated_budget}</span>
        </p>
      )}
      {item.price_concern && (
        <p className="text-sm text-muted">Concern: {item.price_concern}</p>
      )}
      {item.competitor_price_reference && (
        <p className="text-sm text-muted">
          Competitor price: {item.competitor_price_reference}
        </p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

function TimelineRow({ callId, item }: { callId: string; item: TimelineSignal }) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium capitalize text-ink">
          {formatSignalType(item.timeline_type)}
        </span>
        <ConfidenceLabel confidence={item.confidence} />
      </div>
      {item.description && (
        <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
      )}
      {item.date_reference && (
        <p className="mt-0.5 text-xs text-muted">Stated: {item.date_reference}</p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

function CompetitorRow({ callId, item }: { callId: string; item: CompetitorMention }) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{item.name}</span>
        <ConfidenceLabel confidence={item.confidence} />
      </div>
      {item.context && (
        <p className="mt-1 text-sm leading-relaxed text-muted">{item.context}</p>
      )}
      <EvidenceFoot callId={callId} itemId={item.id} />
    </div>
  )
}

/* ---- Formatting ---- */

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ')
}

function formatSignalType(type: string): string {
  return type.replace(/_/g, ' ')
}