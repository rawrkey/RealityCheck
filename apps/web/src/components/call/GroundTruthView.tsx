import type { ReactNode } from 'react'
import type {
  Commitment,
  ConfidenceLevel,
  GroundTruthAnalysis,
  NextStep,
  ParticipantInsight,
  PricingSignal,
  StakeholderInsight,
} from '../../lib/types'
import { levelBadgeClass, pct, speakerBadgeClass, speakerLabel } from '../../lib/ui'
import { EvidenceBox } from './EvidenceBox'

type GroundTruthViewProps = {
  callId: string
  analysis: GroundTruthAnalysis
}

export function GroundTruthView({ callId, analysis }: GroundTruthViewProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Ground Truth</h2>
        <span className="text-xs text-slate-500">
          Initial extraction · {analysis.prompt_version}
        </span>
      </div>

      <div className="mt-5 grid gap-6">
        <AssessmentPanel assessment={analysis.initial_ground_truth_assessment} />

        <Section title="Participants" count={analysis.participants.length}>
          {analysis.participants.map((participant) => (
            <ParticipantRow key={participant.speaker_id} item={participant} callId={callId} />
          ))}
        </Section>

        <Section title="Objections" count={analysis.objections.length}>
          {analysis.objections.map((item) => (
            <ItemCard key={item.id} itemId={item.id} callId={callId}
              heading={formatCategory(item.category)}
              confidence={item.confidence}
              lines={[item.description]}
            />
          ))}
        </Section>

        <Section title="Buyer Signals" count={analysis.buyer_signals.length}>
          {analysis.buyer_signals.map((item) => (
            <ItemCard key={item.id} itemId={item.id} callId={callId}
              heading={formatSignalType(item.type)}
              confidence={item.confidence}
              lines={[item.description, `Sentiment: ${item.sentiment}`]}
            />
          ))}
        </Section>

        <Section title="Commitments" count={analysis.commitments.length}>
          {analysis.commitments.map((item) => (
            <CommitmentRow key={item.id} item={item} callId={callId} />
          ))}
        </Section>

        <Section title="Next Steps" count={analysis.next_steps.length}>
          {analysis.next_steps.map((item) => (
            <NextStepRow key={item.id} item={item} callId={callId} />
          ))}
        </Section>

        <Section title="Stakeholders" count={analysis.stakeholders.length}>
          {analysis.stakeholders.map((item) => (
            <StakeholderRow key={item.id} item={item} callId={callId} />
          ))}
        </Section>

        <Section title="Pricing / Budget" count={analysis.pricing_signals.length}>
          {analysis.pricing_signals.map((item) => (
            <PricingRow key={item.id} item={item} callId={callId} />
          ))}
        </Section>

        <Section title="Timeline" count={analysis.timeline_signals.length}>
          {analysis.timeline_signals.map((item) => (
            <ItemCard key={item.id} itemId={item.id} callId={callId}
              heading={formatTimelineType(item.timeline_type)}
              confidence={item.confidence}
              lines={[
                item.description,
                ...(item.date_reference ? [`Stated: ${item.date_reference}`] : []),
              ]}
            />
          ))}
        </Section>

        <Section title="Competition" count={analysis.competitor_mentions.length}>
          {analysis.competitor_mentions.map((item) => (
            <ItemCard key={item.id} itemId={item.id} callId={callId}
              heading={item.name}
              confidence={item.confidence}
              lines={item.context ? [item.context] : []}
            />
          ))}
        </Section>
      </div>
    </section>
  )
}

