"""
Admin API endpoints for Observable AI Cognition dashboard.

Provides:
- Session overviews and statistics
- AI event stream (REST + WebSocket)
- Technique usage analytics
- Emotion trends
"""
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
from typing import Optional, List, Set
import asyncio
import structlog

from app.services.gemini.conversation_state import conversation_state_manager

router = APIRouter()
logger = structlog.get_logger()

# In-memory event store (in production, this would be backed by Kafka consumer or DB)
_recent_events: List[dict] = []
MAX_EVENTS = 500

# WebSocket connections for live streaming
_admin_connections: Set[WebSocket] = set()


async def broadcast_event(event: dict):
    """Broadcast an event to all connected admin dashboards."""
    if not _admin_connections:
        return
    
    disconnected = set()
    for ws in _admin_connections:
        try:
            await ws.send_json(event)
        except Exception:
            disconnected.add(ws)
    
    # Clean up disconnected clients
    _admin_connections.difference_update(disconnected)


def add_event_to_store(event: dict):
    """Add an event to the in-memory store and broadcast to dashboards."""
    global _recent_events
    _recent_events.insert(0, event)
    if len(_recent_events) > MAX_EVENTS:
        _recent_events = _recent_events[:MAX_EVENTS]
    
    # Broadcast to connected admin dashboards (fire and forget)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(broadcast_event(event))
    except RuntimeError:
        pass  # No event loop available


