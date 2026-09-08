import type { CallRecord } from '../../lib/types'
import { StatusPill } from './StatusPill'
import { CallTabs } from './CallTabs'
import type { CallSection } from './CallTabs'
import { ButtonLink } from '../ui'
import { formatDate, formatDuration } from '../../lib/ui'

type CallHeaderProps = {
  call: CallRecord
  section?: CallSection
  onBack: () => void
}

export function CallHeader({ call, section, onBack }: CallHeaderProps) {
  const context: string[] = []
  if (call.transcript) {
    context.push(formatDuration(call.transcript.duration_seconds))
    context.push(`${call.transcript.utterances.length} utterances`)
    if (call.transcript.language) context.push(call.transcript.language)
  }
  const ready = call.status === 'ready'

  return (
    <header className="sticky top-16 z-30 border-b border-rule bg-canvas/85 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-subtle transition-colors hover:text-ink"
            >
              ← Calls
            </button>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate font-mono text-sm font-medium text-ink">
                {call.original_filename}
              </h1>
              <StatusPill status={call.status} />
            </div>
            <p className="mt-0.5 text-[11px] text-subtle">
              {formatDate(call.created_at)}
              {context.length > 0 ? ` · ${context.join(' · ')}` : ''}
            </p>
          </div>

          {ready && section !== 'debrief' && (
            <ButtonLink
              to={`/calls/${encodeURIComponent(call.id)}/debrief`}
              size="sm"
            >
              Start Debrief
              <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
                →
              </span>
            </ButtonLink>
          )}
        </div>

        {ready && (
          <div className="mt-3">
            <CallTabs callId={call.id} active={section ?? 'transcript'} />
          </div>
        )}
      </div>
    </header>
  )
}