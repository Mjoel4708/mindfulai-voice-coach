"""
Database service for session persistence.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, Float, DateTime, Text, Boolean
from datetime import datetime
from typing import Optional, List
from uuid import uuid4
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class Base(DeclarativeBase):
    pass


class Session(Base):
    """Session model for database."""
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True)
    status = Column(String, default="active")
    context = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)


class ConversationTurn(Base):
    """Conversation turn model for database."""
    __tablename__ = "conversation_turns"
    
    id = Column(String, primary_key=True)
    session_id = Column(String, index=True)
    user_message = Column(Text)
    coach_response = Column(Text)
    emotion = Column(String, nullable=True)
    intensity = Column(Float, nullable=True)
    technique = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SafetyIncident(Base):
    """Safety incident model for audit trail."""
    __tablename__ = "safety_incidents"
    
    id = Column(String, primary_key=True)
    session_id = Column(String, index=True)
    severity = Column(String)
    action_taken = Column(String)
    user_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class DatabaseService:
    """Service for database operations."""
    
    def __init__(self):
        self.engine = None
        self.async_session = None
        self.is_connected = False
    
    async def connect(self):
        """Initialize database connection."""
        try:
            self.engine = create_async_engine(
                settings.DATABASE_URL,
                echo=settings.DEBUG
            )
            
            # Create tables
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            self.async_session = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            self.is_connected = True
            logger.info("Database connected successfully")
        except Exception as e:
            logger.error("Failed to connect to database", error=str(e))
            self.is_connected = False
    
    async def disconnect(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
            self.is_connected = False
            logger.info("Database disconnected")
    
    async def create_session(self, session_id: str, context: Optional[str] = None):
        """Create a new session."""
        async with self.async_session() as session:
            db_session = Session(
                id=session_id,
                context=context,
                status="active"
            )
            session.add(db_session)
            await session.commit()
            logger.info("Session created in database", session_id=session_id)
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session by ID."""
        async with self.async_session() as session:
            result = await session.get(Session, session_id)
            if result:
                return {
                    "session_id": result.id,
                    "status": result.status,
                    "created_at": result.created_at.isoformat(),
                    "ended_at": result.ended_at.isoformat() if result.ended_at else None
                }
            return None
    
    async def end_session(self, session_id: str):
        """End a session."""
        async with self.async_session() as session:
            db_session = await session.get(Session, session_id)
            if db_session:
                db_session.status = "ended"
                db_session.ended_at = datetime.utcnow()
                await session.commit()
                logger.info("Session ended in database", session_id=session_id)
    
    async def save_conversation_turn(
        self,
        session_id: str,
        user_message: str,
        coach_response: str,
        emotion: Optional[str] = None,
        intensity: Optional[float] = None,
        technique: Optional[str] = None
    ):
        """Save a conversation turn."""
        async with self.async_session() as session:
            turn = ConversationTurn(
                id=str(uuid4()),
                session_id=session_id,
                user_message=user_message,
                coach_response=coach_response,
                emotion=emotion,
                intensity=intensity,
                technique=technique
            )
            session.add(turn)
            await session.commit()
            logger.info("Conversation turn saved", session_id=session_id)
    
    async def get_session_history(self, session_id: str) -> List[dict]:
        """Get conversation history for a session."""
        async with self.async_session() as session:
            from sqlalchemy import select
            stmt = select(ConversationTurn).where(
                ConversationTurn.session_id == session_id
            ).order_by(ConversationTurn.created_at)
            
            result = await session.execute(stmt)
            turns = result.scalars().all()
            
            return [
                {
                    "turn_id": turn.id,
                    "user_message": turn.user_message,
                    "coach_response": turn.coach_response,
                    "emotion": turn.emotion,
                    "intensity": turn.intensity,
                    "technique": turn.technique,
                    "timestamp": turn.created_at.isoformat()
                }
                for turn in turns
            ]
    
    async def save_safety_incident(
        self,
        session_id: str,
        severity: str,
        action_taken: str,
        user_message: str
    ):
        """Save a safety incident for audit trail."""
        async with self.async_session() as session:
            incident = SafetyIncident(
                id=str(uuid4()),
                session_id=session_id,
                severity=severity,
                action_taken=action_taken,
                user_message=user_message
            )
            session.add(incident)
            await session.commit()
            logger.info("Safety incident recorded", 
                       session_id=session_id, 
                       severity=severity)
