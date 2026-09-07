import type { CallStatus } from '../../lib/types'

type StatusBadgeProps = {
  status: CallStatus
  errorMessage?: string | null
}

const STYLES: Record<CallStatus, string> = {
  uploaded: 'bg-slate-500/20 text-slate-300',
  transcribing: 'bg-sky-500/20 text-sky-300',
  analyzing: 'bg-purple-500/20 text-purple-300',
  ready: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-rose-500/20 text-rose-300',
}

export function StatusBadge({ status, errorMessage }: StatusBadgeProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-white">Processing Status</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${STYLES[status]}`}
        >
          {status}
        </span>
      </div>

      {status === 'ready' && (
        <p className="mt-2 text-sm text-slate-400">
          The call was transcribed and ground-truth analysis completed.
        </p>
      )}
      {status === 'failed' && errorMessage && (
        <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {errorMessage}
        </p>
      )}
    </section>
  )
}