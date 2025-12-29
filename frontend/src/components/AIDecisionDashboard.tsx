/**
 * Real-Time AI Decision Dashboard
 * 
 * This component provides LIVE TRANSPARENCY into the AI's decision-making process.
 * Key Innovation: Shows judges exactly how the AI:
 *   1. Detects user emotions in real-time
 *   2. Selects therapeutic techniques
 *   3. Adapts voice characteristics
 *   4. Monitors for safety/crisis situations
 * 
 * This is a major differentiator - most mental health AI apps are "black boxes"
 */

import React, { useState, useEffect } from 'react';
import { 
  Ear, Brain, Leaf, Wind, Heart, Search, Star, Shield, Hand,
  AlertCircle, CloudRain, Angry, Smile, Sun, Meh, Mic, Bot
} from 'lucide-react';

interface AIDecision {
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

interface AIDecisionDashboardProps {
  aiDecisions: AIDecision | null;
  isProcessing: boolean;
  safetyStatus: 'safe' | 'caution' | 'crisis';
}

// Map emotions to colors for visualization
const EMOTION_COLORS: Record<string, string> = {
  anxiety: '#f59e0b',      // Amber
  panic: '#ef4444',        // Red
  fear: '#f97316',         // Orange
  sadness: '#6366f1',      // Indigo
  loneliness: '#8b5cf6',   // Violet
  grief: '#7c3aed',        // Purple
  anger: '#dc2626',        // Red
  frustration: '#ea580c',  // Orange-red
  joy: '#22c55e',          // Green
  relief: '#10b981',       // Emerald
  gratitude: '#14b8a6',    // Teal
  hope: '#06b6d4',         // Cyan
  neutral: '#64748b',      // Slate
  calm: '#3b82f6',         // Blue
  overwhelm: '#f59e0b',    // Amber
  hopelessness: '#8b5cf6', // Violet
};

// Map techniques to icons (using Lucide React components)
const getTechniqueIcon = (technique: string): React.ReactNode => {
  const iconClass = "w-5 h-5";
  const iconMap: Record<string, React.ReactNode> = {
    reflective_listening: <Ear className={`${iconClass} text-cyan-400`} />,
    cognitive_reframing: <Brain className={`${iconClass} text-purple-400`} />,
    grounding: <Leaf className={`${iconClass} text-green-400`} />,
    breathing_exercise: <Wind className={`${iconClass} text-blue-400`} />,
    validation: <Heart className={`${iconClass} text-pink-400`} />,
    exploration: <Search className={`${iconClass} text-indigo-400`} />,
    encouragement: <Star className={`${iconClass} text-yellow-400`} />,
    coping_strategy: <Shield className={`${iconClass} text-teal-400`} />,
    greeting: <Hand className={`${iconClass} text-amber-400`} />,
    open_ended_questioning: <Search className={`${iconClass} text-cyan-400`} />,
    strength_recognition: <Star className={`${iconClass} text-yellow-400`} />,
    action_planning: <Shield className={`${iconClass} text-emerald-400`} />
  };
  return iconMap[technique] || <Bot className={`${iconClass} text-slate-400`} />;
};

// Map techniques to descriptions
const TECHNIQUE_DESCRIPTIONS: Record<string, string> = {
  reflective_listening: 'Actively mirroring and validating emotions',
  cognitive_reframing: 'Helping shift perspective on the situation',
  grounding: 'Anchoring to the present moment',
  breathing_exercise: 'Guided breathing for calm',
  validation: 'Affirming feelings are valid',
  exploration: 'Gently exploring the situation',
  encouragement: 'Building confidence and hope',
  coping_strategy: 'Teaching coping techniques',
  greeting: 'Warm welcome and connection',
  open_ended_questioning: 'Asking thoughtful questions to explore feelings',
  strength_recognition: 'Highlighting user strengths and resilience',
  action_planning: 'Identifying concrete next steps'
};

export const AIDecisionDashboard: React.FC<AIDecisionDashboardProps> = ({
  aiDecisions,
  isProcessing,
  safetyStatus
}) => {
  const [showDetails, setShowDetails] = useState(true);
  const [animatePulse, setAnimatePulse] = useState(false);

  // Pulse animation when new decisions arrive
  useEffect(() => {
    if (aiDecisions) {
      setAnimatePulse(true);
      const timer = setTimeout(() => setAnimatePulse(false), 500);
      return () => clearTimeout(timer);
    }
  }, [aiDecisions]);

  const emotionColor = aiDecisions?.emotion_analysis?.emotion 
    ? EMOTION_COLORS[aiDecisions.emotion_analysis.emotion.toLowerCase()] || '#64748b'
    : '#64748b';

  const technique = aiDecisions?.technique_selection?.technique || '';
  const techniqueIcon = getTechniqueIcon(technique);
  const techniqueDescription = TECHNIQUE_DESCRIPTIONS[technique] || 'Processing...';

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 
                    transition-all duration-300 ${animatePulse ? 'ring-2 ring-cyan-400/50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-cyan-400 animate-pulse' : 'bg-green-400'}`} />
          <h3 className="text-sm font-semibold text-slate-200">AI Decision Dashboard</h3>
          <span className="text-xs text-slate-500">LIVE</span>
        </div>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          {showDetails ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {showDetails && (
        <div className="space-y-4">
          {/* Safety Status Bar */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50">
            <span className="text-xs text-slate-400">Safety Monitor:</span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              ${safetyStatus === 'safe' ? 'bg-green-500/20 text-green-400' : ''}
              ${safetyStatus === 'caution' ? 'bg-yellow-500/20 text-yellow-400' : ''}
              ${safetyStatus === 'crisis' ? 'bg-red-500/20 text-red-400 animate-pulse' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full 
                ${safetyStatus === 'safe' ? 'bg-green-400' : ''}
                ${safetyStatus === 'caution' ? 'bg-yellow-400' : ''}
                ${safetyStatus === 'crisis' ? 'bg-red-400' : ''}`} 
              />
              {safetyStatus === 'safe' && 'All Clear'}
              {safetyStatus === 'caution' && 'Monitoring'}
              {safetyStatus === 'crisis' && 'Crisis Protocol Active'}
            </div>
          </div>