@router.websocket("/events")
async def admin_events_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time AI cognition event streaming.
    
    Admin dashboards connect here to receive events as they happen,
    eliminating the need for polling.
    """
    await websocket.accept()
    _admin_connections.add(websocket)
    logger.info("Admin dashboard connected via WebSocket", total_connections=len(_admin_connections))
    
    try:
        # Send recent events on connect
        for event in _recent_events[:20]:
            await websocket.send_json(event)
        
        # Keep connection alive
        while True:
            # Wait for ping/pong to keep connection alive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        _admin_connections.discard(websocket)
        logger.info("Admin dashboard disconnected", total_connections=len(_admin_connections))
    except Exception as e:
        _admin_connections.discard(websocket)
        logger.debug("Admin WebSocket error", error=str(e))


@router.get("/sessions")
async def get_sessions_overview():
    """
    Get overview of all sessions with statistics.
    
    Returns:
    - List of sessions with their current state
    - Aggregate statistics
    """
    sessions = []
    total_turns = 0
    total_breakthroughs = 0
    emotion_counts: dict = {}
    technique_counts: dict = {}
    active_count = 0
    
    # Get all sessions from conversation state manager
    for session_id, memory in conversation_state_manager.sessions.items():
        # Determine if session is active (had activity in last 5 minutes)
        last_activity = None
        if memory.emotion_journey:
            last_activity = memory.emotion_journey[-1].get("timestamp")
        
        is_active = False
        if last_activity:
            try:
                last_time = datetime.fromisoformat(last_activity)
                is_active = datetime.now() - last_time < timedelta(minutes=5)
            except:
                pass
        
        if is_active:
            active_count += 1
        
        # Get dominant emotion
        dominant_emotion, _ = memory.get_dominant_emotion()
        
        # Count emotions
        for ej in memory.emotion_journey:
            emotion = ej.get("emotion", "unknown")
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        # Count techniques
        for tech, count in memory.techniques_used.items():
            technique_counts[tech] = technique_counts.get(tech, 0) + count
        
        total_turns += memory.total_exchanges
        total_breakthroughs += len(memory.breakthroughs)
        
        sessions.append({
            "session_id": session_id,
            "start_time": memory.emotion_journey[0].get("timestamp") if memory.emotion_journey else None,
            "last_activity": last_activity,
            "total_turns": memory.total_exchanges,
            "current_phase": memory.phase.value,
            "dominant_emotion": dominant_emotion,
            "techniques_used": list(memory.techniques_used.keys()),
            "breakthroughs": len(memory.breakthroughs),
            "is_active": is_active,
            "insights_count": len(memory.key_insights),
            "topics": memory.user_topics[-5:] if memory.user_topics else []
        })
    
    # Calculate statistics
    num_sessions = len(sessions) or 1  # Avoid division by zero
    most_common_emotion = max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else "neutral"
    most_used_technique = max(technique_counts.items(), key=lambda x: x[1])[0] if technique_counts else "validation"
    
    stats = {
        "total_sessions": len(sessions),
        "active_sessions": active_count,
        "total_turns": total_turns,
        "total_breakthroughs": total_breakthroughs,
        "avg_session_length": total_turns / num_sessions,
        "most_common_emotion": most_common_emotion,
        "most_used_technique": most_used_technique
    }
    
    # Sort sessions by last activity (most recent first)
    sessions.sort(key=lambda x: x.get("last_activity") or "", reverse=True)
    
    return {
        "sessions": sessions,
        "stats": stats
    }


@router.get("/events")
async def get_recent_events(
    limit: int = Query(50, ge=1, le=200),
    session_id: Optional[str] = None,
    event_type: Optional[str] = None
):
    """
    Get recent AI cognition events.
    
    Args:
        limit: Maximum number of events to return
        session_id: Filter by session ID
        event_type: Filter by event type
    
    Returns:
        List of recent events with correlation_id and reason fields
    """
    events = _recent_events
    
    # Apply filters
    if session_id:
        events = [e for e in events if e.get("session_id") == session_id]
    
    if event_type:
        events = [e for e in events if e.get("event_type") == event_type]
    
    return {
        "events": events[:limit],
        "total": len(events)
    }


@router.get("/session/{session_id}")
async def get_session_details(session_id: str):
    """
    Get detailed information about a specific session.
    
    Returns full conversation memory and event history.
    """
    memory = conversation_state_manager.sessions.get(session_id)
    
    if not memory:
        return {"error": "Session not found", "session_id": session_id}
    
    # Get session-specific events
    session_events = [e for e in _recent_events if e.get("session_id") == session_id]
    
    return {
        "session_id": session_id,
        "memory": {
            "phase": memory.phase.value,
            "exchanges_in_phase": memory.exchanges_in_phase,
            "total_exchanges": memory.total_exchanges,
            "emotion_journey": memory.emotion_journey,
            "emotion_weights": dict(memory.emotion_weights),
            "user_topics": memory.user_topics,
            "topic_weights": dict(memory.topic_weights),
            "key_insights": memory.key_insights,
            "techniques_used": dict(memory.techniques_used),
            "user_goals": memory.user_goals,
            "breakthroughs": memory.breakthroughs
        },
        "events": session_events[:100],
        "context_string": memory.to_context_string()
    }


@router.get("/analytics/emotions")
async def get_emotion_analytics():
    """
    Get emotion analytics across all sessions.
    
    Returns emotion frequency, intensity averages, and trends.
    """
    emotion_data = {
        "frequency": {},
        "avg_intensity": {},
        "by_phase": {}
    }
    
    for session_id, memory in conversation_state_manager.sessions.items():
        for ej in memory.emotion_journey:
            emotion = ej.get("emotion", "unknown")
            intensity = ej.get("intensity", 0.5)
            
            # Frequency
            emotion_data["frequency"][emotion] = emotion_data["frequency"].get(emotion, 0) + 1
            
            # Intensity (for averaging)
            if emotion not in emotion_data["avg_intensity"]:
                emotion_data["avg_intensity"][emotion] = {"total": 0, "count": 0}
            emotion_data["avg_intensity"][emotion]["total"] += intensity
            emotion_data["avg_intensity"][emotion]["count"] += 1
    
    # Calculate averages
    for emotion, data in emotion_data["avg_intensity"].items():
        if data["count"] > 0:
            emotion_data["avg_intensity"][emotion] = round(data["total"] / data["count"], 2)
        else:
            emotion_data["avg_intensity"][emotion] = 0.5
    
    return emotion_data


@router.get("/analytics/techniques")
async def get_technique_analytics():
    """
    Get technique usage analytics.
    
    Returns which techniques are used most and in which contexts.
    """
    technique_data = {
        "usage_count": {},
        "by_emotion": {},
        "by_phase": {}
    }
    
    for session_id, memory in conversation_state_manager.sessions.items():
        for tech, count in memory.techniques_used.items():
            technique_data["usage_count"][tech] = technique_data["usage_count"].get(tech, 0) + count
    
    return technique_data


# Export the event store function for use by other modules
def get_event_store_adder():
    return add_event_to_store
