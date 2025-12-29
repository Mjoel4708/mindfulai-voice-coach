# MindfulAI 🧠💚

A voice-first AI wellness coach powered by Gemini 2.5 Flash with observable cognition - every AI decision is explainable, auditable, and streamed via Kafka in real-time.

Built for the **Google Cloud AI Partner Catalyst Hackathon**.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🎯 Challenge: ElevenLabs + Confluent + Google Cloud

This project combines:
- **Google Cloud Vertex AI (Gemini)** - Emotion analysis, intent detection, and empathetic response generation
- **ElevenLabs** - Natural voice synthesis for conversational AI
- **Confluent Kafka** - Real-time event streaming for AI decisions and observability
- **PostgreSQL** - Session persistence and audit trails

## 🌟 FeaturesN

### Voice-First Interaction
- Natural speech input using browser Speech Recognition API
- High-quality voice responses via ElevenLabs
- Real-time conversation flow

### Intelligent Emotion Detection
- Real-time emotion analysis using Gemini
- Intent recognition for appropriate responses
- Adaptive coaching techniques based on emotional state

### Coaching Techniques
- **Reflective Listening** - Mirror back what the user said
- **Cognitive Reframing** - Help see situations differently
- **Grounding Exercises** - Mindfulness for anxiety/overwhelm
- **Validation** - Acknowledge and validate feelings
- **Open-Ended Questioning** - Encourage self-exploration

### Safety & Responsible AI
- Crisis detection with immediate resource provision
- No medical advice or diagnosis
- Transparent AI decision-making
- Audit trail for all interactions

### Real-Time Observability (Confluent)
Events streamed to Kafka topics:
- `conversation.events` - Session lifecycle, user speech
- `ai.decisions` - Emotion detection, technique selection
- `safety.events` - Crisis detection, interventions

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  FastAPI        │────▶│  Vertex AI      │
│  + ElevenLabs   │◀────│  Backend        │◀────│  (Gemini)       │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │ Confluent │ │ PostgreSQL│ │ ElevenLabs│
            │   Kafka   │ │  Database │ │   TTS     │
            └───────────┘ └───────────┘ └───────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- Google Cloud account with Vertex AI enabled
- ElevenLabs API key
- Confluent Cloud account

### 1. Clone and Setup Environment

```bash
git clone https://github.com/yourusername/ai-mental-coach.git
cd ai-mental-coach
cp .env.example .env
```

Edit `.env` with your API keys:
```env
GOOGLE_CLOUD_PROJECT=your-project-id
ELEVENLABS_API_KEY=your-elevenlabs-key
KAFKA_BOOTSTRAP_SERVERS=your-cluster.confluent.cloud:9092
KAFKA_API_KEY=your-kafka-key
KAFKA_API_SECRET=your-kafka-secret
```

### 2. Start with Docker Compose

```bash
# Start all services
docker-compose up --build

# Or start just the database for local development
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Local Development (Alternative)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 📁 Project Structure

```
ai-mental-coach/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routes
│   │   │   ├── health.py     # Health check endpoints
│   │   │   ├── sessions.py   # Session management
│   │   │   └── websocket.py  # Real-time voice interaction
│   │   ├── core/
│   │   │   └── config.py     # Application configuration
│   │   ├── services/
│   │   │   ├── gemini/       # Vertex AI integration
│   │   │   │   ├── analyzer.py   # Emotion detection
│   │   │   │   └── responder.py  # Response generation
│   │   │   ├── elevenlabs/   # Voice synthesis
│   │   │   │   └── synthesizer.py
│   │   │   ├── kafka/        # Event streaming
│   │   │   │   └── producer.py
│   │   │   ├── safety/       # Crisis detection
│   │   │   │   └── evaluator.py
│   │   │   └── database.py   # PostgreSQL service
│   │   └── schemas/          # Pydantic models
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API & WebSocket clients
│   │   └── types/            # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔧 Configuration

### Google Cloud Setup

1. Create a GCP project and enable Vertex AI API
2. Create a service account with Vertex AI User role
3. Download credentials JSON or use `gcloud auth application-default login`

### Confluent Cloud Setup

1. Create a Confluent Cloud cluster
2. Create API keys
3. Topics are auto-created, or create manually:
   - `conversation.events`
   - `ai.decisions`
   - `safety.events`

### ElevenLabs Setup

1. Sign up at elevenlabs.io
2. Get your API key from settings
3. Choose a voice ID (default: Rachel - `21m00Tcm4TlvDq8ikWAM`)

## 🧪 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/detailed` | GET | Detailed health with dependencies |
| `/api/v1/sessions` | POST | Create new coaching session |
| `/api/v1/sessions/{id}` | GET | Get session details |
| `/api/v1/sessions/{id}/end` | POST | End session |
| `/ws/{session_id}` | WebSocket | Real-time voice interaction |

## 📊 Kafka Event Schema

### Conversation Event
```json
{
  "event_type": "user_spoke",
  "session_id": "abc123",
  "timestamp": "2025-01-01T00:00:00Z",
  "length_seconds": 5.2
}
```

### AI Decision Event
```json
{
  "event_type": "emotion_detected",
  "session_id": "abc123",
  "emotion": "anxiety",
  "intensity": 0.78,
  "confidence": 0.85,
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### Safety Event
```json
{
  "event_type": "crisis_detected",
  "session_id": "abc123",
  "severity": "high",
  "action_taken": "handoff_to_resources",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## 🔒 Safety Features

- **Crisis Detection**: Keyword-based and context-aware detection
- **Resource Provision**: Immediate crisis helpline information
- **No Medical Advice**: Strict guardrails against diagnosis
- **Audit Trail**: All interactions logged for review
- **Graceful Handoff**: Appropriate escalation paths

## 🏆 Hackathon Alignment

| Requirement | Implementation |
|-------------|----------------|
| Google Cloud (Vertex AI/Gemini) | Emotion analysis, intent detection, response generation |
| ElevenLabs | Natural voice synthesis for all coach responses |
| Confluent Kafka | Real-time streaming of conversation events and AI decisions |
| Working Application | Full-stack voice-first wellness coach |
| Innovation | Event-driven AI with transparent decision-making |

## 📜 License

MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Google Cloud for Vertex AI and Gemini
- ElevenLabs for voice synthesis technology
- Confluent for real-time data streaming
- The mental health community for guidance on responsible AI

---

**Built with ❤️ for the Google Cloud AI Partner Catalyst Hackathon 2025**
