"""Enhanced video processor with dual-stream handling and improved analytics."""

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
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from typing import List, Dict, Any, Tuple, Optional
import time
from collections import defaultdict
import subprocess

from config import Config
from mouse_tracker import generate_heat_map

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud clients
storage_client = storage.Client(project=Config.GOOGLE_CLOUD_PROJECT)
firestore_client = firestore.Client(project=Config.GOOGLE_CLOUD_PROJECT)
os.environ['GOOGLE_CLOUD_PROJECT'] = Config.GOOGLE_CLOUD_PROJECT
subscriber = pubsub_v1.SubscriberClient()

# Initialize Anthropic client
anthropic_client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

# Subscription path
subscription_path = subscriber.subscription_path(
    Config.GOOGLE_CLOUD_PROJECT, 
    Config.PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR
)


class EnhancedVideoProcessor:
    """Enhanced video processor with dual-stream handling and advanced analytics."""
    
    def __init__(self, session_id: str, gcs_uri: str):
        self.session_id = session_id
        self.gcs_uri = gcs_uri
        self.temp_dir = None
        self.video_path = None
        self.playback_video_path = None
        self.frames_dir = None
        self.results = {
            'sessionId': session_id,
            'frameAnalyses': [],
            'mousePositions': [],
            'frictionPoints': [],
            'stats': {},
            'behaviorSummary': '',
            'userJourney': [],
            'keyMoments': [],
            'events': [],
            'funnelMetrics': {},
            'uiElements': []
        }
    
    def process(self):
        """Enhanced processing pipeline."""
        try:
            logger.info(f"Starting enhanced processing for session {self.session_id}")
            
            # Update status in Firestore
            self._update_status('processing')
            
            # Create temporary directory
            self.temp_dir = tempfile.mkdtemp()
            self.frames_dir = os.path.join(self.temp_dir, 'frames')
            os.makedirs(self.frames_dir)
            
            # Download video
            self._download_video()
            
            # Create dual streams (high-res for playback, optimized for analysis)
            self._create_dual_streams()
            
            # Extract frames with higher quality
            frame_count = self._extract_frames_enhanced()
            self.results['stats']['totalFrames'] = frame_count
            
            # Enhanced mouse tracking (every frame for precision)
            self._track_mouse_enhanced()
            
            # Detect UI elements and interactions
            self._detect_ui_elements()
            
            # Analyze events and create funnel
            self._analyze_events_enhanced()
            
            # Extract key moments
            self._extract_key_moments()
            
            # Analyze key frames with AI
            self._analyze_frames_enhanced()
            
            # Generate user journey narrative
            self._generate_user_journey()
            
            # Generate comprehensive behavior summary
            self._generate_enhanced_summary()
            
            # Save all results
            self._save_enhanced_results()
            
            # Update status
            self._update_status('completed')
            
            # Notify agent service
            self._notify_agent()
            
            logger.info(f"Completed enhanced processing for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error in enhanced processing: {str(e)}")
            self._update_status('failed', error=str(e))
            raise
        
        finally:
            # Cleanup temp files
            if self.temp_dir and os.path.exists(self.temp_dir):
                import shutil
                shutil.rmtree(self.temp_dir)
    
    def _download_video(self):
        """Download video from GCS to local temp directory."""
        bucket_name = self.gcs_uri.split('/')[2]
        blob_path = '/'.join(self.gcs_uri.split('/')[3:])
        
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        self.video_path = os.path.join(self.temp_dir, 'original_video.mp4')
        blob.download_to_filename(self.video_path)
        
        logger.info(f"Downloaded video to {self.video_path}")
    
    def _create_dual_streams(self):
        """Create dual video streams: high-res for playback, optimized for analysis."""
        try:
            # Create high-quality version for playback
            self.playback_video_path = os.path.join(self.temp_dir, 'playback_video.mp4')
            
            # Preserve original quality for playback
            (
                ffmpeg
                .input(self.video_path)
                .output(self.playback_video_path, 
                       vcodec='libx264',
                       crf=23,  # High quality
                       preset='medium',
                       acodec='aac')
                .overwrite_output()
                .run(quiet=True)
            )
            
            # Create optimized version for analysis (keep original for now)
            # In production, you might downsample here if needed
            
            logger.info("Created dual video streams")
            
        except Exception as e:
            logger.error(f"Error creating dual streams: {str(e)}")
            # Fall back to using original
            self.playback_video_path = self.video_path
    
    def _extract_frames_enhanced(self):
        """Extract frames at higher quality for better analysis."""
        try:
            # Get video info
            probe = ffmpeg.probe(self.video_path)
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            fps = eval(video_info['r_frame_rate'])
            duration = float(probe['format']['duration'])
            width = int(video_info['width'])
            height = int(video_info['height'])
            
            # Extract frames at 2 FPS for better temporal resolution
            extraction_fps = 2
            (
                ffmpeg
                .input(self.video_path)
                .filter('fps', fps=extraction_fps)
                .output(os.path.join(self.frames_dir, 'frame_%06d.png'),
                       format='image2',
                       pix_fmt='rgb24',
                       s=f'{width}x{height}')  # Preserve resolution
                .overwrite_output()
                .run(quiet=True)
            )
            
            # Count extracted frames
            frame_files = [f for f in os.listdir(self.frames_dir) if f.endswith('.png')]
            frame_count = len(frame_files)
            
            self.results['stats']['videoDuration'] = duration
            self.results['stats']['fps'] = fps
            self.results['stats']['resolution'] = f"{width}x{height}"
            self.results['stats']['extractionFps'] = extraction_fps
            
            logger.info(f"Extracted {frame_count} frames at {extraction_fps} FPS")
            return frame_count
            
        except Exception as e:
            logger.error(f"Error extracting frames: {str(e)}")
            raise
    
    def _track_mouse_enhanced(self):
        """Enhanced mouse tracking with per-frame precision."""
        frame_files = sorted([f for f in os.listdir(self.frames_dir) if f.endswith('.png')])
        
        # Use template matching for better cursor detection
        cursor_template = self._create_cursor_template()
        
        for idx, frame_file in enumerate(frame_files):
            frame_path = os.path.join(self.frames_dir, frame_file)
            
            try:
                frame = cv2.imread(frame_path)
                
                # Try template matching first
                cursor_pos = self._detect_cursor_template(frame, cursor_template)
                
                # Fall back to color-based detection
                if cursor_pos is None:
                    cursor_pos = self._detect_cursor_color(frame)
                
                if cursor_pos:
                    # Calculate actual timestamp based on extraction FPS
                    timestamp = idx / self.results['stats']['extractionFps']
                    
                    self.results['mousePositions'].append({
                        'frameIndex': idx,
                        'timestamp': timestamp,
                        'x': cursor_pos[0],
                        'y': cursor_pos[1],
                        'confidence': cursor_pos[2] if len(cursor_pos) > 2 else 1.0
                    })
                
            except Exception as e:
                logger.warning(f"Error tracking mouse in frame {idx}: {str(e)}")
        
        logger.info(f"Tracked {len(self.results['mousePositions'])} mouse positions")
        
        # Calculate movement statistics
        self._calculate_movement_stats_enhanced()
    
    def _create_cursor_template(self):
        """Create cursor templates for template matching."""
        # Create common cursor shapes
        templates = []
        
        # Arrow cursor
        arrow = np.zeros((19, 12), dtype=np.uint8)
        arrow[0:15, 0:8] = 255  # Simplified arrow shape
        templates.append(arrow)
        
        # Hand cursor
        hand = np.zeros((20, 16), dtype=np.uint8)
        hand[5:18, 3:13] = 255  # Simplified hand shape
        templates.append(hand)
        
        return templates
    
    def _detect_cursor_template(self, frame, templates):
        """Detect cursor using template matching."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        best_match = None
        best_score = 0
        
        for template in templates:
            result = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
            
            if max_val > best_score and max_val > 0.7:  # Threshold
                best_score = max_val
                best_match = (max_loc[0], max_loc[1], max_val)
        
        return best_match
    
    def _detect_cursor_color(self, frame):
        """Improved color-based cursor detection."""
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Multiple cursor color ranges
        cursor_masks = []
        
        # White cursor
        lower_white = np.array([0, 0, 200])
        upper_white = np.array([180, 30, 255])
        cursor_masks.append(cv2.inRange(hsv, lower_white, upper_white))
        
        # Black cursor  
        lower_black = np.array([0, 0, 0])
        upper_black = np.array([180, 255, 30])
        cursor_masks.append(cv2.inRange(hsv, lower_black, upper_black))
        
        # Blue cursor (common in some UIs)
        lower_blue = np.array([100, 50, 50])
        upper_blue = np.array([130, 255, 255])
        cursor_masks.append(cv2.inRange(hsv, lower_blue, upper_blue))
        
        # Combine masks
        combined_mask = cursor_masks[0]
        for mask in cursor_masks[1:]:
            combined_mask = cv2.bitwise_or(combined_mask, mask)
        
        # Morphological operations to clean up
        kernel = np.ones((3, 3), np.uint8)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Filter by size and shape
            valid_contours = []
            for contour in contours:
                area = cv2.contourArea(contour)
                if 10 < area < 500:  # Reasonable cursor size
                    x, y, w, h = cv2.boundingRect(contour)
                    aspect_ratio = w / h if h > 0 else 0
                    if 0.3 < aspect_ratio < 3:  # Reasonable aspect ratio
                        valid_contours.append(contour)
            
            if valid_contours:
                # Use the largest valid contour
                largest_contour = max(valid_contours, key=cv2.contourArea)
                M = cv2.moments(largest_contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    return (cx, cy, 0.8)  # Lower confidence for color detection
        
        return None
    
    def _calculate_movement_stats_enhanced(self):
        """Enhanced movement statistics calculation."""
        positions = self.results['mousePositions']
        if len(positions) < 2:
            return
        
        total_distance = 0
        speeds = []
        accelerations = []
        direction_changes = 0
        
        for i in range(1, len(positions)):
            prev_pos = positions[i-1]
            curr_pos = positions[i]
            
            # Calculate distance
            dx = curr_pos['x'] - prev_pos['x']
            dy = curr_pos['y'] - prev_pos['y']
            distance = np.sqrt(dx*dx + dy*dy)
            total_distance += distance
            
            # Calculate speed
            time_diff = curr_pos['timestamp'] - prev_pos['timestamp']
            if time_diff > 0:
                speed = distance / time_diff
                speeds.append(speed)
                
                # Calculate acceleration
                if i > 1 and len(speeds) > 1:
                    prev_speed = speeds[-2]
                    acceleration = (speed - prev_speed) / time_diff
                    accelerations.append(acceleration)
                
                # Detect direction changes
                if i > 1:
                    prev_prev_pos = positions[i-2]
                    prev_dx = prev_pos['x'] - prev_prev_pos['x']
                    prev_dy = prev_pos['y'] - prev_prev_pos['y']
                    
                    # Calculate angle change
                    if (prev_dx != 0 or prev_dy != 0) and (dx != 0 or dy != 0):
                        angle1 = np.arctan2(prev_dy, prev_dx)
                        angle2 = np.arctan2(dy, dx)
                        angle_diff = abs(angle2 - angle1)
                        if angle_diff > np.pi:
                            angle_diff = 2 * np.pi - angle_diff
                        if angle_diff > np.pi / 4:  # 45 degrees
                            direction_changes += 1
        
        # Update enhanced stats
        self.results['stats']['totalMovements'] = len(positions)
        self.results['stats']['totalDistance'] = float(total_distance)
        self.results['stats']['averageSpeed'] = float(np.mean(speeds)) if speeds else 0.0
        self.results['stats']['maxSpeed'] = float(np.max(speeds)) if speeds else 0.0
        self.results['stats']['minSpeed'] = float(np.min(speeds)) if speeds else 0.0
        self.results['stats']['speedStdDev'] = float(np.std(speeds)) if speeds else 0.0
        self.results['stats']['averageAcceleration'] = float(np.mean(accelerations)) if accelerations else 0.0
        self.results['stats']['directionChanges'] = direction_changes
    
    def _detect_ui_elements(self):
        """Detect UI elements in frames using computer vision."""
        # Sample key frames for UI detection
        frame_files = sorted([f for f in os.listdir(self.frames_dir) if f.endswith('.png')])
        sample_indices = list(range(0, len(frame_files), max(1, len(frame_files) // 10)))
        
        for idx in sample_indices[:5]:  # Analyze up to 5 frames
            frame_path = os.path.join(self.frames_dir, frame_files[idx])
            
            try:
                frame = cv2.imread(frame_path)
                
                # Detect buttons and clickable elements
                ui_elements = self._detect_buttons_and_links(frame)
                
                for element in ui_elements:
                    element['frameIndex'] = idx
                    element['timestamp'] = idx / self.results['stats']['extractionFps']
                    self.results['uiElements'].append(element)
                
            except Exception as e:
                logger.warning(f"Error detecting UI elements in frame {idx}: {str(e)}")
        
        logger.info(f"Detected {len(self.results['uiElements'])} UI elements")
    
    def _detect_buttons_and_links(self, frame):
        """Detect buttons and clickable elements in a frame."""
        elements = []
        
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Edge detection
        edges = cv2.Canny(gray, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            # Get bounding box
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter by size (potential buttons)
            if 20 < w < 300 and 15 < h < 100 and 0.2 < w/h < 5:
                # Check if it looks like a button (rectangular with reasonable aspect ratio)
                roi = frame[y:y+h, x:x+w]
                
                # Simple heuristic: buttons often have uniform color or gradient
                color_variance = np.var(roi)
                
                if color_variance < 5000:  # Relatively uniform
                    elements.append({
                        'type': 'button',
                        'bounds': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                        'confidence': 0.7
                    })
        
        return elements
    
    def _analyze_events_enhanced(self):
        """Enhanced event analysis with UI element interaction detection."""
        positions = self.results['mousePositions']
        if len(positions) < 2:
            return
        
        events = []
        clicks = []
        scrolls = []
        hovers = []
        
        # Detect various event types
        for i in range(1, len(positions) - 1):
            prev_pos = positions[i-1]
            curr_pos = positions[i]
            next_pos = positions[i+1] if i+1 < len(positions) else curr_pos
            
            # Calculate movements
            delta1 = np.sqrt((curr_pos['x'] - prev_pos['x'])**2 + (curr_pos['y'] - prev_pos['y'])**2)
            delta2 = np.sqrt((next_pos['x'] - curr_pos['x'])**2 + (next_pos['y'] - curr_pos['y'])**2)
            
            # Detect clicks (movement then pause)
            if delta1 > 20 and delta2 < 5:
                # Check if click is on a UI element
                clicked_element = self._find_ui_element_at_position(curr_pos['x'], curr_pos['y'], curr_pos['frameIndex'])
                
                click_event = {
                    'type': 'click',
                    'frameIndex': curr_pos['frameIndex'],
                    'timestamp': curr_pos['timestamp'],
                    'x': curr_pos['x'],
                    'y': curr_pos['y'],
                    'intensity': float(delta1),
                    'targetElement': clicked_element
                }
                events.append(click_event)
                clicks.append(click_event)
            
            # Detect hover (pause without click)
            elif delta1 < 10 and delta2 < 10:
                hover_duration = next_pos['timestamp'] - curr_pos['timestamp']
                if hover_duration > 0.5:  # Hover for more than 0.5s
                    hovered_element = self._find_ui_element_at_position(curr_pos['x'], curr_pos['y'], curr_pos['frameIndex'])
                    
                    hover_event = {
                        'type': 'hover',
                        'frameIndex': curr_pos['frameIndex'],
                        'timestamp': curr_pos['timestamp'],
                        'x': curr_pos['x'],
                        'y': curr_pos['y'],
                        'duration': hover_duration,
                        'targetElement': hovered_element
                    }
                    events.append(hover_event)
                    hovers.append(hover_event)
        
        # Detect scrolling patterns
        window_size = 5
        for i in range(window_size, len(positions) - window_size):
            y_positions = [positions[j]['y'] for j in range(i-window_size, i+window_size)]
            y_trend = y_positions[-1] - y_positions[0]
            
            if abs(y_trend) > 50:
                scroll_event = {
                    'type': 'scroll',
                    'frameIndex': positions[i]['frameIndex'],
                    'timestamp': positions[i]['timestamp'],
                    'direction': 'down' if y_trend > 0 else 'up',
                    'magnitude': abs(float(y_trend)),
                    'speed': abs(y_trend) / (positions[i+window_size-1]['timestamp'] - positions[i-window_size]['timestamp'])
                }
                events.append(scroll_event)
                scrolls.append(scroll_event)
        
        # Detect rage clicks
        rage_clicks = self._detect_rage_clicks(clicks)
        events.extend(rage_clicks)
        
        # Sort events by timestamp
        events.sort(key=lambda x: x['timestamp'])
        
        # Update results
        self.results['events'] = events
        self.results['stats']['totalClicks'] = len(clicks)
        self.results['stats']['totalScrolls'] = len(scrolls)
        self.results['stats']['totalHovers'] = len(hovers)
        self.results['stats']['rageClicks'] = len(rage_clicks)
        
        # Analyze funnel metrics
        self._analyze_funnel_metrics(events)
        
        logger.info(f"Detected {len(events)} events: {len(clicks)} clicks, {len(scrolls)} scrolls, {len(hovers)} hovers")
    
    def _find_ui_element_at_position(self, x, y, frame_index):
        """Find UI element at given position."""
        for element in self.results['uiElements']:
            if abs(element['frameIndex'] - frame_index) < 5:  # Within 5 frames
                bounds = element['bounds']
                if (bounds['x'] <= x <= bounds['x'] + bounds['width'] and
                    bounds['y'] <= y <= bounds['y'] + bounds['height']):
                    return element
        return None
    
    def _detect_rage_clicks(self, clicks):
        """Detect rage click patterns."""
        rage_clicks = []
        
        # Group clicks by proximity in time and space
        click_groups = []
        for click in clicks:
            added = False
            for group in click_groups:
                # Check if click belongs to existing group
                if (abs(click['timestamp'] - group[0]['timestamp']) < 2 and  # Within 2 seconds
                    np.sqrt((click['x'] - group[0]['x'])**2 + (click['y'] - group[0]['y'])**2) < 50):  # Within 50 pixels
                    group.append(click)
                    added = True
                    break
            
            if not added:
                click_groups.append([click])
        
        # Identify rage click groups
        for group in click_groups:
            if len(group) >= 3:  # 3+ rapid clicks
                rage_click = {
                    'type': 'rage_click',
                    'frameIndex': group[0]['frameIndex'],
                    'timestamp': group[0]['timestamp'],
                    'x': int(np.mean([c['x'] for c in group])),
                    'y': int(np.mean([c['y'] for c in group])),
                    'clickCount': len(group),
                    'duration': group[-1]['timestamp'] - group[0]['timestamp'],
                    'targetElement': group[0].get('targetElement')
                }
                rage_clicks.append(rage_click)
                
                # Add as friction point
                self.results['frictionPoints'].append({
                    'type': 'rage_click',
                    'frameIndex': rage_click['frameIndex'],
                    'timestamp': rage_click['timestamp'],
                    'severity': 'high',
                    'description': f"User performed {rage_click['clickCount']} rapid clicks in {rage_click['duration']:.1f}s, indicating frustration with potentially unresponsive UI",
                    'recommendation': 'Check if the clicked element is properly responsive and provides adequate feedback'
                })
        
        return rage_clicks
    
    def _analyze_funnel_metrics(self, events):
        """Analyze user funnel and conversion metrics."""
        # Define common funnel stages based on events
        funnel_stages = {
            'page_load': {'completed': False, 'timestamp': 0},
            'first_interaction': {'completed': False, 'timestamp': None},
            'form_start': {'completed': False, 'timestamp': None},
            'form_complete': {'completed': False, 'timestamp': None},
            'cta_click': {'completed': False, 'timestamp': None},
            'conversion': {'completed': False, 'timestamp': None}
        }
        
        # Track funnel progression
        for event in events:
            # First interaction
            if not funnel_stages['first_interaction']['completed'] and event['type'] in ['click', 'hover']:
                funnel_stages['first_interaction']['completed'] = True
                funnel_stages['first_interaction']['timestamp'] = event['timestamp']
            
            # Form interactions (heuristic based on multiple clicks in similar area)
            if event['type'] == 'click' and event.get('targetElement'):
                if event['targetElement']['type'] == 'button':
                    if not funnel_stages['cta_click']['completed']:
                        funnel_stages['cta_click']['completed'] = True
                        funnel_stages['cta_click']['timestamp'] = event['timestamp']
        
        # Calculate funnel metrics
        completed_stages = sum(1 for stage in funnel_stages.values() if stage['completed'])
        total_stages = len(funnel_stages)
        
        self.results['funnelMetrics'] = {
            'stages': funnel_stages,
            'completionRate': completed_stages / total_stages,
            'dropoffPoints': [name for name, stage in funnel_stages.items() if not stage['completed']],
            'timeToFirstInteraction': funnel_stages['first_interaction']['timestamp'] if funnel_stages['first_interaction']['completed'] else None
        }
    
    def _extract_key_moments(self):
        """Extract key moments from the user session."""
        key_moments = []
        
        # Add first interaction
        first_click = next((e for e in self.results['events'] if e['type'] == 'click'), None)
        if first_click:
            key_moments.append({
                'type': 'first_interaction',
                'timestamp': first_click['timestamp'],
                'frameIndex': first_click['frameIndex'],
                'description': 'User made their first click',
                'icon': '🖱️'
            })
        
        # Add rage clicks as key moments
        for fp in self.results['frictionPoints']:
            if fp['type'] == 'rage_click':
                key_moments.append({
                    'type': 'friction',
                    'timestamp': fp['timestamp'],
                    'frameIndex': fp['frameIndex'],
                    'description': fp['description'],
                    'icon': '😤'
                })
        
        # Add long pauses as key moments
        if self.results['mousePositions']:
            for i in range(1, len(self.results['mousePositions'])):
                time_diff = self.results['mousePositions'][i]['timestamp'] - self.results['mousePositions'][i-1]['timestamp']
                if time_diff > 3:  # Pause longer than 3 seconds
                    key_moments.append({
                        'type': 'pause',
                        'timestamp': self.results['mousePositions'][i]['timestamp'],
                        'frameIndex': self.results['mousePositions'][i]['frameIndex'],
                        'description': f'User paused for {time_diff:.1f} seconds',
                        'icon': '⏸️'
                    })
        
        # Sort by timestamp
        key_moments.sort(key=lambda x: x['timestamp'])
        
        self.results['keyMoments'] = key_moments[:10]  # Top 10 moments
        logger.info(f"Extracted {len(key_moments)} key moments")
    
    def _analyze_frames_enhanced(self):
        """Enhanced frame analysis with better AI prompts."""
        frame_files = sorted([f for f in os.listdir(self.frames_dir) if f.endswith('.png')])
        
        # Select key frames based on events and key moments
        key_indices = set()
        
        # Add frames where key events occurred
        for event in self.results['events'][:20]:  # Top 20 events
            key_indices.add(event['frameIndex'])
        
        # Add frames for key moments
        for moment in self.results['keyMoments']:
            key_indices.add(moment['frameIndex'])
        
        # Ensure we have at least 6 frames evenly distributed
        if len(key_indices) < 6:
            step = max(1, len(frame_files) // 6)
            for i in range(0, len(frame_files), step):
                key_indices.add(i)
                if len(key_indices) >= 6:
                    break
        
        # Analyze selected frames
        for idx in sorted(list(key_indices))[:8]:  # Analyze up to 8 key frames
            if idx >= len(frame_files):
                continue
                
            frame_path = os.path.join(self.frames_dir, frame_files[idx])
            
            try:
                # Read and encode frame
                with open(frame_path, 'rb') as f:
                    image_data = f.read()
                
                # Convert to base64
                base64_image = base64.b64encode(image_data).decode('utf-8')
                
                # Get context about what's happening at this frame
                frame_context = []
                for event in self.results['events']:
                    if abs(event['frameIndex'] - idx) < 2:
                        frame_context.append(f"{event['type']} at ({event['x']}, {event['y']})")
                
                context_str = "User actions near this frame: " + ", ".join(frame_context) if frame_context else "No specific actions detected"
                
                # Enhanced AI prompt
                response = anthropic_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=400,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"""Analyze this screenshot from a user session recording. {context_str}

