import type { ReactNode } from 'react'
import { Link } from './Link'
import { useHashPath } from '../lib/router'
import { cx } from '../lib/cx'

function Wordmark({ muted = false }: { muted?: boolean }) {
  return (
    <span className="flex items-baseline gap-2 select-none">
      <span
        className={cx(
          'font-semibold tracking-tight text-[21px] leading-none',
          muted ? 'text-muted' : 'text-ink',
        )}
      >
        RealityCheck
      </span>
      <span className="inline-block h-2 w-px bg-warning rotate-[18deg]" aria-hidden="true" />
    </span>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useHashPath()
  const inCalls =
    pathname === '/calls' || pathname === '/' || pathname.startsWith('/calls/')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-50 border-b border-rule bg-canvas/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
          <Link to="/" aria-label="RealityCheck home">
            <Wordmark />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            <Link
              to="/calls"
              className={cx(
                'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                inCalls
                  ? 'text-ink bg-panel border border-rule'
                  : 'text-muted hover:text-ink hover:bg-vessel border border-transparent',
              )}
            >
              Calls
            </Link>
          </nav>

          <Link
            to="/calls"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-canvas transition-all hover:bg-white/95 active:scale-[0.98]"
          >
            Analyze a call
            <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </header>

      {children}
    </div>
  )
}