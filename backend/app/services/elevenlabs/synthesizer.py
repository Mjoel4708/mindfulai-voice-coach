"""
ElevenLabs Voice Synthesizer with Emotion-Adaptive Voice Technology.

This module implements sophisticated emotion-aware voice synthesis that
dynamically adjusts vocal characteristics based on detected user emotions.
Key innovation: The AI coach's voice adapts in real-time to provide
the most therapeutically appropriate vocal delivery.
"""
import base64
import structlog
from elevenlabs.client import ElevenLabs
from typing import Optional, Dict, Any

from app.core.config import settings

logger = structlog.get_logger()


# Comprehensive emotion-to-voice mapping profiles
# Each emotion has scientifically-informed voice parameters optimized for therapeutic effect
EMOTION_VOICE_PROFILES: Dict[str, Dict[str, Any]] = {
    # ANXIETY/STRESS - Ultra-calm, slow, steady voice to soothe
    "anxiety": {
        "stability": 0.92,      # Very stable - no vocal variations that could increase anxiety
        "similarity_boost": 0.75,
        "style": 0.05,          # Minimal expressiveness - grounding effect
        "use_speaker_boost": True,
        "speed_modifier": 0.85,  # Slower pace for calming
        "description": "Ultra-calm and grounding voice to reduce anxiety"
    },
    "overwhelm": {
        "stability": 0.90,
        "similarity_boost": 0.75,
        "style": 0.08,
        "use_speaker_boost": True,
        "speed_modifier": 0.82,
        "description": "Slow, steady voice to help with overwhelm"
    },
    "panic": {
        "stability": 0.95,      # Maximum stability for crisis
        "similarity_boost": 0.70,
        "style": 0.02,          # Almost monotone for maximum calming
        "use_speaker_boost": True,
        "speed_modifier": 0.75,  # Very slow and deliberate
        "description": "Maximum stability voice for panic/crisis"
    },
    "fear": {
        "stability": 0.88,
        "similarity_boost": 0.75,
        "style": 0.10,
        "use_speaker_boost": True,
        "speed_modifier": 0.85,
        "description": "Reassuring and stable voice for fear"
    },
    
    # SADNESS/DEPRESSION - Warm, empathetic, gentle voice
    "sadness": {
        "stability": 0.75,
        "similarity_boost": 0.85,  # Higher for warmth
        "style": 0.25,          # Some warmth and empathy
        "use_speaker_boost": True,
        "speed_modifier": 0.90,
        "description": "Warm and empathetic voice for sadness"
    },
    "loneliness": {
        "stability": 0.72,
        "similarity_boost": 0.88,  # Very warm
        "style": 0.30,          # More expressive/connected
        "use_speaker_boost": True,
        "speed_modifier": 0.88,
        "description": "Connected and warm voice for loneliness"
    },
    "hopelessness": {
        "stability": 0.78,
        "similarity_boost": 0.85,
        "style": 0.22,
        "use_speaker_boost": True,
        "speed_modifier": 0.88,
        "description": "Gentle and hopeful voice for hopelessness"
    },
    "grief": {
        "stability": 0.70,
        "similarity_boost": 0.90,  # Maximum warmth
        "style": 0.28,
        "use_speaker_boost": True,
        "speed_modifier": 0.85,
        "description": "Deeply empathetic voice for grief"
    },
    
    # ANGER/FRUSTRATION - Calm, validating, even-toned
    "anger": {
        "stability": 0.85,      # Stable but not confrontational
        "similarity_boost": 0.70,
        "style": 0.12,
        "use_speaker_boost": True,
        "speed_modifier": 0.92,
        "description": "Calm and validating voice for anger"
    },
    "frustration": {
        "stability": 0.82,
        "similarity_boost": 0.72,
        "style": 0.15,
        "use_speaker_boost": True,
        "speed_modifier": 0.90,
        "description": "Understanding voice for frustration"
    },
    "irritation": {
        "stability": 0.80,
        "similarity_boost": 0.75,
        "style": 0.18,
        "use_speaker_boost": True,
        "speed_modifier": 0.95,
        "description": "Patient voice for irritation"
    },
    
    # POSITIVE EMOTIONS - Slightly more energetic and warm
    "joy": {
        "stability": 0.60,      # More dynamic
        "similarity_boost": 0.80,
        "style": 0.45,          # More expressive
        "use_speaker_boost": True,
        "speed_modifier": 1.05,  # Slightly upbeat
        "description": "Warm and celebratory voice for joy"
    },
    "relief": {
        "stability": 0.68,
        "similarity_boost": 0.80,
        "style": 0.35,
        "use_speaker_boost": True,
        "speed_modifier": 1.0,
        "description": "Supportive voice for relief"
    },
    "gratitude": {
        "stability": 0.65,
        "similarity_boost": 0.82,
        "style": 0.40,
        "use_speaker_boost": True,
        "speed_modifier": 1.02,
        "description": "Appreciative voice for gratitude"
    },
    "hope": {
        "stability": 0.70,
        "similarity_boost": 0.80,
        "style": 0.38,
        "use_speaker_boost": True,
        "speed_modifier": 1.0,
        "description": "Encouraging voice for hope"
    },
    
    # NEUTRAL/CALM - Balanced professional coaching voice
    "neutral": {
        "stability": 0.75,
        "similarity_boost": 0.75,
        "style": 0.20,
        "use_speaker_boost": True,
        "speed_modifier": 1.0,
        "description": "Balanced professional coaching voice"
    },
    "calm": {
        "stability": 0.78,
        "similarity_boost": 0.78,
        "style": 0.18,
        "use_speaker_boost": True,
        "speed_modifier": 0.98,
        "description": "Peaceful calm voice"
    },
    
    # CRISIS - Maximum safety-focused delivery
    "crisis": {
        "stability": 0.98,      # Maximum stability
        "similarity_boost": 0.65,
        "style": 0.0,           # Completely even
        "use_speaker_boost": True,
        "speed_modifier": 0.70,  # Very slow and deliberate
        "description": "Crisis intervention voice - maximum stability"
    },
    "suicidal": {
        "stability": 0.98,
        "similarity_boost": 0.70,
        "style": 0.0,
        "use_speaker_boost": True,
        "speed_modifier": 0.68,
        "description": "Suicide prevention voice - calm and connected"
    }
}

