"""
Gemini Responder for technique selection and response generation.
Uses Google Generative AI with Gemini model.
"""
import asyncio
import json
import os
import random
import structlog
from typing import List, Optional
from google import genai
from google.genai.types import GenerateContentConfig, SafetySetting, HarmCategory, HarmBlockThreshold

from app.core.config import settings
from app.services.gemini.conversation_state import conversation_state_manager, ConversationMemory

# Set credentials path before any Google API calls
if settings.GOOGLE_APPLICATION_CREDENTIALS:
    creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
    if not os.path.isabs(creds_path):
        # Make relative path absolute from backend directory
        creds_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), creds_path)
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path

from app.schemas.conversation import Technique, CoachResponse

logger = structlog.get_logger()

# Safety settings for mental health context - we need to allow sensitive topics
SAFETY_SETTINGS = [
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH
    ),
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH
    ),
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH
    ),
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH
    ),
]

# Retry settings for rate limiting
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


class GeminiResponder:
    """
    Selects coaching techniques and generates empathetic responses using Gemini.
    """
    
    TECHNIQUES = {
        "reflective_listening": {
            "description": "Mirror back what the user said to show understanding",
            "best_for": ["venting", "validation", "being heard"]
        },
        "open_ended_questioning": {
            "description": "Ask thoughtful questions to help user explore their feelings",
            "best_for": ["exploration", "self-discovery", "clarity"]
        },
        "cognitive_reframing": {
            "description": "Help user see situation from a different perspective",
            "best_for": ["negative thinking", "stuck patterns", "problem-solving"]
        },
        "grounding_exercise": {
            "description": "Guide user through a mindfulness or grounding technique",
            "best_for": ["anxiety", "overwhelm", "panic", "stress"]
        },
        "validation": {
            "description": "Acknowledge and validate the user's feelings",
            "best_for": ["emotional pain", "feeling invalidated", "sadness"]
        },
        "strength_recognition": {
            "description": "Help user recognize their strengths and resilience",
            "best_for": ["low confidence", "hopelessness", "self-doubt"]
        },
        "action_planning": {
            "description": "Help user identify small, concrete next steps",
            "best_for": ["feeling stuck", "problem-solving", "motivation"]
        }
    }
    
    TECHNIQUE_SELECTION_PROMPT = """Select a coaching technique for this user.

Emotion: {emotion} (intensity: {intensity})
Intent: {intent}

Techniques: {techniques}

{conversation_state}
{anti_repetition}

Reply with ONLY valid JSON including WHY you chose this AND why NOT other techniques:
{{"technique": "technique_name", "reason": "why this technique fits", "why_not": {{"other_technique_1": "brief reason why not", "other_technique_2": "brief reason why not"}}}}

Example: {{"technique": "validation", "reason": "User needs to feel heard before problem-solving", "why_not": {{"cognitive_reframing": "Too early - user not ready for new perspective", "grounding_exercise": "No anxiety symptoms present"}}}}"""

    RESPONSE_GENERATION_PROMPT = """You are Aria, a warm and empathetic AI wellness coach having a real conversation.

The user just said: "{user_message}"

Their emotional state: {emotion} (intensity: {intensity}/1.0)

Technique to use: {technique}
What this means: {technique_description}

{conversation_state}

{exercise_context}

{anti_repetition}

CRITICAL RULES:
1. Response must be 2-3 COMPLETE sentences - be CONCISE and focused!
2. ABSOLUTELY NEVER repeat any previous response - say something COMPLETELY NEW
3. Be SPECIFIC to what they just said - reference their ACTUAL WORDS briefly
4. If they mentioned specific things (work, family, deadlines), acknowledge THOSE EXACT things
5. Follow the PHASE GUIDANCE above - match your approach to the conversation phase
6. Use the technique naturally and vary your openers:
   - reflective_listening: "It sounds like..." / "What I'm hearing is..." / "So you're feeling..."
   - validation: "That makes total sense..." / "Of course you'd feel..." / "Anyone would feel..."
   - cognitive_reframing: "What if..." / "Have you considered..." / "Another angle might be..."
   - grounding: "Let's pause for a moment..." / "I'd like to try something..." / "Can we do a quick exercise?"
   - open_ended_questioning: Ask about their SPECIFIC situation, not generic questions
7. Match their emotional intensity - gentle for high intensity, warmer for lower
8. End with ONE short, thoughtful question OR supportive statement
9. ALWAYS write COMPLETE sentences that end with proper punctuation (. ? !)
10. If user just completed an exercise, acknowledge it warmly and ask how they're feeling NOW
11. SESSION CLOSURE: If user is feeling positive (relief, gratitude, hope, joy, calm) and has made progress:
    - Acknowledge their growth and progress warmly
    - Summarize what they worked through
    - End with encouragement to return anytime, NOT more questions
    - Example: "You've done real work today. Remember these insights when challenges arise."

Your response (just the natural text, no labels, MAX 2-3 sentences):
"""

    # Prompt for continuing after exercise completion
    EXERCISE_FOLLOWUP_PROMPT = """The user just completed a {exercise_type} exercise. 
They said: "{user_feedback}"
Their feedback indicates: {outcome}

Previous exercises completed: {exercise_history}

IMPORTANT: 
- Acknowledge the exercise completion warmly
- If it helped: celebrate their progress, ask what shifted for them
- If it didn't help: validate that's okay, suggest we try something different
- Connect back to what they were working on BEFORE the exercise
- Keep the momentum of the conversation going"""

    def __init__(self):
        """Initialize Gemini responder."""
        self.client = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Google GenAI client."""
        try:
            self.client = genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.VERTEX_AI_LOCATION
            )
            logger.info("Gemini Responder initialized successfully")
        except Exception as e:
            logger.error("Failed to initialize Gemini Responder", error=str(e))
            raise
    
    def _extract_json_from_response(self, response_text: str, expected_field: str) -> dict:
        """
        Robustly extract JSON from model response, handling various formats and truncation.
        
        Args:
            response_text: Raw response from the model
            expected_field: The field we expect to find (e.g., "technique", "emotion")
            
        Returns:
            Parsed JSON dict
        """
        import re
        
        # Try to clean up markdown code blocks first
        cleaned = response_text
        if "```json" in cleaned:
            parts = cleaned.split("```json")
            if len(parts) > 1:
                cleaned = parts[1].split("```")[0]
        elif "```" in cleaned:
            parts = cleaned.split("```")
            if len(parts) > 1:
                cleaned = parts[1].split("```")[0] if len(parts) > 2 else parts[1]
        
        cleaned = cleaned.strip()
        
        # Try direct JSON parse first
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass
        
        # Try to find JSON object with regex
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        
        # Try to extract key-value pairs manually for truncated responses
        result = {}
        
        # Look for the expected field with various patterns
        patterns = [
            rf'"{expected_field}"\s*:\s*"([^"]+)"',  # "field": "value"
            rf"'{expected_field}'\s*:\s*'([^']+)'",  # 'field': 'value'
            rf'{expected_field}\s*:\s*"([^"]+)"',    # field: "value"
            rf'{expected_field}\s*:\s*(\w+)',        # field: value (no quotes)
        ]
        
        for pattern in patterns:
            match = re.search(pattern, response_text, re.IGNORECASE)
            if match:
                result[expected_field] = match.group(1)
                break
        
        # Try to find reason field too
        reason_patterns = [
            r'"reason"\s*:\s*"([^"]*)',  # May be truncated, so don't require closing quote
            r"'reason'\s*:\s*'([^']*)",
        ]
        
        for pattern in reason_patterns:
            match = re.search(pattern, response_text, re.IGNORECASE)
            if match:
                result["reason"] = match.group(1).rstrip('"\'')
                break
        
        if result:
            logger.debug("Extracted fields from malformed JSON", fields=list(result.keys()))
            return result
        
        # Last resort: raise an error with helpful message
        raise json.JSONDecodeError(
            f"Could not extract JSON. Expected field '{expected_field}'. Raw: {response_text[:200]}",
            response_text,
            0
        )
    
    def _format_techniques(self) -> str:
        """Format available techniques for prompt - compact format."""
        return ", ".join(self.TECHNIQUES.keys())
    
    def _format_history(self, history: List[dict]) -> str:
        """Format conversation history for prompt."""
        if not history:
            return "This is the start of the conversation."
        
        formatted = []
        for turn in history[-4:]:  # Last 4 turns
            role = "User" if turn.get("role") == "user" else "Coach"
            content = turn.get("content", "")
            technique = turn.get("technique", "")
            if technique:
                formatted.append(f"{role}: {content} [Used: {technique}]")
            else:
                formatted.append(f"{role}: {content}")
        
        return "\n".join(formatted)
    
    async def select_technique(
        self,
        emotion: str,
        intent: str,
        intensity: float,
        conversation_history: Optional[List[dict]] = None,
        session_id: Optional[str] = None
    ) -> Technique:
        """
        Select the best coaching technique based on emotional analysis.
        
        Args:
            emotion: Detected primary emotion
            intent: User's apparent need/intent
            intensity: Emotional intensity (0-1)
            conversation_history: Previous conversation turns
            session_id: Session ID for state tracking
            
        Returns:
            Technique with name and reason
        """
        try:
            # Get conversation state for smarter selection
            memory = None
            conversation_state = ""
            anti_repetition = ""
            
            if session_id:
                memory = conversation_state_manager.get_or_create_memory(session_id)
                conversation_state = memory.to_context_string()
                anti_repetition = conversation_state_manager.get_anti_repetition_guidance(memory)
            
            prompt = self.TECHNIQUE_SELECTION_PROMPT.format(
                emotion=emotion,
                intensity=f"{intensity:.2f}",
                intent=intent,
                conversation_state=conversation_state or self._format_history(conversation_history or []),
                techniques=self._format_techniques(),
                anti_repetition=anti_repetition
            )
            
            config = GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2048,  # Generous limit to prevent truncation
                top_p=0.8,
                safety_settings=SAFETY_SETTINGS
            )
            
            response = await self.client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=config
            )
            
            # Check for empty or None response
            if not response or not response.text:
                logger.error("Gemini returned empty response for technique selection")
                raise Exception("Gemini returned empty response for technique selection")
            
            response_text = response.text.strip()
            logger.debug("Technique selection raw response", response=response_text[:500])
            
            # Check for empty text after stripping
            if not response_text:
                raise Exception("Gemini returned empty text after stripping")
            
            # Extract JSON from response - handle various formats
            technique_data = self._extract_json_from_response(response_text, "technique")
            
            technique_name = technique_data.get("technique", "reflective_listening")
            
            # Validate technique name
            if technique_name not in self.TECHNIQUES:
                logger.warning(f"Unknown technique '{technique_name}', using reflective_listening")
                technique_name = "reflective_listening"
            
            # Extract why_not for explainability (optional field)
            why_not = technique_data.get("why_not", {})
            if not isinstance(why_not, dict):
                why_not = {}
            
            result = Technique(
                name=technique_name,
                reason=technique_data.get("reason", "Selected based on emotional context"),
                description=self.TECHNIQUES[technique_name]["description"],
                why_not=why_not if why_not else None
            )
            
            logger.info("Technique selected",
                       technique=result.name,
                       reason=result.reason,
                       why_not=why_not if why_not else "not provided")
            
            return result
            
        except Exception as e:
            logger.error("Technique selection failed - NO FALLBACK", error=str(e))
            raise e
    
    async def generate_response(
        self,
        user_message: str,
        emotion: str,
        technique: Technique,
        conversation_history: Optional[List[dict]] = None,
        session_id: Optional[str] = None,
        intensity: float = 0.5
    ) -> CoachResponse:
        """
        Generate an empathetic coaching response.
        
        Args:
            user_message: The user's message
            emotion: Detected emotion
            technique: Selected technique
            conversation_history: Previous conversation turns
            session_id: Session ID for state tracking
            intensity: Emotional intensity
            
        Returns:
            CoachResponse with generated text
        """
        try:
            # Get conversation state for context
            memory = None
            conversation_state = ""
            anti_repetition = ""
            exercise_context = ""
            
            if session_id:
                memory = conversation_state_manager.get_or_create_memory(session_id)
                conversation_state = memory.to_context_string()
                anti_repetition = conversation_state_manager.get_anti_repetition_guidance(memory)
                
                # Check if user JUST completed an exercise (this message mentions it)
                # Only include exercise followup context if user is actively talking about it
                user_message_lower = user_message.lower()
                is_exercise_feedback = any(word in user_message_lower for word in [
                    'completed', 'finished', 'did the', 'tried the', 'exercise', 'breathing', 'grounding'
                ])
                
                if is_exercise_feedback and memory.exercises_completed:
                    last_exercise = memory.exercises_completed[-1]
                    exercise_context = self.EXERCISE_FOLLOWUP_PROMPT.format(
                        exercise_type=last_exercise.get("exercise_type", "wellness"),
                        user_feedback=last_exercise.get("user_feedback", "")[:100],
                        outcome=last_exercise.get("outcome", "neutral"),
                        exercise_history=f"{len(memory.exercises_completed)} exercise(s) completed this session"
                    )
                # If not exercise feedback, don't include exercise context - let the conversation move on
            
            prompt = self.RESPONSE_GENERATION_PROMPT.format(
                user_message=user_message,
                emotion=emotion,
                intensity=intensity,
                technique=technique.name,
                technique_description=technique.description or self.TECHNIQUES.get(technique.name, {}).get("description", ""),
                conversation_state=conversation_state or self._format_history(conversation_history or []),
                exercise_context=exercise_context,
                anti_repetition=anti_repetition
            )
            
            config = GenerateContentConfig(
                temperature=0.7,  # Higher for more natural responses
                max_output_tokens=2048,  # Generous limit to prevent truncation
                top_p=0.9,
                safety_settings=SAFETY_SETTINGS
            )
            
            response = await self.client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=config
            )
            
            # Check for empty response
            if not response or not response.text:
                logger.error("Gemini returned empty response for coach response")
                raise Exception("Gemini returned empty response")
            
            response_text = response.text.strip()
            
            # Log the raw response for debugging
            logger.debug("Raw coach response", response=response_text)
            
            # Clean up any accidental formatting
            response_text = response_text.replace("Coach:", "").strip()
            response_text = response_text.replace("Aria:", "").strip()
            
            # Ensure response ends with proper punctuation (complete sentence)
            if response_text and response_text[-1] not in '.!?':
                # Try to find the last complete sentence
                last_period = response_text.rfind('.')
                last_question = response_text.rfind('?')
                last_exclaim = response_text.rfind('!')
                last_punct = max(last_period, last_question, last_exclaim)
                
                if last_punct > len(response_text) // 2:  # Only truncate if we have at least half the response
                    response_text = response_text[:last_punct + 1]
                    logger.warning("Truncated incomplete sentence from response")
                else:
                    # Add a period to complete the thought
                    response_text = response_text + "."
                    logger.warning("Added period to incomplete response")
            
            result = CoachResponse(
                text=response_text,
                technique=technique.name,
                emotion_addressed=emotion
            )
            
            # Update conversation state memory after generating response
            if session_id:
                conversation_state_manager.update_memory(
                    session_id=session_id,
                    user_message=user_message,
                    emotion=emotion,
                    intensity=intensity,
                    ai_response=response_text,
                    technique_used=technique.name
                )
            
            logger.info("Response generated",
                       technique=technique.name,
                       response_length=len(response_text))
            
            return result
            
        except Exception as e:
            logger.error("Response generation failed - NO FALLBACK", error=str(e))
            raise e
