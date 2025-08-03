"""Enhanced Flask application with HLS streaming and advanced analytics."""

import os
import uuid
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from functools import wraps
from werkzeug.utils import secure_filename
from google.cloud import storage, pubsub_v1, firestore
import json
import anthropic
import requests
import hmac
import hashlib
from typing import Dict, List, Any, Optional
import subprocess
import tempfile

from config import Config

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-API-Key"]
    }
})

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud clients
storage_client = storage.Client(project=Config.GOOGLE_CLOUD_PROJECT)
publisher = pubsub_v1.PublisherClient()
os.environ['GOOGLE_CLOUD_PROJECT'] = Config.GOOGLE_CLOUD_PROJECT
firestore_client = firestore.Client(project=Config.GOOGLE_CLOUD_PROJECT)
anthropic_client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

# Get or create buckets
upload_bucket = storage_client.bucket(Config.GCS_BUCKET_NAME)
results_bucket = storage_client.bucket(Config.GCS_RESULTS_BUCKET)

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
    return jsonify({'status': 'healthy', 'service': 'function-hackathon-enhanced'}), 200


@app.route('/api/upload', methods=['POST'])
@require_api_key
def upload_video():
    """Enhanced upload endpoint with HLS preparation."""
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
        blob = upload_bucket.blob(gcs_path)
        blob.upload_from_file(file, content_type=file.content_type)
        
        # Get the GCS URI
        gcs_uri = f"gs://{Config.GCS_BUCKET_NAME}/{gcs_path}"
        
        # Create initial Firestore document with enhanced fields
        session_doc = {
            'sessionId': session_id,
            'filename': filename,
            'uploadTime': datetime.utcnow(),
            'gcsUri': gcs_uri,
            'fileSize': file_size,
            'status': 'uploaded',
            'metadata': {
                'contentType': file.content_type,
                'originalFilename': file.filename,
                'userAgent': request.headers.get('User-Agent', ''),
                'uploadIp': request.remote_addr
            },
            'enhanced': True,  # Flag for enhanced processing
            'processingStarted': None,
            'processingCompleted': None,
            'hlsReady': False
        }
        
        # Save to Firestore
        firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(session_id).set(session_doc)
        
        # Publish message to Pub/Sub for enhanced processing
        message_data = {
            'sessionId': session_id,
            'gcsUri': gcs_uri,
            'enhanced': True
        }
        
        future = publisher.publish(
            topic_path,
            json.dumps(message_data).encode('utf-8')
        )
        
        # Wait for publish to complete
        future.result()
        
        logger.info(f"Video uploaded successfully for enhanced processing: {session_id}")
        
        return jsonify({
            'sessionId': session_id,
            'message': 'Video uploaded successfully',
            'status': 'processing',
            'enhanced': True
        }), 201
        
    except Exception as e:
        logger.error(f"Error uploading video: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/session/<session_id>/video-url', methods=['GET'])
@require_api_key
def get_video_url(session_id):
    """Get video URL with HLS support."""
    try:
        # Get session from Firestore
        doc_ref = firestore_client.collection('sessions').document(session_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = doc.to_dict()
        
        # Check if HLS is available
        if session_data.get('hlsReady'):
            # Return HLS manifest URL
            hls_blob = results_bucket.blob(f"{session_id}/hls/playlist.m3u8")
            if hls_blob.exists():
                hls_url = hls_blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(hours=2),
                    method="GET"
                )
                
                return jsonify({
                    'videoUrl': hls_url,
                    'type': 'hls',
                    'expiresIn': 7200  # 2 hours
                }), 200
        
        # Check for high-quality playback video
        playback_video_url = session_data.get('playbackVideoUrl')
        if playback_video_url:
            # Parse GCS URI
            if playback_video_url.startswith('gs://'):
                parts = playback_video_url[5:].split('/', 1)
                if len(parts) == 2:
                    bucket_name, blob_path = parts
                    bucket = storage_client.bucket(bucket_name)
                    blob = bucket.blob(blob_path)
                    
                    if blob.exists():
                        url = blob.generate_signed_url(
                            version="v4",
                            expiration=timedelta(hours=2),
                            method="GET"
                        )
                        
                        return jsonify({
                            'videoUrl': url,
                            'type': 'mp4',
                            'quality': 'high',
                            'expiresIn': 7200
                        }), 200
        
        # Fall back to original video
        gcs_uri = session_data.get('gcsUri')
        if not gcs_uri:
            return jsonify({'error': 'No video found for this session'}), 404
        
        # Parse GCS URI
        if gcs_uri.startswith('gs://'):
            parts = gcs_uri[5:].split('/', 1)
            if len(parts) != 2:
                return jsonify({'error': 'Invalid GCS URI'}), 500
            
            bucket_name, blob_path = parts
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            
            # Generate signed URL
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(hours=2),
                method="GET"
            )
            
            return jsonify({
                'videoUrl': url,
                'type': 'mp4',
                'quality': 'original',
                'expiresIn': 7200
            }), 200
        else:
            return jsonify({'error': 'Invalid video URI format'}), 500
            
    except Exception as e:
        logger.error(f"Error generating video URL: {str(e)}")
        return jsonify({'error': 'Failed to generate video URL'}), 500


