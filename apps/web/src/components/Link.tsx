import type { AnchorHTMLAttributes, ReactNode } from 'react'

export function Link({
  to,
  children,
  className,
  ...rest
}: {
  to: string
  children: ReactNode
  className?: string
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={`#${to}`} className={className} {...rest}>
      {children}
    </a>
  )
}
