import { useEffect, useState } from 'react'

function getPath(): string {
  return (window.location.hash || '#/').slice(1) || '/'
}

export function useHashPath(): string {
  const [path, setPath] = useState(getPath)

  useEffect(() => {
    const onHashChange = () => setPath(getPath())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return path
}

export function navigate(to: string): void {
  const target = to.startsWith('#') ? to : `#${to}`
  if (window.location.hash === target) return
  window.location.hash = target
}
