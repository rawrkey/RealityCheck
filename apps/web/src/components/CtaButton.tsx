type CtaProps = {
  label?: string
  onClick?: () => void
}

export function CtaButton({ label = 'Start a Demo', onClick }: CtaProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
    >
      {label}
    </button>
  )
}