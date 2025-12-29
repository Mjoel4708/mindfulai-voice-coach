"""
MindfulAI - Backend Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings
from app.api import health, sessions, websocket, admin
from app.services.kafka.producer import KafkaProducerService
from app.services.database import DatabaseService
from app.services.gemini.conversation_state import set_event_store_adder
from app.api.admin import get_event_store_adder

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events."""
    # Startup
    logger.info("Starting AI Mental Wellness Coach API")
    
    # Initialize Kafka producer (graceful - won't crash if not configured)
    app.state.kafka_producer = KafkaProducerService()
    try:
        await app.state.kafka_producer.start()
    except Exception as e:
        logger.warning("Kafka producer failed to start", error=str(e))
    
    # Initialize database (graceful - won't crash if not configured)
    app.state.db = DatabaseService()
    try:
        await app.state.db.connect()
    except Exception as e:
        logger.warning("Database failed to connect", error=str(e))
    
    # Wire up Observable AI Cognition event store for admin dashboard
    set_event_store_adder(get_event_store_adder())
    logger.info("Observable AI Cognition event store connected to admin dashboard")
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Mental Wellness Coach API")
    try:
        await app.state.kafka_producer.stop()
    except Exception:
        pass
    try:
        await app.state.db.disconnect()
    except Exception:
        pass
    logger.info("Application shutdown complete")


app = FastAPI(
    title="AI Mental Wellness Coach",
    description="Real-time, voice-first AI wellness coaching system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(sessions.router, prefix="/api/v1", tags=["Sessions"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin Dashboard"])
# Admin WebSocket is at /ws/admin/events (admin router has /events WebSocket)
app.include_router(admin.router, prefix="/ws/admin", tags=["Admin WebSocket"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "AI Mental Wellness Coach",
        "version": "1.0.0",
        "status": "running"
    }
