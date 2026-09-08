import type { CallStatus } from '../../lib/types'
import { callStatusMeta } from '../../lib/ui'
import { cx } from '../../lib/cx'

export function StatusPill({ status }: { status: CallStatus }) {
  const meta = callStatusMeta(status)
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rule bg-vessel px-2.5 py-1">
      <span className={cx('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
      <span
        className={cx(
          'font-mono text-[10px] font-semibold uppercase tracking-widest',
          meta.text,
        )}
      >
        {meta.label}
      </span>
    </span>
  )
}