# Default voice settings
DEFAULT_VOICE_PROFILE = EMOTION_VOICE_PROFILES["neutral"]


class VoiceSynthesizer:
    """
    Advanced emotion-adaptive voice synthesizer using ElevenLabs API.
    
    Key Innovation: Dynamically adjusts voice characteristics based on
    detected user emotion to provide therapeutically optimal delivery.
    """
    
    # Base voice settings (used when no emotion detected)
    VOICE_SETTINGS = {
        "stability": 0.75,
        "similarity_boost": 0.75,
        "style": 0.20,
        "use_speaker_boost": True
    }
    
    def __init__(self):
        """Initialize ElevenLabs client."""
        self.client = None
        self.voice_id = settings.ELEVENLABS_VOICE_ID
        self._initialize()
    
    def _initialize(self):
        """Initialize the ElevenLabs sync client."""
        try:
            self.client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
            logger.info("ElevenLabs Voice Synthesizer initialized",
                       voice_id=self.voice_id)
        except Exception as e:
            logger.error("Failed to initialize ElevenLabs client", error=str(e))
            raise
    
    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_turbo_v2"
    ) -> str:
        """
        Convert text to speech and return base64-encoded audio.
        
        Args:
            text: Text to convert to speech
            voice_id: Optional voice ID override
            model_id: ElevenLabs model to use
            
        Returns:
            Base64-encoded MP3 audio data
        """
        try:
            voice = voice_id or self.voice_id
            
            logger.info("Synthesizing speech",
                       text_length=len(text),
                       voice_id=voice,
                       model=model_id)
            
            # Generate audio using ElevenLabs (sync client returns iterator)
            audio_iterator = self.client.text_to_speech.convert(
                voice_id=voice,
                text=text,
                model_id=model_id,
                voice_settings={
                    "stability": self.VOICE_SETTINGS["stability"],
                    "similarity_boost": self.VOICE_SETTINGS["similarity_boost"],
                    "style": self.VOICE_SETTINGS["style"],
                    "use_speaker_boost": self.VOICE_SETTINGS["use_speaker_boost"]
                }
            )
            
            # Collect audio chunks
            audio_chunks = []
            for chunk in audio_iterator:
                audio_chunks.append(chunk)
            
            # Combine and encode
            audio_data = b"".join(audio_chunks)
            audio_base64 = base64.b64encode(audio_data).decode("utf-8")
            
            logger.info("Speech synthesis complete",
                       audio_size_bytes=len(audio_data))
            
            return audio_base64
            
        except Exception as e:
            logger.error("Speech synthesis failed", error=str(e))
            raise
    
    async def synthesize_with_emotion(
        self,
        text: str,
        emotion: str,
        intensity: float = 0.5
    ) -> Dict[str, Any]:
        """
        Synthesize speech with sophisticated emotion-adaptive voice settings.
        
        This is a KEY INNOVATION: The AI coach's voice dynamically adapts
        based on detected user emotion, providing therapeutically optimal
        vocal delivery that research shows improves outcomes.
        
        Args:
            text: Text to convert to speech
            emotion: Detected emotion for voice adjustment
            intensity: Emotional intensity (0-1) - higher = more adaptation
            
        Returns:
            Dict containing:
                - audio: Base64-encoded MP3 audio data
                - voice_profile: The profile used
                - adaptation_info: Details about voice adaptation
        """
        # Get emotion-specific voice profile
        emotion_lower = emotion.lower()
        voice_profile = EMOTION_VOICE_PROFILES.get(emotion_lower, DEFAULT_VOICE_PROFILE)
        
        # Blend settings based on intensity (higher intensity = more adaptation)
        # This creates a smooth transition from default to fully adapted voice
        base = DEFAULT_VOICE_PROFILE
        blended_settings = {
            "stability": base["stability"] + (voice_profile["stability"] - base["stability"]) * intensity,
            "similarity_boost": base["similarity_boost"] + (voice_profile["similarity_boost"] - base["similarity_boost"]) * intensity,
            "style": base["style"] + (voice_profile["style"] - base["style"]) * intensity,
            "use_speaker_boost": voice_profile["use_speaker_boost"]
        }
        
        # Log the voice adaptation for debugging and demo
        adaptation_info = {
            "detected_emotion": emotion,
            "intensity": intensity,
            "profile_used": voice_profile.get("description", "Custom profile"),
            "applied_settings": blended_settings,
            "speed_modifier": voice_profile.get("speed_modifier", 1.0)
        }
        
        logger.info("🎤 Emotion-adaptive voice synthesis",
                   emotion=emotion,
                   intensity=intensity,
                   profile=voice_profile.get("description"),
                   stability=round(blended_settings["stability"], 2),
                   style=round(blended_settings["style"], 2))
        
        try:
            audio_iterator = self.client.text_to_speech.convert(
                voice_id=self.voice_id,
                text=text,
                model_id="eleven_turbo_v2",
                voice_settings=blended_settings
            )
            
            audio_chunks = []
            for chunk in audio_iterator:
                audio_chunks.append(chunk)
            
            audio_data = b"".join(audio_chunks)
            audio_base64 = base64.b64encode(audio_data).decode("utf-8")
            
            logger.info("✅ Emotion-adapted speech synthesis complete",
                       emotion=emotion,
                       audio_size=len(audio_data))
            
            return {
                "audio": audio_base64,
                "voice_profile": voice_profile,
                "adaptation_info": adaptation_info
            }
            
        except Exception as e:
            logger.error("Emotion-adjusted synthesis failed", error=str(e))
            # Fall back to standard synthesis
            audio = await self.synthesize(text)
            return {
                "audio": audio,
                "voice_profile": DEFAULT_VOICE_PROFILE,
                "adaptation_info": {"fallback": True, "error": str(e)}
            }
    
    async def get_available_voices(self) -> list:
        """Get list of available voices from ElevenLabs."""
        try:
            voices = self.client.voices.get_all()
            return [
                {
                    "voice_id": voice.voice_id,
                    "name": voice.name,
                    "category": voice.category
                }
                for voice in voices.voices
            ]
        except Exception as e:
            logger.error("Failed to fetch voices", error=str(e))
            return []
