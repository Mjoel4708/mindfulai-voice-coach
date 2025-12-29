"""
Session schemas.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SessionCreate(BaseModel):
    """Schema for creating a new session."""
    context: Optional[str] = None


class SessionResponse(BaseModel):
    """Schema for session response."""
    session_id: str
    status: str
    created_at: str
    message: Optional[str] = None
    ended_at: Optional[str] = None


class ConversationTurnSchema(BaseModel):
    """Schema for a single conversation turn."""
    turn_id: str
    user_message: str
    coach_response: str
    emotion: Optional[str] = None
    intensity: Optional[float] = None
    technique: Optional[str] = None
    timestamp: str


class SessionHistory(BaseModel):
    """Schema for session conversation history."""
    session_id: str
    turns: List[ConversationTurnSchema]
