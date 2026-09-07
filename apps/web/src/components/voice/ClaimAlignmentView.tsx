import type { ClaimAlignment, RepClaim } from '../../lib/types'
import { dimensionLabel, pct, verdictBadgeClass } from '../../lib/ui'

type ClaimAlignmentViewProps = {
  claims: RepClaim[]
  alignments: ClaimAlignment[]
}

export function ClaimAlignmentView({ claims, alignments }: ClaimAlignmentViewProps) {
  if (alignments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No claims were extracted from the debrief yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {alignments.map((alignment) => {
        const claim = claims.find((c) => c.id === alignment.claim_id)
        return (
          <div
            key={alignment.claim_id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold text-white">
                {dimensionLabel(alignment.dimension)}
              </h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${verdictBadgeClass(alignment.verdict)}`}
              >
                {alignment.verdict}
              </span>
              {claim && (
                <span className="ml-auto text-xs text-slate-400">
                  Rep confidence {pct(claim.rep_confidence)}
                </span>
              )}
            </div>

            {claim && (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Rep claim: “{claim.claim}”
              </p>
            )}

            <p className="mt-2 text-xs text-slate-400">{alignment.summary}</p>

            {alignment.matched_analysis_ids.length > 0 && (
              <p className="mt-3 text-xs text-emerald-300/90">
                Matches {alignment.matched_analysis_ids.length} ground-truth analysis{' '}
                {alignment.matched_analysis_ids.length === 1 ? 'item' : 'items'}
              </p>
            )}

            {alignment.transcript_evidence.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-indigo-300 hover:text-indigo-200">
                  Show {alignment.transcript_evidence.length} transcript evidence{' '}
                  {alignment.transcript_evidence.length === 1 ? 'utterance' : 'utterances'}
                </summary>
                <ul className="mt-3 space-y-2">
                  {alignment.transcript_evidence.map((evidence) => (
                    <li
                      key={evidence.utterance_id}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <p className="text-xs text-slate-500">
                        {evidence.speaker} · {evidence.timestamp} · {evidence.utterance_id}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-300">
                        “{evidence.text}”
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}