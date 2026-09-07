export type Speaker = 'SPEAKER_A' | 'SPEAKER_B' | 'SPEAKER_C' | 'SPEAKER_D'

export type CallStatus = 'uploaded' | 'transcribing' | 'analyzing' | 'ready' | 'failed'

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
  transcript: Transcript | null
  analysis: GroundTruthAnalysis | null
  error_message: string | null
}

export interface CallSummary {
  id: string
  original_filename: string
  created_at: string
  status: CallStatus
  error_message: string | null
}