import { Logo } from '../components/Logo'

export function Header() {
  return (
    <header className="border-b border-slate-800/80">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Logo />
        <nav className="text-sm text-slate-400">
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
            Voice Interrogation
          </span>
        </nav>
      </div>
    </header>
  )
}
