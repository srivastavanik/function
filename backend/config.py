"""Configuration module for the Function Hackathon backend."""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Application configuration."""
    
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    # Google Cloud Platform
    GOOGLE_CLOUD_PROJECT = os.getenv('GOOGLE_CLOUD_PROJECT', 'function-hackathon')
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    
    # Cloud Storage
    GCS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'fh-session-videos')
    GCS_RESULTS_BUCKET = os.getenv('GCS_RESULTS_BUCKET', 'fh-results')
    
    # Pub/Sub
    PUBSUB_TOPIC_VIDEO_UPLOADS = os.getenv('PUBSUB_TOPIC_VIDEO_UPLOADS', 'video-uploads')
    PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR = os.getenv('PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR', 'video-processor-sub')
    
    # Firestore
    FIRESTORE_COLLECTION_SESSIONS = os.getenv('FIRESTORE_COLLECTION_SESSIONS', 'sessions')
    
    # Anthropic API
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
    
    # Security
    API_KEY = os.getenv('API_KEY')
    
    # Server Configuration
    MAX_UPLOAD_SIZE = int(os.getenv('MAX_UPLOAD_SIZE', '104857600'))  # 100MB default
    ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_EXTENSIONS', 'mp4,avi,mov,mkv').split(','))
    
    # Cloud Run
    PORT = int(os.getenv('PORT', '8080'))
    
    @classmethod
    def validate(cls):
        """Validate required configuration."""
        required_vars = [
            'GOOGLE_CLOUD_PROJECT',
            'GCS_BUCKET_NAME',
            'PUBSUB_TOPIC_VIDEO_UPLOADS',
            'API_KEY',
            'ANTHROPIC_API_KEY'
        ]
        
        missing = []
        for var in required_vars:
            if not getattr(cls, var):
                missing.append(var)
        
        if missing:
            raise ValueError(f"Missing required configuration: {', '.join(missing)}")
