import { Sparkles } from 'lucide-react';

interface EmotionIndicatorProps {
  emotion: string;
  technique?: string | null;
}

const emotionConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  anxiety: { color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Anxiety' },
  sadness: { color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Sadness' },
  anger: { color: 'text-red-600', bgColor: 'bg-red-50', label: 'Anger' },
  fear: { color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'Fear' },
  frustration: { color: 'text-orange-600', bgColor: 'bg-orange-50', label: 'Frustration' },
  loneliness: { color: 'text-indigo-600', bgColor: 'bg-indigo-50', label: 'Loneliness' },
  overwhelm: { color: 'text-pink-600', bgColor: 'bg-pink-50', label: 'Overwhelm' },
  hopelessness: { color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'Hopelessness' },
  neutral: { color: 'text-serenity-600', bgColor: 'bg-serenity-50', label: 'Neutral' },
  joy: { color: 'text-yellow-600', bgColor: 'bg-yellow-50', label: 'Joy' },
  relief: { color: 'text-green-600', bgColor: 'bg-green-50', label: 'Relief' },
  gratitude: { color: 'text-teal-600', bgColor: 'bg-teal-50', label: 'Gratitude' },
};

const techniqueLabels: Record<string, string> = {
  reflective_listening: 'Listening',
  open_ended_questioning: 'Exploring',
  cognitive_reframing: 'Reframing',
  grounding_exercise: 'Grounding',
  validation: 'Validating',
  strength_recognition: 'Empowering',
  action_planning: 'Planning',
  greeting: 'Welcome',
};

export default function EmotionIndicator({ emotion, technique }: EmotionIndicatorProps) {
  const config = emotionConfig[emotion] || emotionConfig.neutral;
  const techniqueLabel = technique ? techniqueLabels[technique] || technique : null;

  return (
    <div className="flex items-center space-x-2">
      {/* Emotion Badge */}
      <div className={`flex items-center px-3 py-1.5 rounded-full ${config.bgColor}`}>
        <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${config.color}`} />
        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Technique Badge */}
      {techniqueLabel && (
        <div className="flex items-center px-3 py-1.5 rounded-full bg-calm-50">
          <span className="text-xs font-medium text-calm-600">
            {techniqueLabel}
          </span>
        </div>
      )}
    </div>
  );
}
