/**
 * Interactive Breathing Exercise Component
 * 
 * Beautiful animated breathing guide that syncs with therapeutic techniques.
 * Supports multiple breathing patterns used in clinical practice:
 * - Box Breathing (4-4-4-4) - Navy SEALs technique
 * - 4-7-8 Breathing - Dr. Andrew Weil's relaxation technique
 * - Calm Breathing (4-6) - Simple anxiety reduction
 */

import React, { useState, useEffect, useCallback } from 'react';

type BreathingPattern = 'box' | '478' | 'calm';

interface BreathingExerciseProps {
  isActive: boolean;
  pattern?: BreathingPattern;
  onComplete?: () => void;
  cycles?: number;
}

interface PatternConfig {
  name: string;
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
  description: string;
  color: string;
}

const PATTERNS: Record<BreathingPattern, PatternConfig> = {
  box: {
    name: 'Box Breathing',
    inhale: 4,
    hold1: 4,
    exhale: 4,
    hold2: 4,
    description: 'Used by Navy SEALs for stress management',
    color: 'cyan'
  },
  '478': {
    name: '4-7-8 Breathing',
    inhale: 4,
    hold1: 7,
    exhale: 8,
    hold2: 0,
    description: "Dr. Weil's natural tranquilizer",
    color: 'purple'
  },
  calm: {
    name: 'Calming Breath',
    inhale: 4,
    hold1: 0,
    exhale: 6,
    hold2: 0,
    description: 'Simple technique for quick relief',
    color: 'green'
  }
};

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2' | 'complete';

