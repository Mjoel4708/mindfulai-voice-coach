import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConversationTurn, VoiceState } from '../types';

interface SessionContextType {
  conversationHistory: ConversationTurn[];
  addTurn: (turn: ConversationTurn) => void;
  clearHistory: () => void;
  voiceState: VoiceState;
  setVoiceState: (state: Partial<VoiceState>) => void;
  currentEmotion: string | null;
  setCurrentEmotion: (emotion: string | null) => void;
  currentTechnique: string | null;
  setCurrentTechnique: (technique: string | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [voiceState, setVoiceStateInternal] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
  });
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [currentTechnique, setCurrentTechnique] = useState<string | null>(null);

  const addTurn = useCallback((turn: ConversationTurn) => {
    setConversationHistory((prev) => [...prev, turn]);
  }, []);

  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    setCurrentEmotion(null);
    setCurrentTechnique(null);
  }, []);

  const setVoiceState = useCallback((state: Partial<VoiceState>) => {
    setVoiceStateInternal((prev) => ({ ...prev, ...state }));
  }, []);

  return (
    <SessionContext.Provider
      value={{
        conversationHistory,
        addTurn,
        clearHistory,
        voiceState,
        setVoiceState,
        currentEmotion,
        setCurrentEmotion,
        currentTechnique,
        setCurrentTechnique,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
