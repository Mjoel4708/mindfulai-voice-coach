"""
Conversation schemas.
"""
from pydantic import BaseModel
from typing import Optional, List


class EmotionAnalysis(BaseModel):
    """Schema for emotion analysis result."""
    emotion: str
    intensity: float  # 0.0 to 1.0
    intent: str
    confidence: float  # 0.0 to 1.0
    secondary_emotions: Optional[List[str]] = None


class Technique(BaseModel):
    """Schema for selected coaching technique."""
    name: str
    reason: str
    description: Optional[str] = None
    why_not: Optional[dict] = None  # Explains why other techniques were NOT chosen


class CoachResponse(BaseModel):
    """Schema for coach response."""
    text: str
    technique: str
    emotion_addressed: str


class ConversationTurn(BaseModel):
    """Schema for a conversation turn."""
    role: str  # "user" or "coach"
    content: str
    emotion: Optional[str] = None
    technique: Optional[str] = None
    timestamp: Optional[str] = None
