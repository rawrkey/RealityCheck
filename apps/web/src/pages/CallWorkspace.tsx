import { useState } from 'react'
import { GroundTruthView } from '../components/call/GroundTruthView'
import { StatusBadge } from '../components/call/StatusBadge'
import { TranscriptView } from '../components/call/TranscriptView'
import { UploadCall } from '../components/call/UploadCall'
import { Header } from '../components/Header'
import type { CallRecord } from '../lib/types'

type CallWorkspaceProps = {
  onBack: () => void
}

export default function CallWorkspace({ onBack }: CallWorkspaceProps) {
  const [call, setCall] = useState<CallRecord | null>(null)

  const ready = call?.status === 'ready' && call.transcript != null && call.analysis != null

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Call Workspace
          </h1>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-slate-400 transition hover:text-slate-200"
          >
            ← Back
          </button>
        </div>

        <UploadCall onProcessed={setCall} />

        {call && (
          <>
            <StatusBadge status={call.status} errorMessage={call.error_message} />

            {ready && call.transcript && call.analysis && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">
                    Original call — transcript &amp; ground truth
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = `#/calls/${call.id}/debrief`
                    }}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                  >
                    Run voice interrogation →
                  </button>
                </div>
                <TranscriptView callId={call.id} transcript={call.transcript} />
                <GroundTruthView callId={call.id} analysis={call.analysis} />
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}