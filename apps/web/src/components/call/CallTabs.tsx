import { Link } from '../Link'
import { cx } from '../../lib/cx'

export type CallSection = 'transcript' | 'ground-truth' | 'debrief' | 'reality'

const SECTIONS: Array<{ id: CallSection; label: string }> = [
  { id: 'transcript', label: 'Transcript' },
  { id: 'ground-truth', label: 'Ground Truth' },
  { id: 'debrief', label: 'Debrief' },
  { id: 'reality', label: 'Deal Reality' },
]

export function CallTabs({
  callId,
  active,
}: {
  callId: string
  active: CallSection
}) {
  return (
    <nav aria-label="Call workflow" className="overflow-x-auto">
      <div className="flex w-max items-center gap-0.5 rounded-md border border-rule bg-vessel p-0.5">
        {SECTIONS.map((section, index) => {
          const isActive = section.id === active
          return (
            <Link
              key={section.id}
              to={`/calls/${encodeURIComponent(callId)}/${section.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={cx(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-panel text-ink shadow-[inset_0_0_0_1px_#30363c]'
                  : 'text-muted hover:text-ink',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'font-mono text-[9px] tabular-nums',
                  isActive ? 'text-warning' : 'text-faint',
                )}
              >
                {index + 1}
              </span>
              {section.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}