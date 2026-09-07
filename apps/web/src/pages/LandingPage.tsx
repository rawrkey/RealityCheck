import { Header } from '../components/Header'
import { CtaButton } from '../components/CtaButton'

type LandingPageProps = {
  onStartDemo: () => void
}

export default function LandingPage({ onStartDemo }: LandingPageProps) {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-5xl flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-white sm:text-6xl">
          RealityCheck
        </h1>
        <p className="mt-6 max-w-2xl text-xl text-slate-400">
          AI that challenges your sales call.
        </p>
        <p className="mt-4 max-w-xl text-sm text-slate-500">
          Your salesperson thinks the deal went well. Our AI proves whether
          they're right.
        </p>
        <div className="mt-10">
          <CtaButton onClick={onStartDemo} />
        </div>
      </main>
    </>
  )
}