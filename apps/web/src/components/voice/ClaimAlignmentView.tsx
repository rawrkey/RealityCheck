import type { AlignmentVerdict, ClaimAlignment, RepClaim } from '../../lib/types'
import { pct } from '../../lib/ui'
import { EvidenceBox } from '../call/EvidenceBox'

type ClaimAlignmentViewProps = {
  callId: string
  claims: RepClaim[]
  alignments: ClaimAlignment[]
}

const VERDICT_META: Record<AlignmentVerdict, { label: string; badge: string }> = {
  aligned: {
    label: 'Evidence supports this',
    badge: 'bg-sentiment-tint/60 text-sentiment border-sentiment/40',
  },
  misaligned: {
    label: 'Conflicts with evidence',
    badge: 'bg-caution-tint/60 text-caution border-caution/40',
  },
  unsupported: {
    label: 'No evidence found',
    badge: 'bg-panel text-subtle border-rule-strong',
  },
}

export function ClaimAlignmentView({
  callId,
  claims,
  alignments,
}: ClaimAlignmentViewProps) {
  if (alignments.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-vessel p-6 text-sm text-muted">
        No claims were extracted from the debrief yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {alignments.map((alignment) => {
        const claim = claims.find((c) => c.id === alignment.claim_id)
        const verdict = VERDICT_META[alignment.verdict] ?? VERDICT_META.unsupported
        return (
          <div
            key={alignment.claim_id}
            className="rounded-lg border border-rule bg-vessel p-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink">
                {dimensionTitle(alignment.dimension)}
              </h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${verdict.badge}`}
              >
                {verdict.label}
              </span>
              {claim && (
                <span className="ml-auto text-xs text-subtle">
                  Rep confidence {pct(claim.rep_confidence)}
                </span>
              )}
            </div>

            {claim && (
              <p className="mt-3 text-sm leading-relaxed text-ink">
                <span className="text-muted">Rep claim: </span>“{claim.claim}”
              </p>
            )}

            <p className="mt-2 text-xs leading-relaxed text-muted">
              {alignment.summary}
            </p>

            {alignment.matched_analysis_ids.length > 0 && (
              <p className="mt-3 text-xs text-sentiment">
                Matches {alignment.matched_analysis_ids.length} ground-truth{' '}
                {alignment.matched_analysis_ids.length === 1 ? 'item' : 'items'}
              </p>
            )}

            {alignment.transcript_evidence.length > 0 && (
              <div className="mt-4">
                <EvidenceBox
                  callId={callId}
                  utteranceIds={alignment.transcript_evidence.map(
                    (item) => item.utterance_id,
                  )}
                  idleLabel="Show evidence from the call"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function dimensionTitle(dimension: ClaimAlignment['dimension']): string {
  const titles: Record<ClaimAlignment['dimension'], string> = {
    primary_objection: 'Primary Objection',
    buyer_decision_maker: 'Buyer / Decision-Maker',
    deal_interest_risk: 'Deal Interest & Risk',
    next_step: 'Next Step',
  }
  return titles[dimension] ?? String(dimension).replace(/_/g, ' ')
}