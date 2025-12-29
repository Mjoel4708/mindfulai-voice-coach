import { useCallback, useRef } from 'react';

interface UseAudioPlayerReturn {
  playAudio: (base64Audio: string) => Promise<void>;
  stopAudio: () => void;
  isPlaying: boolean;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  const playAudio = useCallback(async (base64Audio: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        // Create audio element from base64
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audioRef.current = audio;
        isPlayingRef.current = true;

        audio.onended = () => {
          isPlayingRef.current = false;
          resolve();
        };

        audio.onerror = (error) => {
          isPlayingRef.current = false;
          reject(error);
        };

        audio.play().catch(reject);
      } catch (error) {
        isPlayingRef.current = false;
        reject(error);
      }
    });
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  return {
    playAudio,
    stopAudio,
    isPlaying: isPlayingRef.current,
  };
}
