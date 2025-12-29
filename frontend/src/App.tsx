import { useState, useEffect } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import CoachingSession from './components/CoachingSession';
import AdminDashboard from './components/AdminDashboard';
import { SessionProvider } from './hooks/useSession';
import { Brain } from 'lucide-react';

function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  // Check for admin mode via URL hash
  useEffect(() => {
    const checkHash = () => {
      setShowAdmin(window.location.hash === '#admin');
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleStartSession = (newSessionId: string) => {
    setSessionId(newSessionId);
    setIsSessionActive(true);
  };

  const handleEndSession = () => {
    setIsSessionActive(false);
    setSessionId(null);
  };

  // Admin dashboard mode
  if (showAdmin) {
    return <AdminDashboard />;
  }

  return (
    <SessionProvider>
      <div className="min-h-screen bg-gradient-to-br from-calm-50 via-serenity-50 to-warmth-50">
        {/* Admin dashboard link */}
        <a 
          href="#admin" 
          className="fixed bottom-4 right-4 z-50 px-3 py-1.5 bg-gray-900/80 text-gray-400 text-xs rounded-lg hover:bg-gray-800 hover:text-white transition-all flex items-center gap-1"
          title="Open Admin Dashboard"
        >
          <Brain className="w-3 h-3" /> Admin
        </a>
        
        {!isSessionActive ? (
          <WelcomeScreen onStartSession={handleStartSession} />
        ) : (
          <CoachingSession 
            sessionId={sessionId!} 
            onEndSession={handleEndSession} 
          />
        )}
      </div>
    </SessionProvider>
  );
}

export default App;
