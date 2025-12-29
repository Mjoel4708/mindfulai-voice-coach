"""
Kafka Producer Service for streaming events to Confluent Cloud.
"""
import json
import structlog
from typing import Optional, Dict, Any
from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient, NewTopic

from app.core.config import settings

logger = structlog.get_logger()


class KafkaProducerService:
    """
    Kafka producer for streaming conversation events, AI decisions,
    and safety events to Confluent Cloud.
    """
    
    TOPICS = [
        settings.KAFKA_TOPIC_CONVERSATION_EVENTS,  # conversation.events
        settings.KAFKA_TOPIC_AI_DECISIONS,          # ai.decisions
        settings.KAFKA_TOPIC_SAFETY_EVENTS          # safety.events
    ]
    
    def __init__(self):
        """Initialize Kafka producer configuration."""
        self.producer: Optional[Producer] = None
        self.admin_client: Optional[AdminClient] = None
        self.is_connected = False
        
        self.config = {
            'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
            'security.protocol': settings.KAFKA_SECURITY_PROTOCOL,
            'sasl.mechanisms': settings.KAFKA_SASL_MECHANISM,
            'sasl.username': settings.KAFKA_API_KEY,
            'sasl.password': settings.KAFKA_API_SECRET,
            'client.id': 'ai-wellness-coach-producer',
            'acks': 'all',  # Ensure message durability
            'retries': 3,
            'retry.backoff.ms': 500
        }
    
    async def start(self):
        """Start the Kafka producer and ensure topics exist."""
        try:
            if not settings.KAFKA_BOOTSTRAP_SERVERS:
                logger.warning("Kafka not configured - running without event streaming")
                return
            
            # Initialize producer
            self.producer = Producer(self.config)
            
            # Initialize admin client for topic management
            self.admin_client = AdminClient(self.config)
            
            # Ensure topics exist
            await self._ensure_topics()
            
            self.is_connected = True
            logger.info("Kafka producer started successfully",
                       bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS)
            
        except Exception as e:
            logger.error("Failed to start Kafka producer", error=str(e))
            self.is_connected = False
    
    async def _ensure_topics(self):
        """Ensure all required topics exist."""
        try:
            # Get existing topics
            metadata = self.admin_client.list_topics(timeout=10)
            existing_topics = set(metadata.topics.keys())
            
            # Create missing topics
            new_topics = []
            for topic in self.TOPICS:
                if topic not in existing_topics:
                    new_topics.append(NewTopic(
                        topic,
                        num_partitions=3,
                        replication_factor=3  # For Confluent Cloud
                    ))
            
            if new_topics:
                futures = self.admin_client.create_topics(new_topics)
                for topic, future in futures.items():
                    try:
                        future.result()
                        logger.info("Created Kafka topic", topic=topic)
                    except Exception as e:
                        # Topic might already exist
                        logger.warning("Topic creation note", topic=topic, note=str(e))
            
        except Exception as e:
            logger.warning("Topic management note", error=str(e))
    
    async def stop(self):
        """Stop the Kafka producer."""
        if self.producer:
            # Flush any remaining messages
            self.producer.flush(timeout=10)
            logger.info("Kafka producer stopped")
        self.is_connected = False
    
    def _delivery_callback(self, err, msg):
        """Callback for message delivery confirmation."""
        if err:
            logger.error("Message delivery failed",
                        topic=msg.topic(),
                        error=str(err))
        else:
            logger.debug("Message delivered",
                        topic=msg.topic(),
                        partition=msg.partition(),
                        offset=msg.offset())
    
    async def send_event(
        self,
        topic: str,
        event: Dict[str, Any],
        key: Optional[str] = None
    ):
        """
        Send an event to a Kafka topic.
        
        Args:
            topic: Target Kafka topic
            event: Event data dictionary
            key: Optional message key (e.g., session_id)
        """
        if not self.producer or not self.is_connected:
            logger.debug("Kafka not available, skipping event", topic=topic)
            return
        
        try:
            # Serialize event to JSON
            value = json.dumps(event).encode('utf-8')
            key_bytes = key.encode('utf-8') if key else event.get('session_id', '').encode('utf-8')
            
            # Produce message
            self.producer.produce(
                topic=topic,
                key=key_bytes,
                value=value,
                callback=self._delivery_callback
            )
            
            # Trigger delivery (non-blocking)
            self.producer.poll(0)
            
            logger.info("Event sent to Kafka",
                       topic=topic,
                       event_type=event.get('event_type', 'unknown'))
            
        except Exception as e:
            logger.error("Failed to send event",
                        topic=topic,
                        error=str(e))
    
    async def send_conversation_event(
        self,
        session_id: str,
        event_type: str,
        **kwargs
    ):
        """Send a conversation event."""
        from datetime import datetime
        
        event = {
            "event_type": event_type,
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs
        }
        
        await self.send_event(
            topic=settings.KAFKA_TOPIC_CONVERSATION_EVENTS,
            event=event,
            key=session_id
        )
    
    async def send_ai_decision_event(
        self,
        session_id: str,
        event_type: str,
        **kwargs
    ):
        """Send an AI decision event."""
        from datetime import datetime
        
        event = {
            "event_type": event_type,
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs
        }
        
        await self.send_event(
            topic=settings.KAFKA_TOPIC_AI_DECISIONS,
            event=event,
            key=session_id
        )
    
    async def send_safety_event(
        self,
        session_id: str,
        severity: str,
        action_taken: str,
        **kwargs
    ):
        """Send a safety event."""
        from datetime import datetime
        
        event = {
            "event_type": "safety_alert",
            "session_id": session_id,
            "severity": severity,
            "action_taken": action_taken,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs
        }
        
        await self.send_event(
            topic=settings.KAFKA_TOPIC_SAFETY_EVENTS,
            event=event,
            key=session_id
        )
