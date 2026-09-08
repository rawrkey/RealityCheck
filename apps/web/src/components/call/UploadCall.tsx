import { useState } from 'react'
import type { RefObject } from 'react'
import { uploadCall } from '../../lib/api'
import { formatBytes } from '../../lib/ui'
import type { CallRecord } from '../../lib/types'
import { cx } from '../../lib/cx'
import { Eyebrow } from '../ui'

const ALLOWED_AUDIO_EXTENSIONS = [
  'WAV',
  'MP3',
  'M4A',
  'MP4',
  'MOV',
  'AAC',
  'FLAC',
  'OGG',
  'WEBM',
  'WMA',
]

const ALLOWED_EXT_RE = /\.(wav|mp3|m4a|mp4|mov|aac|flac|ogg|webm|wma)$/i
const MAX_SIZE_BYTES = 200 * 1024 * 1024

type UploadPhase = 'idle' | 'selected' | 'uploading' | 'error'

type UploadCallProps = {
  onProcessed: (call: CallRecord) => void
  inputRef?: RefObject<HTMLInputElement | null>
}

export function UploadCall({ onProcessed, inputRef }: UploadCallProps) {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function pickFile(next: File | undefined | null) {
    if (!next) return
    setError(null)
    if (!ALLOWED_EXT_RE.test(next.name)) {
      setError(
        `Unsupported file type. Use one of: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}.`,
      )
      setPhase('error')
      return
    }
    if (next.size > MAX_SIZE_BYTES) {
      setError('The file exceeds the 200 MB upload limit.')
      setPhase('error')
      return
    }
    setFile(next)
    setPhase('selected')
  }

  function clear() {
    setFile(null)
    setError(null)
    setPhase('idle')
    if (inputRef?.current) inputRef.current.value = ''
  }

  const openPicker = () => inputRef?.current?.click() ?? undefined

  async function analyze() {
    if (!file || phase === 'uploading') return
    setPhase('uploading')
    setError(null)
    try {
      const call = await uploadCall(file)
      onProcessed(call)
      clear()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
      setPhase('error')
    }
  }

  return (
    <section aria-label="Upload a call recording">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(false)
          if (phase === 'uploading') return
          pickFile(e.dataTransfer.files?.[0])
        }}
        className={cx(
          'relative rounded-lg border border-dashed px-6 py-9 text-center transition-colors',
          dragging
            ? 'border-warning bg-warning/[0.06]'
            : 'border-rule-strong bg-vessel/40 hover:border-ash',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.mp4,.mov,.aac,.flac,.ogg,.webm,.wma"
          aria-label="Choose a call recording"
          onChange={(e) => pickFile(e.target.files?.[0])}
          className="sr-only"
        />

        {phase === 'uploading' ? (
          <div className="flex flex-col items-center gap-3" role="status">
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
              <span className="relative inline-flex size-3 rounded-full bg-info" />
            </span>
            <div>
              <p className="text-sm font-medium text-info">Uploading and analyzing…</p>
              <p className="mt-1 text-xs text-subtle">
                Transcription and ground-truth analysis run in a single pass. The call
                appears in your list once it's ready.
              </p>
            </div>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:text-left">
            <div className="min-w-0">
              <Eyebrow>Selected file</Eyebrow>
              <p className="mt-1 truncate font-mono text-sm text-ink">{file.name}</p>
              <p className="mt-0.5 text-xs text-subtle">{formatBytes(file.size)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={analyze}
                className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-canvas transition-all hover:bg-white/95 active:scale-[0.98]"
              >
                Analyze call
                <span className="text-[10px] leading-none opacity-70" aria-hidden="true">
                  →
                </span>
              </button>
              <button
                type="button"
                onClick={clear}
                className="rounded-md px-3 py-2 text-sm text-subtle transition-colors hover:text-ink"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className="w-full rounded-md p-2 text-center focus-visible:outline-2 focus-visible:outline-warning"
          >
            <p className="font-mono text-[11px] uppercase tracking-widest text-subtle">
              Upload a call
            </p>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink">
              Drop a recorded sales call here.
            </p>
            <p className="mt-2 text-sm text-muted">
              or{' '}
              <span className="font-medium text-ink underline underline-offset-4">
                browse files
              </span>
            </p>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-subtle">
              {ALLOWED_AUDIO_EXTENSIONS.join(' · ')} · up to 200 MB
            </p>
          </button>
        )}
      </div>

      {phase === 'error' && error && (
        <div
          className="mt-3 flex items-start justify-between gap-4 rounded-md border border-caution/30 bg-caution/[0.06] px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-caution">{error}</p>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  )
}