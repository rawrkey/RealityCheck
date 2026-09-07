import { useRef, useState } from 'react'
import { uploadCall } from '../../lib/api'
import type { CallRecord } from '../../lib/types'

type UploadCallProps = {
  onProcessed: (call: CallRecord) => void
}

export function UploadCall({ onProcessed }: UploadCallProps) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      const call = await uploadCall(file)
      onProcessed(call)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-white">Upload a Sales Call</h2>
      <p className="mt-1 text-sm text-slate-400">
        Provide a recorded call. RealityCheck will transcribe it, run ground-truth
        analysis, and let you inspect the evidence.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-300 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-300 hover:file:bg-indigo-500/30"
        />

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!file || busy}
            className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Processing...' : 'Process Call'}
          </button>
          {busy && (
            <span className="flex items-center gap-2 text-sm text-slate-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-indigo-400" />
              Transcribing and analyzing (may take a minute)
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}