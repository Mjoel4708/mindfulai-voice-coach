"""
Intelligent Conversation State Machine for Therapeutic Journey Tracking.
This creates a "memory" system that prevents repetition and guides the conversation naturally.

KEY INNOVATION: MEMORY DECAY
- Emotional signals decay over conversation turns (factor: 0.7)
- This prevents old emotions from dominating current responses
- Example: anxiety(1.0) → anxiety(0.7) → anxiety(0.49) as turns pass
- If user expresses relief, it becomes dominant while old anxiety fades

KEY INNOVATION: OBSERVABLE AI COGNITION
- All memory state changes are emitted as Kafka events
- This makes the AI's "thinking" process transparent and auditable
- Events: memory.state.updated, memory.emotion.decayed, memory.phase.transitioned, etc.
"""
import json
import asyncio
from typing import List, Dict, Optional, Set, Tuple, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import structlog

logger = structlog.get_logger()

# Global event emitter - will be set by the application
_kafka_emitter: Optional[Callable] = None
_current_session_id: Optional[str] = None

# Event store adder - for admin dashboard
_event_store_adder: Optional[Callable] = None

def set_event_store_adder(adder: Callable):
    """Set the function to add events to the admin dashboard store."""
    global _event_store_adder
    _event_store_adder = adder

# Current turn number for correlation
_current_turn_number: int = 0


def set_memory_event_emitter(emitter: Callable, session_id: str = None):
    """Set the Kafka event emitter for memory events.
    
    This enables OBSERVABLE AI COGNITION - all memory changes
    are streamed as events for real-time monitoring and audit trails.
    """
    global _kafka_emitter, _current_session_id, _current_turn_number
    _kafka_emitter = emitter
    _current_session_id = session_id
    _current_turn_number = 0  # Reset turn counter for new session


def set_current_turn(turn_number: int):
    """Set the current turn number for correlation_id generation."""
    global _current_turn_number
    _current_turn_number = turn_number


def get_correlation_id(session_id: str = None) -> str:
    """Generate a correlation_id for event tracing.
    
    Format: {session_id}-turn{turn_number}
    Example: "sess_abc123-turn7"
    
    This enables:
    - Replay of all events in a conversation turn
    - Visualization of cause-effect chains
    - Root-cause analysis of AI decisions
    """
    sid = session_id or _current_session_id or "unknown"
    return f"{sid}-turn{_current_turn_number}"


async def emit_memory_event(
    event_type: str, 
    data: Dict[str, Any], 
    session_id: str = None,
    reason: str = None
):
    """Emit a memory event to Kafka for observable AI cognition.
    
    Event types:
    - memory.state.updated: Overall state change
    - memory.emotion.detected: New emotion detected
    - memory.emotion.decayed: Old emotion faded
    - memory.phase.transitioned: Conversation phase changed
    - memory.technique.used: Therapeutic technique applied
    - memory.insight.extracted: Key insight found in user's words
    - memory.breakthrough.detected: User had a breakthrough moment
    - memory.topic.identified: New topic identified
    
    Args:
        event_type: Type of memory event
        data: Event payload
        session_id: Session identifier
        reason: Human-readable explanation of WHY this event occurred
    """
    sid = session_id or _current_session_id
    event = {
        "event_type": event_type,
        "correlation_id": get_correlation_id(sid),
        "session_id": sid,
        "turn_number": _current_turn_number,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data
    }
    # Add reason/why field if provided - enables explainability
    if reason:
        event["reason"] = reason
    
    # Store event in admin dashboard
    if _event_store_adder:
        try:
            _event_store_adder(event)
        except Exception as e:
            logger.debug(f"Event store failed: {e}")
    
    # Emit to Kafka
    if _kafka_emitter:
        try:
            # Fire and forget - don't block on Kafka
            asyncio.create_task(_kafka_emitter("ai.cognition", event))
            logger.debug(f"Memory event emitted: {event_type}", 
                        correlation_id=event["correlation_id"], 
                        reason=reason,
                        data=data)
        except Exception as e:
            logger.debug(f"Memory event emission skipped: {e}")


