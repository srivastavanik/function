"""Video processor service that handles asynchronous video analysis."""

import os
import json
import logging
import tempfile
import base64
from datetime import datetime
import cv2
import numpy as np
from google.cloud import storage, firestore, pubsub_v1
from google.cloud.pubsub_v1.subscriber import message
import ffmpeg
import anthropic
from PIL import Image
import io

from config import Config

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud clients
storage_client = storage.Client(project=Config.GOOGLE_CLOUD_PROJECT)
firestore_client = firestore.Client(project=Config.GOOGLE_CLOUD_PROJECT)
subscriber = pubsub_v1.SubscriberClient()

# Initialize Anthropic client
anthropic_client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

# Subscription path
subscription_path = subscriber.subscription_path(
    Config.GOOGLE_CLOUD_PROJECT, 
    Config.PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR
)


class VideoProcessor:
    """Handles video processing and analysis."""
    
    def __init__(self, session_id: str, gcs_uri: str):
        self.session_id = session_id
        self.gcs_uri = gcs_uri
        self.temp_dir = None
        self.video_path = None
        self.frames_dir = None
        self.results = {
            'sessionId': session_id,
            'frameAnalyses': [],
            'mousePositions': [],
            'frictionPoints': [],
            'stats': {},
            'behaviorSummary': ''
        }
    
    def process(self):
        """Main processing pipeline."""
        try:
            logger.info(f"Starting processing for session {self.session_id}")
            
            # Update status in Firestore
            self._update_status('processing')
            
            # Create temporary directory
            self.temp_dir = tempfile.mkdtemp()
            self.frames_dir = os.path.join(self.temp_dir, 'frames')
            os.makedirs(self.frames_dir)
            
            # Download video
            self._download_video()
            
            # Extract frames
            frame_count = self._extract_frames()
            self.results['stats']['totalFrames'] = frame_count
            
            # Track mouse movements
            self._track_mouse()
            
            # Analyze key frames with AI
            self._analyze_frames()
            
            # Generate behavior summary
            self._generate_summary()
            
            # Save results
            self._save_results()
            
            # Update status
            self._update_status('completed')
            
            # Notify agent service if webhook URL is configured
            self._notify_agent()
            
            logger.info(f"Completed processing for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error processing video: {str(e)}")
            self._update_status('failed', error=str(e))
            raise
        
        finally:
            # Cleanup temp files
            if self.temp_dir and os.path.exists(self.temp_dir):
                import shutil
                shutil.rmtree(self.temp_dir)
    
    def _download_video(self):
        """Download video from GCS to local temp directory."""
        # Parse GCS URI
        bucket_name = self.gcs_uri.split('/')[2]
        blob_path = '/'.join(self.gcs_uri.split('/')[3:])
        
        # Get blob
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        # Download to temp file
        self.video_path = os.path.join(self.temp_dir, 'video.mp4')
        blob.download_to_filename(self.video_path)
        
        logger.info(f"Downloaded video to {self.video_path}")
    
    def _extract_frames(self):
        """Extract frames from video at 1 FPS."""
        try:
            # Get video info
            probe = ffmpeg.probe(self.video_path)
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            fps = eval(video_info['r_frame_rate'])
            duration = float(probe['format']['duration'])
            
            # Extract frames at 1 FPS
            (
                ffmpeg
                .input(self.video_path)
                .filter('fps', fps=1)
                .output(os.path.join(self.frames_dir, 'frame_%04d.png'))
                .overwrite_output()
                .run(quiet=True)
            )
            
            # Count extracted frames
            frame_files = [f for f in os.listdir(self.frames_dir) if f.endswith('.png')]
            frame_count = len(frame_files)
            
            self.results['stats']['videoDuration'] = duration
            self.results['stats']['fps'] = fps
            
            logger.info(f"Extracted {frame_count} frames")
            return frame_count
            
        except Exception as e:
            logger.error(f"Error extracting frames: {str(e)}")
            raise
    
    def _track_mouse(self):
        """Track mouse movements in frames."""
        frame_files = sorted([f for f in os.listdir(self.frames_dir) if f.endswith('.png')])
        
        # Sample every 10th frame for mouse tracking
        sample_indices = list(range(0, len(frame_files), 10))
        
        for idx in sample_indices:
            frame_path = os.path.join(self.frames_dir, frame_files[idx])
            
            try:
                # Read frame
                frame = cv2.imread(frame_path)
                
                # Simple cursor detection using color masks
                # This is a simplified version - in production, use more sophisticated tracking
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                
                # Define range for white/light colors (typical cursor)
                lower_white = np.array([0, 0, 200])
                upper_white = np.array([180, 30, 255])
                mask = cv2.inRange(hsv, lower_white, upper_white)
                
                # Find contours
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if contours:
                    # Get largest contour (likely cursor)
                    largest_contour = max(contours, key=cv2.contourArea)
                    M = cv2.moments(largest_contour)
                    
                    if M["m00"] != 0:
                        cx = int(M["m01"] / M["m00"])
                        cy = int(M["m10"] / M["m00"])
                        
                        self.results['mousePositions'].append({
                            'frameIndex': idx,
                            'timestamp': idx,  # seconds
                            'x': cx,
                            'y': cy
                        })
                
            except Exception as e:
                logger.warning(f"Error tracking mouse in frame {idx}: {str(e)}")
        
        logger.info(f"Tracked {len(self.results['mousePositions'])} mouse positions")
    
    def _analyze_frames(self):
        """Analyze key frames using Anthropic AI."""
        frame_files = sorted([f for f in os.listdir(self.frames_dir) if f.endswith('.png')])
        
        # Select up to 6 key frames evenly distributed
        total_frames = len(frame_files)
        if total_frames <= 6:
            key_indices = list(range(total_frames))
        else:
            step = total_frames // 6
            key_indices = [i * step for i in range(6)]
        
        for idx in key_indices:
            frame_path = os.path.join(self.frames_dir, frame_files[idx])
            
            try:
                # Read and encode frame
                with open(frame_path, 'rb') as f:
                    image_data = f.read()
                
                # Convert to base64
                base64_image = base64.b64encode(image_data).decode('utf-8')
                
                # Call Anthropic API
                response = anthropic_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=300,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Analyze this screenshot from a user session recording. Identify visible user actions, potential friction points, interface response issues, or any signs of user confusion or frustration. Be specific and concise."
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": base64_image
                                }
                            }
                        ]
                    }]
                )
                
                analysis_text = response.content[0].text
                
                self.results['frameAnalyses'].append({
                    'frameIndex': idx,
                    'timestamp': idx,
                    'analysisText': analysis_text
                })
                
                # Extract friction points from analysis
                if any(keyword in analysis_text.lower() for keyword in ['error', 'confusion', 'stuck', 'unclear', 'frustration']):
                    self.results['frictionPoints'].append({
                        'type': 'ui_confusion',
                        'frameIndex': idx,
                        'timestamp': idx,
                        'description': analysis_text[:200]
                    })
                
                # Rate limiting
                import time
                time.sleep(0.2)
                
            except Exception as e:
                logger.error(f"Error analyzing frame {idx}: {str(e)}")
        
        logger.info(f"Analyzed {len(self.results['frameAnalyses'])} frames")
    
    def _generate_summary(self):
        """Generate overall behavior summary using AI."""
        try:
            # Combine all analyses
            all_analyses = "\n\n".join([
                f"Frame {fa['frameIndex']} (t={fa['timestamp']}s): {fa['analysisText']}"
                for fa in self.results['frameAnalyses']
            ])
            
            # Add mouse movement summary
            if self.results['mousePositions']:
                movement_summary = f"\nMouse tracking: {len(self.results['mousePositions'])} positions tracked"
            else:
                movement_summary = "\nNo mouse movements detected"
            
            # Call Anthropic for summary
            response = anthropic_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": f"""Based on the following frame-by-frame analysis of a user session recording:

