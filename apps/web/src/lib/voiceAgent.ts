export type VoiceAgentToolCall = {
  call_id: string
  name: string
  arguments: Record<string, unknown>
}

export type VoiceAgentLogEntry =
  | { kind: 'rep'; text: string }
  | { kind: 'agent'; text: string }
  | { kind: 'tool'; text: string }
  | { kind: 'system'; text: string }

export type VoiceAgentCallbacks = {
  onLog: (entry: VoiceAgentLogEntry) => void
  onStatus?: (status: string) => void
  onError?: (message: string) => void
  onEnded?: () => void
  onToolCall?: (call: VoiceAgentToolCall) => Promise<string>
}

const READY_TIMEOUT_MS = 15_000

/**
 * Minimal browser client for the AssemblyAI Voice Agent API.
 *
 * Handles: session.update on connect, `transcript.user` (rep speech) and
 * `transcript.agent` (agent speech) logging, client-side function tools
 * (`tool.call` → relay to our backend → `tool.result` drained on
 * `reply.done`), mic streaming as PCM16 `input.audio`, and `session.end`.
 *
 * Tool results are only sent when `reply.done` is the latest event, per the
 * protocol's turn-taking rules; interrupted replies discard pending results.
 */
export class VoiceAgentClient {
  private ws: WebSocket | null = null
  private sessionConfig: Record<string, unknown>
  private callbacks: VoiceAgentCallbacks
  private url: string

  private ready = false
  private lastEvent: 'turn' | 'idle' = 'idle'
  private pendingTools: {
    call_id: string
    result: string
    is_error: boolean
  }[] = []
  private ended = false

  private micStream: MediaStream | null = null
  private micContext: AudioContext | null = null
  private micProcessor: ScriptProcessorNode | null = null

  constructor(
    url: string,
    sessionConfig: Record<string, unknown>,
    callbacks: VoiceAgentCallbacks,
  ) {
    this.url = url
    this.sessionConfig = sessionConfig
    this.callbacks = callbacks
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.ready
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url)
      this.ws = ws
      let settled = false

      const readyTimer = setTimeout(() => {
        settle(new Error('Timed out waiting for session.ready'))
      }, READY_TIMEOUT_MS)

      const settle = (error: Error | null) => {
        if (settled) return
        settled = true
        clearTimeout(readyTimer)
        if (error) reject(error)
        else resolve()
      }

      ws.onopen = () => {
        this.callbacks.onLog?.({
          kind: 'system',
          text: 'Connected to voice agent. Sending session configuration…',
        })
        ws.send(JSON.stringify({ type: 'session.update', ...this.sessionConfig }))
      }

      ws.onmessage = (event) => {
        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(String(event.data))
        } catch {
          return
        }
        if (payload.type === 'session.ready') {
          this.ready = true
          this.callbacks.onStatus?.('Session ready. You can speak now.')
          settle(null)
          return
        }
        if (payload.type === 'session.error') {
          this.callbacks.onError?.(`${payload.code} — ${payload.message}`)
          return
        }
        this.handleEvent(payload)
      }

      ws.onerror = () => {
        this.callbacks.onLog?.({
          kind: 'system',
          text: 'WebSocket connection error.',
        })
        settle(new Error('WebSocket connection error'))
      }

      ws.onclose = () => {
        this.ready = false
        if (this.ended) {
          this.callbacks.onLog?.({ kind: 'system', text: 'Session ended.' })
          this.callbacks.onEnded?.()
        } else {
          this.callbacks.onLog?.({ kind: 'system', text: 'Connection closed.' })
        }
      }
    })
  }

  private handleEvent(event: Record<string, unknown>): void {
    switch (event.type) {
      case 'transcript.user':
        this.callbacks.onLog?.({ kind: 'rep', text: String(event.text ?? '') })
        break
      case 'transcript.agent':
        this.callbacks.onLog?.({ kind: 'agent', text: String(event.text ?? '') })
        break
      case 'input.speech.started':
      case 'reply.started':
        this.lastEvent = 'turn'
        break
      case 'reply.done':
        if (event.status === 'interrupted') {
          this.pendingTools = []
        } else {
          this.lastEvent = 'idle'
          this.flushTools()
        }
        break
      case 'tool.call':
        void this.handleToolCall(event as unknown as VoiceAgentToolCall)
        break
      case 'session.ended':
        this.ended = true
        break
      default:
        break
    }
  }

  private async handleToolCall(call: VoiceAgentToolCall): Promise<void> {
    this.callbacks.onLog?.({
      kind: 'tool',
      text: `Tool call: ${call.name}(${JSON.stringify(call.arguments ?? {})})`,
    })
    if (!this.callbacks.onToolCall) return
    try {
      const result = await this.callbacks.onToolCall(call)
      this.pendingTools.push({ call_id: call.call_id, result, is_error: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.pendingTools.push({
        call_id: call.call_id,
        result: JSON.stringify({ error: message }),
        is_error: true,
      })
    }
    this.flushIfIdle()
  }

  private flushIfIdle(): void {
    if (this.lastEvent !== 'idle') return
    this.flushTools()
  }

  private flushTools(): void {
    if (this.lastEvent !== 'idle') return
    for (const pending of this.pendingTools) {
      this.ws?.send(
        JSON.stringify({
          type: 'tool.result',
          call_id: pending.call_id,
          result: pending.result,
          is_error: pending.is_error,
        }),
      )
    }
    this.pendingTools = []
  }

  async startMic(): Promise<void> {
    this.stopMic()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 24000 },
    })
    const context = new AudioContext({ sampleRate: 24000 })
    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = (event) => {
      this.sendPcm(event.inputBuffer.getChannelData(0))
    }
    source.connect(processor)
    processor.connect(context.destination)
    this.micStream = stream
    this.micContext = context
    this.micProcessor = processor
  }

  private sendPcm(samples: Float32Array): void {
    if (!this.isConnected || this.ended) return
    const int16 = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, samples[i] ?? 0))
      int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    const bytes = new Uint8Array(int16.buffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    this.send({ type: 'input.audio', audio: btoa(binary) })
  }

  end(): void {
    this.send({ type: 'session.end' })
  }

  close(): void {
    this.stopMic()
    this.ready = false
    this.ended = false
    try {
      this.ws?.close()
    } catch {
      /* already closed */
    }
    this.ws = null
  }

  private stopMic(): void {
    this.micProcessor?.disconnect()
    this.micProcessor = null
    void this.micContext?.close()
    this.micContext = null
    this.micStream?.getTracks().forEach((track) => track.stop())
    this.micStream = null
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }
}