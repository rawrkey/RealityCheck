import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'
import { Link } from './Link'

/* Tiny headless primitives — deliberately not a component library. */

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cx('mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10', className)}>
      {children}
    </main>
  )
}

export function Panel({
  children,
  className,
  variant = 'solid',
}: {
  children: ReactNode
  className?: string
  variant?: 'solid' | 'soft' | 'ghost'
}) {
  const surfaceClasses: Record<typeof variant, string> = {
    solid: 'bg-vessel border-rule',
    soft: 'bg-vessel/70 border-rule/70',
    ghost: 'bg-transparent border-none',
  }
  return (
    <section
      className={cx(
        'rounded-lg border p-5 sm:p-7',
        surfaceClasses[variant],
        className,
      )}
    >
      {children}
    </section>
  )
}

export function Eyebrow({ children, knob }: { children: ReactNode; knob?: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-subtle">
      {knob}
      {children}
    </p>
  )
}

export function Divider() {
  return <hr className="my-6 border-t border-rule" />
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-canvas hover:bg-white/95 active:scale-[0.98] tracking-tight font-semibold',
  secondary:
    'border border-rule-strong bg-transparent text-ink hover:bg-soft hover:border-ash',
  ghost: 'text-muted hover:text-ink',
  subtle: 'bg-panel border border-rule text-muted hover:text-ink hover:border-ash',
}

const sizeClass: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-md gap-1.5',
  sm: 'px-3.5 py-2 text-sm rounded-md gap-2',
  md: 'px-5 py-2.5 text-sm rounded-md gap-2',
  lg: 'px-7 py-3.5 text-base rounded-md gap-2.5',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-all focus-visible:outline-2 focus-visible:outline-warning disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {loading && (
        <svg
          className="h-[1em] w-[1em] animate-spin"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path
            d="M14.5 8 A6.5 6.5 0 0 1 8 14.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  )
}

export function Dot({ className }: { className?: string }) {
  return <span className={cx('inline-block size-[5px] rounded-full', className)} aria-hidden="true" />
}

type ButtonLinkProps = {
  to: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} & AnchorHTMLAttributes<HTMLAnchorElement>

export function ButtonLink({
  to,
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-2 focus-visible:outline-warning',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('rounded-md bg-panel relative overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rule/40 to-transparent animate-shimmer" />
    </div>
  )
}
