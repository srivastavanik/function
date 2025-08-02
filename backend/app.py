"""Main Flask application for Function Hackathon backend."""

import os
import uuid
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from werkzeug.utils import secure_filename
from google.cloud import storage, pubsub_v1, firestore
import json

from config import Config

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud clients
storage_client = storage.Client(project=Config.GOOGLE_CLOUD_PROJECT)
publisher = pubsub_v1.PublisherClient()
firestore_client = firestore.Client(project=Config.GOOGLE_CLOUD_PROJECT)

# Get or create bucket
bucket = storage_client.bucket(Config.GCS_BUCKET_NAME)

# Pub/Sub topic path
topic_path = publisher.topic_path(Config.GOOGLE_CLOUD_PROJECT, Config.PUBSUB_TOPIC_VIDEO_UPLOADS)


def require_api_key(f):
    """Decorator to require API key for endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != Config.API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'function-hackathon-backend'}), 200


@app.route('/api/upload', methods=['POST'])
@require_api_key
def upload_video():
    """Upload video endpoint."""
    try:
        # Check if file is in request
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        file = request.files['video']
        
        # Check if file was selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file extension
        if not allowed_file(file.filename):
            return jsonify({
                'error': f'Invalid file type. Allowed extensions: {", ".join(Config.ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > Config.MAX_UPLOAD_SIZE:
            return jsonify({
                'error': f'File too large. Maximum size: {Config.MAX_UPLOAD_SIZE / (1024*1024)}MB'
            }), 400
        
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        
        # Secure the filename
        filename = secure_filename(file.filename)
        
        # Create GCS object path
        gcs_path = f"{session_id}/{filename}"
        
        # Upload to Google Cloud Storage
        blob = bucket.blob(gcs_path)
        blob.upload_from_file(file, content_type=file.content_type)
        
        # Get the GCS URI
        gcs_uri = f"gs://{Config.GCS_BUCKET_NAME}/{gcs_path}"
        
        # Create initial Firestore document
        session_doc = {
            'sessionId': session_id,
            'filename': filename,
            'uploadTime': datetime.utcnow(),
            'gcsUri': gcs_uri,
            'fileSize': file_size,
            'status': 'uploaded',
            'metadata': {
                'contentType': file.content_type,
                'originalFilename': file.filename
            }
        }
        
        # Save to Firestore
        firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(session_id).set(session_doc)
        
        # Publish message to Pub/Sub
        message_data = {
            'sessionId': session_id,
            'gcsUri': gcs_uri
        }
        
        future = publisher.publish(
            topic_path,
            json.dumps(message_data).encode('utf-8')
        )
        
        # Wait for publish to complete
        future.result()
        
        logger.info(f"Video uploaded successfully: {session_id}")
        
        return jsonify({
            'sessionId': session_id,
            'message': 'Video uploaded successfully',
            'status': 'processing'
        }), 201
        
    except Exception as e:
        logger.error(f"Error uploading video: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/session/<session_id>', methods=['GET'])
@require_api_key
def get_session(session_id):
    """Get session details."""
    try:
        # Get session from Firestore
        doc = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(session_id).get()
        
        if not doc.exists:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = doc.to_dict()
        
        # Convert datetime to string
        if 'uploadTime' in session_data and hasattr(session_data['uploadTime'], 'isoformat'):
            session_data['uploadTime'] = session_data['uploadTime'].isoformat()
        
        return jsonify(session_data), 200
        
    except Exception as e:
        logger.error(f"Error getting session: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/sessions', methods=['GET'])
@require_api_key
def list_sessions():
    """List all sessions."""
    try:
        # Get pagination parameters
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))
        
        # Query Firestore
        query = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)\
            .order_by('uploadTime', direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .offset(offset)
        
        sessions = []
        for doc in query.stream():
            session_data = doc.to_dict()
            
            # Convert datetime to string
            if 'uploadTime' in session_data and hasattr(session_data['uploadTime'], 'isoformat'):
                session_data['uploadTime'] = session_data['uploadTime'].isoformat()
            
            sessions.append(session_data)
        
        return jsonify({
            'sessions': sessions,
            'limit': limit,
            'offset': offset
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.errorhandler(404)
def not_found(error):
    """404 error handler."""
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """500 error handler."""
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Validate configuration
    try:
        Config.validate()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        exit(1)
    
    # Run the app
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.FLASK_DEBUG)