function AssessmentPanel({ assessment }: { assessment: GroundTruthAnalysis['initial_ground_truth_assessment'] }) {
  const rows: Array<{ label: string; level: ConfidenceLevel }> = [
    { label: 'Interest', level: assessment.interest_level },
    { label: 'Risk', level: assessment.risk_level },
    { label: 'Urgency', level: assessment.urgency_level },
  ]
  return (
    <div>
      <SectionTitle>Initial Deal Assessment (AI)</SectionTitle>
      <div className="mt-3 flex flex-wrap gap-3">
        {rows.map((row) => (
          <span
            key={row.label}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-4 py-1.5 text-sm"
          >
            <span className="text-slate-500">{row.label}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelBadgeClass(row.level)}`}>
              {row.level}
            </span>
          </span>
        ))}
        <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-4 py-1.5 text-sm text-slate-400">
          Confidence {pct(assessment.confidence)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Early evidence-based estimation — not the final Deal Reality verdict.
      </p>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div>
      <SectionTitle>
        {title} <span className="text-slate-600">({count})</span>
      </SectionTitle>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{children}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

function ItemCard({
  itemId,
  callId,
  heading,
  confidence,
  lines,
}: {
  itemId: string
  callId: string
  heading: string
  confidence: number
  lines: string[]
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{itemId}</span>
        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
          {pct(confidence)} confidence
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{heading}</p>
      {lines.map((line) => (
        <p key={line} className="mt-0.5 text-sm text-slate-300">{line}</p>
      ))}
      <div className="mt-2">
        <EvidenceBox callId={callId} itemId={itemId} idleLabel="Show evidence" />
      </div>
    </div>
  )
}

function ParticipantRow({ item, callId }: { item: ParticipantInsight; callId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${speakerBadgeClass(item.speaker_id)}`}>
          {speakerLabel(item.speaker_id)}
        </span>
        <span className="text-sm font-semibold text-white">
          {item.likely_role ?? 'unknown role'}
        </span>
        <span className="ml-auto rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
          {pct(item.confidence)}
        </span>
      </div>
      {item.evidence && (
        <p className="mt-2 text-sm text-slate-400">{item.evidence}</p>
      )}
      <div className="mt-2">
        <EvidenceBox
          callId={callId}
          utteranceIds={item.evidence_utterance_ids}
          idleLabel={item.evidence_utterance_ids.length ? 'Show evidence' : 'No transcript evidence'}
        />
      </div>
    </div>
  )
}

function CommitmentRow({ item, callId }: { item: Commitment; callId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${speakerBadgeClass(item.speaker_id)}`}>
          {speakerLabel(item.speaker_id)}
        </span>
        <span className="font-mono text-xs text-slate-500">{item.id}</span>
        <span className="ml-auto rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
          {pct(item.confidence)}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{item.commitment}</p>
      {item.deadline && <p className="text-xs text-slate-400">Deadline: {item.deadline}</p>}
      <div className="mt-2">
        <EvidenceBox callId={callId} itemId={item.id} idleLabel="Show evidence" />
      </div>
    </div>
  )
}

function NextStepRow({ item, callId }: { item: NextStep; callId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          {item.step_type === 'AGREED_NEXT_STEP' ? 'AGREED' : 'SUGGESTED'}
        </span>
        <span className="font-mono text-xs text-slate-500">{item.id}</span>
        <span className="ml-auto rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
          {pct(item.confidence)}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{item.description}</p>
      <p className="text-xs text-slate-400">
        {item.owner ? `Owner: ${speakerLabel(item.owner)} ` : ''}
        {item.deadline ? `· Deadline: ${item.deadline}` : ''}
      </p>
      <div className="mt-2">
        <EvidenceBox callId={callId} itemId={item.id} idleLabel="Show evidence" />
      </div>
    </div>
  )
}

function StakeholderRow({ item, callId }: { item: StakeholderInsight; callId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{item.id}</span>
        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
          {pct(item.confidence)}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold capitalize text-white">
        {item.stakeholder_type.replace(/_/g, ' ')}
      </p>
      {item.description && <p className="mt-0.5 text-sm text-slate-300">{item.description}</p>}
      <div className="mt-2">
        <EvidenceBox callId={callId} itemId={item.id} idleLabel="Show evidence" />
      </div>
    </div>
  )
}

function PricingRow({ item, callId }: { item: PricingSignal; callId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500">{item.id}</span>
        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
          {item.pricing_discussed ? 'Pricing discussed' : 'No pricing'}
        </span>
      </div>
      {item.stated_budget && <p className="mt-1 text-sm text-slate-300">Budget: <span className="font-semibold text-white">{item.stated_budget}</span></p>}
      {item.price_concern && <p className="text-sm text-slate-300">Concern: {item.price_concern}</p>}
      {item.competitor_price_reference && (
        <p className="text-sm text-slate-300">Competitor price: {item.competitor_price_reference}</p>
      )}
      <div className="mt-2">
        <EvidenceBox callId={callId} itemId={item.id} idleLabel="Show evidence" />
      </div>
    </div>
  )
}

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ')
}
function formatSignalType(type: string): string {
  return type.replace(/_/g, ' ')
}
function formatTimelineType(type: string): string {
  return type.replace(/_/g, ' ')
}