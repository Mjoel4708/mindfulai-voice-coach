/**
 * 5-4-3-2-1 Grounding Exercise Component
 * 
 * A clinically-validated grounding technique for anxiety and panic.
 * Guides users through acknowledging:
 * - 5 things they can SEE
 * - 4 things they can TOUCH
 * - 3 things they can HEAR
 * - 2 things they can SMELL
 * - 1 thing they can TASTE
 * 
 * Beautiful animated interface that makes the exercise engaging.
 */

import React, { useState, useEffect } from 'react';
import { Eye, Hand, Ear, Wind, Coffee, Check, Leaf } from 'lucide-react';

interface GroundingExerciseProps {
  isActive: boolean;
  onComplete?: () => void;
}

interface GroundingStep {
  count: number;
  sense: string;
  icon: React.ReactNode;
  color: string;
  prompt: string;
  examples: string[];
}

const GROUNDING_STEPS: GroundingStep[] = [
  {
    count: 5,
    sense: 'SEE',
    icon: <Eye className="w-8 h-8" />,
    color: 'cyan',
    prompt: 'Look around and name 5 things you can see',
    examples: ['A window', 'Your hands', 'A plant', 'The ceiling', 'A book']
  },
  {
    count: 4,
    sense: 'TOUCH',
    icon: <Hand className="w-8 h-8" />,
    color: 'purple',
    prompt: 'Notice 4 things you can physically feel',
    examples: ['Chair beneath you', 'Feet on floor', 'Clothes on skin', 'Air temperature']
  },
  {
    count: 3,
    sense: 'HEAR',
    icon: <Ear className="w-8 h-8" />,
    color: 'green',
    prompt: 'Listen for 3 sounds around you',
    examples: ['Birds outside', 'AC humming', 'Your breathing']
  },
  {
    count: 2,
    sense: 'SMELL',
    icon: <Wind className="w-8 h-8" />,
    color: 'orange',
    prompt: 'Identify 2 things you can smell',
    examples: ['Fresh air', 'Coffee nearby']
  },
  {
    count: 1,
    sense: 'TASTE',
    icon: <Coffee className="w-8 h-8" />,
    color: 'pink',
    prompt: 'Notice 1 thing you can taste',
    examples: ['Taste in your mouth', 'Recent drink']
  }
];

const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/50',
    text: 'text-cyan-300',
    glow: 'shadow-cyan-500/30'
  },
  purple: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    text: 'text-purple-300',
    glow: 'shadow-purple-500/30'
  },
  green: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-300',
    glow: 'shadow-green-500/30'
  },
  orange: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-300',
    glow: 'shadow-orange-500/30'
  },
  pink: {
    bg: 'bg-pink-500/20',
    border: 'border-pink-500/50',
    text: 'text-pink-300',
    glow: 'shadow-pink-500/30'
  }
};

