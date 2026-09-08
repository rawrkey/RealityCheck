export type Speaker = 'SPEAKER_A' | 'SPEAKER_B' | 'SPEAKER_C' | 'SPEAKER_D'

export type CallStatus = 'uploaded' | 'transcribing' | 'analyzing' | 'ready' | 'failed'

export type CallSource = 'sample' | 'upload'

export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'unknown'

export type Sentiment = 'positive' | 'negative' | 'neutral'

export type ObjectionCategory =
  | 'pricing'
  | 'security'
  | 'implementation'
  | 'integration'
  | 'timing'
  | 'competition'
  | 'product_fit'
  | 'procurement'
  | 'other'

export type BuyerSignalType =
  | 'positive_interest'
  | 'concern'
  | 'urgency'
  | 'hesitation'
  | 'commitment'
  | 'comparison'
  | 'request_for_next_step'

export type StakeholderType =
  | 'decision_maker'
  | 'economic_buyer'
  | 'technical_stakeholder'
  | 'procurement'
  | 'champion'
  | 'end_user'
  | 'other'

export type NextStepType = 'AGREED_NEXT_STEP' | 'SUGGESTED_NEXT_STEP'

export type TimelineType =
  | 'purchase_target'
  | 'implementation_date'
  | 'evaluation_period'
  | 'decision_date'
  | 'other'

export interface Utterance {
  id: string
  speaker: Speaker
  start_ms: number
  end_ms: number
  text: string
}

export interface Transcript {
  id: string
  duration_seconds: number
  language: string
  utterances: Utterance[]
  full_text: string
}

export interface EvidenceItem {
  utterance_id: string
  speaker: Speaker
  start_ms: number
  end_ms: number
  timestamp: string
  text: string
  matched_reason: string
}

export interface ParticipantInsight {
  speaker_id: Speaker
  likely_role: string | null
  confidence: number
  evidence: string | null
  evidence_utterance_ids: string[]
}

export interface Objection {
  id: string
  category: ObjectionCategory
  description: string
  evidence_utterance_ids: string[]
  confidence: number
}

export interface BuyerSignal {
  id: string
  type: BuyerSignalType
  description: string
  evidence_utterance_ids: string[]
  sentiment: Sentiment
  confidence: number
}

export interface StakeholderInsight {
  id: string
  stakeholder_type: StakeholderType
  description: string | null
  evidence_utterance_ids: string[]
  confidence: number
}

export interface Commitment {
  id: string
  speaker_id: Speaker
  commitment: string
  deadline: string | null
  evidence_utterance_ids: string[]
  confidence: number
}

export interface NextStep {
  id: string
  description: string
  step_type: NextStepType
  owner: Speaker | null
  deadline: string | null
  evidence_utterance_ids: string[]
  confidence: number
}

export interface PricingSignal {
  id: string
  pricing_discussed: boolean
  stated_budget: string | null
  price_concern: string | null
  competitor_price_reference: string | null
  evidence_utterance_ids: string[]
}

export interface TimelineSignal {
  id: string
  description: string
  timeline_type: TimelineType
  date_reference: string | null
  evidence_utterance_ids: string[]
  confidence: number
}

export interface CompetitorMention {
  id: string
  name: string
  context: string | null
  evidence_utterance_ids: string[]
  confidence: number
}

export interface GroundTruthAssessment {
  interest_level: ConfidenceLevel
  risk_level: ConfidenceLevel
  urgency_level: ConfidenceLevel
  confidence: number
}

export interface GroundTruthAnalysis {
  prompt_version: string
  participants: ParticipantInsight[]
  objections: Objection[]
  buyer_signals: BuyerSignal[]
  stakeholders: StakeholderInsight[]
  commitments: Commitment[]
  next_steps: NextStep[]
  pricing_signals: PricingSignal[]
  timeline_signals: TimelineSignal[]
  competitor_mentions: CompetitorMention[]
  initial_ground_truth_assessment: GroundTruthAssessment
}

export interface CallRecord {
  id: string
  original_filename: string
  created_at: string
  status: CallStatus
  source: CallSource
  transcript: Transcript | null
  analysis: GroundTruthAnalysis | null
  error_message: string | null
}

export interface VoiceAvailability {
  available: boolean
  reason: string | null
}

export interface CallSummary {
  id: string
  original_filename: string
  created_at: string
  status: CallStatus
  source: CallSource
  error_message: string | null
}

export interface ProviderStatus {
  live_analysis_available: boolean
  voice_available: boolean
  mode: 'live' | 'sample'
  label: string
}

// ---- Phase 3: Voice Interrogation + Deal Reality ----

export type InterrogationDimension =
  | 'primary_objection'
  | 'buyer_decision_maker'
  | 'deal_interest_risk'
  | 'next_step'

export type InterrogationRole = 'agent' | 'rep'
export type InterrogationStatus = 'created' | 'in_progress' | 'completed'
export type AlignmentVerdict = 'aligned' | 'misaligned' | 'unsupported'
export type DealRiskLevel = 'low' | 'medium' | 'high'
export type Priority = 'high' | 'medium' | 'low'

export interface InterrogationMessage {
  role: InterrogationRole
  text: string
}

export interface RepClaim {
  id: string
  dimension: InterrogationDimension
  question: string
  claim: string
  rep_confidence: number
  evidence_utterance_ids: string[]
}

export interface InterrogationSession {
  id: string
  call_id: string
  status: InterrogationStatus
  dimensions: InterrogationDimension[]
  system_prompt: string
  messages: InterrogationMessage[]
  claims: RepClaim[]
  debrief_transcript: Transcript | null
  created_at: string
  updated_at: string
}

export interface ClaimAlignment {
  claim_id: string
  dimension: InterrogationDimension
  verdict: AlignmentVerdict
  summary: string
  transcript_evidence: EvidenceItem[]
  matched_analysis_ids: string[]
}

export interface BlindSpot {
  id: string
  dimension: InterrogationDimension | null
  title: string
  description: string
  transcript_evidence: EvidenceItem[]
}

export interface RecommendedAction {
  id: string
  priority: Priority
  action: string
  rationale: string
}

export interface DealReality {
  call_id: string
  prompt_version: string
  summary: string
  risk_level: DealRiskLevel
  alignment_score: number
  aligned_count: number
  total_count: number
  blind_spots: BlindSpot[]
  recommendations: RecommendedAction[]
  created_at: string
}

export interface InterrogationConfig {
  call_id: string
  token: string
  websocket_url: string
  session: Record<string, unknown>
  expires_in_seconds: number
}

export interface DebriefResponse {
  call_id: string
  session: InterrogationSession
  alignments: ClaimAlignment[]
}