          {/* Emotion Detection */}
          <div className="p-3 rounded-lg bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Emotion Detection</span>
              {aiDecisions?.emotion_analysis?.confidence && (
                <span className="text-xs text-slate-500">
                  {Math.round(aiDecisions.emotion_analysis.confidence * 100)}% confidence
                </span>
              )}
            </div>
            
            {aiDecisions?.emotion_analysis ? (
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${emotionColor}20`, border: `2px solid ${emotionColor}` }}
                >
                  {getEmotionIcon(aiDecisions.emotion_analysis.emotion)}
                </div>
                <div>
                  <div className="text-lg font-medium text-white capitalize">
                    {aiDecisions.emotion_analysis.emotion}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">Intensity:</span>
                    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${aiDecisions.emotion_analysis.intensity * 100}%`,
                          backgroundColor: emotionColor
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-300">
                      {Math.round(aiDecisions.emotion_analysis.intensity * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-sm">Waiting for input...</div>
            )}
          </div>

          {/* Technique Selection */}
          <div className="p-3 rounded-lg bg-slate-900/50">
            <span className="text-xs text-slate-400 uppercase tracking-wide block mb-2">
              Technique Selection
            </span>
            
            {aiDecisions?.technique_selection ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  {techniqueIcon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white capitalize">
                    {technique.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {techniqueDescription}
                  </div>
                  {aiDecisions.technique_selection.reason && (
                    <div className="text-xs text-cyan-400/80 mt-2 italic">
                      "{aiDecisions.technique_selection.reason}"
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-sm">Waiting for analysis...</div>
            )}
          </div>

          {/* Voice Adaptation */}
          <div className="p-3 rounded-lg bg-slate-900/50">
            <span className="text-xs text-slate-400 uppercase tracking-wide block mb-2">
              Voice Adaptation
            </span>
            
            {aiDecisions?.voice_adaptation ? (
              <div className="space-y-2">
                <div className="text-xs text-cyan-300 flex items-center gap-1">
                  <Mic className="w-3 h-3" /> {aiDecisions.voice_adaptation.profile_used}
                </div>
                
                {aiDecisions.voice_adaptation.applied_settings && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <VoiceMetric 
                      label="Stability" 
                      value={aiDecisions.voice_adaptation.applied_settings.stability}
                      color="#22c55e"
                    />
                    <VoiceMetric 
                      label="Warmth" 
                      value={aiDecisions.voice_adaptation.applied_settings.similarity_boost}
                      color="#f59e0b"
                    />
                    <VoiceMetric 
                      label="Expression" 
                      value={aiDecisions.voice_adaptation.applied_settings.style}
                      color="#8b5cf6"
                    />
                  </div>
                )}
                
                {aiDecisions.voice_adaptation.speed_modifier && (
                  <div className="text-xs text-slate-400 mt-1">
                    Speaking pace: {aiDecisions.voice_adaptation.speed_modifier < 1 ? 'Slower' : 
                                   aiDecisions.voice_adaptation.speed_modifier > 1 ? 'Faster' : 'Normal'}
                    ({Math.round(aiDecisions.voice_adaptation.speed_modifier * 100)}%)
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 text-sm">Voice settings will adapt to emotion...</div>
            )}
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-400">AI Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper component for voice metrics
const VoiceMetric: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="text-center">
    <div className="text-xs text-slate-500 mb-1">{label}</div>
    <div className="relative w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
        style={{ width: `${value * 100}%`, backgroundColor: color }}
      />
    </div>
    <div className="text-xs text-slate-300 mt-1">{Math.round(value * 100)}%</div>
  </div>
);

// Helper function to get icon for emotions (returns React node)
function getEmotionIcon(emotion: string): React.ReactNode {
  const emotionLower = emotion.toLowerCase();
  const iconClass = "w-6 h-6";
  
  // Negative emotions
  if (['anxiety', 'panic', 'fear', 'overwhelm'].includes(emotionLower)) {
    return <AlertCircle className={`${iconClass} text-amber-400`} />;
  }
  if (['sadness', 'loneliness', 'grief', 'hopelessness'].includes(emotionLower)) {
    return <CloudRain className={`${iconClass} text-indigo-400`} />;
  }
  if (['anger', 'frustration', 'irritation'].includes(emotionLower)) {
    return <Angry className={`${iconClass} text-red-400`} />;
  }
  
  // Positive emotions
  if (['joy', 'gratitude', 'hope'].includes(emotionLower)) {
    return <Sun className={`${iconClass} text-yellow-400`} />;
  }
  if (['relief', 'calm'].includes(emotionLower)) {
    return <Smile className={`${iconClass} text-green-400`} />;
  }
  
  // Neutral
  return <Meh className={`${iconClass} text-slate-400`} />;
}

export default AIDecisionDashboard;