Please identify:
1. What is the user trying to accomplish in this screen?
2. Any visible UI issues, errors, or confusion indicators
3. The user's emotional state based on interaction patterns
4. Specific friction points or obstacles
5. What UI element is the focus of attention

Be specific about locations and describe exactly what you see."""
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
                    'timestamp': idx / self.results['stats']['extractionFps'],
                    'analysisText': analysis_text,
                    'context': frame_context
                })
                
                # Extract specific friction indicators
                friction_keywords = ['error', 'confusion', 'stuck', 'unclear', 'frustration', 'difficult', 'problem', 'issue']
                if any(keyword in analysis_text.lower() for keyword in friction_keywords):
                    self.results['frictionPoints'].append({
                        'type': 'ui_confusion',
                        'frameIndex': idx,
                        'timestamp': idx / self.results['stats']['extractionFps'],
                        'severity': 'medium',
                        'description': analysis_text[:200],
                        'recommendation': 'Review UI design and user flow at this point'
                    })
                
                # Rate limiting
                time.sleep(0.2)
                
            except Exception as e:
                logger.error(f"Error analyzing frame {idx}: {str(e)}")
        
        logger.info(f"Analyzed {len(self.results['frameAnalyses'])} key frames")
    
    def _generate_user_journey(self):
        """Generate a narrative of the user's journey through the session."""
        journey_points = []
        
        # Start of session
        journey_points.append({
            'timestamp': 0,
            'type': 'session_start',
            'description': 'User started the session',
            'icon': '🚀'
        })
        
        # Add all events with descriptions
        for event in self.results['events']:
            if event['type'] == 'click':
                desc = f"Clicked at ({event['x']}, {event['y']})"
                if event.get('targetElement'):
                    desc += f" on a {event['targetElement']['type']}"
                journey_points.append({
                    'timestamp': event['timestamp'],
                    'type': 'interaction',
                    'description': desc,
                    'icon': '🖱️'
                })
            elif event['type'] == 'scroll':
                journey_points.append({
                    'timestamp': event['timestamp'],
                    'type': 'navigation',
                    'description': f"Scrolled {event['direction']} ({event['magnitude']:.0f}px)",
                    'icon': '📜'
                })
            elif event['type'] == 'hover':
                desc = f"Hovered for {event['duration']:.1f}s"
                if event.get('targetElement'):
                    desc += f" over a {event['targetElement']['type']}"
                journey_points.append({
                    'timestamp': event['timestamp'],
                    'type': 'exploration',
                    'description': desc,
                    'icon': '👀'
                })
            elif event['type'] == 'rage_click':
                journey_points.append({
                    'timestamp': event['timestamp'],
                    'type': 'frustration',
                    'description': f"Rage clicked {event['clickCount']} times - user frustrated",
                    'icon': '😤'
                })
        
        # Add friction points
        for fp in self.results['frictionPoints']:
            if fp['type'] != 'rage_click':  # Avoid duplicates
                journey_points.append({
                    'timestamp': fp['timestamp'],
                    'type': 'friction',
                    'description': fp['description'][:100],
                    'icon': '⚠️'
                })
        
        # Add pauses
        for moment in self.results['keyMoments']:
            if moment['type'] == 'pause':
                journey_points.append({
                    'timestamp': moment['timestamp'],
                    'type': 'pause',
                    'description': moment['description'],
                    'icon': moment['icon']
                })
        
        # Sort by timestamp
        journey_points.sort(key=lambda x: x['timestamp'])
        
        # Generate narrative
        narrative_parts = []
        for i, point in enumerate(journey_points):
            time_str = f"{point['timestamp']:.1f}s"
            narrative_parts.append(f"{point['icon']} At {time_str}: {point['description']}")
        
        self.results['userJourney'] = journey_points
        self.results['userJourneyNarrative'] = "\n".join(narrative_parts)
        
        logger.info(f"Generated user journey with {len(journey_points)} points")
    
    def _generate_enhanced_summary(self):
        """Generate comprehensive behavior summary with actionable insights."""
        try:
            # Prepare comprehensive context
            frame_analyses = "\n\n".join([
                f"Frame at {fa['timestamp']:.1f}s: {fa['analysisText']}"
                for fa in self.results['frameAnalyses']
            ])
            
            # Movement patterns
            movement_summary = f"""
Mouse Movement Analysis:
- Total positions tracked: {len(self.results['mousePositions'])}
- Average speed: {self.results['stats']['averageSpeed']:.1f} px/s
- Total distance: {self.results['stats']['totalDistance']:.1f} px
- Direction changes: {self.results['stats']['directionChanges']}
"""
            
            # Event summary
            event_summary = f"""
User Interactions:
- Clicks: {self.results['stats']['totalClicks']}
- Scrolls: {self.results['stats']['totalScrolls']}
- Hovers: {self.results['stats']['totalHovers']}
- Rage clicks: {self.results['stats']['rageClicks']}
"""
            
            # Friction summary
            friction_summary = "\n".join([
                f"- {fp['type']}: {fp['description'][:100]}"
                for fp in self.results['frictionPoints'][:5]
            ])
            
            # Journey highlights
            journey_highlights = "\n".join([
                f"- {jp['description']}"
                for jp in self.results['userJourney']
                if jp['type'] in ['frustration', 'friction', 'pause']
            ][:5])
            
            # Generate comprehensive summary
            response = anthropic_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=800,
                messages=[{
                    "role": "user",
                    "content": f"""Based on this comprehensive user session analysis:

FRAME ANALYSES:
{frame_analyses}

{movement_summary}

{event_summary}

KEY FRICTION POINTS:
{friction_summary}

JOURNEY HIGHLIGHTS:
{journey_highlights}

Please provide:

1. EXECUTIVE SUMMARY (2-3 sentences about the overall user experience)

2. USER BEHAVIOR PATTERNS:
   - Primary user goal/intent
   - Navigation patterns
   - Interaction style (confident, hesitant, frustrated, etc.)

3. CRITICAL FRICTION POINTS:
   - Top 3 issues with severity levels
   - Root causes
   - User impact

4. ACTIONABLE RECOMMENDATIONS:
   - Immediate fixes (quick wins)
   - Medium-term improvements
   - Long-term UX enhancements

5. POSITIVE OBSERVATIONS:
   - What worked well
   - Smooth interactions

Format as clear sections with bullet points. Be specific and actionable."""
                }]
            )
            
            self.results['behaviorSummary'] = response.content[0].text
            
            # Extract severity scores
            high_severity = len([fp for fp in self.results['frictionPoints'] if fp.get('severity') == 'high'])
            medium_severity = len([fp for fp in self.results['frictionPoints'] if fp.get('severity') == 'medium'])
            
            self.results['stats']['frictionSeverity'] = {
                'high': high_severity,
                'medium': medium_severity,
                'low': len(self.results['frictionPoints']) - high_severity - medium_severity
            }
            
        except Exception as e:
            logger.error(f"Error generating enhanced summary: {str(e)}")
            self.results['behaviorSummary'] = "Error generating summary"
    
    def _save_enhanced_results(self):
        """Save all enhanced analysis results."""
        try:
            # Save to Cloud Storage
            results_bucket = storage_client.bucket(Config.GCS_RESULTS_BUCKET)
            
            # Save enhanced JSON results
            json_blob = results_bucket.blob(f"{self.session_id}/analysis_enhanced.json")
            json_blob.upload_from_string(
                json.dumps(self.results, indent=2),
                content_type='application/json'
            )
            
            # Save high-quality playback video
            if self.playback_video_path and os.path.exists(self.playback_video_path):
                playback_blob = results_bucket.blob(f"{self.session_id}/playback_video.mp4")
                with open(self.playback_video_path, 'rb') as f:
                    playback_blob.upload_from_file(f, content_type='video/mp4')
                
                self.results['playbackVideoUrl'] = f"gs://{Config.GCS_RESULTS_BUCKET}/{self.session_id}/playback_video.mp4"
            
            # Generate and save enhanced heat map
            heatmap_url = None
            if self.results['mousePositions']:
                heatmap_path = os.path.join(self.temp_dir, 'heatmap_enhanced.png')
                
                # Generate high-quality heat map
                self._generate_enhanced_heatmap(heatmap_path)
                
                # Upload heat map
                heatmap_blob = results_bucket.blob(f"{self.session_id}/heatmap_enhanced.png")
                with open(heatmap_path, 'rb') as f:
                    heatmap_blob.upload_from_file(f, content_type='image/png')
                
                heatmap_url = f"gs://{Config.GCS_RESULTS_BUCKET}/{self.session_id}/heatmap_enhanced.png"
            
            # Save mouse trail data
            trail_blob = results_bucket.blob(f"{self.session_id}/mouse_trail.json")
            trail_blob.upload_from_string(
                json.dumps({
                    'positions': self.results['mousePositions'],
                    'resolution': self.results['stats'].get('resolution', '1920x1080')
                }, indent=2),
                content_type='application/json'
            )
            
            # Update Firestore with enhanced data
            doc_ref = firestore_client.collection(Config.FIRESTORE_COLLECTION_SESSIONS).document(self.session_id)
            update_data = {
                'stats': self.results['stats'],
                'frictionPoints': self.results['frictionPoints'],
                'behaviorSummary': self.results['behaviorSummary'],
                'userJourney': self.results['userJourney'][:20],  # Store top 20 journey points
                'keyMoments': self.results['keyMoments'],
                'funnelMetrics': self.results['funnelMetrics'],
                'analysisCompleted': datetime.utcnow(),
                'resultsUri': f"gs://{Config.GCS_RESULTS_BUCKET}/{self.session_id}/",
                'playbackVideoUrl': self.results.get('playbackVideoUrl'),
                'heatmapUrl': heatmap_url,
                'enhanced': True,  # Flag for enhanced processing
                'agentProcessed': False
            }
            
            doc_ref.update(update_data)
            
            logger.info(f"Saved enhanced results for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"Error saving enhanced results: {str(e)}")
            raise
    
    def _generate_enhanced_heatmap(self, output_path):
        """Generate an enhanced heat map with better visualization."""
        positions = self.results['mousePositions']
        if not positions:
            return
        
        # Get video dimensions
        resolution = self.results['stats'].get('resolution', '1920x1080').split('x')
        width = int(resolution[0])
        height = int(resolution[1])
        
        # Create high-resolution heat map
        fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
        
        # Extract x, y coordinates
        x_coords = [pos['x'] for pos in positions]
        y_coords = [pos['y'] for pos in positions]
        
        # Create 2D histogram
        heatmap, xedges, yedges = np.histogram2d(x_coords, y_coords, bins=[width//20, height//20])
        
        # Apply Gaussian smoothing for better visualization
        from scipy.ndimage import gaussian_filter
        heatmap = gaussian_filter(heatmap.T, sigma=2)
        
        # Create the heat map
        im = ax.imshow(heatmap, extent=[0, width, height, 0], 
                      cmap='hot', interpolation='bilinear', alpha=0.8)
        
        # Add color bar
        cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
        cbar.set_label('Mouse Activity Intensity', rotation=270, labelpad=15)
        
        # Style the plot
        ax.set_xlim(0, width)
        ax.set_ylim(height, 0)  # Invert y-axis for image coordinates
        ax.set_xlabel('X Position (pixels)')
        ax.set_ylabel('Y Position (pixels)')
        ax.set_title(f'User Activity Heat Map - Session {self.session_id}')
        
        # Remove tick marks for cleaner look
        ax.set_xticks([])
        ax.set_yticks([])
        
        # Add grid
        ax.grid(True, alpha=0.1)
        
        # Save with high quality
        plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='black')
        plt.close()
    
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
                
                # Include friction severity in notification
                severity = self.results['stats'].get('frictionSeverity', {})
                
                response = requests.post(
                    f"{agent_webhook_url}/webhook/session-completed",
                    json={
                        'sessionId': self.session_id,
                        'frictionCount': len(self.results['frictionPoints']),
                        'highSeverityCount': severity.get('high', 0),
                        'rageClicks': self.results['stats'].get('rageClicks', 0)
                    },
                    timeout=5
                )
                if response.status_code == 200:
                    logger.info(f"Agent notified for session {self.session_id}")
                else:
                    logger.warning(f"Agent notification failed: {response.status_code}")
            except Exception as e:
                logger.error(f"Error notifying agent: {str(e)}")


def process_message(message: message.Message):
    """Process a Pub/Sub message using enhanced processor."""
    try:
        # Parse message
        data = json.loads(message.data.decode('utf-8'))
        session_id = data['sessionId']
        gcs_uri = data['gcsUri']
        
        logger.info(f"Processing message for session {session_id} with enhanced processor")
        
        # Use enhanced processor
        processor = EnhancedVideoProcessor(session_id, gcs_uri)
        processor.process()
        
        # Acknowledge message
        message.ack()
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        # Don't acknowledge - let it retry
        message.nack()


def main():
    """Main entry point for the enhanced video processor service."""
    logger.info("Starting enhanced video processor service")
    
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
