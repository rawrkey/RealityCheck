import type { CallStatus } from '../../lib/types'
import { StatusPill } from './StatusPill'

type StatusBadgeProps = {
  status: CallStatus
  errorMessage?: string | null
}

export function StatusBadge({ status, errorMessage }: StatusBadgeProps) {
  return (
    <section className="rounded-lg border border-rule bg-panel p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-ink">Processing Status</h2>
        <StatusPill status={status} />
      </div>

      {status === 'ready' && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The call was transcribed and ground-truth analysis completed.
        </p>
      )}
      {status === 'failed' && errorMessage && (
        <p
          className="mt-2 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-2 text-sm leading-relaxed text-caution"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </section>
  )
}