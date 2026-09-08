import type {
  AlignmentVerdict,
  CallStatus,
  ConfidenceLevel,
  DealRiskLevel,
  InterrogationDimension,
  Priority,
  Speaker,
} from '../lib/types'

const SPEAKER_STYLES: Record<Speaker, string> = {
  SPEAKER_A: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  SPEAKER_B: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  SPEAKER_C: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  SPEAKER_D: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
}

export function speakerBadgeClass(speaker: Speaker): string {
  return SPEAKER_STYLES[speaker] ?? SPEAKER_STYLES.SPEAKER_A
}

export function speakerLabel(speaker: Speaker): string {
  return speaker.replace('SPEAKER_', 'Speaker ')
}

const SPEAKER_DOTS: Record<Speaker, string> = {
  SPEAKER_A: 'bg-info',
  SPEAKER_B: 'bg-warning',
  SPEAKER_C: 'bg-sentiment',
  SPEAKER_D: 'bg-caution',
}

/** Restrained speaker differentiation: a small token-coloured dot, not a bubble. */
export function speakerDotClass(speaker: Speaker): string {
  return SPEAKER_DOTS[speaker] ?? SPEAKER_DOTS.SPEAKER_A
}

const LEVEL_STYLES: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-rose-500/20 text-rose-300',
  unknown: 'bg-slate-500/20 text-slate-400',
}

export function levelBadgeClass(level: ConfidenceLevel): string {
  return LEVEL_STYLES[level] ?? LEVEL_STYLES.unknown
}

const VERDICT_STYLES: Record<AlignmentVerdict, string> = {
  aligned: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  misaligned: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  unsupported: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
}

export function verdictBadgeClass(verdict: AlignmentVerdict): string {
  return VERDICT_STYLES[verdict] ?? VERDICT_STYLES.unsupported
}

const RISK_STYLES: Record<DealRiskLevel, string> = {
  low: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-amber-500/20 text-amber-300',
  high: 'bg-rose-500/20 text-rose-300',
}

export function riskBadgeClass(risk: DealRiskLevel): string {
  return RISK_STYLES[risk] ?? RISK_STYLES.medium
}

const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-rose-500/20 text-rose-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-slate-500/20 text-slate-300',
}

export function priorityBadgeClass(priority: Priority): string {
  return PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium
}

const DIMENSION_LABELS: Record<InterrogationDimension, string> = {
  primary_objection: 'Primary Objection',
  buyer_decision_maker: 'Buyer / Decision-Maker',
  deal_interest_risk: 'Deal Interest & Risk',
  next_step: 'Next Step',
}

export function dimensionLabel(dimension: InterrogationDimension | string): string {
  return DIMENSION_LABELS[dimension as InterrogationDimension] ?? dimension.replace(/_/g, ' ')
}

export function pct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

const CALL_STATUS_META: Record<
  CallStatus,
  { label: string; dot: string; text: string }
> = {
  uploaded: { label: 'Uploaded', dot: 'bg-subtle', text: 'text-muted' },
  transcribing: { label: 'Transcribing', dot: 'bg-info', text: 'text-info' },
  analyzing: { label: 'Analyzing', dot: 'bg-info animate-pulse', text: 'text-info' },
  ready: { label: 'Ready', dot: 'bg-sentiment', text: 'text-sentiment' },
  failed: { label: 'Failed', dot: 'bg-caution', text: 'text-caution' },
}

export function callStatusMeta(status: CallStatus) {
  return CALL_STATUS_META[status] ?? CALL_STATUS_META.uploaded
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** "12m 04s" style duration from seconds (web formatDuration previously local). */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

/** "00:04" / "01:12" / "1:02:03" clock reading from a UTC timestamp in ms. */
export function formatTimestampMs(startMs: number): string {
  const total = Math.max(0, Math.floor(startMs / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** "00:42" / "01:02:03" ticking elapsed-time reading from seconds elapsed. */
export function formatElapsed(elapsedSeconds: number): string {
  return formatTimestampMs(Math.max(0, elapsedSeconds) * 1000)
}