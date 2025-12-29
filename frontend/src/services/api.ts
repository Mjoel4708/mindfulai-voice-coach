const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || '';

export interface CreateSessionResponse {
  session_id: string;
  status: string;
  created_at: string;
  message: string;
}

export const api = {
  /**
   * Create a new coaching session
   */
  async createSession(context?: string): Promise<CreateSessionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context }),
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    return response.json();
  },

  /**
   * End a coaching session
   */
  async endSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}/end`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to end session');
    }
  },

  /**
   * Get session details
   */
  async getSession(sessionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/sessions/${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to get session');
    }

    return response.json();
  },

  /**
   * Get WebSocket URL for a session
   */
  getWebSocketUrl(sessionId: string): string {
    const wsUrl = WS_BASE_URL || `ws://${window.location.host}`;
    return `${wsUrl}/ws/${sessionId}`;
  },

  /**
   * Health check
   */
  async healthCheck() {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.json();
  },
};
