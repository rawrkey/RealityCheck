import type {
  CallRecord,
  CallSummary,
  ClaimAlignment,
  DebriefResponse,
  DealReality,
  EvidenceItem,
  InterrogationConfig,
  InterrogationSession,
  InterrogationMessage,
  Transcript,
  ProviderStatus,
  VoiceAvailability,
} from './types'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/** Deterministic cold-start demo call seeded by POST /api/calls/demo. */
export const SAMPLE_CALL_ID = 'demo-nova-onboarding'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body?.detail)) {
        detail = (body.detail as { msg?: string }[])
          .map((item) => item.msg ?? '')
          .filter(Boolean)
          .join('; ')
      }
    } catch {
      // ignore non-JSON error bodies
    }
    const error = new Error(detail) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return res.json() as Promise<T>
}

export async function checkHealth(): Promise<{ status: string }> {
  return handle<{ status: string }>(await fetch(`${API_BASE_URL}/health`))
}

export async function uploadCall(file: File): Promise<CallRecord> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE_URL}/api/calls`, {
    method: 'POST',
    body: form,
  })
  return handle<CallRecord>(res)
}

export async function listCalls(): Promise<CallSummary[]> {
  return handle<CallSummary[]>(await fetch(`${API_BASE_URL}/api/calls`))
}

/** Probe live-provider availability (transcription/analysis/voice). */
export async function getProviderStatus(): Promise<ProviderStatus> {
  return handle<ProviderStatus>(
    await fetch(`${API_BASE_URL}/api/calls/provider-status`),
  )
}

/** Seed the deterministic demo call and return it as the current call. */
export async function loadSampleCall(): Promise<CallRecord> {
  return handle<CallRecord>(
    await fetch(`${API_BASE_URL}/api/calls/demo`, { method: 'POST' }),
  )
}

/** True when the given call id / record is the bundled sample call. */
export function isSampleCall(callId: string): boolean {
  return callId === SAMPLE_CALL_ID
}

export async function getCall(callId: string): Promise<CallRecord> {
  return handle<CallRecord>(await fetch(`${API_BASE_URL}/api/calls/${callId}`))
}

export async function getTranscript(callId: string): Promise<Transcript> {
  return handle<Transcript>(
    await fetch(`${API_BASE_URL}/api/calls/${callId}/transcript`),
  )
}

export type EvidenceParams = {
  query?: string
  analysis_item_id?: string
  utterance_id?: string
  utterance_ids?: string[]
}

export async function getEvidence(
  callId: string,
  params: EvidenceParams,
): Promise<EvidenceItem[]> {
  const search = new URLSearchParams()
  if (params.query) search.set('query', params.query)
  if (params.analysis_item_id) search.set('analysis_item_id', params.analysis_item_id)
  if (params.utterance_id) search.set('utterance_id', params.utterance_id)
  if (params.utterance_ids?.length) search.set('utterance_ids', params.utterance_ids.join(','))
  const qs = search.toString()
  const url = `${API_BASE_URL}/api/calls/${callId}/evidence${qs ? `?${qs}` : ''}`
  return handle<EvidenceItem[]>(await fetch(url))
}

// ---- Phase 3: Voice Interrogation + Deal Reality ----

export async function startInterrogation(callId: string): Promise<InterrogationSession> {
  return handle<InterrogationSession>(
    await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/session`, {
      method: 'POST',
    }),
  )
}

export async function getInterrogationSession(callId: string): Promise<InterrogationSession> {
  return handle<InterrogationSession>(
    await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/session`),
  )
}

export async function submitDebrief(
  callId: string,
  messages: InterrogationMessage[],
): Promise<DebriefResponse> {
  const res = await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/debrief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  return handle<DebriefResponse>(res)
}

export async function getDebrief(callId: string): Promise<DebriefResponse> {
  return handle<DebriefResponse>(await fetch(`${API_BASE_URL}/api/calls/${callId}/debrief`))
}

export async function getAlignments(callId: string): Promise<ClaimAlignment[]> {
  return handle<ClaimAlignment[]>(
    await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/alignment`),
  )
}

export async function getReality(callId: string): Promise<DealReality> {
  return handle<DealReality>(await fetch(`${API_BASE_URL}/api/calls/${callId}/reality`))
}

/** Probe whether a live voice debrief is available for a call. */
export async function getVoiceAvailability(callId: string): Promise<VoiceAvailability> {
  return handle<VoiceAvailability>(
    await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/voice`),
  )
}

export async function buildReality(callId: string): Promise<DealReality> {
  return handle<DealReality>(
    await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/reality`, {
      method: 'POST',
    }),
  )
}

export async function getInterrogationConfig(callId: string): Promise<InterrogationConfig> {
  return handle<InterrogationConfig>(
    await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/config`),
  )
}

export type ToolCall = {
  name: string
  arguments: Record<string, unknown>
}

export async function executeVoiceTool(
  callId: string,
  toolCall: ToolCall,
): Promise<{ result: string }> {
  const res = await fetch(`${API_BASE_URL}/api/calls/${callId}/interrogation/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolCall),
  })
  return handle<{ result: string }>(res)
}