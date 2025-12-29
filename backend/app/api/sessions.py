"""
Session management endpoints.
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from uuid import uuid4
from datetime import datetime
import structlog

from app.schemas.session import SessionCreate, SessionResponse, SessionHistory
from app.schemas.conversation import ConversationTurn
from app.services.gemini.conversation_state import conversation_state_manager

router = APIRouter()
logger = structlog.get_logger()


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    request: Request,
    session_data: Optional[SessionCreate] = None
):
    """Create a new coaching session."""
    session_id = str(uuid4())
    
    # Emit session creation event to Kafka
    try:
        await request.app.state.kafka_producer.send_event(
            topic="conversation.events",
            event={
                "event_type": "session_created",
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
                "user_context": session_data.context if session_data else None
            }
        )
    except Exception as e:
        logger.error("Failed to emit session creation event", error=str(e))
    
    # Persist session to database
    try:
        await request.app.state.db.create_session(
            session_id=session_id,
            context=session_data.context if session_data else None
        )
    except Exception as e:
        logger.error("Failed to persist session", error=str(e))
    
    logger.info("Session created", session_id=session_id)
    
    return SessionResponse(
        session_id=session_id,
        status="active",
        created_at=datetime.utcnow().isoformat(),
        message="Session created successfully. Connect to WebSocket to start voice interaction."
    )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(request: Request, session_id: str):
    """Get session details."""
    try:
        session = await request.app.state.db.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get session", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve session")


@router.get("/sessions/{session_id}/history", response_model=SessionHistory)
async def get_session_history(request: Request, session_id: str):
    """Get conversation history for a session."""
    try:
        history = await request.app.state.db.get_session_history(session_id)
        return SessionHistory(
            session_id=session_id,
            turns=history
        )
    except Exception as e:
        logger.error("Failed to get session history", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve session history")


@router.post("/sessions/{session_id}/end")
async def end_session(request: Request, session_id: str):
    """End a coaching session."""
    try:
        # Emit session end event
        await request.app.state.kafka_producer.send_event(
            topic="conversation.events",
            event={
                "event_type": "session_ended",
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        # Update session status in database
        await request.app.state.db.end_session(session_id)
        
        # Clear conversation state memory
        conversation_state_manager.clear_session(session_id)
        
        logger.info("Session ended", session_id=session_id)
        
        return {"status": "ended", "session_id": session_id}
    except Exception as e:
        logger.error("Failed to end session", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to end session")


@router.get("/sessions/{session_id}/state")
async def get_session_state(request: Request, session_id: str):
    """Get the intelligent conversation state for a session - includes phase, topics, emotional journey, etc."""
    try:
        memory = conversation_state_manager.get_or_create_memory(session_id)
        
        return {
            "session_id": session_id,
            "conversation_phase": memory.phase.value,
            "exchanges_in_phase": memory.exchanges_in_phase,
            "total_exchanges": memory.total_exchanges,
            "user_topics": memory.user_topics,
            "emotional_journey": memory.emotion_journey,
            "key_insights": memory.key_insights,
            "techniques_used": memory.techniques_used,
            "user_goals": memory.user_goals,
            "breakthroughs": memory.breakthroughs,
            "phase_guidance": memory._get_phase_guidance()
        }
    except Exception as e:
        logger.error("Failed to get session state", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve session state")
