import type { ConfidenceLevel, Speaker } from '../lib/types'

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

export function pct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}