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