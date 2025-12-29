import { useRef, useEffect } from 'react';
import { 
  User, Heart, Sparkles, Ear, HelpCircle, Brain, Leaf, 
  Wind, Star, ClipboardList, Hand, Search, Shield 
} from 'lucide-react';
import { ConversationTurn } from '../types';

interface ConversationHistoryProps {
  turns: ConversationTurn[];
}

export default function ConversationHistory({ turns }: ConversationHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  if (turns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
        <div className="relative mb-4">
          <Heart className="w-16 h-16 opacity-30 text-cyan-400" />
          <Sparkles className="w-6 h-6 absolute -top-1 -right-1 text-cyan-400 animate-pulse" />
        </div>
        <p className="text-lg font-medium text-slate-300">MindfulAI is ready to support you</p>
        <p className="text-sm mt-2 text-slate-500">Press and hold the microphone to start speaking.</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">Powered by Gemini</span>
          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">ElevenLabs Voice</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <MessageBubble key={turn.turn_id} turn={turn} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start space-x-3 max-w-[80%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          ${isUser 
            ? 'bg-slate-700 text-slate-300 border border-slate-600' 
            : 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
          }
        `}>
          {isUser ? (
            <User className="w-5 h-5" />
          ) : (
            <Heart className="w-5 h-5" />
          )}
        </div>

        {/* Message Content */}
        <div className={`
          rounded-2xl px-4 py-3
          ${isUser 
            ? 'bg-slate-700 text-white rounded-tr-md border border-slate-600' 
            : 'bg-slate-800/80 backdrop-blur shadow-lg border border-slate-700 text-slate-100 rounded-tl-md'
          }
        `}>
          <p className="text-sm leading-relaxed">{turn.content}</p>
          
          {/* Metadata for coach messages */}
          {!isUser && turn.technique && (
            <div className="mt-2 pt-2 border-t border-slate-700 flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full">
                {formatTechnique(turn.technique)}
              </span>
              {turn.emotion && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-400">
                    Detected: <span className="text-yellow-400 capitalize">{turn.emotion}</span>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTechnique(technique: string): React.ReactNode {
  const iconClass = "w-3 h-3 inline mr-1";
  const techniqueNames: Record<string, { icon: React.ReactNode; label: string }> = {
    reflective_listening: { icon: <Ear className={iconClass} />, label: 'Reflective Listening' },
    open_ended_questioning: { icon: <HelpCircle className={iconClass} />, label: 'Open-Ended Questions' },
    cognitive_reframing: { icon: <Brain className={iconClass} />, label: 'Cognitive Reframing' },
    grounding_exercise: { icon: <Leaf className={iconClass} />, label: 'Grounding' },
    grounding: { icon: <Leaf className={iconClass} />, label: 'Grounding' },
    breathing_exercise: { icon: <Wind className={iconClass} />, label: 'Breathing Exercise' },
    validation: { icon: <Heart className={iconClass} />, label: 'Validation' },
    strength_recognition: { icon: <Star className={iconClass} />, label: 'Strength Recognition' },
    action_planning: { icon: <ClipboardList className={iconClass} />, label: 'Action Planning' },
    greeting: { icon: <Hand className={iconClass} />, label: 'Welcome' },
    exploration: { icon: <Search className={iconClass} />, label: 'Exploration' },
    encouragement: { icon: <Star className={iconClass} />, label: 'Encouragement' },
    coping_strategy: { icon: <Shield className={iconClass} />, label: 'Coping Strategy' },
  };

  const info = techniqueNames[technique];
  if (info) {
    return <span className="flex items-center">{info.icon}{info.label}</span>;
  }
  return technique;
}
