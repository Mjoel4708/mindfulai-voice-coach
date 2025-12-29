import { useState } from 'react';
import { Heart, Mic, Brain, Waves, Activity } from 'lucide-react';
import { api } from '../services/api';

interface WelcomeScreenProps {
  onStartSession: (sessionId: string) => void;
}

export default function WelcomeScreen({ onStartSession }: WelcomeScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.createSession();
      onStartSession(response.session_id);
    } catch (err) {
      setError('Failed to start session. Please try again.');
      console.error('Failed to create session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-4xl w-full text-center relative z-10">
        {/* Hackathon Badge */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-full text-sm">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-cyan-300">Google Cloud AI Partner Catalyst Hackathon</span>
          </span>
        </div>

        {/* Logo / Brand */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 mb-6 animate-breathe shadow-2xl shadow-cyan-500/30 relative">
            <Heart className="w-12 h-12 text-white" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 animate-ping opacity-30" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent mb-3">
            MindfulAI
          </h1>
          <p className="text-xl text-slate-300 mb-2">
            Real-Time, Voice-First Mental Health Support
          </p>
          <p className="text-sm text-slate-500">
            Powered by Emotion-Adaptive AI with Therapeutic Transparency
          </p>
        </div>

        {/* Key Innovations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <FeatureCard
            icon={<Brain className="w-6 h-6 text-cyan-400" />}
            title="Real-Time Emotion AI"
            description="Gemini-powered emotion detection adapts therapy techniques in real-time"
            tech="Google Vertex AI"
            techColor="text-cyan-400"
          />
          <FeatureCard
            icon={<Waves className="w-6 h-6 text-purple-400" />}
            title="Adaptive Voice"
            description="Voice characteristics change based on your emotional state"
            tech="ElevenLabs"
            techColor="text-purple-400"
          />
          <FeatureCard
            icon={<Activity className="w-6 h-6 text-orange-400" />}
            title="Live AI Dashboard"
            description="See the AI's decision-making process in real-time"
            tech="Confluent Kafka"
            techColor="text-orange-400"
          />
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartSession}
          disabled={isLoading}
          className="group inline-flex items-center justify-center px-10 py-5 text-lg font-bold text-white 
                     bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full 
                     shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 
                     transform hover:scale-105 transition-all duration-300 
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                     relative overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {isLoading ? (
            <>
              <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3 relative z-10"></span>
              <span className="relative z-10">Initializing AI Coach...</span>
            </>
          ) : (
            <>
              <Mic className="w-6 h-6 mr-3 relative z-10" />
              <span className="relative z-10">Start Voice Session</span>
            </>
          )}
        </button>

        {error && (
          <p className="mt-4 text-red-400 bg-red-500/20 px-4 py-2 rounded-lg inline-block">{error}</p>
        )}

        {/* Tech Stack Pills */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          <TechPill color="cyan">Gemini 1.5 Flash</TechPill>
          <TechPill color="purple">ElevenLabs TTS</TechPill>
          <TechPill color="orange">Confluent Kafka</TechPill>
          <TechPill color="green">FastAPI</TechPill>
          <TechPill color="blue">React + TypeScript</TechPill>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-xs text-slate-500 max-w-md mx-auto">
          Demo for hackathon purposes. Not a substitute for professional mental health care.
          If you're in crisis, please contact emergency services.
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  tech,
  techColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tech: string;
  techColor: string;
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-colors group">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-700/50 mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-3">{description}</p>
      <span className={`text-xs font-medium ${techColor} bg-slate-700/50 px-2 py-1 rounded`}>
        {tech}
      </span>
    </div>
  );
}

function TechPill({ children, color }: { children: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  };

  return (
    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${colorClasses[color]}`}>
      {children}
    </span>
  );
}
