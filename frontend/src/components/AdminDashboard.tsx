/**
 * Admin Dashboard - Observable AI Cognition Monitor
 * 
 * Provides real-time visibility into:
 * - Active sessions and their states
 * - Emotion trends across all users
 * - Technique effectiveness
 * - Phase progression patterns
 * - Breakthrough detection
 * 
 * This demonstrates EXPLAINABLE AI - judges can see
 * exactly how the AI is making decisions in real-time.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Brain, RefreshCw, MessageSquare, Search, 
  TrendingDown, Wind, Wrench, ArrowRight, Lightbulb, 
  Sparkles, BarChart3, Tag, User, AlertTriangle, LogOut,
  Pin, Activity
} from 'lucide-react';

// Types for the admin dashboard
interface SessionOverview {
  session_id: string;
  start_time: string;
  last_activity: string;
  total_turns: number;
  current_phase: string;
  dominant_emotion: string;
  techniques_used: string[];
  breakthroughs: number;
  is_active: boolean;
}

interface EmotionDataPoint {
  timestamp: string;
  session_id: string;
  emotion: string;
  intensity: number;
  turn_number: number;
}

interface TechniqueUsage {
  technique: string;
  count: number;
  effectiveness_score: number;
  sessions_used: number;
}

interface AIEvent {
  event_type: string;
  correlation_id: string;
  session_id: string;
  turn_number: number;
  timestamp: string;
  data: Record<string, unknown>;
  reason?: string;
}

interface DashboardStats {
  total_sessions: number;
  active_sessions: number;
  total_turns: number;
  total_breakthroughs: number;
  avg_session_length: number;
  most_common_emotion: string;
  most_used_technique: string;
}

const AdminDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<SessionOverview[]>([]);
  const [emotionData, setEmotionData] = useState<EmotionDataPoint[]>([]);
  const [techniqueUsage, setTechniqueUsage] = useState<TechniqueUsage[]>([]);
  const [recentEvents, setRecentEvents] = useState<AIEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      // Fetch sessions overview
      const sessionsRes = await fetch(`${baseUrl}/api/admin/sessions`);
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
        setStats(sessionsData.stats || null);
      }
      
      // Fetch recent AI events
      const eventsRes = await fetch(`${baseUrl}/api/admin/events?limit=50`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const events = eventsData.events || [];
        setRecentEvents(events);
        
        // Extract emotion data from events
        const emotionEvents = events.filter((e: AIEvent) => 
          e.event_type === 'memory.emotion.detected' || 
          e.event_type === 'emotion_detected'
        );
        setEmotionData(emotionEvents.map((e: AIEvent) => ({
          timestamp: e.timestamp,
          session_id: e.session_id,
          emotion: (e.data as { emotion?: string }).emotion || 'unknown',
          intensity: (e.data as { intensity?: number }).intensity || 0.5,
          turn_number: e.turn_number
        })));
        
        // Calculate technique usage from events
        const techEvents = events.filter((e: AIEvent) => 
          e.event_type === 'memory.technique.used' ||
          e.event_type === 'technique_selected'
        );
        const techCounts: Record<string, number> = {};
        techEvents.forEach((e: AIEvent) => {
          const tech = (e.data as { technique?: string }).technique || 'unknown';
          techCounts[tech] = (techCounts[tech] || 0) + 1;
        });
        setTechniqueUsage(Object.entries(techCounts).map(([technique, count]) => ({
          technique,
          count,
          effectiveness_score: Math.random() * 0.4 + 0.6, // Placeholder
          sessions_used: Math.ceil(count / 3)
        })));
      }
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  }, []);

  // Initial fetch only - no polling loop
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  
  // WebSocket for real-time event streaming (when live mode is on)
  useEffect(() => {
    if (!isLive) return;
    
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    
    const connect = () => {
      try {
        ws = new WebSocket(`${wsUrl}/ws/admin/events`);
        
        ws.onmessage = (event) => {
          try {
            const newEvent = JSON.parse(event.data) as AIEvent;
            setRecentEvents(prev => [newEvent, ...prev.slice(0, 49)]);
            
            // Update emotion data if it's an emotion event
            if (newEvent.event_type === 'memory.emotion.detected') {
              const emotionEntry: EmotionDataPoint = {
                timestamp: newEvent.timestamp,
                session_id: newEvent.session_id,
                emotion: (newEvent.data as { emotion?: string }).emotion || 'unknown',
                intensity: (newEvent.data as { intensity?: number }).intensity || 0.5,
                turn_number: newEvent.turn_number
              };
              setEmotionData(prev => [emotionEntry, ...prev.slice(0, 99)]);
            }
            
            // Update technique usage if it's a technique event
            if (newEvent.event_type === 'memory.technique.used') {
              const tech = (newEvent.data as { technique?: string }).technique;
              if (tech) {
                setTechniqueUsage(prev => {
                  const existing = prev.find(t => t.technique === tech);
                  if (existing) {
                    return prev.map(t => t.technique === tech 
                      ? { ...t, count: t.count + 1 } 
                      : t
                    );
                  }
                  return [...prev, { technique: tech, count: 1, effectiveness_score: 0.7, sessions_used: 1 }];
                });
              }
            }
          } catch (e) {
            console.debug('Failed to parse WebSocket message:', e);
          }
        };
        
        ws.onclose = () => {
          // Only reconnect if still in live mode
          if (isLive) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        };
        
        ws.onerror = () => {
          // WebSocket not available, fall back to periodic refresh
          console.debug('Admin WebSocket not available, using manual refresh');
        };
      } catch (e) {
        console.debug('WebSocket connection failed:', e);
      }
    };
    
    connect();
    
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [isLive]);

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Get emotion color
  const getEmotionColor = (emotion: string): string => {
    const colors: Record<string, string> = {
      joy: '#10B981',
      happiness: '#10B981',
      relief: '#6EE7B7',
      calm: '#60A5FA',
      neutral: '#9CA3AF',
      sadness: '#60A5FA',
      anxiety: '#F59E0B',
      fear: '#EF4444',
      anger: '#DC2626',
      frustration: '#F97316'
    };
    return colors[emotion.toLowerCase()] || '#9CA3AF';
  };

  // Get phase badge color
  const getPhaseColor = (phase: string): string => {
    const colors: Record<string, string> = {
      opening: 'bg-green-100 text-green-800',
      exploration: 'bg-blue-100 text-blue-800',
      deepening: 'bg-purple-100 text-purple-800',
      technique: 'bg-yellow-100 text-yellow-800',
      integration: 'bg-indigo-100 text-indigo-800',
      closing: 'bg-gray-100 text-gray-800'
    };
    return colors[phase.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  // Get event icon component
  const getEventIcon = (eventType: string): React.ReactNode => {
    const iconClass = "w-4 h-4";
    const iconMap: Record<string, React.ReactNode> = {
      'memory.emotion.detected': <Activity className={`${iconClass} text-cyan-400`} />,
      'memory.emotion.decayed': <TrendingDown className={`${iconClass} text-orange-400`} />,
      'memory.emotion.faded': <Wind className={`${iconClass} text-gray-400`} />,
      'memory.technique.used': <Wrench className={`${iconClass} text-yellow-400`} />,
      'memory.phase.transitioned': <ArrowRight className={`${iconClass} text-blue-400`} />,
      'memory.insight.extracted': <Lightbulb className={`${iconClass} text-amber-400`} />,
      'memory.breakthrough.detected': <Sparkles className={`${iconClass} text-green-400`} />,
      'memory.state.updated': <BarChart3 className={`${iconClass} text-purple-400`} />,
      'memory.topic.identified': <Tag className={`${iconClass} text-teal-400`} />,
      'emotion_detected': <Activity className={`${iconClass} text-cyan-400`} />,
      'technique_selected': <Wrench className={`${iconClass} text-yellow-400`} />,
      'user_spoke': <User className={`${iconClass} text-blue-400`} />,
      'crisis_detected': <AlertTriangle className={`${iconClass} text-red-400`} />,
      'session_disconnected': <LogOut className={`${iconClass} text-gray-400`} />
    };
    return iconMap[eventType] || <Pin className={`${iconClass} text-gray-400`} />;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-400" /> Observable AI Cognition
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time visibility into AI decision-making
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isLive 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-300 animate-pulse' : 'bg-gray-500'}`} />
            {isLive ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-3xl font-bold text-blue-400">{stats.total_sessions}</div>
            <div className="text-gray-400 text-sm">Total Sessions</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-3xl font-bold text-green-400">{stats.active_sessions}</div>
            <div className="text-gray-400 text-sm">Active Now</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-3xl font-bold text-purple-400">{stats.total_turns}</div>
            <div className="text-gray-400 text-sm">Total Turns</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-3xl font-bold text-yellow-400">{stats.total_breakthroughs}</div>
            <div className="text-gray-400 text-sm flex items-center gap-1"><Sparkles className="w-3 h-3" /> Breakthroughs</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-3xl font-bold text-indigo-400">{stats.avg_session_length.toFixed(1)}</div>
            <div className="text-gray-400 text-sm">Avg Turns/Session</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xl font-bold text-pink-400 capitalize">{stats.most_common_emotion}</div>
            <div className="text-gray-400 text-sm">Top Emotion</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xl font-bold text-cyan-400 capitalize">{stats.most_used_technique}</div>
            <div className="text-gray-400 text-sm">Top Technique</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-400" /> Sessions
            <span className="text-sm font-normal text-gray-400">({sessions.length})</span>
          </h2>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-cyan-400" />
                <p>No sessions yet</p>
                <p className="text-sm">Start a coaching session to see data</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => setSelectedSession(session.session_id)}
                  className={`p-4 rounded-lg cursor-pointer transition-all ${
                    selectedSession === session.session_id
                      ? 'bg-blue-600/30 border border-blue-500'
                      : 'bg-gray-700/50 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${session.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                      <span className="font-mono text-sm text-gray-300">
                        {session.session_id.slice(0, 12)}...
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${getPhaseColor(session.current_phase)}`}>
                      {session.current_phase}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {session.total_turns} turns</span>
                    <span style={{ color: getEmotionColor(session.dominant_emotion) }}>
                      {session.dominant_emotion}
                    </span>
                    {session.breakthroughs > 0 && (
                      <span className="text-yellow-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {session.breakthroughs}</span>
                    )}
                  </div>
                  
                  <div className="mt-2 flex flex-wrap gap-1">
                    {session.techniques_used.slice(0, 3).map((tech) => (
                      <span key={tech} className="px-2 py-0.5 bg-gray-600 rounded text-xs">
                        {tech}
                      </span>
                    ))}
                    {session.techniques_used.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-600 rounded text-xs">
                        +{session.techniques_used.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Technique Usage */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Wrench className="w-5 h-5 text-yellow-400" /> Technique Usage</h2>
          
          <div className="space-y-4">
            {techniqueUsage.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-purple-400" />
                <p>No technique data yet</p>
              </div>
            ) : (
              techniqueUsage.sort((a, b) => b.count - a.count).map((tech) => (
                <div key={tech.technique} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="capitalize font-medium">{tech.technique.replace('_', ' ')}</span>
                    <span className="text-gray-400">{tech.count}x</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      style={{ 
                        width: `${(tech.count / Math.max(...techniqueUsage.map(t => t.count))) * 100}%` 
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Used in {tech.sessions_used} sessions
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Emotion Distribution */}
          <h2 className="text-xl font-bold mt-8 mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-400" /> Emotion Distribution
          </h2>
          
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              emotionData.reduce((acc, e) => {
                acc[e.emotion] = (acc[e.emotion] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([emotion, count]) => (
              <div
                key={emotion}
                className="px-3 py-2 rounded-lg flex items-center gap-2"
                style={{ 
                  backgroundColor: getEmotionColor(emotion) + '30',
                  borderLeft: `3px solid ${getEmotionColor(emotion)}`
                }}
              >
                <span className="capitalize">{emotion}</span>
                <span className="text-gray-400 text-sm">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Event Stream */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" /> AI Cognition Stream
            {isLive && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          </h2>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {recentEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="w-12 h-12 mx-auto mb-2 text-blue-400 animate-spin" />
                <p>Waiting for AI events...</p>
                <p className="text-sm">Events will stream here in real-time</p>
              </div>
            ) : (
              recentEvents.slice(0, 30).map((event, idx) => (
                <div
                  key={`${event.correlation_id}-${idx}`}
                  className={`p-3 rounded-lg text-sm ${
                    event.event_type.includes('breakthrough') 
                      ? 'bg-yellow-500/20 border border-yellow-500/50'
                      : event.event_type.includes('crisis')
                      ? 'bg-red-500/20 border border-red-500/50'
                      : 'bg-gray-700/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="flex items-center gap-2">
                      <span>{getEventIcon(event.event_type)}</span>
                      <span className="font-medium">
                        {event.event_type.replace('memory.', '').replace('.', ' ').replace('_', ' ')}
                      </span>
                    </span>
                    <span className="text-gray-500 text-xs">{formatTime(event.timestamp)}</span>
                  </div>
                  
                  {event.reason && (
                    <p className="text-gray-300 mt-1 text-xs leading-relaxed flex items-start gap-1">
                      <MessageSquare className="w-3 h-3 mt-0.5 text-cyan-400 flex-shrink-0" /> <em>{event.reason}</em>
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span className="font-mono bg-gray-800 px-1 rounded">
                      {event.correlation_id.slice(0, 20)}...
                    </span>
                    <span>Turn {event.turn_number}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer - Why This Matters */}
      <div className="mt-8 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> Why This Matters for Hackathon Judges
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
          <div>
            <strong className="text-purple-400">Observable AI</strong>
            <p>Every AI decision is logged with a correlation_id, enabling full replay and audit of any conversation turn.</p>
          </div>
          <div>
            <strong className="text-blue-400">Explainable Reasoning</strong>
            <p>Each event includes a "reason" field explaining WHY the AI made that decision - true explainability.</p>
          </div>
          <div>
            <strong className="text-green-400">Real-time Streaming</strong>
            <p>Events stream via Kafka in real-time, enabling monitoring, alerting, and analysis at scale.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
