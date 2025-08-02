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
import anthropic

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
anthropic_client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

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


@app.route('/api/query', methods=['POST'])
@require_api_key
def query_sessions():
    """Natural language query endpoint."""
    try:
        # Get query from request
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'error': 'Query is required'}), 400
        
        user_query = data['query']
        
        # Get all sessions with summaries for context
        sessions_ref = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)
        sessions = []
        
        for doc in sessions_ref.stream():
            session_data = doc.to_dict()
            if 'behaviorSummary' in session_data and session_data['behaviorSummary']:
                sessions.append({
                    'sessionId': session_data.get('sessionId'),
                    'filename': session_data.get('filename'),
                    'uploadTime': session_data.get('uploadTime').isoformat() if hasattr(session_data.get('uploadTime'), 'isoformat') else str(session_data.get('uploadTime')),
                    'stats': session_data.get('stats', {}),
                    'frictionPoints': len(session_data.get('frictionPoints', [])),
                    'behaviorSummary': session_data.get('behaviorSummary', '')[:500]  # Truncate for context
                })
        
        if not sessions:
            return jsonify({
                'query': user_query,
                'results': [],
                'summary': 'No analyzed sessions found.',
                'recommendations': []
            }), 200
        
        # Create context for AI
        sessions_context = json.dumps(sessions, indent=2)
        
        # First, ask AI to translate the query into filter criteria
        filter_response = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": f"""Given this natural language query: "{user_query}"

And these available sessions with their metadata:
{sessions_context}

Please identify which sessions match the query criteria. Consider friction points count, behavior summaries, stats, and any mentioned issues. Return a JSON object with:
{{
    "matching_session_ids": ["id1", "id2", ...],
    "filter_explanation": "Brief explanation of why these sessions match"
}}"""
            }]
        )
        
        # Parse AI response
        import re
        filter_text = filter_response.content[0].text
        
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', filter_text)
        if json_match:
            filter_data = json.loads(json_match.group())
            matching_ids = filter_data.get('matching_session_ids', [])
            filter_explanation = filter_data.get('filter_explanation', '')
        else:
            # Fallback to all sessions if parsing fails
            matching_ids = [s['sessionId'] for s in sessions]
            filter_explanation = "Showing all sessions"
        
        # Get matching sessions
        matching_sessions = [s for s in sessions if s['sessionId'] in matching_ids]
        
        if not matching_sessions:
            return jsonify({
                'query': user_query,
                'results': [],
                'summary': 'No sessions match your query criteria.',
                'recommendations': []
            }), 200
        
        # Generate summary and recommendations
        summary_response = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"""Based on this query: "{user_query}"

And these matching sessions:
{json.dumps(matching_sessions, indent=2)}

Filter explanation: {filter_explanation}

Please provide:
1. A concise summary of the findings across these sessions
2. Top friction points identified
3. Recommended next steps to address the issues

Format as clear sections."""
            }]
        )
        
        summary_text = summary_response.content[0].text
        
        # Extract recommendations
        recommendations = []
        if 'recommend' in summary_text.lower():
            # Simple extraction of bullet points after "recommend"
            rec_section = summary_text.split('recommend', 1)[1] if 'recommend' in summary_text.lower() else ''
            rec_lines = [line.strip() for line in rec_section.split('\n') if line.strip() and (line.strip().startswith('-') or line.strip().startswith('•') or line.strip().startswith('*'))]
            recommendations = [line.lstrip('-•* ') for line in rec_lines[:5]]  # Top 5 recommendations
        
        # Prepare response
        response = {
            'query': user_query,
            'results': matching_sessions,
            'filterExplanation': filter_explanation,
            'summary': summary_text,
            'recommendations': recommendations,
            'totalMatches': len(matching_sessions)
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
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
