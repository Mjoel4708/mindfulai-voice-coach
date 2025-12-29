"""
WebSocket endpoint for real-time voice interaction.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
import json
import structlog

from app.services.gemini.analyzer import GeminiAnalyzer
from app.services.gemini.responder import GeminiResponder
from app.services.elevenlabs.synthesizer import VoiceSynthesizer
from app.services.safety.evaluator import SafetyEvaluator
from app.services.gemini.conversation_state import (
    set_memory_event_emitter, 
    set_current_turn,
    conversation_state_manager
)
from app.schemas.events import ConversationEvent, AIDecisionEvent, SafetyEvent

router = APIRouter()
logger = structlog.get_logger()


class ConnectionManager:
    """Manages WebSocket connections."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info("WebSocket connected", session_id=session_id)
    
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info("WebSocket disconnected", session_id=session_id)
    
    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)


manager = ConnectionManager()


@router.websocket("/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time voice coaching interaction.
    
    Message Types (from client):
    - user_speech: { "type": "user_speech", "transcript": "...", "audio_duration": 5.2 }
    - ping: { "type": "ping" }
    
    Message Types (to client):
    - coach_response: { "type": "coach_response", "text": "...", "audio_url": "...", "emotion": "...", "technique": "..." }
    - safety_alert: { "type": "safety_alert", "message": "...", "resources": [...] }
    - error: { "type": "error", "message": "..." }
    - pong: { "type": "pong" }
    """
    await manager.connect(websocket, session_id)
    
    # Initialize services
    analyzer = GeminiAnalyzer()
    responder = GeminiResponder()
    synthesizer = VoiceSynthesizer()
    safety_evaluator = SafetyEvaluator()
    
    # PERSIST SESSION TO POSTGRESQL
    try:
        if hasattr(websocket.app.state, 'db') and websocket.app.state.db.is_connected:
            await websocket.app.state.db.create_session(session_id)
            logger.info("Session persisted to database", session_id=session_id)
    except Exception as e:
        logger.error("Failed to persist session to database", error=str(e))
    
    # Wire up OBSERVABLE AI COGNITION - memory events go to Kafka
    async def kafka_memory_emitter(topic: str, event: dict):
        """Emit memory events to Kafka for observable AI cognition."""
        try:
            if hasattr(websocket.app.state, 'kafka_producer') and websocket.app.state.kafka_producer.is_connected:
                await websocket.app.state.kafka_producer.send_event(topic=topic, event=event)
        except Exception as e:
            logger.debug("Memory event to Kafka skipped", error=str(e))
    
    set_memory_event_emitter(kafka_memory_emitter, session_id)
    logger.info("Observable AI Cognition enabled - memory events streaming to Kafka", session_id=session_id)
    
    # Conversation context
    conversation_history = []
    is_first_message = True
    
    try:
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await manager.send_message(session_id, {"type": "pong"})
                continue
            
            # Handle welcome message request
            if message.get("type") == "request_welcome":
                welcome_text = "Hello, I'm here to support you. How are you feeling today?"
                try:
                    welcome_audio = await synthesizer.synthesize(welcome_text)
                except Exception as e:
                    logger.error("Failed to synthesize welcome audio", error=str(e))
                    welcome_audio = None
                
                await manager.send_message(session_id, {
                    "type": "coach_response",
                    "text": welcome_text,
                    "audio_base64": welcome_audio,
                    "emotion": None,
                    "technique": "greeting"
                })
                
                # Add welcome to conversation history
                conversation_history.append({
                    "role": "coach",
                    "content": welcome_text,
                    "technique": "greeting"
                })
                continue
            
            if message.get("type") == "user_speech":
                transcript = message.get("transcript", "")
                audio_duration = message.get("audio_duration", 0)
                
                if not transcript:
                    continue
                
                # Calculate turn number for correlation_id (user turns only)
                turn_number = sum(1 for msg in conversation_history if msg.get("role") == "user") + 1
                set_current_turn(turn_number)
                
                logger.info("User speech received", 
                           session_id=session_id, 
                           turn_number=turn_number,
                           transcript_length=len(transcript))
                
                # Generate correlation_id for this turn
                correlation_id = f"{session_id}-turn{turn_number}"
                
                # Emit user speech event to Kafka (optional - won't block if Kafka is not configured)
                try:
                    if hasattr(websocket.app.state, 'kafka_producer') and websocket.app.state.kafka_producer.is_connected:
                        await websocket.app.state.kafka_producer.send_event(
                            topic="conversation.events",
                            event={
                                "event_type": "user_spoke",
                                "correlation_id": correlation_id,
                                "session_id": session_id,
                                "turn_number": turn_number,
                                "timestamp": datetime.utcnow().isoformat(),
                                "length_seconds": audio_duration,
                                "transcript_length": len(transcript)
                            }
                        )
                except Exception as e:
                    logger.debug("Kafka event skipped", error=str(e))
                
                # Step 1: Safety evaluation (before any AI processing)
                safety_result = await safety_evaluator.evaluate(transcript)
                
                if safety_result.is_crisis:
                    # Emit safety event (optional)
                    try:
                        if hasattr(websocket.app.state, 'kafka_producer') and websocket.app.state.kafka_producer.is_connected:
                            await websocket.app.state.kafka_producer.send_event(
                                topic="safety.events",
                                event={
                                    "event_type": "crisis_detected",
                                    "correlation_id": correlation_id,
                                    "session_id": session_id,
                                    "turn_number": turn_number,
                                    "severity": safety_result.severity,
                                    "action_taken": "handoff_to_resources",
                                    "timestamp": datetime.utcnow().isoformat(),
                                    "reason": "User message contained indicators of crisis requiring immediate safety intervention"
                                }
                            )
                    except Exception:
                        pass
                    
                    # Send safety response
                    safety_response = safety_result.get_crisis_response()
                    safety_audio = await synthesizer.synthesize(safety_response)
                    
                    await manager.send_message(session_id, {
                        "type": "safety_alert",
                        "text": safety_response,
                        "audio_base64": safety_audio,
                        "resources": safety_result.resources
                    })
                    continue
                
                # Step 1.5: Check for unclear speech that needs clarification
                unclear_speech = conversation_state_manager.detect_unclear_speech(transcript)
                if unclear_speech:
                    logger.info("Detected unclear speech", 
                               unclear=unclear_speech["unclear_word"],
                               suggested=unclear_speech["suggested_correction"])
                    
                    # Auto-correct common errors instead of asking
                    corrected_transcript = transcript.lower().replace(
                        unclear_speech["unclear_word"], 
                        unclear_speech["suggested_correction"]
                    )
                    # Use corrected transcript for processing
                    transcript = corrected_transcript
                    logger.info("Auto-corrected transcript", original=unclear_speech["original_message"], corrected=transcript)
                
                # Step 1.6: Check if user is giving feedback about an exercise
                exercise_feedback = conversation_state_manager.detect_exercise_feedback(transcript)
                if exercise_feedback:
                    # Log the exercise completion
                    conversation_state_manager.log_exercise_completion(
                        session_id=session_id,
                        exercise_type=exercise_feedback["exercise_type"],
                        outcome=exercise_feedback["outcome"],
                        user_feedback=transcript
                    )
                    logger.info("Exercise feedback detected",
                               exercise_type=exercise_feedback["exercise_type"],
                               outcome=exercise_feedback["outcome"])
                
                # Step 2: Emotion and intent analysis
                try:
                    analysis = await analyzer.analyze(
                        transcript=transcript,
                        conversation_history=conversation_history
                    )
                except Exception as e:
                    logger.error("EMOTION ANALYSIS FAILED", error=str(e))
                    await manager.send_message(session_id, {
                        "type": "error",
                        "error": f"Emotion analysis failed: {str(e)[:200]}",
                        "stage": "emotion_analysis"
                    })
                    continue
                
                # Emit emotion detection event (optional)
                try:
                    if hasattr(websocket.app.state, 'kafka_producer') and websocket.app.state.kafka_producer.is_connected:
                        await websocket.app.state.kafka_producer.send_event(
                            topic="ai.decisions",
                            event={
                                "event_type": "emotion_detected",
                                "correlation_id": correlation_id,
                                "session_id": session_id,
                                "turn_number": turn_number,
                                "emotion": analysis.emotion,
                                "intensity": analysis.intensity,
                                "intent": analysis.intent,
                                "confidence": analysis.confidence,
                                "timestamp": datetime.utcnow().isoformat(),
                                "reason": f"Analyzed user speech and detected '{analysis.emotion}' emotion with {analysis.intensity:.0%} intensity based on language patterns"
                            }
                        )
                except Exception:
                    pass
                
                # Step 3: Technique selection
                try:
                    technique = await responder.select_technique(
                        emotion=analysis.emotion,
                        intent=analysis.intent,
                        intensity=analysis.intensity,
                        conversation_history=conversation_history,
                        session_id=session_id
                    )
                except Exception as e:
                    logger.error("TECHNIQUE SELECTION FAILED", error=str(e))
                    await manager.send_message(session_id, {
                        "type": "error",
                        "error": f"Technique selection failed: {str(e)[:200]}",
                        "stage": "technique_selection"
                    })
                    continue
                
                # Emit technique selection event (optional)
                try:
                    if hasattr(websocket.app.state, 'kafka_producer') and websocket.app.state.kafka_producer.is_connected:
                        await websocket.app.state.kafka_producer.send_event(
                            topic="ai.decisions",
                            event={
                                "event_type": "technique_selected",
                                "correlation_id": correlation_id,
                                "session_id": session_id,
                                "turn_number": turn_number,
                                "technique": technique.name,
                                "reason": technique.reason,
                                "why_not": technique.why_not or {},  # Explainability: why NOT other techniques
                                "timestamp": datetime.utcnow().isoformat()
                            }
                        )
                except Exception:
                    pass
                
                # Step 4: Generate response
                try:
                    response = await responder.generate_response(
                        user_message=transcript,
                        emotion=analysis.emotion,
                        technique=technique,
                        conversation_history=conversation_history,
                        session_id=session_id,
                        intensity=analysis.intensity
                    )
                except Exception as e:
                    logger.error("RESPONSE GENERATION FAILED", error=str(e))
                    await manager.send_message(session_id, {
                        "type": "error",
                        "error": f"Response generation failed: {str(e)[:200]}",
                        "stage": "response_generation"
                    })
                    continue
                
                # Step 5: Synthesize voice with EMOTION-ADAPTIVE technology
                # Key innovation: Voice characteristics adapt to user's emotional state
                synthesis_result = await synthesizer.synthesize_with_emotion(
                    text=response.text,
                    emotion=analysis.emotion,
                    intensity=analysis.intensity
                )
                
                # Extract audio and voice adaptation info
                audio_base64 = synthesis_result["audio"]
                voice_adaptation = synthesis_result.get("adaptation_info", {})
                
                # Update conversation history
                conversation_history.append({
                    "role": "user",
                    "content": transcript,
                    "emotion": analysis.emotion
                })
                conversation_history.append({
                    "role": "coach",
                    "content": response.text,
                    "technique": technique.name
                })
                
                # Persist conversation turn
                try:
                    await websocket.app.state.db.save_conversation_turn(
                        session_id=session_id,
                        user_message=transcript,
                        coach_response=response.text,
                        emotion=analysis.emotion,
                        intensity=analysis.intensity,
                        technique=technique.name
                    )
                except Exception as e:
                    logger.error("Failed to persist conversation turn", error=str(e))
                
                # Send response to client with AI decision info for dashboard
                await manager.send_message(session_id, {
                    "type": "coach_response",
                    "text": response.text,
                    "audio_base64": audio_base64,
                    "emotion": analysis.emotion,
                    "technique": technique.name,
                    "intensity": analysis.intensity,
                    # NEW: AI Decision Dashboard data
                    "ai_decisions": {
                        "emotion_analysis": {
                            "emotion": analysis.emotion,
                            "intensity": analysis.intensity,
                            "confidence": analysis.confidence,
                            "intent": analysis.intent
                        },
                        "technique_selection": {
                            "technique": technique.name,
                            "reason": technique.reason
                        },
                        "voice_adaptation": voice_adaptation
                    }
                })
                
                logger.info("Coach response sent",
                           session_id=session_id,
                           emotion=analysis.emotion,
                           technique=technique.name)
                
                # SESSION CLOSURE LOGIC - Check if user is in positive state and ready to end
                memory = conversation_state_manager.get_or_create_memory(session_id)
                should_suggest_closure = check_session_closure(memory, analysis.emotion, analysis.intensity)
                
                if should_suggest_closure:
                    # Send session closure suggestion to client
                    await manager.send_message(session_id, {
                        "type": "session_closure_ready",
                        "reason": "positive_resolution",
                        "emotion": analysis.emotion,
                        "wellness_indicators": {
                            "positive_emotion": analysis.emotion,
                            "total_turns": memory.total_exchanges,
                            "breakthroughs": len(memory.breakthroughs),
                            "phase": memory.phase.value
                        }
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(session_id)
        
        # End session in database
        try:
            if hasattr(websocket.app.state, 'db') and websocket.app.state.db.is_connected:
                await websocket.app.state.db.end_session(session_id)
                logger.info("Session ended in database", session_id=session_id)
        except Exception as e:
            logger.error("Failed to end session in database", error=str(e))
        
        # Calculate session summary for the final event
        total_turns = sum(1 for msg in conversation_history if msg.get("role") == "user")
        
        # Get memory for summary data
        memory = conversation_state_manager.get_or_create_memory(session_id)
        
        # Calculate emotional delta (how emotions changed)
        emotional_delta = {}
        if len(memory.emotion_journey) >= 2:
            first_emotion = memory.emotion_journey[0]["emotion"]
            first_intensity = memory.emotion_journey[0]["intensity"]
            last_emotion = memory.emotion_journey[-1]["emotion"]
            last_intensity = memory.emotion_journey[-1]["intensity"]
            emotional_delta = {
                "start_emotion": first_emotion,
                "start_intensity": first_intensity,
                "end_emotion": last_emotion,
                "end_intensity": last_intensity,
                "shifted": first_emotion != last_emotion
            }
        
        # Calculate technique diversity
        unique_techniques = len(memory.techniques_used)
        total_technique_uses = sum(memory.techniques_used.values())
        
        # Emit SESSION SUMMARY event - comprehensive session analytics
        try:
            if hasattr(websocket.app.state, 'kafka_producer') and websocket.app.state.kafka_producer.is_connected:
                await websocket.app.state.kafka_producer.send_event(
                    topic="conversation.events",
                    event={
                        "event_type": "session.summarized",
                        "session_id": session_id,
                        "total_exchanges": memory.total_exchanges,
                        "emotional_delta": emotional_delta,
                        "breakthroughs": len(memory.breakthroughs),
                        "breakthrough_details": memory.breakthroughs[:3],  # Top 3
                        "techniques_diversity": {
                            "unique_techniques": unique_techniques,
                            "total_uses": total_technique_uses,
                            "techniques_breakdown": dict(memory.techniques_used)
                        },
                        "final_phase": memory.phase.value,
                        "topics_explored": list(memory.topic_weights.keys()),
                        "key_insights": memory.key_insights[:5],  # Top 5 insights
                        "exercises_completed": len(memory.exercises_completed),
                        "timestamp": datetime.utcnow().isoformat(),
                        "reason": f"Session concluded after {memory.total_exchanges} exchanges. "
                                  f"User started feeling {emotional_delta.get('start_emotion', 'unknown')} and ended feeling {emotional_delta.get('end_emotion', 'unknown')}. "
                                  f"{len(memory.breakthroughs)} breakthrough(s) detected. {unique_techniques} different techniques used."
                    }
                )
                logger.info("Session summary emitted",
                           session_id=session_id,
                           exchanges=memory.total_exchanges,
                           breakthroughs=len(memory.breakthroughs))
        except Exception as e:
            logger.error("Failed to emit session summary", error=str(e))
        
        # Emit session disconnected event (optional)
        try:
            if hasattr(websocket.app.state, 'kafka_producer') and websocket.app.state.kafka_producer.is_connected:
                await websocket.app.state.kafka_producer.send_event(
                    topic="conversation.events",
                    event={
                        "event_type": "session_disconnected",
                        "session_id": session_id,
                        "total_turns": total_turns,
                        "timestamp": datetime.utcnow().isoformat(),
                        "reason": f"User disconnected after {total_turns} conversation turns"
                    }
                )
        except Exception:
            pass
    
    except Exception as e:
        logger.error("WebSocket error", session_id=session_id, error=str(e))
        # Send error but don't disconnect - allow user to retry
        try:
            await manager.send_message(session_id, {
                "type": "error",
                "message": "An error occurred. Please try again."
            })
        except Exception:
            # Only disconnect if we can't communicate with the client
            manager.disconnect(session_id)


def check_session_closure(memory, emotion: str, intensity: float) -> bool:
    """Check if session should be suggested for closure based on positive resolution.
    
    Criteria for suggesting closure:
    1. User has had at least 4 meaningful exchanges
    2. Current emotion is positive (joy, relief, gratitude, hope, calm)
    3. User has had at least one breakthrough OR phase is integration/closing
    4. Intensity of positive emotion is above 0.5
    
    Returns:
        True if session closure should be suggested
    """
    from app.services.gemini.conversation_state import ConversationPhase
    
    # Minimum exchanges before considering closure
    if memory.total_exchanges < 4:
        return False
    
    # Positive emotions that indicate resolution
    positive_emotions = {'joy', 'relief', 'gratitude', 'hope', 'calm', 'happy', 'better', 'good'}
    
    if emotion.lower() not in positive_emotions:
        return False
    
    # Need sufficient intensity of positive emotion
    if intensity < 0.5:
        return False
    
    # Either had a breakthrough or in late-stage phase
    has_breakthrough = len(memory.breakthroughs) > 0
    in_late_phase = memory.phase in [ConversationPhase.INTEGRATION, ConversationPhase.CLOSING, ConversationPhase.TECHNIQUE]
    
    if not has_breakthrough and not in_late_phase:
        return False
    
    return True
