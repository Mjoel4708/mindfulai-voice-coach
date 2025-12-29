"""
Application configuration using Pydantic Settings.
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "AI Mental Wellness Coach"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS - Allow localhost for dev and Cloud Run URLs for production
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://mindfulai-frontend-180294198748.us-central1.run.app",
        "https://mindfulai-frontend-2clwsj7t5a-uc.a.run.app",
    ]
    
    # Google Cloud / Vertex AI
    GOOGLE_CLOUD_PROJECT: str = ""
    VERTEX_AI_LOCATION: str = "us-central1"
    GEMINI_MODEL: str = "gemini-2.5-flash"  # Latest stable Flash model - fast & smart for real-time wellness coaching
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None
    
    # ElevenLabs
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
    
    # Kafka / Confluent
    KAFKA_BOOTSTRAP_SERVERS: str = ""
    KAFKA_ENDPOINTS: str = ""  # Optional REST endpoint
    KAFKA_API_KEY: str = ""
    KAFKA_API_SECRET: str = ""
    KAFKA_SECURITY_PROTOCOL: str = "SASL_SSL"
    KAFKA_SASL_MECHANISM: str = "PLAIN"
    
    # Kafka Topics
    KAFKA_TOPIC_CONVERSATION_EVENTS: str = "conversation.events"
    KAFKA_TOPIC_AI_DECISIONS: str = "ai.decisions"
    KAFKA_TOPIC_SAFETY_EVENTS: str = "safety.events"
    KAFKA_TOPIC_AI_COGNITION: str = "ai.cognition"  # Observable AI Cognition - memory events
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:Password123@localhost:5432/wellness_coach"
    
    # Safety thresholds
    CRISIS_KEYWORDS: List[str] = [
        "suicide", "kill myself", "end my life", "self-harm",
        "hurt myself", "don't want to live", "better off dead"
    ]
    HIGH_RISK_THRESHOLD: float = 0.8
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
