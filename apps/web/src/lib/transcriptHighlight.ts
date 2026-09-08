const PENDING_KEY = 'rc:pending-view'

export const HIGHLIGHT_EVENT = 'rc:transcript-highlight'

export function requestViewInTranscript(callId: string, utteranceId: string): void {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ callId, utteranceId, at: Date.now() }),
    )
  } catch {
    // sessionStorage unavailable — the navigation itself still works
  }
}

export function consumeViewInTranscript(callId: string): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { callId?: string; utteranceId?: string }
    if (!data?.utteranceId || data.callId !== callId) return null
    sessionStorage.removeItem(PENDING_KEY)
    return data.utteranceId
  } catch {
    return null
  }
}

export function emitHighlight(utteranceId: string): void {
  window.dispatchEvent(
    new CustomEvent(HIGHLIGHT_EVENT, { detail: { utteranceId } }),
  )
}