{all_analyses}
{movement_summary}

Please provide:
1. A list of real friction points and hesitation moments
2. Any error patterns or repeated issues
3. Specific solutions and recommendations to improve the user experience

Format your response as clear, actionable bullet points."""
                }]
            )
            
            self.results['behaviorSummary'] = response.content[0].text
            
            # Extract high-priority friction points
            if 'high' in self.results['behaviorSummary'].lower() or 'critical' in self.results['behaviorSummary'].lower():
                self.results['stats']['highPriorityFrictionCount'] = len([
                    fp for fp in self.results['frictionPoints'] 
                    if 'error' in fp.get('description', '').lower()
                ])
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            self.results['behaviorSummary'] = "Error generating summary"
    
    def _save_results(self):
        """Save analysis results to Cloud Storage and Firestore."""
        try:
            # Save to Cloud Storage
            results_bucket = storage_client.bucket(Config.GCS_RESULTS_BUCKET)
            
            # Save JSON results
            json_blob = results_bucket.blob(f"{self.session_id}/analysis.json")
            json_blob.upload_from_string(
                json.dumps(self.results, indent=2),
                content_type='application/json'
            )
            
            # Generate and save heat map (placeholder for now)
            # In production, create actual heat map visualization
            heatmap_data = {
                'sessionId': self.session_id,
                'mousePositions': self.results['mousePositions'],
                'generated': datetime.utcnow().isoformat()
            }
            
            heatmap_blob = results_bucket.blob(f"{self.session_id}/heatmap.json")
            heatmap_blob.upload_from_string(
                json.dumps(heatmap_data, indent=2),
                content_type='application/json'
            )
            
            # Update Firestore
            doc_ref = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(self.session_id)
            doc_ref.update({
                'stats': self.results['stats'],
                'frictionPoints': self.results['frictionPoints'],
                'behaviorSummary': self.results['behaviorSummary'],
                'analysisCompleted': datetime.utcnow(),
                'resultsUri': f"gs://{Config.GCS_RESULTS_BUCKET}/{self.session_id}/",
                'agentProcessed': False  # Flag for agent processing
            })
            
            logger.info(f"Saved results for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error saving results: {str(e)}")
            raise
    
    def _update_status(self, status: str, error: str = None):
        """Update processing status in Firestore."""
        try:
            doc_ref = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(self.session_id)
            update_data = {
                'status': status,
                'lastUpdated': datetime.utcnow()
            }
            
            if error:
                update_data['error'] = error
            
            doc_ref.update(update_data)
            
        except Exception as e:
            logger.error(f"Error updating status: {str(e)}")
    
    def _notify_agent(self):
        """Notify agent service about completed analysis."""
        agent_webhook_url = os.getenv('AGENT_WEBHOOK_URL')
        if agent_webhook_url:
            try:
                import requests
                response = requests.post(
                    f"{agent_webhook_url}/webhook/session-completed",
                    json={'sessionId': self.session_id},
                    timeout=5
                )
                if response.status_code == 200:
                    logger.info(f"Agent notified for session {self.session_id}")
                else:
                    logger.warning(f"Agent notification failed: {response.status_code}")
            except Exception as e:
                logger.error(f"Error notifying agent: {str(e)}")


def process_message(message: message.Message):
    """Process a Pub/Sub message."""
    try:
        # Parse message
        data = json.loads(message.data.decode('utf-8'))
        session_id = data['sessionId']
        gcs_uri = data['gcsUri']
        
        logger.info(f"Processing message for session {session_id}")
        
        # Process video
        processor = VideoProcessor(session_id, gcs_uri)
        processor.process()
        
        # Acknowledge message
        message.ack()
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        # Don't acknowledge - let it retry
        message.nack()


def main():
    """Main entry point for the video processor service."""
    logger.info("Starting video processor service")
    
    # Validate configuration
    try:
        Config.validate()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        exit(1)
    
    # Set up subscriber
    flow_control = pubsub_v1.types.FlowControl(max_messages=1)
    
    # Start pulling messages
    streaming_pull_future = subscriber.subscribe(
        subscription_path,
        callback=process_message,
        flow_control=flow_control
    )
    
    logger.info(f"Listening for messages on {subscription_path}")
    
    # Keep the main thread running
    with subscriber:
        try:
            streaming_pull_future.result()
        except KeyboardInterrupt:
            streaming_pull_future.cancel()
            streaming_pull_future.result()  # Block until cancel is complete


if __name__ == '__main__':
    main()
