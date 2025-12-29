import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mic, MicOff, Volume2, Loader2, ChevronRight, ChevronLeft, LogOut, Sparkles, Wind, Leaf, Target } from 'lucide-react';
import { WebSocketClient } from '../services/websocket';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { useSpeechRecognition, getAudioDuration } from '../hooks/useSpeechRecognition';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { WebSocketMessage, ConversationTurn } from '../types';
import ConversationHistory from './ConversationHistory';
import EmotionIndicator from './EmotionIndicator';
import VoiceVisualizer from './VoiceVisualizer';
import AIDecisionDashboard from './AIDecisionDashboard';
import SessionInsights from './SessionInsights';
import SessionSummary from './SessionSummary';
import { BreathingExercise, GroundingExercise } from './exercises';

interface CoachingSessionProps {
  sessionId: string;
  onEndSession: () => void;
}

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

interface EmotionDataPoint {
  timestamp: Date;
  emotion: string;
  intensity: number;
  technique: string;
}

export default function CoachingSession({ sessionId, onEndSession }: CoachingSessionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [showDashboard, setShowDashboard] = useState(true);
  const [aiDecisions, setAiDecisions] = useState<AIDecision | null>(null);
  const [safetyStatus, setSafetyStatus] = useState<'safe' | 'caution' | 'crisis'>('safe');
  const [emotionHistory, setEmotionHistory] = useState<EmotionDataPoint[]>([]);
  const [sessionStartTime] = useState(Date.now());
  const [sessionDuration, setSessionDuration] = useState(0);
  
  // Exercise states
  const [showBreathingExercise, setShowBreathingExercise] = useState(false);
  const [showGroundingExercise, setShowGroundingExercise] = useState(false);
  const [breathingPattern, setBreathingPattern] = useState<'box' | '478' | 'calm'>('box');
  
  // Session summary state
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  
  // Session closure suggestion state
  const [showClosureSuggestion, setShowClosureSuggestion] = useState(false);
  
  const wsRef = useRef<WebSocketClient | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  
  const {
    conversationHistory,
    addTurn,
    clearHistory,
    voiceState,
    setVoiceState,
    currentEmotion,
    setCurrentEmotion,
    currentTechnique,
    setCurrentTechnique,
  } = useSession();

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechSupported,
  } = useSpeechRecognition();

  const { playAudio, stopAudio } = useAudioPlayer();

  // Check if message mentions exercises and trigger them
  const checkForExerciseTrigger = useCallback((text: string, technique: string) => {
    const lowerText = text.toLowerCase();
    const lowerTechnique = technique?.toLowerCase() || '';
    
    // Check for breathing exercise triggers
    if (lowerTechnique.includes('breathing') || 
        lowerText.includes('breathing exercise') ||
        lowerText.includes('take a deep breath') ||
        lowerText.includes('let\'s breathe together')) {
      
      // Determine breathing pattern based on context
      if (lowerText.includes('box') || lowerText.includes('4-4-4-4')) {
        setBreathingPattern('box');
      } else if (lowerText.includes('4-7-8') || lowerText.includes('relaxation')) {
        setBreathingPattern('478');
      } else {
        setBreathingPattern('calm');
      }
      
      // Delay showing exercise until after audio plays
      setTimeout(() => setShowBreathingExercise(true), 2000);
    }
    
    // Check for grounding exercise triggers
    if (lowerTechnique.includes('grounding') ||
        lowerText.includes('grounding exercise') ||
        lowerText.includes('5-4-3-2-1') ||
        lowerText.includes('five things you can see')) {
      setTimeout(() => setShowGroundingExercise(true), 2000);
    }
  }, []);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(async (message: WebSocketMessage) => {
    console.log('Processing message:', message.type);

    switch (message.type) {
      case 'coach_response':
        // Add coach response to history
        const coachTurn: ConversationTurn = {
          turn_id: Date.now().toString(),
          role: 'coach',
          content: message.text || '',
          emotion: message.emotion || undefined,
          technique: message.technique,
          timestamp: new Date().toISOString(),
        };
        addTurn(coachTurn);

        // Update current emotion and technique
        if (message.emotion) {
          setCurrentEmotion(message.emotion);
          
          // Track emotion history for insights
          setEmotionHistory(prev => [...prev, {
            timestamp: new Date(),
            emotion: message.emotion!,
            intensity: message.intensity || 0.5,
            technique: message.technique || ''
          }]);
        }
        if (message.technique) {
          setCurrentTechnique(message.technique);
        }

        // Update AI decision dashboard data
        if (message.ai_decisions) {
          setAiDecisions(message.ai_decisions);
        }

        // Check if this message should trigger an exercise
        checkForExerciseTrigger(message.text || '', message.technique || '');

        // Play audio response
        if (message.audio_base64) {
          setVoiceState({ isSpeaking: true, isProcessing: false });
          try {
            await playAudio(message.audio_base64);
          } catch (error) {
            console.error('Failed to play audio:', error);
          }
          setVoiceState({ isSpeaking: false });
        } else {
          setVoiceState({ isProcessing: false });
        }
        break;

      case 'safety_alert':
        // Update safety status
        setSafetyStatus('crisis');
        
        // Handle safety alert with crisis resources
        const safetyTurn: ConversationTurn = {
          turn_id: Date.now().toString(),
          role: 'coach',
          content: message.text || '',
          timestamp: new Date().toISOString(),
        };
        addTurn(safetyTurn);

        if (message.audio_base64) {
          setVoiceState({ isSpeaking: true, isProcessing: false });
          try {
            await playAudio(message.audio_base64);
          } catch (error) {
            console.error('Failed to play audio:', error);
          }
          setVoiceState({ isSpeaking: false });
        }
        
        // Reset safety status after 10 seconds
        setTimeout(() => setSafetyStatus('safe'), 10000);
        break;

      case 'error':
        console.error('Server error:', message.message);
        setVoiceState({ isProcessing: false });
        break;

      case 'pong':
        // Heartbeat response, ignore
        break;
      
      case 'session_closure_ready':
        // AI detected positive resolution - suggest ending session
        console.log('Session closure suggested:', message);
        setShowClosureSuggestion(true);
        break;
    }
  }, [addTurn, setCurrentEmotion, setCurrentTechnique, setVoiceState, playAudio, checkForExerciseTrigger]);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocketClient(
      sessionId,
      handleWebSocketMessage,
      setIsConnected
    );
    
    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [sessionId, handleWebSocketMessage]);

  // Update session duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Update transcript state as user speaks
  useEffect(() => {
    if (transcript) {
      setCurrentTranscript(transcript);
    }
  }, [transcript]);

  // Handle starting to speak
  const handleStartSpeaking = useCallback(() => {
    if (!isSpeechSupported) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    stopAudio(); // Stop any playing audio
    speechStartTimeRef.current = Date.now();
    startListening();
    setVoiceState({ isListening: true });
  }, [isSpeechSupported, startListening, setVoiceState, stopAudio]);

  // Handle stopping speech and sending to server
  const handleStopSpeaking = useCallback(() => {
    stopListening();
    setVoiceState({ isListening: false });

    // Small delay to allow speech recognition to finalize the transcript
    setTimeout(() => {
      const finalTranscript = transcript || currentTranscript;
      
      if (finalTranscript && finalTranscript.trim() && wsRef.current?.isConnected()) {
        // Add user message to history
        const userTurn: ConversationTurn = {
          turn_id: Date.now().toString(),
          role: 'user',
          content: finalTranscript.trim(),
          timestamp: new Date().toISOString(),
        };
        addTurn(userTurn);

        // Send to server
        const duration = getAudioDuration(speechStartTimeRef.current);
        wsRef.current.sendUserSpeech(finalTranscript.trim(), duration);
        
        setVoiceState({ isProcessing: true });
      }

      resetTranscript();
      setCurrentTranscript('');
    }, 150); // Wait for recognition to finalize
  }, [stopListening, transcript, currentTranscript, addTurn, setVoiceState, resetTranscript]);

  // Handle requesting to end the session (shows summary first)
  const handleRequestEndSession = useCallback(() => {
    setShowSessionSummary(true);
  }, []);

  // Handle exercise completion - send feedback to coach
  const handleExerciseComplete = useCallback((exerciseType: string) => {
    // Close the exercise overlay
    if (exerciseType === 'breathing') {
      setShowBreathingExercise(false);
    } else if (exerciseType === 'grounding') {
      setShowGroundingExercise(false);
    }
    
    // Send exercise completion message to the backend
    // This allows the AI to continue the conversation with context
    if (wsRef.current?.isConnected()) {
      const feedbackMessage = exerciseType === 'breathing' 
        ? "The breathing exercise helped, thank you."
        : "I completed the grounding exercise.";
      
      // Add as user message
      const userTurn: ConversationTurn = {
        turn_id: Date.now().toString(),
        role: 'user',
        content: feedbackMessage,
        timestamp: new Date().toISOString(),
      };
      addTurn(userTurn);
      
      // Send to backend so AI can respond contextually
      wsRef.current.sendUserSpeech(feedbackMessage, 0);
      setVoiceState({ isProcessing: true });
    }
  }, [addTurn, setVoiceState]);

  // Handle actually ending the session after summary
  const handleEndSession = useCallback(async () => {
    setShowSessionSummary(false);
    
    try {
      await api.endSession(sessionId);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
    
    wsRef.current?.disconnect();
    clearHistory();
    onEndSession();
  }, [sessionId, clearHistory, onEndSession]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} ${isConnected ? 'animate-pulse' : ''}`} />
            <span className="text-sm text-slate-300">
              {isConnected ? 'AI Coach Connected' : 'Connecting...'}
            </span>
            <span className="text-xs text-slate-500 ml-2">
              Session: {sessionId.slice(0, 8)}...
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {currentEmotion && (
              <EmotionIndicator emotion={currentEmotion} technique={currentTechnique} />
            )}
            
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-300 
                         bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg transition-colors"
            >
              {showDashboard ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {showDashboard ? 'Hide Dashboard' : 'Show AI Dashboard'}
            </button>
            
            <button
              onClick={handleRequestEndSession}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content with Optional Sidebar */}
      <main className="flex-1 flex overflow-hidden">
        {/* Conversation Area */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${showDashboard ? 'mr-80' : ''}`}>
          <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 flex flex-col">
            {/* Conversation History */}
            <div className="flex-1 overflow-y-auto mb-6">
              <ConversationHistory turns={conversationHistory} />
            </div>

            {/* Current Transcript */}
            {(voiceState.isListening || currentTranscript) && (
              <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-slate-700">
                <p className="text-cyan-400 text-sm mb-1">You're saying:</p>
                <p className="text-white">
                  {currentTranscript || 'Listening...'}
                </p>
              </div>
            )}

            {/* Voice Control */}
            <div className="flex flex-col items-center space-y-4">
              {/* Voice Visualizer */}
              <VoiceVisualizer 
                isActive={voiceState.isListening || voiceState.isSpeaking}
                mode={voiceState.isListening ? 'listening' : voiceState.isSpeaking ? 'speaking' : 'idle'}
              />

              {/* Status Text */}
              <p className="text-sm text-slate-400">
                {voiceState.isListening && ' Listening...'}
                {voiceState.isProcessing && ' AI Processing...'}
                {voiceState.isSpeaking && ' Coach Speaking...'}
                {!voiceState.isListening && !voiceState.isProcessing && !voiceState.isSpeaking && 'Press and hold to speak'}
              </p>

              {/* Main Voice Button */}
              <button
                onMouseDown={handleStartSpeaking}
                onMouseUp={handleStopSpeaking}
                onMouseLeave={isListening ? handleStopSpeaking : undefined}
                onTouchStart={handleStartSpeaking}
                onTouchEnd={handleStopSpeaking}
                disabled={voiceState.isProcessing || voiceState.isSpeaking || !isConnected}
                className={`
                  w-20 h-20 rounded-full flex items-center justify-center
                  transition-all duration-200 transform
                  ${voiceState.isListening 
                    ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30 ring-4 ring-red-500/20' 
                    : voiceState.isProcessing 
                      ? 'bg-cyan-500 animate-pulse'
                      : voiceState.isSpeaking
                        ? 'bg-green-500 shadow-lg shadow-green-500/30'
                        : 'bg-gradient-to-br from-cyan-400 to-blue-500 hover:scale-105 shadow-lg shadow-cyan-500/30'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                `}
              >
                {voiceState.isProcessing ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : voiceState.isSpeaking ? (
                  <Volume2 className="w-8 h-8 text-white" />
                ) : voiceState.isListening ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </button>

              {/* End Session Button */}
              <button
                onClick={handleRequestEndSession}
                className="flex items-center gap-2 px-4 py-2 mt-4 text-sm text-slate-400 
                           hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                End Session
              </button>
            </div>
          </div>
        </div>

        {/* AI Decision Dashboard Sidebar */}
        {showDashboard && (
          <div className="fixed right-0 top-[57px] bottom-0 w-80 bg-slate-900/95 backdrop-blur-sm 
                          border-l border-slate-700 overflow-y-auto p-4 space-y-4">
            <AIDecisionDashboard 
              aiDecisions={aiDecisions}
              isProcessing={voiceState.isProcessing}
              safetyStatus={safetyStatus}
            />
            
            <SessionInsights 
              emotionHistory={emotionHistory}
              sessionDuration={sessionDuration}
              totalMessages={conversationHistory.length}
            />

            {/* Quick Exercise Buttons for Demo */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Try Exercises
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => { setBreathingPattern('box'); setShowBreathingExercise(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 
                             text-cyan-300 rounded-lg transition-colors text-sm"
                >
                  <Wind className="w-4 h-4" /> Box Breathing
                </button>
                <button
                  onClick={() => { setBreathingPattern('478'); setShowBreathingExercise(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 
                             text-purple-300 rounded-lg transition-colors text-sm"
                >
                  <Wind className="w-4 h-4" /> 4-7-8 Relaxation
                </button>
                <button
                  onClick={() => setShowGroundingExercise(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 
                             text-green-300 rounded-lg transition-colors text-sm"
                >
                  <Leaf className="w-4 h-4" /> 5-4-3-2-1 Grounding
                </button>
              </div>
            </div>

            {/* Demo Mode Indicator */}
            <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-semibold text-white">Hackathon Demo Mode</span>
              </div>
              <p className="text-xs text-slate-300">
                This dashboard shows the AI's real-time decision-making process,
                demonstrating transparency in mental health AI.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="text-xs px-2 py-0.5 bg-cyan-500/30 text-cyan-300 rounded-full">Google Vertex AI</span>
                <span className="text-xs px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded-full">ElevenLabs</span>
                <span className="text-xs px-2 py-0.5 bg-orange-500/30 text-orange-300 rounded-full">Confluent</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Breathing Exercise Overlay */}
      <BreathingExercise
        isActive={showBreathingExercise}
        pattern={breathingPattern}
        onComplete={() => handleExerciseComplete('breathing')}
        cycles={3}
      />

      {/* Grounding Exercise Overlay */}
      <GroundingExercise
        isActive={showGroundingExercise}
        onComplete={() => handleExerciseComplete('grounding')}
      />

      {/* Session Summary Modal */}
      <SessionSummary
        isOpen={showSessionSummary}
        onClose={handleEndSession}
        sessionId={sessionId}
        sessionDuration={sessionDuration}
        emotionHistory={emotionHistory}
        totalMessages={conversationHistory.length}
        conversationHistory={conversationHistory.map(turn => ({
          role: turn.role,
          content: turn.content,
          emotion: turn.emotion,
          technique: turn.technique
        }))}
      />

      {/* Session Closure Suggestion Banner */}
      {showClosureSuggestion && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 
                        bg-gradient-to-r from-green-600/95 to-emerald-600/95 backdrop-blur-lg 
                        rounded-2xl p-5 shadow-2xl border border-green-400/30 max-w-md mx-4
                        animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">✨</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-1">
                You've made great progress!
              </h3>
              <p className="text-green-100 text-sm mb-4">
                It looks like you're feeling better. Would you like to wrap up this session 
                and see your progress summary?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSessionSummary(true)}
                  className="px-4 py-2 bg-white text-green-700 font-medium rounded-lg 
                             hover:bg-green-50 transition-colors text-sm"
                >
                  End Session
                </button>
                <button
                  onClick={() => setShowClosureSuggestion(false)}
                  className="px-4 py-2 bg-green-700/50 text-white rounded-lg 
                             hover:bg-green-700/70 transition-colors text-sm"
                >
                  Continue Talking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
