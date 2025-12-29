"""
Gemini Analyzer for emotion detection and intent analysis.
Uses Google Generative AI with Gemini model.
"""
import asyncio
import json
import os
import structlog
from typing import List, Optional
from google import genai
from google.genai.types import GenerateContentConfig, SafetySetting, HarmCategory, HarmBlockThreshold

from app.core.config import settings

# Set credentials path before any Google API calls
if settings.GOOGLE_APPLICATION_CREDENTIALS:
    creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
    if not os.path.isabs(creds_path):
        # Make relative path absolute from backend directory
        creds_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), creds_path)
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path

from app.schemas.conversation import EmotionAnalysis

logger = structlog.get_logger()

# Safety settings for mental health context - allow sensitive wellness topics
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


class GeminiAnalyzer:
    """
    Analyzes user speech for emotion, intent, and risk using Gemini.
    """
    
    ANALYSIS_PROMPT = """You are an expert emotional intelligence system analyzing what someone shared with a mental wellness coach.

User just said: "{transcript}"

Previous conversation:
{history}

IMPORTANT: Carefully detect emotions from keywords like:
- "anxious", "worried", "nervous" → anxiety
- "scared", "afraid", "fear" → fear  
- "sad", "down", "depressed" → sadness
- "angry", "frustrated", "annoyed" → anger/frustration
- "overwhelmed", "too much", "can't handle" → overwhelm
- "lonely", "alone", "isolated" → loneliness
- "stressed", "pressure", "deadline" → anxiety
- "happy", "good", "great" → joy
- "relieved", "better" → relief

Respond with ONLY this JSON (no other text):
{{
    "emotion": "<primary emotion: anxiety, sadness, anger, fear, frustration, loneliness, overwhelm, hopelessness, neutral, joy, relief, gratitude>",
    "intensity": <0.0 to 1.0 - higher if words like "really", "very", "so" are used>,
    "intent": "<validation, problem-solving, venting, support, advice, understanding>",
    "confidence": <0.0 to 1.0>
}}
"""

    def __init__(self):
        """Initialize Gemini analyzer."""
        self.client = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Google GenAI client."""
        try:
            # Initialize the client for Vertex AI
            self.client = genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT,
                location=settings.VERTEX_AI_LOCATION
            )
            logger.info("Gemini Analyzer initialized successfully")
        except Exception as e:
            logger.error("Failed to initialize Gemini Analyzer", error=str(e))
            raise
    
    def _format_history(self, history: List[dict]) -> str:
        """Format conversation history for prompt."""
        if not history:
            return "No previous conversation."
        
        formatted = []
        for turn in history[-5:]:  # Last 5 turns for context
            role = turn.get("role", "unknown")
            content = turn.get("content", "")
            emotion = turn.get("emotion", "")
            if emotion:
                formatted.append(f"{role.capitalize()}: {content} [Emotion: {emotion}]")
            else:
                formatted.append(f"{role.capitalize()}: {content}")
        
        return "\n".join(formatted)
    
    async def analyze(
        self,
        transcript: str,
        conversation_history: Optional[List[dict]] = None
    ) -> EmotionAnalysis:
        """
        Analyze user transcript for emotion and intent.
        
        Args:
            transcript: The user's speech transcript
            conversation_history: Previous conversation turns
            
        Returns:
            EmotionAnalysis with detected emotion, intensity, intent, and confidence
        """
        history_str = self._format_history(conversation_history or [])
        
        prompt = self.ANALYSIS_PROMPT.format(
            transcript=transcript,
            history=history_str
        )
        
        config = GenerateContentConfig(
            temperature=0.2,  # Low temperature for consistent analysis
            max_output_tokens=2048,  # Generous limit to prevent truncation
            top_p=0.8,
            safety_settings=SAFETY_SETTINGS
        )
        
        # Retry loop for rate limiting
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = await self.client.aio.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=config
                )
                
                # Parse JSON response
                response_text = response.text.strip()
                
                # Clean up response if needed
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                analysis_data = json.loads(response_text.strip())
                
                result = EmotionAnalysis(
                    emotion=analysis_data.get("emotion", "neutral"),
                    intensity=float(analysis_data.get("intensity", 0.5)),
                    intent=analysis_data.get("intent", "unknown"),
                    confidence=float(analysis_data.get("confidence", 0.5)),
                    secondary_emotions=analysis_data.get("secondary_emotions", [])
                )
                
                logger.info("Emotion analysis complete",
                           emotion=result.emotion,
                           intensity=result.intensity,
                           intent=result.intent)
                
                return result
                
            except Exception as e:
                last_error = e
                error_str = str(e)
                # Check if it's a rate limit error (429)
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    if attempt < MAX_RETRIES - 1:
                        wait_time = RETRY_DELAY * (attempt + 1)
                        logger.warning(f"Rate limited, retrying in {wait_time}s", attempt=attempt + 1)
                        await asyncio.sleep(wait_time)
                        continue
                # For other errors, don't retry
                break
        
        # If we exhausted retries or hit a non-retryable error, raise it
        if last_error:
            error_str = str(last_error)
            logger.error("Emotion analysis failed - NO FALLBACK", error=error_str)
            raise last_error
        
        # Should never reach here, but just in case
        raise Exception("Emotion analysis failed with unknown error")
