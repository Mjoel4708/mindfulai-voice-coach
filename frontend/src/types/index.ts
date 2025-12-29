// Session types
export interface Session {
  session_id: string;
  status: 'active' | 'ended';
  created_at: string;
  ended_at?: string;
}

// Conversation types
export interface ConversationTurn {
  turn_id: string;
  role: 'user' | 'coach';
  content: string;
  emotion?: string;
  intensity?: number;
  technique?: string;
  timestamp: string;
  audio_base64?: string;
}

// AI Decision types for transparency dashboard
export interface AIDecisions {
  emotion_analysis?: {
    emotion: string;
    intensity: number;
    confidence: number;
    intent: string;
  };
  technique_selection?: {
    technique: string;
    reason: string;
  };
  voice_adaptation?: {
    detected_emotion: string;
    intensity: number;
    profile_used: string;
    applied_settings?: {
      stability: number;
      similarity_boost: number;
      style: number;
    };
    speed_modifier?: number;
  };
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'user_speech' | 'ping' | 'coach_response' | 'safety_alert' | 'error' | 'pong';
  transcript?: string;
  audio_duration?: number;
  text?: string;
  audio_base64?: string;
  emotion?: string;
  technique?: string;
  intensity?: number;
  message?: string;
  resources?: CrisisResource[];
  ai_decisions?: AIDecisions;  // NEW: AI transparency data
}

export interface CoachResponse {
  type: 'coach_response';
  text: string;
  audio_base64: string;
  emotion: string | null;
  technique: string;
  intensity?: number;
  ai_decisions?: AIDecisions;  // NEW: AI transparency data
}

export interface SafetyAlert {
  type: 'safety_alert';
  text: string;
  audio_base64: string;
  resources: CrisisResource[];
}

export interface CrisisResource {
  name: string;
  phone?: string;
  text?: string;
  url?: string;
  description: string;
}

// Emotion types
export type EmotionType = 
  | 'anxiety'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'frustration'
  | 'loneliness'
  | 'overwhelm'
  | 'hopelessness'
  | 'neutral'
  | 'joy'
  | 'relief'
  | 'gratitude';

// Technique types
export type TechniqueType =
  | 'reflective_listening'
  | 'open_ended_questioning'
  | 'cognitive_reframing'
  | 'grounding_exercise'
  | 'validation'
  | 'strength_recognition'
  | 'action_planning'
  | 'greeting';

// UI state types
export interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
}

export interface EmotionDisplay {
  emotion: EmotionType;
  intensity: number;
  color: string;
  icon: string;
}
