"""
Health check endpoints.
"""
from fastapi import APIRouter, Request
from datetime import datetime

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ai-mental-wellness-coach"
    }


@router.get("/health/detailed")
async def detailed_health_check(request: Request):
    """Detailed health check including dependencies."""
    kafka_status = "unknown"
    db_status = "unknown"
    
    # Check Kafka
    try:
        if hasattr(request.app.state, 'kafka_producer'):
            kafka_status = "connected" if request.app.state.kafka_producer.is_connected else "disconnected"
    except Exception:
        kafka_status = "error"
    
    # Check Database
    try:
        if hasattr(request.app.state, 'db'):
            db_status = "connected" if request.app.state.db.is_connected else "disconnected"
    except Exception:
        db_status = "error"
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ai-mental-wellness-coach",
        "dependencies": {
            "kafka": kafka_status,
            "database": db_status,
            "vertex_ai": "configured",
            "elevenlabs": "configured"
        }
    }