@app.route('/api/session/<session_id>', methods=['GET'])
@require_api_key
def get_session(session_id):
    """Get enhanced session details with all analytics."""
    try:
        # Get session from Firestore
        doc = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(session_id).get()
        
        if not doc.exists:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = doc.to_dict()
        
        # Convert datetime fields to strings
        datetime_fields = ['uploadTime', 'processingStarted', 'processingCompleted', 'analysisCompleted', 'lastUpdated']
        for field in datetime_fields:
            if field in session_data and hasattr(session_data[field], 'isoformat'):
                session_data[field] = session_data[field].isoformat()
        
        # Get additional data from Cloud Storage if available
        if session_data.get('enhanced') and session_data.get('status') == 'completed':
            try:
                # Get mouse trail data
                trail_blob = results_bucket.blob(f"{session_id}/mouse_trail.json")
                if trail_blob.exists():
                    trail_data = json.loads(trail_blob.download_as_text())
                    session_data['mouseTrail'] = trail_data.get('positions', [])
                
                # Get enhanced analysis
                analysis_blob = results_bucket.blob(f"{session_id}/analysis_enhanced.json")
                if analysis_blob.exists():
                    analysis_data = json.loads(analysis_blob.download_as_text())
                    # Add additional fields not stored in Firestore
                    session_data['frameAnalyses'] = analysis_data.get('frameAnalyses', [])
                    session_data['events'] = analysis_data.get('events', [])
                    session_data['uiElements'] = analysis_data.get('uiElements', [])
            
            except Exception as e:
                logger.warning(f"Error loading additional data: {str(e)}")
        
        return jsonify(session_data), 200
        
    except Exception as e:
        logger.error(f"Error getting session: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/session/<session_id>/heatmap', methods=['GET'])
@require_api_key
def get_heatmap_url(session_id):
    """Get signed URL for session heatmap."""
    try:
        # Check if heatmap exists
        heatmap_blob = results_bucket.blob(f"{session_id}/heatmap_enhanced.png")
        if not heatmap_blob.exists():
            # Try regular heatmap
            heatmap_blob = results_bucket.blob(f"{session_id}/heatmap.png")
            if not heatmap_blob.exists():
                return jsonify({'error': 'Heatmap not found'}), 404
        
        # Generate signed URL
        url = heatmap_blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=1),
            method="GET"
        )
        
        return jsonify({
            'heatmapUrl': url,
            'expiresIn': 3600
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting heatmap URL: {str(e)}")
        return jsonify({'error': 'Failed to generate heatmap URL'}), 500


@app.route('/api/session/<session_id>/journey', methods=['GET'])
@require_api_key
def get_user_journey(session_id):
    """Get user journey narrative for a session."""
    try:
        # Get session from Firestore
        doc = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(session_id).get()
        
        if not doc.exists:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = doc.to_dict()
        
        # Get journey data
        user_journey = session_data.get('userJourney', [])
        key_moments = session_data.get('keyMoments', [])
        
        # If no journey data in Firestore, try loading from Cloud Storage
        if not user_journey and session_data.get('enhanced'):
            try:
                analysis_blob = results_bucket.blob(f"{session_id}/analysis_enhanced.json")
                if analysis_blob.exists():
                    analysis_data = json.loads(analysis_blob.download_as_text())
                    user_journey = analysis_data.get('userJourney', [])
                    narrative = analysis_data.get('userJourneyNarrative', '')
                    
                    return jsonify({
                        'sessionId': session_id,
                        'journey': user_journey,
                        'keyMoments': key_moments,
                        'narrative': narrative
                    }), 200
            except Exception as e:
                logger.warning(f"Error loading journey data: {str(e)}")
        
        return jsonify({
            'sessionId': session_id,
            'journey': user_journey,
            'keyMoments': key_moments
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user journey: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/sessions', methods=['GET'])
@require_api_key
def list_sessions():
    """List sessions with enhanced filtering."""
    try:
        # Get query parameters
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))
        status = request.args.get('status')
        min_friction = request.args.get('minFriction', type=int)
        max_friction = request.args.get('maxFriction', type=int)
        sort_by = request.args.get('sortBy', 'uploadTime')
        order = request.args.get('order', 'desc')
        
        # Build query
        query = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)
        
        # Apply filters
        if status:
            query = query.where('status', '==', status)
        
        # Apply ordering
        direction = firestore.Query.DESCENDING if order == 'desc' else firestore.Query.ASCENDING
        query = query.order_by(sort_by, direction=direction)
        
        # Apply pagination
        query = query.limit(limit).offset(offset)
        
        # Execute query
        sessions = []
        for doc in query.stream():
            session_data = doc.to_dict()
            
            # Apply friction filter (post-query filtering)
            friction_count = len(session_data.get('frictionPoints', []))
            if min_friction is not None and friction_count < min_friction:
                continue
            if max_friction is not None and friction_count > max_friction:
                continue
            
            # Convert datetime to string
            if 'uploadTime' in session_data and hasattr(session_data['uploadTime'], 'isoformat'):
                session_data['uploadTime'] = session_data['uploadTime'].isoformat()
            
            # Add summary fields
            session_data['frictionCount'] = friction_count
            session_data['hasHighSeverity'] = any(
                fp.get('severity') == 'high' 
                for fp in session_data.get('frictionPoints', [])
            )
            
            sessions.append(session_data)
        
        # Get total count
        total_query = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)
        if status:
            total_query = total_query.where('status', '==', status)
        total_count = len(list(total_query.stream()))
        
        return jsonify({
            'sessions': sessions,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total_count,
                'hasMore': offset + len(sessions) < total_count
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/query', methods=['POST'])
@require_api_key
def query_sessions():
    """Enhanced natural language query with cross-session analytics."""
    try:
        # Get query from request
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'error': 'Query is required'}), 400
        
        user_query = data['query']
        include_analytics = data.get('includeAnalytics', True)
        
        # Get all sessions with summaries
        sessions_ref = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)
        sessions = []
        
        for doc in sessions_ref.stream():
            session_data = doc.to_dict()
            if session_data.get('status') == 'completed' and session_data.get('behaviorSummary'):
                sessions.append({
                    'sessionId': session_data.get('sessionId'),
                    'filename': session_data.get('filename'),
                    'uploadTime': session_data.get('uploadTime').isoformat() if hasattr(session_data.get('uploadTime'), 'isoformat') else str(session_data.get('uploadTime')),
                    'stats': session_data.get('stats', {}),
                    'frictionPoints': session_data.get('frictionPoints', []),
                    'behaviorSummary': session_data.get('behaviorSummary', ''),
                    'keyMoments': session_data.get('keyMoments', []),
                    'funnelMetrics': session_data.get('funnelMetrics', {})
                })
        
        if not sessions:
            return jsonify({
                'query': user_query,
                'results': [],
                'summary': 'No analyzed sessions found.',
                'analytics': {},
                'recommendations': []
            }), 200
        
        # Prepare context for AI
        sessions_context = json.dumps(sessions[:20], indent=2)  # Limit context size
        
        # Enhanced query analysis
        query_response = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=800,
            messages=[{
                "role": "user",
                "content": f"""Analyze this natural language query: "{user_query}"

Available sessions with analytics:
{sessions_context}

Please provide:

1. MATCHING SESSIONS:
   - List session IDs that match the query
   - Explain why each matches

2. CROSS-SESSION ANALYTICS:
   - Common friction patterns across sessions
   - Average metrics (if relevant to query)
   - Trend analysis

3. KEY INSIGHTS:
   - Top issues found
   - User behavior patterns
   - Conversion/funnel insights

4. RECOMMENDATIONS:
   - Immediate actions
   - Long-term improvements

Return a comprehensive JSON response with these sections."""
            }]
        )
        
        # Parse AI response
        import re
        response_text = query_response.content[0].text
        
        # Try to extract structured data
        try:
            # Look for JSON in the response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                structured_data = json.loads(json_match.group())
            else:
                # Fallback to parsing text
                structured_data = {
                    'matching_sessions': [],
                    'analytics': {},
                    'insights': [],
                    'recommendations': []
                }
        except:
            structured_data = {}
        
        # Get matching sessions
        matching_ids = structured_data.get('matching_sessions', [])
        if isinstance(matching_ids, list) and matching_ids:
            matching_sessions = [s for s in sessions if s['sessionId'] in matching_ids]
        else:
            # Fallback: return all sessions if parsing failed
            matching_sessions = sessions[:10]
        
        # Calculate aggregate analytics if requested
        analytics = {}
        if include_analytics and matching_sessions:
            total_friction = sum(len(s['frictionPoints']) for s in matching_sessions)
            avg_friction = total_friction / len(matching_sessions)
            
            # Aggregate friction types
            friction_types = {}
            for session in matching_sessions:
                for fp in session['frictionPoints']:
                    fp_type = fp.get('type', 'unknown')
                    friction_types[fp_type] = friction_types.get(fp_type, 0) + 1
            
            # Funnel metrics aggregation
            funnel_completion_rates = []
            for session in matching_sessions:
                if 'funnelMetrics' in session and 'completionRate' in session['funnelMetrics']:
                    funnel_completion_rates.append(session['funnelMetrics']['completionRate'])
            
            analytics = {
                'sessionCount': len(matching_sessions),
                'totalFrictionPoints': total_friction,
                'averageFrictionPerSession': round(avg_friction, 2),
                'frictionTypeDistribution': friction_types,
                'averageFunnelCompletion': round(sum(funnel_completion_rates) / len(funnel_completion_rates), 2) if funnel_completion_rates else 0
            }
        
        # Prepare response
        response = {
            'query': user_query,
            'results': matching_sessions,
            'summary': response_text,
            'analytics': analytics,
            'insights': structured_data.get('insights', []),
            'recommendations': structured_data.get('recommendations', []),
            'totalMatches': len(matching_sessions)
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/analytics/friction-trends', methods=['GET'])
@require_api_key
def get_friction_trends():
    """Get friction trends across all sessions."""
    try:
        # Get time range parameters
        days = int(request.args.get('days', 7))
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Query sessions within time range
        query = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)\
            .where('uploadTime', '>=', start_date)\
            .where('status', '==', 'completed')
        
        # Aggregate friction data
        daily_friction = {}
        friction_types = {}
        severity_distribution = {'high': 0, 'medium': 0, 'low': 0}
        
        for doc in query.stream():
            session = doc.to_dict()
            upload_date = session['uploadTime'].date()
            
            # Daily aggregation
            date_key = upload_date.isoformat()
            if date_key not in daily_friction:
                daily_friction[date_key] = {
                    'sessionCount': 0,
                    'totalFriction': 0,
                    'highSeverity': 0
                }
            
            daily_friction[date_key]['sessionCount'] += 1
            
            # Process friction points
            for fp in session.get('frictionPoints', []):
                daily_friction[date_key]['totalFriction'] += 1
                
                # Type distribution
                fp_type = fp.get('type', 'unknown')
                friction_types[fp_type] = friction_types.get(fp_type, 0) + 1
                
                # Severity distribution
                severity = fp.get('severity', 'low')
                severity_distribution[severity] += 1
                
                if severity == 'high':
                    daily_friction[date_key]['highSeverity'] += 1
        
        # Calculate averages
        for date_data in daily_friction.values():
            if date_data['sessionCount'] > 0:
                date_data['averageFrictionPerSession'] = round(
                    date_data['totalFriction'] / date_data['sessionCount'], 2
                )
        
        # Sort friction types by frequency
        sorted_types = sorted(friction_types.items(), key=lambda x: x[1], reverse=True)
        
        return jsonify({
            'timeRange': {
                'days': days,
                'startDate': start_date.isoformat(),
                'endDate': datetime.utcnow().isoformat()
            },
            'dailyTrends': daily_friction,
            'frictionTypes': dict(sorted_types[:10]),  # Top 10 types
            'severityDistribution': severity_distribution,
            'summary': {
                'totalSessions': sum(d['sessionCount'] for d in daily_friction.values()),
                'totalFrictionPoints': sum(d['totalFriction'] for d in daily_friction.values()),
                'mostCommonType': sorted_types[0][0] if sorted_types else None
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting friction trends: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/analytics/funnel-metrics', methods=['GET'])
@require_api_key
def get_funnel_metrics():
    """Get aggregated funnel metrics across sessions."""
    try:
        # Query completed sessions
        query = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)\
            .where('status', '==', 'completed')
        
        # Aggregate funnel data
        funnel_stages = {
            'page_load': {'completed': 0, 'total': 0},
            'first_interaction': {'completed': 0, 'total': 0},
            'form_start': {'completed': 0, 'total': 0},
            'form_complete': {'completed': 0, 'total': 0},
            'cta_click': {'completed': 0, 'total': 0},
            'conversion': {'completed': 0, 'total': 0}
        }
        
        session_count = 0
        
        for doc in query.stream():
            session = doc.to_dict()
            funnel_data = session.get('funnelMetrics', {})
            stages = funnel_data.get('stages', {})
            
            if stages:
                session_count += 1
                for stage_name, stage_data in stages.items():
                    if stage_name in funnel_stages:
                        funnel_stages[stage_name]['total'] += 1
                        if stage_data.get('completed'):
                            funnel_stages[stage_name]['completed'] += 1
        
        # Calculate conversion rates
        funnel_analysis = {}
        for stage_name, stage_data in funnel_stages.items():
            if stage_data['total'] > 0:
                conversion_rate = (stage_data['completed'] / stage_data['total']) * 100
                funnel_analysis[stage_name] = {
                    'completed': stage_data['completed'],
                    'total': stage_data['total'],
                    'conversionRate': round(conversion_rate, 2)
                }
        
        # Calculate drop-off rates between stages
        stage_order = ['page_load', 'first_interaction', 'form_start', 'form_complete', 'cta_click', 'conversion']
        dropoff_analysis = []
        
        for i in range(1, len(stage_order)):
            prev_stage = stage_order[i-1]
            curr_stage = stage_order[i]
            
            if prev_stage in funnel_analysis and curr_stage in funnel_analysis:
                prev_completed = funnel_analysis[prev_stage]['completed']
                curr_completed = funnel_analysis[curr_stage]['completed']
                
                if prev_completed > 0:
                    dropoff_rate = ((prev_completed - curr_completed) / prev_completed) * 100
                    dropoff_analysis.append({
                        'from': prev_stage,
                        'to': curr_stage,
                        'dropoffRate': round(dropoff_rate, 2),
                        'lost': prev_completed - curr_completed
                    })
        
        return jsonify({
            'sessionCount': session_count,
            'funnelStages': funnel_analysis,
            'dropoffAnalysis': dropoff_analysis,
            'overallConversion': {
                'rate': funnel_analysis.get('conversion', {}).get('conversionRate', 0),
                'completed': funnel_analysis.get('conversion', {}).get('completed', 0)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting funnel metrics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/voice/webhook', methods=['POST'])
def voice_webhook():
    """Enhanced webhook endpoint for Vapi voice assistant."""
    try:
        # Verify webhook signature if secret is configured
        vapi_secret = os.environ.get('VAPI_WEBHOOK_SECRET')
        if vapi_secret:
            signature = request.headers.get('X-Vapi-Signature')
            if not signature:
                return jsonify({'error': 'Missing signature'}), 401
            
            # Verify HMAC signature
            expected_signature = hmac.new(
                vapi_secret.encode(),
                request.get_data(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                return jsonify({'error': 'Invalid signature'}), 401
        
        # Parse webhook payload
        data = request.get_json()
        webhook_type = data.get('type')
        
        logger.info(f"Received Vapi webhook: {webhook_type}")
        
        # Forward to agents service if available
        agents_url = os.environ.get('AGENTS_SERVICE_URL', 'http://localhost:3001')
        
        try:
            response = requests.post(
                f"{agents_url}/voice/webhook",
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            return jsonify(response.json()), response.status_code
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to forward to agents service: {str(e)}")
            
            # Handle function calls directly
            if webhook_type == 'function-call':
                function_call = data.get('functionCall', {})
                function_name = function_call.get('name')
                parameters = function_call.get('parameters', {})
                
                if function_name == 'searchSessions':
                    # Use enhanced query
                    query_result = query_sessions_enhanced(parameters.get('query', ''))
                    return jsonify({
                        'response': query_result.get('summary', 'No results found'),
                        'data': {
                            'sessions': query_result.get('results', [])[:3],
                            'analytics': query_result.get('analytics', {}),
                            'totalFound': query_result.get('totalMatches', 0)
                        }
                    }), 200
                
                elif function_name == 'getSessionDetails':
                    session_id = parameters.get('sessionId')
                    if not session_id:
                        return jsonify({'error': 'sessionId required'}), 400
                    
                    # Get enhanced session details
                    doc = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(session_id).get()
                    if not doc.exists:
                        return jsonify({
                            'response': 'I couldn\'t find that session.',
                            'error': 'Session not found'
                        }), 200
                    
                    session = doc.to_dict()
                    friction_count = len(session.get('frictionPoints', []))
                    high_severity = sum(1 for fp in session.get('frictionPoints', []) if fp.get('severity') == 'high')
                    
                    response_text = f"Session {session_id} has {friction_count} friction points. "
                    if high_severity > 0:
                        response_text += f"{high_severity} are high severity issues requiring immediate attention. "
                    
                    # Add key moments summary
                    key_moments = session.get('keyMoments', [])
                    if key_moments:
                        response_text += f"Key moments include: {', '.join(m['description'] for m in key_moments[:3])}."
                    
                    return jsonify({
                        'response': response_text,
                        'data': {
                            'sessionId': session_id,
                            'frictionPoints': friction_count,
                            'highSeverity': high_severity,
                            'summary': session.get('behaviorSummary', '')[:500]
                        }
                    }), 200
                
                elif function_name == 'getFrictionTrends':
                    # Get recent friction trends
                    trends_result = get_friction_trends_internal(days=7)
                    
                    total_friction = trends_result.get('summary', {}).get('totalFrictionPoints', 0)
                    most_common = trends_result.get('summary', {}).get('mostCommonType', 'unknown')
                    
                    response_text = f"In the last 7 days, I found {total_friction} total friction points. "
                    response_text += f"The most common issue is {most_common.replace('_', ' ')}. "
                    
                    return jsonify({
                        'response': response_text,
                        'data': trends_result
                    }), 200
                
                else:
                    return jsonify({
                        'error': f'Unknown function: {function_name}'
                    }), 400
            
            # For other webhook types, acknowledge
            return jsonify({'success': True}), 200
        
    except Exception as e:
        logger.error(f"Error processing voice webhook: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


def query_sessions_enhanced(query: str) -> Dict[str, Any]:
    """Enhanced internal query function for voice interactions."""
    try:
        # Get sessions
        sessions_ref = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)
        sessions = []
        
        for doc in sessions_ref.stream():
            session_data = doc.to_dict()
            if session_data.get('status') == 'completed' and session_data.get('behaviorSummary'):
                sessions.append({
                    'sessionId': session_data.get('sessionId'),
                    'filename': session_data.get('filename'),
                    'uploadTime': session_data.get('uploadTime').isoformat() if hasattr(session_data.get('uploadTime'), 'isoformat') else str(session_data.get('uploadTime')),
                    'stats': session_data.get('stats', {}),
                    'frictionPoints': session_data.get('frictionPoints', []),
                    'behaviorSummary': session_data.get('behaviorSummary', '')
                })
        
        if not sessions:
            return {
                'query': query,
                'results': [],
                'summary': 'No analyzed sessions found.',
                'analytics': {},
                'totalMatches': 0
            }
        
        # Use AI for voice-optimized response
        sessions_context = json.dumps(sessions[:10], indent=2)
        
        voice_response = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": f"""Voice query: "{query}"

Sessions data:
{sessions_context}

Provide a brief, conversational response (2-3 sentences) summarizing the findings. Focus on:
1. How many sessions match
2. Key friction points or patterns
3. One actionable recommendation

Be concise and natural for voice output."""
            }]
        )
        
        summary_text = voice_response.content[0].text
        
        # Simple matching based on query keywords
        query_lower = query.lower()
        matching_sessions = []
        
        for session in sessions:
            summary_lower = session['behaviorSummary'].lower()
            # Check if query terms appear in summary
            if any(term in summary_lower for term in query_lower.split()):
                matching_sessions.append(session)
        
        # If no keyword matches, return all recent sessions
        if not matching_sessions:
            matching_sessions = sessions[:5]
        
        # Calculate basic analytics
        total_friction = sum(len(s['frictionPoints']) for s in matching_sessions)
        avg_friction = total_friction / len(matching_sessions) if matching_sessions else 0
        
        return {
            'query': query,
            'results': matching_sessions,
            'summary': summary_text,
            'analytics': {
                'sessionCount': len(matching_sessions),
                'totalFrictionPoints': total_friction,
                'averageFrictionPerSession': round(avg_friction, 2)
            },
            'totalMatches': len(matching_sessions)
        }
        
    except Exception as e:
        logger.error(f"Error in enhanced query: {str(e)}")
        return {
            'query': query,
            'results': [],
            'summary': 'An error occurred while processing your query.',
            'analytics': {},
            'totalMatches': 0
        }


def get_friction_trends_internal(days: int = 7) -> Dict[str, Any]:
    """Internal function to get friction trends."""
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        query = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS)\
            .where('uploadTime', '>=', start_date)\
            .where('status', '==', 'completed')
        
        friction_types = {}
        total_friction = 0
        session_count = 0
        
        for doc in query.stream():
            session = doc.to_dict()
            session_count += 1
            
            for fp in session.get('frictionPoints', []):
                total_friction += 1
                fp_type = fp.get('type', 'unknown')
                friction_types[fp_type] = friction_types.get(fp_type, 0) + 1
        
        sorted_types = sorted(friction_types.items(), key=lambda x: x[1], reverse=True)
        
        return {
            'summary': {
                'totalSessions': session_count,
                'totalFrictionPoints': total_friction,
                'mostCommonType': sorted_types[0][0] if sorted_types else None,
                'averagePerSession': round(total_friction / session_count, 2) if session_count > 0 else 0
            },
            'frictionTypes': dict(sorted_types[:5])
        }
        
    except Exception as e:
        logger.error(f"Error getting friction trends: {str(e)}")
        return {'summary': {}, 'frictionTypes': {}}


@app.route('/api/export/session/<session_id>', methods=['GET'])
@require_api_key
def export_session_data(session_id):
    """Export session data in various formats."""
    try:
        format_type = request.args.get('format', 'json')
        
        # Get session data
        doc = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(session_id).get()
        
        if not doc.exists:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = doc.to_dict()
        
        # Convert datetime fields
        for field in ['uploadTime', 'processingStarted', 'processingCompleted', 'analysisCompleted']:
            if field in session_data and hasattr(session_data[field], 'isoformat'):
                session_data[field] = session_data[field].isoformat()
        
        if format_type == 'json':
            return jsonify(session_data), 200
        
        elif format_type == 'csv':
            # Create CSV format for friction points
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Timestamp', 'Type', 'Severity', 'Description', 'Recommendation'])
            
            # Write friction points
            for fp in session_data.get('frictionPoints', []):
                writer.writerow([
                    fp.get('timestamp', ''),
                    fp.get('type', ''),
                    fp.get('severity', ''),
                    fp.get('description', ''),
                    fp.get('recommendation', '')
                ])
            
            # Create response
            output.seek(0)
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment; filename=session_{session_id}_friction.csv'}
            )
        
        elif format_type == 'report':
            # Generate PDF report (simplified text version for now)
            report = f"""
USER SESSION ANALYSIS REPORT

Session ID: {session_id}
Upload Time: {session_data.get('uploadTime', 'N/A')}
Status: {session_data.get('status', 'N/A')}

EXECUTIVE SUMMARY
-----------------
{session_data.get('behaviorSummary', 'No summary available')}

METRICS
-------
Total Movements: {session_data.get('stats', {}).get('totalMovements', 0)}
Total Distance: {session_data.get('stats', {}).get('totalDistance', 0):.1f} pixels
Average Speed: {session_data.get('stats', {}).get('averageSpeed', 0):.1f} px/s
Total Clicks: {session_data.get('stats', {}).get('totalClicks', 0)}
Rage Clicks: {session_data.get('stats', {}).get('rageClicks', 0)}

FRICTION POINTS ({len(session_data.get('frictionPoints', []))})
----------------
"""
            
            for i, fp in enumerate(session_data.get('frictionPoints', []), 1):
                report += f"\n{i}. {fp.get('type', 'Unknown').upper()} (Severity: {fp.get('severity', 'N/A')})"
                report += f"\n   Time: {fp.get('timestamp', 0):.1f}s"
                report += f"\n   Description: {fp.get('description', 'N/A')}"
                report += f"\n   Recommendation: {fp.get('recommendation', 'N/A')}\n"
            
            report += "\n\nKEY MOMENTS\n-----------\n"
            for moment in session_data.get('keyMoments', [])[:10]:
                report += f"\n{moment.get('icon', '•')} {moment.get('timestamp', 0):.1f}s: {moment.get('description', '')}"
            
            return Response(
                report,
                mimetype='text/plain',
                headers={'Content-Disposition': f'attachment; filename=session_{session_id}_report.txt'}
            )
        
        else:
            return jsonify({'error': 'Invalid format. Supported: json, csv, report'}), 400
            
    except Exception as e:
        logger.error(f"Error exporting session data: {str(e)}")
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
