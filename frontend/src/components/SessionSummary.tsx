/**
 * Session Summary Component
 * 
 * Displays a comprehensive summary of the coaching session including:
 * - Emotional journey visualization
 * - Techniques used
 * - Session duration and metrics
 * - Option to export as PDF for sharing with therapists
 */

import React, { useMemo } from 'react';
import { 
  X, Download, Clock, MessageSquare, Brain, 
  TrendingUp, TrendingDown, Minus, Heart,
  Share2, CheckCircle, Lightbulb, AlertCircle,
  Smile, CloudRain, Frown, Meh, Sun
} from 'lucide-react';

// Helper function to get colored icon for emotions
function getEmotionIcon(emotion: string): React.ReactNode {
  const emotionLower = emotion.toLowerCase();
  const iconClass = "w-6 h-6";
  
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

interface SessionSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionDuration: number; // seconds
  emotionHistory: EmotionDataPoint[];
  totalMessages: number;
  conversationHistory: Array<{
    role: 'user' | 'coach';
    content: string;
    emotion?: string;
    technique?: string;
  }>;
}

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

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  isOpen,
  onClose,
  sessionId,
  sessionDuration,
  emotionHistory,
  totalMessages,
  conversationHistory
}) => {
  // Calculate session insights
  const insights = useMemo(() => {
    if (emotionHistory.length === 0) {
      return {
        emotionalShift: 0,
        trend: 'stable' as const,
        primaryEmotions: [],
        techniquesUsed: [],
        startEmotion: null,
        endEmotion: null,
        improvementPercentage: 0
      };
    }

    // Get emotion score
    const getScore = (emotion: string): number => {
      const cat = EMOTION_CATEGORIES[emotion.toLowerCase()];
      return cat === 'positive' ? 1 : cat === 'negative' ? -1 : 0;
    };

    const startEmotion = emotionHistory[0]?.emotion;
    const endEmotion = emotionHistory[emotionHistory.length - 1]?.emotion;
    const startScore = startEmotion ? getScore(startEmotion) : 0;
    const endScore = endEmotion ? getScore(endEmotion) : 0;
    const emotionalShift = endScore - startScore;

    // Calculate improvement percentage (wellness score)
    // This measures how well the session went based on:
    // 1. Ending emotion vs starting emotion
    // 2. Overall positive vs negative emotions
    // 3. Whether there was improvement over time
    const positiveCount = emotionHistory.filter(e => 
      EMOTION_CATEGORIES[e.emotion.toLowerCase()] === 'positive'
    ).length;
    const neutralCount = emotionHistory.filter(e => 
      EMOTION_CATEGORIES[e.emotion.toLowerCase()] === 'neutral'
    ).length;
    
    const totalEmotions = emotionHistory.length;
    
    // Calculate wellness score (0-100)
    // Base score starts at 50 (neutral)
    let improvementPercentage = 50;
    
    if (totalEmotions > 0) {
      // Factor 1: Ending state matters most (40 points possible)
      const endCategory = EMOTION_CATEGORIES[endEmotion?.toLowerCase() || 'neutral'];
      if (endCategory === 'positive') {
        improvementPercentage += 40;
      } else if (endCategory === 'neutral') {
        improvementPercentage += 20;
      } else {
        improvementPercentage -= 10;
      }
      
      // Factor 2: Did we improve from start? (30 points possible)
      if (emotionalShift > 0) {
        improvementPercentage += 30; // Improved
      } else if (emotionalShift === 0) {
        improvementPercentage += 10; // Stayed same
      } else {
        improvementPercentage -= 15; // Got worse
      }
      
      // Factor 3: Overall positive ratio (20 points possible)
      const positiveRatio = (positiveCount + neutralCount * 0.5) / totalEmotions;
      improvementPercentage += Math.round(positiveRatio * 20);
      
      // Clamp to 0-100
      improvementPercentage = Math.max(0, Math.min(100, improvementPercentage));
    }

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (emotionalShift > 0) trend = 'improving';
    else if (emotionalShift < 0) trend = 'declining';

    // Get primary emotions
    const emotionCounts: Record<string, number> = {};
    emotionHistory.forEach(e => {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
    });
    const primaryEmotions = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion]) => emotion);

    // Get techniques used
    const techniqueCounts: Record<string, number> = {};
    emotionHistory.forEach(e => {
      if (e.technique) {
        techniqueCounts[e.technique] = (techniqueCounts[e.technique] || 0) + 1;
      }
    });
    const techniquesUsed = Object.entries(techniqueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([technique]) => technique);

    // Extract key insights from conversation
    const keyInsights: string[] = [];
    
    // Look for self-awareness moments (user realizations)
    const realizationPatterns = [
      /i (?:think|realize|see|understand|notice)/i,
      /makes? me (?:realize|see|think)/i,
      /i (?:never|didn't) (?:thought|realized)/i,
    ];
    
    conversationHistory.forEach(msg => {
      if (msg.role === 'user') {
        const content = msg.content.toLowerCase();
        
        // Check for self-awareness/realization moments
        if (realizationPatterns.some(p => p.test(content))) {
          if (content.includes('pressure') || content.includes('myself')) {
            keyInsights.push('Recognized self-imposed pressure patterns');
          }
          if (content.includes('expect') || content.includes('fulfill')) {
            keyInsights.push('Identified external expectations as a stress source');
          }
        }
        
        // Check for family/relationship insights
        if (content.includes('family') || content.includes('parent')) {
          keyInsights.push('Explored family dynamics and expectations');
        }
        
        // Check for uncertainty about future
        if (content.includes("don't know") && (content.includes('what') || content.includes('next'))) {
          keyInsights.push('Processing uncertainty about future direction');
        }
      }
    });
    
    // Remove duplicates and limit to 4
    const uniqueInsights = [...new Set(keyInsights)].slice(0, 4);

    return {
      emotionalShift,
      trend,
      primaryEmotions,
      techniquesUsed,
      startEmotion,
      endEmotion,
      improvementPercentage,
      keyInsights: uniqueInsights
    };
  }, [emotionHistory, conversationHistory]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const handleExportPDF = () => {
    // Create a printable summary
    const printContent = `
      <html>
        <head>
          <title>Session Summary - ${sessionId}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #0891b2; }
            h2 { color: #334155; margin-top: 24px; }
            .stat { display: inline-block; margin-right: 30px; margin-bottom: 20px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #0891b2; }
            .stat-label { font-size: 12px; color: #64748b; }
            .emotion-tag { display: inline-block; padding: 4px 12px; border-radius: 12px; margin: 4px; background: #f1f5f9; }
            .conversation { margin-top: 20px; }
            .message { padding: 12px; margin: 8px 0; border-radius: 8px; }
            .user { background: #f1f5f9; }
            .coach { background: #ecfeff; border-left: 3px solid #0891b2; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            .icon { display: inline-block; width: 16px; height: 16px; margin-right: 4px; }
          </style>
        </head>
        <body>
          <h1>MindfulAI - Session Summary</h1>
          <p>Session ID: ${sessionId.slice(0, 8)}... | Date: ${new Date().toLocaleDateString()}</p>
          
          <h2>Session Statistics</h2>
          <div class="stat">
            <div class="stat-value">${formatDuration(sessionDuration)}</div>
            <div class="stat-label">Duration</div>
          </div>
          <div class="stat">
            <div class="stat-value">${totalMessages}</div>
            <div class="stat-label">Messages Exchanged</div>
          </div>
          <div class="stat">
            <div class="stat-value">${insights.improvementPercentage}%</div>
            <div class="stat-label">Wellness Score</div>
          </div>
          
          <h2>Emotional Journey</h2>
          <p>Started: <strong>${insights.startEmotion || 'N/A'}</strong> → 
             Ended: <strong>${insights.endEmotion || 'N/A'}</strong>
             (${insights.trend === 'improving' ? 'Improving' : insights.trend === 'declining' ? 'Needs attention' : 'Stable'})
          </p>
          
          <h2>Techniques Applied</h2>
          ${insights.techniquesUsed.map(t => `<span class="emotion-tag">${t.replace(/_/g, ' ')}</span>`).join('')}
          
          ${insights.keyInsights && insights.keyInsights.length > 0 ? `
          <h2>Key Session Insights</h2>
          <ul>
            ${insights.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
          </ul>
          ` : ''}
          
          <h2>Conversation Transcript</h2>
          <div class="conversation">
            ${conversationHistory.map(msg => `
              <div class="message ${msg.role}">
                <strong>${msg.role === 'user' ? 'You' : 'Coach'}:</strong> ${msg.content}
                ${msg.emotion ? `<br><small>Detected emotion: ${msg.emotion}</small>` : ''}
              </div>
            `).join('')}
          </div>
          
          <div class="footer">
            <p>Generated by MindfulAI | Google Cloud AI Partner Catalyst Hackathon</p>
            <p>This is not a substitute for professional mental health care.</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Session Complete</h2>
                <p className="text-sm text-slate-400">Great job taking time for yourself</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={<Clock className="w-5 h-5 text-cyan-400" />}
              value={formatDuration(sessionDuration)}
              label="Duration"
            />
            <StatCard
              icon={<MessageSquare className="w-5 h-5 text-purple-400" />}
              value={totalMessages.toString()}
              label="Messages"
            />
            <StatCard
              icon={<Brain className="w-5 h-5 text-green-400" />}
              value={`${insights.improvementPercentage}%`}
              label="Wellness Score"
            />
          </div>

          {/* Emotional Journey */}
          <div className="bg-slate-700/30 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Emotional Journey
            </h3>
            
            {emotionHistory.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-center">
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-1"
                      style={{ 
                        backgroundColor: `${EMOTION_COLORS[insights.startEmotion?.toLowerCase() || 'neutral']}30`
                      }}
                    >
                      {getEmotionIcon(insights.startEmotion || 'neutral')}
                    </div>
                    <span className="text-xs text-slate-400">Started</span>
                    <div className="text-sm text-white capitalize">{insights.startEmotion}</div>
                  </div>

                  <div className="flex-1 mx-4 flex items-center">
                    <div className="flex-1 h-1 bg-slate-600 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          insights.trend === 'improving' ? 'bg-gradient-to-r from-slate-500 to-green-400' :
                          insights.trend === 'declining' ? 'bg-gradient-to-r from-slate-500 to-orange-400' :
                          'bg-slate-500'
                        }`}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className={`mx-2 p-1 rounded-full ${
                      insights.trend === 'improving' ? 'bg-green-500/20 text-green-400' :
                      insights.trend === 'declining' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {insights.trend === 'improving' ? <TrendingUp className="w-4 h-4" /> :
                       insights.trend === 'declining' ? <TrendingDown className="w-4 h-4" /> :
                       <Minus className="w-4 h-4" />}
                    </div>
                  </div>

                  <div className="text-center">
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-1 ring-2 ring-cyan-400/50"
                      style={{ 
                        backgroundColor: `${EMOTION_COLORS[insights.endEmotion?.toLowerCase() || 'neutral']}30`
                      }}
                    >
                      {getEmotionIcon(insights.endEmotion || 'neutral')}
                    </div>
                    <span className="text-xs text-slate-400">Ended</span>
                    <div className="text-sm text-white capitalize">{insights.endEmotion}</div>
                  </div>
                </div>

                {/* Emotion timeline mini-visualization */}
                <div className="h-8 flex gap-1 rounded-lg overflow-hidden bg-slate-800/50 p-1">
                  {emotionHistory.map((point, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded transition-all hover:scale-y-110"
                      style={{ 
                        backgroundColor: EMOTION_COLORS[point.emotion.toLowerCase()] || '#64748b',
                        opacity: 0.7 + (i / emotionHistory.length) * 0.3
                      }}
                      title={`${point.emotion} (${Math.round(point.intensity * 100)}%)`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-center py-4">No emotion data recorded</p>
            )}
          </div>

          {/* Techniques Used */}
          {insights.techniquesUsed.length > 0 && (
            <div className="bg-slate-700/30 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Techniques Applied
              </h3>
              <div className="flex flex-wrap gap-2">
                {insights.techniquesUsed.map((technique, i) => (
                  <span 
                    key={i}
                    className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 text-sm rounded-full capitalize"
                  >
                    {technique.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Insights */}
          {insights.keyInsights && insights.keyInsights.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl p-5 border border-yellow-500/20">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-yellow-400" />
                Key Session Insights
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {insights.keyInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Wellness Tips */}
          <div className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-2xl p-5 border border-purple-500/20">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-purple-400" /> Wellness Tips
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                Continue practicing the techniques from today's session
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Consider scheduling regular check-ins with yourself
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Remember: It's okay to seek professional support when needed
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between bg-slate-800/50">
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 
                         text-white rounded-xl transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export Summary
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 
                         text-white rounded-xl transition-colors text-sm"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white 
                       font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper components
const StatCard: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ 
  icon, value, label 
}) => (
  <div className="bg-slate-700/30 rounded-xl p-4 text-center">
    <div className="flex justify-center mb-2">{icon}</div>
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-xs text-slate-400">{label}</div>
  </div>
);

export default SessionSummary;
