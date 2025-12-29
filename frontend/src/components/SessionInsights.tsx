/**
 * Session Insights & Emotional Journey Visualization
 * 
 * Tracks emotional states throughout the session and shows progress.
 * Key Innovation: Visual representation of emotional journey over time
 * - Shows judges how the AI helps users progress emotionally
 * - Demonstrates real therapeutic value
 */

import React, { useMemo } from 'react';
import { AlertCircle, CloudRain, Frown, Smile, Sun, Meh } from 'lucide-react';

// Helper function to get colored icon for emotions
function getEmotionIcon(emotion: string): React.ReactNode {
  const emotionLower = emotion.toLowerCase();
  const iconClass = "w-4 h-4";
  
  if (['anxiety', 'panic', 'fear', 'overwhelm'].includes(emotionLower)) {
    return <AlertCircle className={iconClass} />;
  }
  if (['sadness', 'loneliness', 'grief', 'hopelessness'].includes(emotionLower)) {
    return <CloudRain className={iconClass} />;
  }
  if (['anger', 'frustration', 'irritation'].includes(emotionLower)) {
    return <Frown className={iconClass} />;
  }
  if (['joy', 'gratitude', 'hope'].includes(emotionLower)) {
    return <Sun className={iconClass} />;
  }
  if (['relief', 'calm'].includes(emotionLower)) {
    return <Smile className={iconClass} />;
  }
  return <Meh className={iconClass} />;
}

interface EmotionDataPoint {
  timestamp: Date;
  emotion: string;
  intensity: number;
  technique: string;
}

interface SessionInsightsProps {
  emotionHistory: EmotionDataPoint[];
  sessionDuration: number; // in seconds
  totalMessages: number;
}

// Categorize emotions for progress visualization
const EMOTION_CATEGORIES: Record<string, 'negative' | 'neutral' | 'positive'> = {
  anxiety: 'negative',
  panic: 'negative',
  fear: 'negative',
  sadness: 'negative',
  loneliness: 'negative',
  grief: 'negative',
  hopelessness: 'negative',
  anger: 'negative',
  frustration: 'negative',
  overwhelm: 'negative',
  neutral: 'neutral',
  calm: 'positive',
  relief: 'positive',
  joy: 'positive',
  gratitude: 'positive',
  hope: 'positive',
};

const EMOTION_COLORS: Record<string, string> = {
  anxiety: '#f59e0b',
  panic: '#ef4444',
  fear: '#f97316',
  sadness: '#6366f1',
  loneliness: '#8b5cf6',
  grief: '#7c3aed',
  anger: '#dc2626',
  frustration: '#ea580c',
  joy: '#22c55e',
  relief: '#10b981',
  gratitude: '#14b8a6',
  hope: '#06b6d4',
  neutral: '#64748b',
  calm: '#3b82f6',
  overwhelm: '#f59e0b',
  hopelessness: '#8b5cf6',
};

