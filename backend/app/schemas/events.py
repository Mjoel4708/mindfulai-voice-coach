"""
Event schemas for Kafka streaming.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class BaseEvent(BaseModel):
    """Base schema for all events."""
    event_type: str
    session_id: str
    timestamp: str


class ConversationEvent(BaseEvent):
    """Schema for conversation events."""
    length_seconds: Optional[float] = None
    transcript_length: Optional[int] = None
    user_context: Optional[str] = None


class AIDecisionEvent(BaseEvent):
    """Schema for AI decision events."""
    emotion: Optional[str] = None
    intensity: Optional[float] = None
    intent: Optional[str] = None
    confidence: Optional[float] = None
    technique: Optional[str] = None
    reason: Optional[str] = None


class SafetyEvent(BaseEvent):
    """Schema for safety events."""
    severity: str  # "low", "medium", "high", "critical"
    action_taken: str
    keywords_detected: Optional[List[str]] = None