export const GroundingExercise: React.FC<GroundingExerciseProps> = ({
  isActive,
  onComplete
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkedItems, setCheckedItems] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const currentStep = GROUNDING_STEPS[currentStepIndex];
  const colors = colorClasses[currentStep?.color || 'cyan'];

  useEffect(() => {
    if (isActive) {
      setCurrentStepIndex(0);
      setCheckedItems([]);
      setIsComplete(false);
      setShowIntro(true);
    }
  }, [isActive]);

  const handleItemCheck = (index: number) => {
    if (checkedItems.includes(index)) return;
    
    const newChecked = [...checkedItems, index];
    setCheckedItems(newChecked);
    
    // If all items for this step are checked
    if (newChecked.length >= currentStep.count) {
      setTimeout(() => {
        if (currentStepIndex < GROUNDING_STEPS.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
          setCheckedItems([]);
        } else {
          setIsComplete(true);
        }
      }, 500);
    }
  };

  if (!isActive) return null;

  // Intro screen
  if (showIntro) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-lg">
        <div className="max-w-md text-center px-6">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 mb-4">
              <Leaf className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">5-4-3-2-1 Grounding</h2>
            <p className="text-slate-400">
              This technique helps bring you back to the present moment by engaging your five senses.
            </p>
          </div>

          {/* Preview of steps */}
          <div className="flex justify-center gap-2 mb-8">
            {GROUNDING_STEPS.map((step, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                           ${colorClasses[step.color].bg} ${colorClasses[step.color].text}`}
              >
                {step.count}
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowIntro(false)}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold
                       rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            Begin Exercise
          </button>

          <button
            onClick={onComplete}
            className="block mx-auto mt-4 text-slate-500 hover:text-white text-sm transition-colors"
          >
            Skip Exercise
          </button>
        </div>
      </div>
    );
  }

  // Complete screen
  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-lg">
        <div className="max-w-md text-center px-6">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/30 mb-4 animate-bounce">
              <Check className="w-12 h-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Well Done!</h2>
            <p className="text-slate-400">
              You've completed the grounding exercise. Take a moment to notice how you feel now.
            </p>
          </div>

          {/* Completion summary */}
          <div className="bg-slate-800/50 rounded-2xl p-4 mb-6">
            <div className="flex justify-center gap-1">
              {GROUNDING_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center
                             ${colorClasses[step.color].bg} ${colorClasses[step.color].text}`}
                >
                  <Check className="w-4 h-4" />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">All senses engaged</p>
          </div>

          <button
            onClick={onComplete}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold
                       rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            Continue Session
          </button>
        </div>
      </div>
    );
  }

  // Main exercise screen
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-lg">
      <div className="max-w-lg w-full px-6">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {GROUNDING_STEPS.map((step, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                           transition-all duration-300
                           ${i < currentStepIndex 
                             ? 'bg-green-500/30 text-green-300' 
                             : i === currentStepIndex 
                               ? `${colorClasses[step.color].bg} ${colorClasses[step.color].text} ring-2 ${colorClasses[step.color].border} scale-110`
                               : 'bg-slate-700/50 text-slate-500'
                           }`}
              >
                {i < currentStepIndex ? <Check className="w-5 h-5" /> : step.count}
              </div>
            ))}
          </div>
        </div>

        {/* Current step */}
        <div className={`${colors.bg} ${colors.border} border rounded-3xl p-8 shadow-2xl ${colors.glow}`}>
          {/* Icon and title */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className={`p-4 rounded-2xl ${colors.bg} ${colors.text}`}>
              {currentStep.icon}
            </div>
            <div>
              <div className={`text-5xl font-bold ${colors.text}`}>{currentStep.count}</div>
              <div className="text-white font-medium">things you can {currentStep.sense}</div>
            </div>
          </div>

          {/* Prompt */}
          <p className="text-center text-slate-300 mb-6">{currentStep.prompt}</p>

          {/* Checkable items */}
          <div className="space-y-3">
            {Array.from({ length: currentStep.count }).map((_, i) => (
              <button
                key={i}
                onClick={() => handleItemCheck(i)}
                disabled={checkedItems.includes(i)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-300
                           ${checkedItems.includes(i)
                             ? 'bg-green-500/20 border-green-500/50 border'
                             : `${colors.bg} border ${colors.border} hover:scale-102`
                           }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                               ${checkedItems.includes(i)
                                 ? 'bg-green-500 text-white'
                                 : `border-2 ${colors.border}`
                               }`}>
                  {checkedItems.includes(i) && <Check className="w-4 h-4" />}
                </div>
                <span className={`flex-1 text-left ${checkedItems.includes(i) ? 'text-green-300' : 'text-slate-300'}`}>
                  {checkedItems.includes(i) 
                    ? `✓ Acknowledged` 
                    : `Tap when you notice something (e.g., "${currentStep.examples[i]}")`
                  }
                </span>
              </button>
            ))}
          </div>

          {/* Progress for this step */}
          <div className="mt-6 text-center text-sm text-slate-400">
            {checkedItems.length} of {currentStep.count} acknowledged
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={onComplete}
          className="block mx-auto mt-6 text-slate-500 hover:text-white text-sm transition-colors"
        >
          Skip Exercise
        </button>
      </div>
    </div>
  );
};

export default GroundingExercise;
