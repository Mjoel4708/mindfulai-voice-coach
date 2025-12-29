interface VoiceVisualizerProps {
  isActive: boolean;
  mode: 'idle' | 'listening' | 'speaking';
}

export default function VoiceVisualizer({ isActive, mode }: VoiceVisualizerProps) {
  const barCount = 5;
  
  const getBarColor = () => {
    switch (mode) {
      case 'listening':
        return 'bg-red-400';
      case 'speaking':
        return 'bg-calm-400';
      default:
        return 'bg-serenity-300';
    }
  };

  return (
    <div className="flex items-center justify-center space-x-1 h-12">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={`
            w-1.5 rounded-full transition-all duration-150
            ${getBarColor()}
            ${isActive ? 'voice-bar' : 'h-4 opacity-50'}
          `}
          style={{
            height: isActive ? `${Math.random() * 32 + 16}px` : '16px',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