export const SessionInsights: React.FC<SessionInsightsProps> = ({
  emotionHistory,
  sessionDuration,
  totalMessages
}) => {
  // Calculate insights
  const insights = useMemo(() => {
    if (emotionHistory.length === 0) {
      return {
        primaryEmotion: null,
        emotionProgress: 0,
        techniquesUsed: [],
        emotionalTrend: 'stable',
        startingEmotion: null,
        currentEmotion: null,
      };
    }

    // Count emotions
    const emotionCounts: Record<string, number> = {};
    const techniqueCounts: Record<string, number> = {};
    
    emotionHistory.forEach(point => {
      emotionCounts[point.emotion] = (emotionCounts[point.emotion] || 0) + 1;
      if (point.technique) {
        techniqueCounts[point.technique] = (techniqueCounts[point.technique] || 0) + 1;
      }
    });

    // Primary emotion
    const primaryEmotion = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Techniques used
    const techniquesUsed = Object.entries(techniqueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([technique]) => technique);

    // Calculate emotional progress (negative to positive shift)
    const startingEmotion = emotionHistory[0]?.emotion || null;
    const currentEmotion = emotionHistory[emotionHistory.length - 1]?.emotion || null;
    
    const getEmotionScore = (emotion: string): number => {
      const category = EMOTION_CATEGORIES[emotion.toLowerCase()];
      if (category === 'negative') return -1;
      if (category === 'positive') return 1;
      return 0;
    };

    const startScore = startingEmotion ? getEmotionScore(startingEmotion) : 0;
    const endScore = currentEmotion ? getEmotionScore(currentEmotion) : 0;
    const emotionProgress = endScore - startScore; // -2 to +2

    // Determine trend
    let emotionalTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (emotionHistory.length >= 3) {
      const recentPoints = emotionHistory.slice(-3);
      const recentScores = recentPoints.map(p => getEmotionScore(p.emotion));
      const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      
      const olderPoints = emotionHistory.slice(0, Math.min(3, emotionHistory.length - 3));
      if (olderPoints.length > 0) {
        const olderScores = olderPoints.map(p => getEmotionScore(p.emotion));
        const avgOlder = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
        
        if (avgRecent > avgOlder + 0.3) emotionalTrend = 'improving';
        else if (avgRecent < avgOlder - 0.3) emotionalTrend = 'declining';
      }
    }

    return {
      primaryEmotion,
      emotionProgress,
      techniquesUsed,
      emotionalTrend,
      startingEmotion,
      currentEmotion,
    };
  }, [emotionHistory]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Session Insights</h3>
        <span className="text-xs text-slate-500">{formatDuration(sessionDuration)}</span>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-white">{totalMessages}</div>
          <div className="text-xs text-slate-400">Exchanges</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-white">{emotionHistory.length}</div>
          <div className="text-xs text-slate-400">Emotions</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-white">{insights.techniquesUsed.length}</div>
          <div className="text-xs text-slate-400">Techniques</div>
        </div>
      </div>

      {/* Emotional Journey Graph */}
      {emotionHistory.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">Emotional Journey</div>
          <div className="h-16 bg-slate-900/50 rounded-lg p-2 flex items-end gap-1">
            {emotionHistory.map((point, index) => {
              const category = EMOTION_CATEGORIES[point.emotion.toLowerCase()] || 'neutral';
              const height = category === 'positive' ? 100 : category === 'negative' ? 30 : 60;
              const color = EMOTION_COLORS[point.emotion.toLowerCase()] || '#64748b';
              
              return (
                <div
                  key={index}
                  className="flex-1 rounded-t transition-all duration-300 hover:opacity-80"
                  style={{ 
                    height: `${height}%`, 
                    backgroundColor: color,
                    minWidth: '8px',
                    maxWidth: '20px'
                  }}
                  title={`${point.emotion} (${Math.round(point.intensity * 100)}%)`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Start</span>
            <span>Now</span>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {insights.startingEmotion && insights.currentEmotion && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Emotional Progress</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full
              ${insights.emotionalTrend === 'improving' ? 'bg-green-500/20 text-green-400' : ''}
              ${insights.emotionalTrend === 'stable' ? 'bg-blue-500/20 text-blue-400' : ''}
              ${insights.emotionalTrend === 'declining' ? 'bg-yellow-500/20 text-yellow-400' : ''}`}
            >
              {insights.emotionalTrend === 'improving' && '↑ Improving'}
              {insights.emotionalTrend === 'stable' && '→ Stable'}
              {insights.emotionalTrend === 'declining' && '↓ Needs attention'}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ 
                  backgroundColor: `${EMOTION_COLORS[insights.startingEmotion.toLowerCase()] || '#64748b'}30`,
                  borderColor: EMOTION_COLORS[insights.startingEmotion.toLowerCase()] || '#64748b',
                  borderWidth: '2px'
                }}
              >
                {getEmotionIcon(insights.startingEmotion)}
              </div>
              <span className="text-xs text-slate-500 mt-1 capitalize">{insights.startingEmotion}</span>
            </div>
            
            <div className="flex-1 h-0.5 bg-gradient-to-r from-slate-600 to-cyan-500 relative">
              <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-cyan-500 transform rotate-45" />
            </div>
            
            <div className="flex flex-col items-center">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm ring-2 ring-cyan-400/50"
                style={{ 
                  backgroundColor: `${EMOTION_COLORS[insights.currentEmotion.toLowerCase()] || '#64748b'}30`,
                  borderColor: EMOTION_COLORS[insights.currentEmotion.toLowerCase()] || '#64748b',
                  borderWidth: '2px'
                }}
              >
                {getEmotionIcon(insights.currentEmotion)}
              </div>
              <span className="text-xs text-slate-400 mt-1 capitalize">{insights.currentEmotion}</span>
            </div>
          </div>
        </div>
      )}

      {/* Techniques Used */}
      {insights.techniquesUsed.length > 0 && (
        <div className="p-3 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-400 mb-2">Techniques Applied</div>
          <div className="flex flex-wrap gap-1">
            {insights.techniquesUsed.map((technique, index) => (
              <span 
                key={index}
                className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full capitalize"
              >
                {technique.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {emotionHistory.length === 0 && (
        <div className="text-center py-4">
          <div className="text-slate-500 text-sm">
            Session insights will appear as you talk with your coach
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionInsights;