export const BreathingExercise: React.FC<BreathingExerciseProps> = ({
  isActive,
  pattern = 'box',
  onComplete,
  cycles = 4
}) => {
  const [phase, setPhase] = useState<Phase>('inhale');
  const [countdown, setCountdown] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [scale, setScale] = useState(1);

  const config = PATTERNS[pattern];

  const getPhaseInstruction = (p: Phase): string => {
    switch (p) {
      case 'inhale': return 'Breathe In';
      case 'hold1': return 'Hold';
      case 'exhale': return 'Breathe Out';
      case 'hold2': return 'Hold';
      case 'complete': return 'Complete!';
    }
  };

  const runBreathingCycle = useCallback(() => {
    if (!isActive) return;

    let currentPhase: Phase = 'inhale';
    let time = config.inhale;
    
    setPhase('inhale');
    setCountdown(config.inhale);
    setScale(1.5); // Expand on inhale

    const interval = setInterval(() => {
      time--;
      
      if (time <= 0) {
        // Move to next phase
        if (currentPhase === 'inhale') {
          if (config.hold1 > 0) {
            currentPhase = 'hold1';
            time = config.hold1;
            setPhase('hold1');
            setScale(1.5); // Stay expanded during hold
          } else {
            currentPhase = 'exhale';
            time = config.exhale;
            setPhase('exhale');
            setScale(1); // Contract on exhale
          }
        } else if (currentPhase === 'hold1') {
          currentPhase = 'exhale';
          time = config.exhale;
          setPhase('exhale');
          setScale(1); // Contract on exhale
        } else if (currentPhase === 'exhale') {
          if (config.hold2 > 0) {
            currentPhase = 'hold2';
            time = config.hold2;
            setPhase('hold2');
            setScale(1); // Stay contracted
          } else {
            // Cycle complete
            setCurrentCycle(prev => {
              if (prev >= cycles) {
                clearInterval(interval);
                setPhase('complete');
                onComplete?.();
                return prev;
              }
              // Start new cycle
              currentPhase = 'inhale';
              time = config.inhale;
              setPhase('inhale');
              setScale(1.5);
              return prev + 1;
            });
          }
        } else if (currentPhase === 'hold2') {
          // Cycle complete
          setCurrentCycle(prev => {
            if (prev >= cycles) {
              clearInterval(interval);
              setPhase('complete');
              onComplete?.();
              return prev;
            }
            // Start new cycle
            currentPhase = 'inhale';
            time = config.inhale;
            setPhase('inhale');
            setScale(1.5);
            return prev + 1;
          });
        }
      }
      
      setCountdown(time);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, config, cycles, onComplete]);

  useEffect(() => {
    if (isActive) {
      setCurrentCycle(1);
      const cleanup = runBreathingCycle();
      return cleanup;
    }
  }, [isActive, runBreathingCycle]);

  if (!isActive) return null;

  const colorClasses = {
    cyan: {
      ring: 'ring-cyan-400/50',
      bg: 'from-cyan-500/30 to-blue-500/30',
      glow: 'shadow-cyan-500/50',
      text: 'text-cyan-300',
      progress: 'bg-cyan-400'
    },
    purple: {
      ring: 'ring-purple-400/50',
      bg: 'from-purple-500/30 to-pink-500/30',
      glow: 'shadow-purple-500/50',
      text: 'text-purple-300',
      progress: 'bg-purple-400'
    },
    green: {
      ring: 'ring-green-400/50',
      bg: 'from-green-500/30 to-emerald-500/30',
      glow: 'shadow-green-500/50',
      text: 'text-green-300',
      progress: 'bg-green-400'
    }
  };

  const colors = colorClasses[config.color as keyof typeof colorClasses];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-lg">
      <div className="flex flex-col items-center">
        {/* Title */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-1">{config.name}</h2>
          <p className="text-sm text-slate-400">{config.description}</p>
        </div>

        {/* Breathing Circle */}
        <div className="relative">
          {/* Outer glow rings */}
          <div 
            className={`absolute inset-0 rounded-full ${colors.ring} ring-8 blur-xl transition-transform duration-1000`}
            style={{ transform: `scale(${scale * 1.2})` }}
          />
          <div 
            className={`absolute inset-0 rounded-full ${colors.ring} ring-4 blur-md transition-transform duration-1000`}
            style={{ transform: `scale(${scale * 1.1})` }}
          />
          
          {/* Main breathing circle */}
          <div 
            className={`w-64 h-64 rounded-full bg-gradient-to-br ${colors.bg} 
                       flex items-center justify-center transition-transform duration-1000 ease-in-out
                       shadow-2xl ${colors.glow} relative overflow-hidden`}
            style={{ transform: `scale(${scale})` }}
          >
            {/* Inner animated rings */}
            <div className="absolute inset-4 rounded-full border border-white/10 animate-pulse" />
            <div className="absolute inset-8 rounded-full border border-white/5" />
            
            {/* Center content */}
            <div className="text-center z-10">
              <div className={`text-5xl font-bold ${colors.text} mb-2`}>
                {phase === 'complete' ? '✓' : countdown}
              </div>
              <div className="text-white text-lg font-medium">
                {getPhaseInstruction(phase)}
              </div>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-8 flex items-center gap-2">
          {Array.from({ length: cycles }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i < currentCycle 
                  ? `${colors.progress} shadow-lg` 
                  : i === currentCycle - 1 
                    ? `${colors.progress} animate-pulse` 
                    : 'bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Cycle counter */}
        <div className="mt-4 text-slate-400 text-sm">
          Cycle {Math.min(currentCycle, cycles)} of {cycles}
        </div>

        {/* Pattern info */}
        <div className="mt-6 flex gap-4 text-xs text-slate-500">
          <span>Inhale: {config.inhale}s</span>
          {config.hold1 > 0 && <span>Hold: {config.hold1}s</span>}
          <span>Exhale: {config.exhale}s</span>
          {config.hold2 > 0 && <span>Hold: {config.hold2}s</span>}
        </div>

        {/* Skip button */}
        {phase !== 'complete' && (
          <button
            onClick={() => {
              setPhase('complete');
              onComplete?.();
            }}
            className="mt-8 text-slate-500 hover:text-white text-sm transition-colors"
          >
            Skip Exercise
          </button>
        )}

        {/* Complete button */}
        {phase === 'complete' && (
          <button
            onClick={onComplete}
            className={`mt-8 px-6 py-3 rounded-full ${colors.bg} ${colors.text} font-medium
                       hover:opacity-80 transition-opacity`}
          >
            Continue Session
          </button>
        )}
      </div>
    </div>
  );
};

export default BreathingExercise;