def emit_memory_event_sync(
    event_type: str, 
    data: Dict[str, Any], 
    session_id: str = None,
    reason: str = None
):
    """Synchronous wrapper for emit_memory_event.
    
    Args:
        event_type: Type of memory event
        data: Event payload
        session_id: Session identifier
        reason: Human-readable explanation of WHY this event occurred
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(emit_memory_event(event_type, data, session_id, reason))
        else:
            loop.run_until_complete(emit_memory_event(event_type, data, session_id, reason))
    except RuntimeError:
        # No event loop, just log
        logger.debug(f"Memory event (no loop): {event_type}", data=data, reason=reason)


class ConversationPhase(str, Enum):
    """Phases of a therapeutic conversation."""
    OPENING = "opening"           # Initial greeting, building rapport
    EXPLORATION = "exploration"   # Understanding the issue
    DEEPENING = "deepening"       # Going deeper into feelings/causes
    TECHNIQUE = "technique"       # Applying therapeutic techniques
    INTEGRATION = "integration"   # Helping integrate insights
    CLOSING = "closing"           # Wrapping up, action items

# Decay factor for emotional memory (emotions fade over time)
EMOTION_DECAY_FACTOR = 0.7  # Each turn, old emotions are weighted by this factor
TOPIC_DECAY_FACTOR = 0.85   # Topics decay slower than emotions
MIN_RELEVANCE_THRESHOLD = 0.2  # Below this, memories are considered "faded"


@dataclass
class ConversationMemory:
    """Rich memory of the conversation that prevents repetition.
    
    Implements MEMORY DECAY: Recent emotions/topics have higher weight than older ones.
    This prevents old emotional states from dominating current responses.
    """
    
    # Current phase of the conversation
    phase: ConversationPhase = ConversationPhase.OPENING
    
    # Number of exchanges in current phase
    exchanges_in_phase: int = 0
    
    # Key topics/themes mentioned by user (with decay weights)
    user_topics: List[str] = field(default_factory=list)
    topic_weights: Dict[str, float] = field(default_factory=dict)  # topic -> relevance weight
    
    # Emotions detected throughout session (with timestamps and decay)
    emotion_journey: List[Dict] = field(default_factory=list)
    emotion_weights: Dict[str, float] = field(default_factory=dict)  # emotion -> current weight
    
    # Insights extracted from user's words
    key_insights: List[str] = field(default_factory=list)
    
    # Techniques already used (to avoid overusing one)
    techniques_used: Dict[str, int] = field(default_factory=dict)
    
    # Phrases/responses already given (to never repeat)
    used_response_patterns: Set[str] = field(default_factory=set)
    
    # Questions already asked (to never repeat)
    questions_asked: Set[str] = field(default_factory=set)
    
    # User's stated goals or needs
    user_goals: List[str] = field(default_factory=list)
    
    # Breakthroughs or important moments
    breakthroughs: List[str] = field(default_factory=list)
    
    # Total exchanges count
    total_exchanges: int = 0
    
    # Exercise tracking - stores completed exercises and their outcomes
    exercises_completed: List[Dict] = field(default_factory=list)
    # Format: {"exercise_type": "breathing", "outcome": "helped", "timestamp": "...", "user_feedback": "..."}
    
    # Pending clarification - when AI needs to ask about unclear speech
    pending_clarification: Optional[str] = field(default=None)
    
    def get_dominant_emotion(self) -> Tuple[str, float]:
        """Get the current dominant emotion considering decay weights.
        
        Returns the emotion with highest decayed weight, representing
        what's most emotionally relevant RIGHT NOW.
        """
        if not self.emotion_weights:
            return ("neutral", 0.5)
        
        # Find emotion with highest current weight
        dominant = max(self.emotion_weights.items(), key=lambda x: x[1])
        return dominant
    
    def get_weighted_emotion_summary(self) -> str:
        """Get a summary of emotions with their current relevance weights.
        
        Example: "anxiety(0.8), sadness(0.4), fear(0.2 - fading)"
        """
        if not self.emotion_weights:
            return "No emotional data yet"
        
        # Sort by weight descending
        sorted_emotions = sorted(self.emotion_weights.items(), key=lambda x: -x[1])
        
        parts = []
        for emotion, weight in sorted_emotions:
            if weight >= MIN_RELEVANCE_THRESHOLD:
                if weight >= 0.7:
                    parts.append(f"{emotion}({weight:.1f} - strong)")
                elif weight >= 0.4:
                    parts.append(f"{emotion}({weight:.1f})")
                else:
                    parts.append(f"{emotion}({weight:.1f} - fading)")
        
        return ", ".join(parts) if parts else "emotions fading"
    
    def to_context_string(self) -> str:
        """Convert memory to a rich context string for the AI.
        
        Includes DECAYED emotional weights so AI focuses on current emotional state,
        not stale emotions from earlier in the conversation.
        """
        context_parts = [
            f"CONVERSATION STATE:",
            f"- Phase: {self.phase.value.upper()} (exchange {self.exchanges_in_phase + 1} in this phase)",
            f"- Total exchanges: {self.total_exchanges}",
        ]
        
        if self.user_topics:
            # Show topics with relevance (decayed weights)
            weighted_topics = []
            for topic in self.user_topics[-5:]:
                weight = self.topic_weights.get(topic, 0.5)
                if weight >= MIN_RELEVANCE_THRESHOLD:
                    weighted_topics.append(f"{topic}" if weight > 0.5 else f"{topic}(fading)")
            if weighted_topics:
                context_parts.append(f"- User's topics: {', '.join(weighted_topics)}")
        
        # MEMORY DECAY: Show weighted emotional state
        if self.emotion_weights:
            dominant_emotion, weight = self.get_dominant_emotion()
            weighted_summary = self.get_weighted_emotion_summary()
            context_parts.append(f"- CURRENT emotional state (with decay): {weighted_summary}")
            context_parts.append(f"- Dominant emotion NOW: {dominant_emotion} (relevance: {weight:.1f})")
        elif self.emotion_journey:
            recent_emotions = [e['emotion'] for e in self.emotion_journey[-3:]]
            context_parts.append(f"- Emotional journey: {' → '.join(recent_emotions)}")
        
        if self.key_insights:
            context_parts.append(f"- Key insights gathered: {'; '.join(self.key_insights[-3:])}")
        
        if self.user_goals:
            context_parts.append(f"- User's goals: {'; '.join(self.user_goals)}")
        
        if self.techniques_used:
            tech_summary = [f"{t}({c}x)" for t, c in self.techniques_used.items()]
            context_parts.append(f"- Techniques used: {', '.join(tech_summary)}")
        
        if self.questions_asked:
            context_parts.append(f"- Questions already asked ({len(self.questions_asked)}): Avoid repeating these themes")
        
        if self.breakthroughs:
            context_parts.append(f"- Breakthroughs: {'; '.join(self.breakthroughs[-2:])}")
        
        # IMPORTANT: Track completed exercises to avoid repetition
        if self.exercises_completed:
            exercise_types = [e.get('exercise_type', 'unknown') for e in self.exercises_completed]
            context_parts.append(f"- EXERCISES ALREADY COMPLETED: {', '.join(exercise_types)} - DO NOT suggest these again or keep discussing them. Move the conversation forward.")
        
        # Phase-specific guidance
        phase_guidance = self._get_phase_guidance()
        context_parts.append(f"\nPHASE GUIDANCE: {phase_guidance}")
        
        return "\n".join(context_parts)
    
    def _get_phase_guidance(self) -> str:
        """Get guidance based on current conversation phase."""
        guidance = {
            ConversationPhase.OPENING: 
                "Build rapport. Ask what brings them here. Be warm and welcoming. Don't rush into techniques.",
            ConversationPhase.EXPLORATION:
                "Understand the situation better. Ask clarifying questions. Reflect back what you hear. Identify the core issue.",
            ConversationPhase.DEEPENING:
                "Go deeper into emotions and root causes. Use open-ended questions. Validate their experience. Look for patterns.",
            ConversationPhase.TECHNIQUE:
                "Apply appropriate therapeutic techniques. Guide them through exercises. Offer new perspectives. Be action-oriented.",
            ConversationPhase.INTEGRATION:
                "Help them integrate insights. Ask what they're taking away. Reinforce progress. Discuss how to apply learnings.",
            ConversationPhase.CLOSING:
                "Summarize the session. Acknowledge their courage. Offer encouragement. Invite them back."
        }
        return guidance.get(self.phase, "Continue supporting the user empathetically.")


class ConversationStateManager:
    """
    Manages conversation state to create intelligent, non-repetitive dialogue.
    """
    
    # Phrases that indicate readiness to move to next phase
    PHASE_TRANSITION_SIGNALS = {
        ConversationPhase.OPENING: {
            "next": ConversationPhase.EXPLORATION,
            "min_exchanges": 1,
            "signals": ["feel", "been feeling", "struggling", "help", "want to talk about", "going through"]
        },
        ConversationPhase.EXPLORATION: {
            "next": ConversationPhase.DEEPENING,
            "min_exchanges": 2,
            "signals": ["because", "think it's", "started when", "always", "never", "reminds me"]
        },
        ConversationPhase.DEEPENING: {
            "next": ConversationPhase.TECHNIQUE,
            "min_exchanges": 2,
            "signals": ["what should I", "how can I", "want to change", "need help", "what do you think"]
        },
        ConversationPhase.TECHNIQUE: {
            "next": ConversationPhase.INTEGRATION,
            "min_exchanges": 2,
            "signals": ["that helps", "I see", "makes sense", "never thought of it", "feel better"]
        },
        ConversationPhase.INTEGRATION: {
            "next": ConversationPhase.CLOSING,
            "min_exchanges": 1,
            "signals": ["thank you", "helpful", "going to try", "feel better", "appreciate"]
        }
    }
    
    # Topic extraction keywords
    TOPIC_KEYWORDS = {
        "work": ["work", "job", "boss", "colleague", "deadline", "meeting", "career", "office"],
        "relationships": ["partner", "friend", "family", "mother", "father", "relationship", "dating", "marriage"],
        "health": ["health", "sleep", "tired", "sick", "pain", "body", "eating"],
        "anxiety": ["anxious", "worried", "nervous", "panic", "fear", "scared", "stress"],
        "sadness": ["sad", "depressed", "hopeless", "crying", "lonely", "empty", "grief"],
        "anger": ["angry", "frustrated", "annoyed", "mad", "furious", "resentful"],
        "self_worth": ["worthless", "failure", "not good enough", "hate myself", "stupid", "useless"],
        "future": ["future", "tomorrow", "next week", "goals", "plans", "dream"]
    }
    
    def __init__(self):
        self.sessions: Dict[str, ConversationMemory] = {}
    
    def get_or_create_memory(self, session_id: str) -> ConversationMemory:
        """Get existing memory or create new one for session."""
        if session_id not in self.sessions:
            self.sessions[session_id] = ConversationMemory()
            logger.info("Created new conversation memory", session_id=session_id)
        return self.sessions[session_id]
    
    def _apply_memory_decay(self, memory: ConversationMemory) -> None:
        """Apply decay to emotional and topic weights.
        
        This is the MEMORY DECAY system:
        - Old emotions fade over time (multiplied by EMOTION_DECAY_FACTOR each turn)
        - Old topics fade slower (multiplied by TOPIC_DECAY_FACTOR)
        - This prevents stale emotional states from dominating responses
        
        Example: If user was anxious (1.0) but then expressed relief:
        Turn 1: anxiety=1.0
        Turn 2: anxiety=0.7, relief=1.0  (anxiety decayed)
        Turn 3: anxiety=0.49, relief=0.7 (both decayed, but relief is dominant)
        """
        # Decay emotion weights
        faded_emotions = []
        decayed_emotions = {}
        for emotion, weight in memory.emotion_weights.items():
            new_weight = weight * EMOTION_DECAY_FACTOR
            if new_weight < MIN_RELEVANCE_THRESHOLD:
                faded_emotions.append(emotion)
            else:
                decayed_emotions[emotion] = {"from": weight, "to": new_weight}
                memory.emotion_weights[emotion] = new_weight
        
        # Emit decay events for OBSERVABLE AI COGNITION
        if decayed_emotions:
            emit_memory_event_sync(
                "memory.emotion.decayed", 
                {
                    "decayed_emotions": decayed_emotions,
                    "decay_factor": EMOTION_DECAY_FACTOR
                },
                reason=f"Temporal decay applied - emotions fade by {EMOTION_DECAY_FACTOR}x per turn to keep focus on current feelings"
            )
        
        # Remove completely faded emotions
        for emotion in faded_emotions:
            del memory.emotion_weights[emotion]
            logger.debug(f"Emotion '{emotion}' faded from memory")
            emit_memory_event_sync(
                "memory.emotion.faded", 
                {"emotion": emotion},
                reason=f"'{emotion}' dropped below relevance threshold ({MIN_RELEVANCE_THRESHOLD}) - user hasn't mentioned this feeling recently"
            )
        
        # Decay topic weights
        faded_topics = []
        for topic, weight in memory.topic_weights.items():
            new_weight = weight * TOPIC_DECAY_FACTOR
            if new_weight < MIN_RELEVANCE_THRESHOLD:
                faded_topics.append(topic)
            else:
                memory.topic_weights[topic] = new_weight
        
        for topic in faded_topics:
            del memory.topic_weights[topic]
            emit_memory_event_sync(
                "memory.topic.faded", 
                {"topic": topic},
                reason=f"Topic '{topic}' faded from focus - conversation moved to other subjects"
            )
    
    def update_memory(
        self,
        session_id: str,
        user_message: str,
        emotion: str,
        intensity: float,
        ai_response: str,
        technique_used: str
    ) -> ConversationMemory:
        """Update memory after an exchange with MEMORY DECAY applied.
        
        Emits OBSERVABLE AI COGNITION events to Kafka:
        - memory.emotion.detected
        - memory.topic.identified
        - memory.insight.extracted
        - memory.technique.used
        - memory.phase.transitioned
        - memory.breakthrough.detected
        - memory.state.updated
        """
        memory = self.get_or_create_memory(session_id)
        previous_phase = memory.phase
        
        # FIRST: Apply decay to existing memories before adding new ones
        self._apply_memory_decay(memory)
        
        # Increment counters
        memory.total_exchanges += 1
        memory.exchanges_in_phase += 1
        
        # Track emotion journey (raw data)
        memory.emotion_journey.append({
            "emotion": emotion,
            "intensity": intensity,
            "exchange": memory.total_exchanges,
            "timestamp": datetime.now().isoformat()
        })
        
        # Update emotion weight with BLENDING - preserve emotional continuity
        # Instead of overwriting, we blend: max(previous * 0.6 + new * 0.4, new * 0.8)
        # This ensures emotions feel continuous, not jumpy
        previous_weight = memory.emotion_weights.get(emotion, 0)
        if previous_weight > 0:
            # Blend with previous - don't just overwrite
            blended_weight = max(previous_weight * 0.6 + intensity * 0.4, intensity * 0.8)
            memory.emotion_weights[emotion] = blended_weight
        else:
            # New emotion - use intensity directly but dampened for new entries
            memory.emotion_weights[emotion] = intensity * 0.9
        
        new_weight = memory.emotion_weights[emotion]
        
        # Emit emotion detected event
        is_new = previous_weight == 0
        emotion_reason = (
            f"Detected new emotion '{emotion}' (intensity: {intensity:.1f}, stored: {new_weight:.1f}) from user's words"
            if is_new else
            f"User reinforced existing emotion '{emotion}' - blended from {previous_weight:.1f} to {new_weight:.1f} (raw: {intensity:.1f})"
        )
        emit_memory_event_sync(
            "memory.emotion.detected", 
            {
                "emotion": emotion,
                "intensity": intensity,
                "previous_weight": previous_weight,
                "is_new": is_new,
                "all_emotions": dict(memory.emotion_weights)
            }, 
            session_id,
            reason=emotion_reason
        )
        
        # CONFLICT DETECTION: Check for emotional contradictions
        # This helps judges understand when the AI detects mixed signals
        if len(memory.emotion_journey) >= 2:
            self._detect_emotional_conflict(memory, emotion, session_id)
        
        logger.debug(f"Emotion weight updated: {emotion}={intensity:.2f}", 
                    all_weights=dict(memory.emotion_weights))
        
        # Extract and add topics with weights
        topics = self._extract_topics(user_message)
        new_topics = []
        for topic in topics:
            if topic not in memory.user_topics:
                memory.user_topics.append(topic)
                new_topics.append(topic)
            # New mention = full relevance
            memory.topic_weights[topic] = 1.0
        
        # Emit topic identified event
        if new_topics:
            emit_memory_event_sync(
                "memory.topic.identified", 
                {
                    "new_topics": new_topics,
                    "all_topics": memory.user_topics
                }, 
                session_id,
                reason=f"User introduced new topic(s): {', '.join(new_topics)} - adding to conversation context"
            )
        
        # Extract insights from user message
        insight = self._extract_insight(user_message, emotion)
        if insight and insight not in memory.key_insights:
            memory.key_insights.append(insight)
            # Emit insight extracted event
            emit_memory_event_sync(
                "memory.insight.extracted", 
                {
                    "insight": insight,
                    "derived_from_emotion": emotion,
                    "total_insights": len(memory.key_insights)
                }, 
                session_id,
                reason=f"User expressed meaningful insight during {emotion} state - this could indicate self-awareness growth"
            )
        
        # Track technique usage
        memory.techniques_used[technique_used] = memory.techniques_used.get(technique_used, 0) + 1
        usage_count = memory.techniques_used[technique_used]
        
        # Generate technique reason
        technique_reasons = {
            "reflective_listening": "User needs to feel heard - mirroring back their feelings validates their experience",
            "cognitive_reframing": "User may benefit from seeing situation from a different perspective",
            "grounding": "User showing signs of emotional overwhelm - grounding helps return to present moment",
            "validation": "User's feelings deserve acknowledgment before problem-solving",
            "psychoeducation": "User would benefit from understanding the psychology behind their experience",
            "solution_focused": "User is ready and asking for actionable steps forward",
            "motivational_interviewing": "Helping user discover their own motivation for change",
            "general": "Providing general supportive response based on conversation flow"
        }
        technique_reason = technique_reasons.get(
            technique_used, 
            f"Selected '{technique_used}' as most appropriate therapeutic approach for current emotional state"
        )
        if usage_count > 1:
            technique_reason += f" (used {usage_count}x - varying application to avoid repetition)"
        
        # Emit technique used event
        emit_memory_event_sync(
            "memory.technique.used", 
            {
                "technique": technique_used,
                "usage_count": usage_count,
                "all_techniques": dict(memory.techniques_used)
            }, 
            session_id,
            reason=technique_reason
        )
        
        # Track response patterns to avoid repetition
        response_pattern = self._get_response_pattern(ai_response)
        memory.used_response_patterns.add(response_pattern)
        
        # Track questions asked
        if "?" in ai_response:
            question_pattern = self._extract_question_theme(ai_response)
            memory.questions_asked.add(question_pattern)
        
        # Store exchanges count BEFORE phase transition check (for accurate reporting)
        exchanges_in_previous_phase = memory.exchanges_in_phase
        
        # Check for phase transition
        self._check_phase_transition(memory, user_message)
        
        # Emit phase transition event if changed
        if memory.phase != previous_phase:
            phase_transition_reasons = {
                ("opening", "exploration"): "User began sharing what's on their mind - moving from greeting to exploration",
                ("exploration", "deepening"): "User revealed underlying causes/patterns - ready to go deeper",
                ("deepening", "technique"): "User asking for guidance or ready for therapeutic intervention",
                ("technique", "integration"): "User showing understanding and acceptance - time to integrate insights",
                ("integration", "closing"): "User expressing gratitude or closure - wrapping up session"
            }
            transition_key = (previous_phase.value, memory.phase.value)
            phase_reason = phase_transition_reasons.get(
                transition_key,
                f"Natural progression from {previous_phase.value} to {memory.phase.value} based on user signals"
            )
            emit_memory_event_sync(
                "memory.phase.transitioned", 
                {
                    "from_phase": previous_phase.value,
                    "to_phase": memory.phase.value,
                    "exchanges_in_previous_phase": exchanges_in_previous_phase,  # Use stored value
                    "trigger": "user_signal_detected"
                }, 
                session_id,
                reason=phase_reason
            )
        
        # Check for breakthroughs
        breakthrough = self._detect_breakthrough(user_message, emotion)
        if breakthrough:
            memory.breakthroughs.append(breakthrough)
            # Emit breakthrough event - this is special!
            emit_memory_event_sync(
                "memory.breakthrough.detected", 
                {
                    "breakthrough": breakthrough,
                    "emotion_context": emotion,
                    "exchange_number": memory.total_exchanges,
                    "total_breakthroughs": len(memory.breakthroughs)
                }, 
                session_id,
                reason=f"🎉 USER BREAKTHROUGH: User showed moment of clarity/realization - '{breakthrough}' - this is a significant therapeutic moment"
            )
        
        # Emit overall state update event
        dominant_emotion, dominant_weight = memory.get_dominant_emotion()
        state_summary = f"Turn {memory.total_exchanges} complete. User feeling primarily {dominant_emotion} ({dominant_weight:.0%} relevance). Phase: {memory.phase.value}."
        emit_memory_event_sync(
            "memory.state.updated", 
            {
                "exchange_number": memory.total_exchanges,
                "phase": memory.phase.value,
                "dominant_emotion": dominant_emotion,
                "dominant_emotion_weight": dominant_weight,
                "active_topics": list(memory.topic_weights.keys()),
                "techniques_used_count": sum(memory.techniques_used.values()),
                "insights_count": len(memory.key_insights),
                "breakthroughs_count": len(memory.breakthroughs)
            }, 
            session_id,
            reason=state_summary
        )
        
        logger.info("Updated conversation memory",
                   session_id=session_id,
                   phase=memory.phase.value,
                   total_exchanges=memory.total_exchanges)
        
        return memory
    
    def _extract_topics(self, message: str) -> List[str]:
        """Extract topics from user message."""
        message_lower = message.lower()
        found_topics = []
        
        for topic, keywords in self.TOPIC_KEYWORDS.items():
            if any(kw in message_lower for kw in keywords):
                found_topics.append(topic)
        
        return found_topics
    
    def _extract_insight(self, message: str, emotion: str) -> Optional[str]:
        """Extract a key insight from user's message."""
        message_lower = message.lower()
        
        # Look for causal statements
        causal_patterns = ["because", "since", "when", "after", "before", "makes me"]
        for pattern in causal_patterns:
            if pattern in message_lower:
                # Extract the insight around this pattern
                idx = message_lower.find(pattern)
                insight = message[max(0, idx-20):min(len(message), idx+50)]
                return f"User feels {emotion} {insight.strip()}..."
        
        # Look for belief statements
        belief_patterns = ["i think", "i feel like", "i believe", "i always", "i never"]
        for pattern in belief_patterns:
            if pattern in message_lower:
                idx = message_lower.find(pattern)
                insight = message[idx:min(len(message), idx+60)]
                return f"Core belief: '{insight.strip()}'"
        
        return None
    
    def _get_response_pattern(self, response: str) -> str:
        """Get a pattern hash of response to detect repetition."""
        # Extract first 5 words as pattern
        words = response.split()[:5]
        return " ".join(words).lower()
    
    def _extract_question_theme(self, response: str) -> str:
        """Extract the theme of a question to avoid repeating."""
        # Find the question
        if "?" in response:
            q_idx = response.rfind("?")
            # Find start of question (look for previous sentence end or start)
            start_idx = max(response.rfind(".", 0, q_idx), response.rfind("!", 0, q_idx), 0)
            question = response[start_idx:q_idx+1].strip()
            # Get key words
            key_words = [w for w in question.lower().split() 
                        if len(w) > 3 and w not in ["what", "that", "this", "your", "with", "about", "have", "does"]]
            return " ".join(key_words[:3])
        return ""
    
    def _check_phase_transition(self, memory: ConversationMemory, user_message: str) -> None:
        """Check if conversation should move to next phase."""
        current_phase = memory.phase
        
        if current_phase == ConversationPhase.CLOSING:
            return  # Already at final phase
        
        transition_config = self.PHASE_TRANSITION_SIGNALS.get(current_phase)
        if not transition_config:
            return
        
        min_exchanges = transition_config["min_exchanges"]
        signals = transition_config["signals"]
        next_phase = transition_config["next"]
        
        # Check if minimum exchanges met
        if memory.exchanges_in_phase < min_exchanges:
            return
        
        # Check for transition signals in user message
        message_lower = user_message.lower()
        if any(signal in message_lower for signal in signals):
            memory.phase = next_phase
            memory.exchanges_in_phase = 0
            logger.info("Phase transition", 
                       from_phase=current_phase.value, 
                       to_phase=next_phase.value)
    
    def _detect_breakthrough(self, message: str, emotion: str) -> Optional[str]:
        """Detect if user had a breakthrough or insight.
        
        Breakthroughs require BOTH:
        1. A verbal signal (e.g., "I realize", "that makes sense")
        2. A positive emotion context (relief, calm, gratitude, hopeful, curious)
        
        This prevents false positives from sarcastic or dismissive statements.
        """
        # Positive emotions that indicate genuine insight
        positive_emotions = ["relief", "calm", "gratitude", "hopeful", "curious", "peaceful", "content"]
        
        # If emotion is negative, this is likely sarcasm or dismissal
        if emotion not in positive_emotions:
            return None
        
        breakthrough_signals = [
            "i realize", "i never thought", "that makes sense", 
            "i see now", "i understand", "aha", "oh wow",
            "you're right", "i didn't think of it", "that's true",
            "that helps", "i feel better", "this is helping"
        ]
        
        message_lower = message.lower()
        for signal in breakthrough_signals:
            if signal in message_lower:
                return f"User had insight: '{message[:60]}...'"
        
        return None
    
    def _detect_emotional_conflict(
        self, 
        memory: ConversationMemory, 
        current_emotion: str, 
        session_id: str
    ) -> None:
        """Detect contradictory emotion patterns and emit conflict event.
        
        Conflicts occur when:
        - Positive emotion follows strong negative (sudden shift)
        - User expresses gratitude while still showing anxiety
        - Mixed signals that require careful handling
        
        This helps judges understand the AI's nuanced emotional tracking.
        """
        # Define emotion categories
        positive_emotions = {"relief", "calm", "gratitude", "hopeful", "peaceful", "content", "curious"}
        negative_emotions = {"anxiety", "sadness", "frustration", "anger", "fear", "overwhelmed", "stressed"}
        
        # Get last emotion from journey
        if len(memory.emotion_journey) < 2:
            return
        
        last_entry = memory.emotion_journey[-2]  # Previous emotion (before current)
        last_emotion = last_entry["emotion"]
        last_intensity = last_entry["intensity"]
        
        # Check for sudden polarity shift
        current_is_positive = current_emotion in positive_emotions
        last_was_negative = last_emotion in negative_emotions
        
        # Conflict: sudden shift from strong negative to positive
        if current_is_positive and last_was_negative and last_intensity > 0.6:
            emit_memory_event_sync(
                "memory.conflict.detected",
                {
                    "conflict_type": "sudden_polarity_shift",
                    "from_emotion": last_emotion,
                    "from_intensity": last_intensity,
                    "to_emotion": current_emotion,
                    "exchanges_apart": 1,
                    "interpretation": "User may be suppressing or processing emotions rapidly"
                },
                session_id,
                reason=f"Detected emotional conflict: user shifted from {last_emotion} ({last_intensity:.0%}) to {current_emotion} in one exchange - may indicate emotional processing or suppression"
            )
            logger.info("Emotional conflict detected",
                       from_emotion=last_emotion,
                       to_emotion=current_emotion,
                       session_id=session_id)
        
        # Conflict: expressing gratitude while negative emotions still high
        if current_emotion == "gratitude":
            high_negatives = [
                (em, wt) for em, wt in memory.emotion_weights.items() 
                if em in negative_emotions and wt > 0.4
            ]
            if high_negatives:
                emit_memory_event_sync(
                    "memory.conflict.detected",
                    {
                        "conflict_type": "mixed_resolution",
                        "gratitude_expressed": True,
                        "lingering_negatives": dict(high_negatives),
                        "interpretation": "User showing gratitude despite unresolved negative emotions"
                    },
                    session_id,
                    reason=f"User expressed gratitude but still has elevated {', '.join([e[0] for e in high_negatives])} - partial but incomplete resolution"
                )
    
    def log_exercise_completion(
        self, 
        session_id: str, 
        exercise_type: str, 
        outcome: str,
        user_feedback: str
    ) -> None:
        """Log when user completes an exercise (breathing, grounding, etc.).
        
        Args:
            session_id: Session identifier
            exercise_type: Type of exercise (breathing, grounding, visualization)
            outcome: Outcome of the exercise (helped, somewhat_helped, didnt_help)
            user_feedback: What the user said about the exercise
        """
        memory = self.get_or_create_memory(session_id)
        
        exercise_record = {
            "exercise_type": exercise_type,
            "outcome": outcome,
            "user_feedback": user_feedback,
            "timestamp": datetime.now().isoformat(),
            "emotion_before": memory.get_dominant_emotion()[0] if memory.emotion_weights else "unknown"
        }
        
        memory.exercises_completed.append(exercise_record)
        
        # Emit event for observable AI cognition
        emit_memory_event_sync(
            "memory.exercise.completed",
            {
                "exercise_type": exercise_type,
                "outcome": outcome,
                "user_feedback": user_feedback[:100],
                "total_exercises": len(memory.exercises_completed)
            },
            session_id,
            reason=f"User completed {exercise_type} exercise - outcome: {outcome}"
        )
        
        logger.info("Exercise completion logged",
                   session_id=session_id,
                   exercise_type=exercise_type,
                   outcome=outcome)
    
    def detect_exercise_feedback(self, message: str) -> Optional[Dict[str, str]]:
        """Detect if user is giving feedback about an exercise.
        
        Returns:
            Dict with exercise_type and outcome, or None if not exercise feedback
        """
        message_lower = message.lower()
        
        # Common exercise-related words and their speech recognition errors
        exercise_signals = [
            "exercise", "exercice", "exorcist", "excersize",  # speech recognition variants
            "breathing", "breath", "grounding", "ground",
            "technique", "that helped", "feel better", "feel calmer",
            "didn't help", "didn't work", "still feel"
        ]
        
        if not any(signal in message_lower for signal in exercise_signals):
            return None
        
        # Determine exercise type
        exercise_type = "general"
        if any(w in message_lower for w in ["breath", "breathing"]):
            exercise_type = "breathing"
        elif any(w in message_lower for w in ["ground", "grounding", "5 things", "senses"]):
            exercise_type = "grounding"
        
        # Determine outcome
        positive_signals = ["helped", "better", "calmer", "relaxed", "thank", "good", "worked"]
        negative_signals = ["didn't help", "didn't work", "still", "same", "worse", "not really"]
        
        if any(signal in message_lower for signal in positive_signals):
            outcome = "helped"
        elif any(signal in message_lower for signal in negative_signals):
            outcome = "didnt_help"
        else:
            outcome = "neutral"
        
        return {
            "exercise_type": exercise_type,
            "outcome": outcome,
            "original_message": message
        }
    
    def detect_unclear_speech(self, message: str) -> Optional[Dict[str, str]]:
        """Detect if the speech transcription might contain errors.
        
        Common speech recognition errors to detect:
        - "Exorcist" → "exercise"
        - Unusual words that don't fit context
        - Very short or garbled phrases
        
        Returns:
            Dict with unclear_word and suggested_correction, or None
        """
        message_lower = message.lower()
        
        # Known speech recognition errors and their likely corrections
        SPEECH_ERRORS = {
            "exorcist": {"correction": "exercise", "context": "wellness/therapy"},
            "exercice": {"correction": "exercise", "context": "wellness/therapy"},
            "exercist": {"correction": "exercise", "context": "wellness/therapy"},
            "excersize": {"correction": "exercise", "context": "wellness/therapy"},
            "breath thing": {"correction": "breathing", "context": "wellness/therapy"},
            "ground thing": {"correction": "grounding", "context": "wellness/therapy"},
        }
        
        for error, info in SPEECH_ERRORS.items():
            if error in message_lower:
                return {
                    "unclear_word": error,
                    "suggested_correction": info["correction"],
                    "context": info["context"],
                    "original_message": message
                }
        
        # Check for very unusual word combinations that might indicate errors
        unusual_patterns = [
            # Words that are unlikely in a therapy context
            ("exorcist", "exercise"),
            ("demon", "them"),
        ]
        
        for unusual, likely in unusual_patterns:
            if unusual in message_lower and unusual not in ["feel", "feeling"]:
                return {
                    "unclear_word": unusual,
                    "suggested_correction": likely,
                    "context": "speech_recognition_error",
                    "original_message": message
                }
        
        return None
    
    def get_anti_repetition_guidance(self, memory: ConversationMemory) -> str:
        """Generate guidance to prevent repetition."""
        guidance_parts = []
        
        if memory.used_response_patterns:
            guidance_parts.append(
                f"DO NOT start your response with any of these patterns: "
                f"{', '.join(list(memory.used_response_patterns)[-5:])}"
            )
        
        if memory.questions_asked:
            guidance_parts.append(
                f"DO NOT ask about these themes again: "
                f"{', '.join(list(memory.questions_asked)[-5:])}"
            )
        
        # Suggest under-used techniques
        if memory.techniques_used:
            most_used = max(memory.techniques_used.values())
            if most_used > 2:
                overused = [t for t, c in memory.techniques_used.items() if c >= most_used]
                guidance_parts.append(
                    f"AVOID using these overused techniques: {', '.join(overused)}. "
                    f"Try something different."
                )
        
        # CRITICAL: Prevent exercise repetition
        if memory.exercises_completed:
            exercise_types = list(set(e.get('exercise_type', 'unknown') for e in memory.exercises_completed))
            guidance_parts.append(
                f"IMPORTANT: User has already completed {len(memory.exercises_completed)} exercise(s) ({', '.join(exercise_types)}). "
                f"DO NOT keep talking about exercises or asking about them. Move the conversation forward to other topics. "
                f"Acknowledge briefly if user mentions it again, then redirect."
            )
        
        return "\n".join(guidance_parts) if guidance_parts else ""
    
    def clear_session(self, session_id: str) -> None:
        """Clear memory for a session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info("Cleared conversation memory", session_id=session_id)


# Global instance
conversation_state_manager = ConversationStateManager()
