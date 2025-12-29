"""
Safety Evaluator for crisis detection and responsible AI governance.
"""
import re
import structlog
from typing import List, Optional
from dataclasses import dataclass

from app.core.config import settings

logger = structlog.get_logger()


@dataclass
class SafetyResult:
    """Result of safety evaluation."""
    is_crisis: bool
    severity: str  # "none", "low", "medium", "high", "critical"
    detected_keywords: List[str]
    resources: List[dict]
    requires_handoff: bool
    
    def get_crisis_response(self) -> str:
        """Get appropriate crisis response message."""
        if self.severity == "critical":
            return (
                "I can hear that you're going through something really difficult right now. "
                "What you're feeling matters, and I want you to know that support is available. "
                "Please reach out to a crisis helpline where trained counselors are available 24/7. "
                "In the US, you can call or text 988 for the Suicide and Crisis Lifeline. "
                "Would you like me to share more resources?"
            )
        elif self.severity == "high":
            return (
                "I'm concerned about what you're sharing, and I want to make sure you have the support you need. "
                "These feelings can be overwhelming, but you don't have to face them alone. "
                "There are people who specialize in helping with exactly what you're going through. "
                "Can we talk about getting you connected with someone who can help?"
            )
        else:
            return (
                "It sounds like you're dealing with some heavy thoughts. "
                "I'm here to listen, and I want to make sure you're okay. "
                "How are you feeling right now?"
            )


class SafetyEvaluator:
    """
    Evaluates user messages for crisis indicators and safety concerns.
    Implements responsible AI practices for mental health applications.
    """
    
    # Crisis keywords by severity level
    CRISIS_INDICATORS = {
        "critical": [
            r"\b(suicide|suicidal)\b",
            r"\bkill (myself|me)\b",
            r"\bend (my|it all|everything)\b",
            r"\bdon'?t want to (live|be alive|exist)\b",
            r"\bbetter off dead\b",
            r"\bno reason to live\b",
            r"\bplan to (die|end it)\b"
        ],
        "high": [
            r"\bself[- ]?harm\b",
            r"\bhurt (myself|me)\b",
            r"\bcut(ting)? (myself|me)\b",
            r"\bwant to (die|disappear)\b",
            r"\bcan'?t (go on|take it|do this)\b",
            r"\bgive up\b",
            r"\bhopeless\b"
        ],
        "medium": [
            r"\bworthless\b",
            r"\buseless\b",
            r"\bburden\b",
            r"\bno one (cares|would miss)\b",
            r"\bwhat'?s the point\b",
            r"\bgive up on life\b"
        ]
    }
    
    # Crisis resources by region
    CRISIS_RESOURCES = {
        "global": [
            {
                "name": "International Association for Suicide Prevention",
                "url": "https://www.iasp.info/resources/Crisis_Centres/",
                "description": "Directory of crisis centers worldwide"
            }
        ],
        "us": [
            {
                "name": "988 Suicide and Crisis Lifeline",
                "phone": "988",
                "description": "24/7 crisis support - call or text",
                "url": "https://988lifeline.org"
            },
            {
                "name": "Crisis Text Line",
                "text": "HOME to 741741",
                "description": "Text-based crisis support"
            },
            {
                "name": "SAMHSA National Helpline",
                "phone": "1-800-662-4357",
                "description": "Treatment referral and information"
            }
        ],
        "uk": [
            {
                "name": "Samaritans",
                "phone": "116 123",
                "description": "24/7 emotional support",
                "url": "https://www.samaritans.org"
            }
        ]
    }
    
    def __init__(self):
        """Initialize safety evaluator."""
        # Compile regex patterns for efficiency
        self.patterns = {
            severity: [re.compile(pattern, re.IGNORECASE) 
                      for pattern in patterns]
            for severity, patterns in self.CRISIS_INDICATORS.items()
        }
        
        logger.info("Safety Evaluator initialized")
    
    async def evaluate(self, text: str) -> SafetyResult:
        """
        Evaluate text for crisis indicators.
        
        Args:
            text: User message to evaluate
            
        Returns:
            SafetyResult with crisis assessment
        """
        detected = []
        max_severity = "none"
        severity_order = ["none", "low", "medium", "high", "critical"]
        
        # Check for crisis patterns
        for severity, patterns in self.patterns.items():
            for pattern in patterns:
                matches = pattern.findall(text)
                if matches:
                    detected.extend(matches)
                    if severity_order.index(severity) > severity_order.index(max_severity):
                        max_severity = severity
        
        # Additional context-based checks
        text_lower = text.lower()
        
        # Check for explicit mentions of methods (without listing them)
        method_indicators = [
            "how to", "ways to", "best way to", "easiest way to"
        ]
        if any(ind in text_lower for ind in method_indicators) and max_severity != "none":
            if severity_order.index(max_severity) < severity_order.index("high"):
                max_severity = "high"
        
        # Determine if crisis detected
        is_crisis = max_severity in ["high", "critical"]
        requires_handoff = max_severity == "critical"
        
        # Get appropriate resources
        resources = self._get_resources(max_severity)
        
        result = SafetyResult(
            is_crisis=is_crisis,
            severity=max_severity,
            detected_keywords=list(set(detected)),
            resources=resources,
            requires_handoff=requires_handoff
        )
        
        if is_crisis:
            logger.warning("Crisis indicator detected",
                         severity=max_severity,
                         requires_handoff=requires_handoff)
        
        return result
    
    def _get_resources(self, severity: str) -> List[dict]:
        """Get appropriate crisis resources based on severity."""
        if severity in ["none", "low"]:
            return []
        
        # Return US and global resources (can be extended with geo-detection)
        resources = []
        resources.extend(self.CRISIS_RESOURCES["us"])
        resources.extend(self.CRISIS_RESOURCES["global"])
        
        return resources
    
    async def is_safe_to_respond(self, response: str) -> bool:
        """
        Verify AI response doesn't contain harmful content.
        
        Args:
            response: Generated AI response to verify
            
        Returns:
            True if response is safe to send
        """
        # Check for inappropriate advice patterns
        unsafe_patterns = [
            r"\bshould (take|use) (medication|drugs)\b",
            r"\bdiagnos(e|is|ed)\b",
            r"\byou (have|suffer from) (depression|anxiety|bipolar)\b",
            r"\bstop (taking|your) medication\b",
            r"\bdon'?t (need|see) (a )?(therapist|doctor|professional)\b"
        ]
        
        for pattern in unsafe_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                logger.warning("Unsafe response pattern detected",
                             pattern=pattern)
                return False
        
        return True
    
    def get_safety_disclaimer(self) -> str:
        """Get standard safety disclaimer for session start."""
        return (
            "I'm MindfulAI, here to provide emotional support and "
            "coping strategies. I'm not a replacement for professional mental "
            "health care. If you're experiencing a crisis or need immediate help, "
            "please contact a crisis helpline or emergency services."
        )
