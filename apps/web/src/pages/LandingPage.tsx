import { ButtonLink, Dot, Eyebrow, Panel } from '../components/ui'

const FLOW_STEPS = [
  {
    index: '01',
    title: 'Original Call',
    body: 'A recorded call is transcribed and mined for ground truth — objections, signals, commitments, next steps.',
  },
  {
    index: '02',
    title: 'Voice Debrief',
    body: 'RealityCheck asks the rep the four standard questions and captures their answers.',
  },
  {
    index: '03',
    title: 'Evidence Check',
    body: 'Every claim is aligned against the transcript. Perception, measured against evidence.',
  },
  {
    index: '04',
    title: 'Deal Reality',
    body: 'The reveal: what the rep believed, versus what the call actually shows.',
  },
]

const DIMENSIONS = [
  {
    index: '01',
    title: 'Primary objection',
    body: 'What the buyer actually pushed back on — confirmed word for word.',
  },
  {
    index: '02',
    title: 'Decision maker',
    body: 'Who really decides, confirmed from signals instead of assumption.',
  },
  {
    index: '03',
    title: 'Deal interest & risk',
    body: 'How real the momentum is, measured against buyer behavior.',
  },
  {
    index: '04',
    title: 'Next step',
    body: 'The commitment that was actually made, and the deadline attached to it.',
  },
]

export default function LandingPage({ onStartDemo }: { onStartDemo: () => void }) {
  return (
    <main className="pb-24">
      {/* HERO */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 md:py-32">
          <p className="animate-rise-in font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">
            RealityCheck / Post-call intelligence
          </p>
          <h1
            className="mt-7 max-w-3xl animate-rise-in text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '70ms' }}
          >
            Your sales call.
            <span className="block text-muted">Without the salesperson's bias.</span>
          </h1>
          <p
            className="mt-7 max-w-xl animate-rise-in text-base leading-relaxed text-muted sm:text-lg"
            style={{ animationDelay: '140ms' }}
          >
            RealityCheck debriefs sales reps after the call, challenges their assumptions
            against transcript evidence, and surfaces what the deal actually needs next.
          </p>
          <div
            className="mt-11 flex flex-wrap items-center gap-5 animate-rise-in"
            style={{ animationDelay: '210ms' }}
          >
            <ButtonLink to="/calls" size="lg" onClick={onStartDemo}>
              Start a Demo
              <span className="text-[12px] leading-none opacity-70" aria-hidden="true">
                →
              </span>
            </ButtonLink>
            <button
              type="button"
              onClick={() => {
                const reduced = window.matchMedia(
                  '(prefers-reduced-motion: reduce)',
                ).matches
                document
                  .getElementById('dimensions')
                  ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
              }}
              className="text-sm font-medium text-muted underline decoration-rule-strong underline-offset-4 transition-colors hover:text-ink"
            >
              See the four questions
            </button>
          </div>
        </div>
      </section>

      {/* THE SPLIT */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24">
          <Eyebrow knob={<Dot className="mr-2 bg-info" />}>
            The split — illustrating the concept
          </Eyebrow>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            The rep remembers a good call. Evidence decides.
          </h2>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <Panel className="h-full">
              <Eyebrow>Rep said</Eyebrow>
              <blockquote className="mt-4 max-w-sm text-xl font-medium tracking-tight text-ink sm:text-2xl">
                “Pricing was the main objection.”
              </blockquote>
              <p className="mt-5 text-xs text-muted">
                Captured from a real debrief, as the rep described the call.
              </p>
            </Panel>

            <div
              className="flex select-none items-center justify-center lg:h-full"
              aria-hidden="true"
            >
              <span className="hidden flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-subtle lg:flex">
                <span className="h-8 w-px bg-rule-strong" />
                Challenged against
                <span className="h-8 w-px bg-rule-strong" />
              </span>
              <span className="text-subtle lg:hidden" aria-hidden="true">
                ↓
              </span>
            </div>

            <Panel className="h-full border-info/25 bg-vessel">
              <Eyebrow knob={<Dot className="mr-2 animate-signal-ping bg-warning" />}>
                RealityCheck found
              </Eyebrow>
              <blockquote className="mt-4 max-w-sm text-xl font-medium tracking-tight text-ink sm:text-2xl">
                Security came up 5×. Pricing was mentioned once.
              </blockquote>

              <div className="mt-6 border-t border-rule pt-4">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-muted">Interest</span>
                  <span className="flex items-center gap-2 text-subtle">
                    <span className="text-muted">Rep: high</span>
                    <span className="font-mono text-[10px] text-subtle">vs</span>
                    <span className="text-ink">Evidence: medium</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-xs">
                  <span className="text-muted">Objection</span>
                  <span className="flex items-center gap-2 text-subtle">
                    <span className="text-muted">Rep: pricing</span>
                    <span className="font-mono text-[10px] text-subtle">vs</span>
                    <span className="font-medium text-caution">evidence: security</span>
                  </span>
                </div>
              </div>
            </Panel>
          </div>

          <p className="mt-6 text-xs text-faint">
            Illustrative example of the claim-vs-evidence comparison.
          </p>
        </div>
      </section>

      {/* PRODUCT FLOW */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24">
          <Eyebrow>The flow</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            From call recording to decision
          </h2>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            {FLOW_STEPS.map((step) => (
              <li key={step.index} className="bg-canvas p-6">
                <p className="font-mono text-sm font-semibold text-warning">
                  {step.index}
                </p>
                <h3 className="mt-4 text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FOUR DIMENSIONS */}
      <section id="dimensions" className="scroll-mt-24 border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24">
          <Eyebrow>Four dimensions, tested against evidence</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            What the debrief puts on the line
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Every answer the rep gives is checked against the original call — not taken
            at face value.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2">
            {DIMENSIONS.map((dim) => (
              <div key={dim.index} className="bg-vessel/40 p-6">
                <p className="font-mono text-sm text-warning">{dim.index}</p>
                <h3 className="mt-3 text-sm font-semibold text-ink">{dim.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{dim.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section>
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 md:py-28">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            See what the rep missed.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted">
            Upload a call, get the ground truth, and take the next step the deal actually
            needs.
          </p>
          <div className="mt-9">
            <ButtonLink to="/calls" size="lg" onClick={onStartDemo}>
              Analyze a call
              <span className="text-[12px] leading-none opacity-70" aria-hidden="true">
                →
              </span>
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  )
}