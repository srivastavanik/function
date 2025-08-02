#!/usr/bin/env python3
"""
Flask Web Application for Video Interaction Analysis
"""

import os
import sys
import subprocess
import tempfile
import shutil
import time
from pathlib import Path
from flask import Flask, request, render_template, jsonify, send_file
from werkzeug.utils import secure_filename
import json

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from mouse_tracker import (
    track_mouse_movement,
    track_mouse_movement_fast,
    analyze_movement_patterns,
    detect_friction_points,
    generate_heat_map,
    generate_movement_report,
    detect_cursor_position
)

from interaction_analyzer import (
    extract_interaction_frames,
    analyze_interaction_patterns,
    analyze_interaction_patterns_fast,
    analyze_user_behavior_patterns,
    generate_interaction_report
)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['RESULTS_FOLDER'] = 'results'

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def check_ffmpeg():
    """Check if ffmpeg is available."""
    try:
        subprocess.run(['ffmpeg', '-version'], 
                      capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def check_opencv():
    """Check if OpenCV is available."""
    try:
        import cv2
        return True
    except ImportError:
        return False

def run_interaction_analysis(video_path, analysis_id):
    """Run the complete interaction analysis pipeline."""
    try:
        # Get API key
        api_key = os.getenv('OPENROUTER_API_KEY')
        if not api_key:
            return {
                'error': 'OPENROUTER_API_KEY environment variable not set. Please set your API key.'
            }
        
        # Create output directories
        frames_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id, 'interaction_frames')
        analysis_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id, 'analysis')
        mouse_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id, 'mouse_analysis')
        os.makedirs(frames_dir, exist_ok=True)
        os.makedirs(analysis_dir, exist_ok=True)
        os.makedirs(mouse_dir, exist_ok=True)
        
        # 1. Extract interaction frames (reduced frequency for speed)
        print("🎬 Extracting interaction frames...")
        frame_count, frame_files = extract_interaction_frames(video_path, frames_dir, fps=1)  # Reduced from 2 to 1 FPS
        
        if frame_count == 0:
            return {'error': 'Failed to extract interaction frames from video'}
        
        # 2. Track mouse movements (sampled for speed)
        print("🖱️ Tracking mouse movements...")
        mouse_positions = track_mouse_movement_fast(video_path, mouse_dir)  # Use fast tracking
        
        if not mouse_positions:
            return {'error': 'No mouse movements detected in video'}
        
        # 3. Analyze movement patterns
        print("📊 Analyzing movement patterns...")
        movement_data = analyze_movement_patterns(mouse_positions)
        
        # 4. Detect friction points from mouse movements
        print("🚨 Detecting friction points...")
        friction_points = detect_friction_points(movement_data)
        
        # 5. Analyze interaction patterns with AI (reduced frames)
        print("🤖 Analyzing interaction patterns with AI...")
        interaction_analysis = analyze_interaction_patterns_fast(frames_dir, analysis_id)
        
        if not interaction_analysis or 'error' in interaction_analysis:
            return {'error': 'No interaction patterns were identified'}
        
        # 6. Analyze overall user behavior
        print("🧠 Analyzing user behavior patterns...")
        behavior_analysis = analyze_user_behavior_patterns(interaction_analysis.get('frame_analyses', []), {}, api_key)
        
        # 7. Generate heat map
        video_name = Path(video_path).stem
        heat_map_path = os.path.join(mouse_dir, f'mouse_heat_map_{video_name}.png')
        generate_heat_map(mouse_positions, heat_map_path)
        
        # 8. Generate reports
        timestamp = time.strftime('%Y%m%d_%H%M%S')
        
        # Mouse movement report
        mouse_report_path = os.path.join(mouse_dir, f'mouse_analysis_{video_name}_{timestamp}.md')
        generate_movement_report(movement_data, friction_points, video_name, mouse_report_path)
        
        # Interaction analysis report
        interaction_report_path = os.path.join(analysis_dir, f'interaction_analysis_{video_name}_{timestamp}.md')
        generate_interaction_report(interaction_analysis.get('frame_analyses', []), {}, behavior_analysis, video_name, interaction_report_path)
        
        # Create summary for web display
        summary = create_web_summary(movement_data, friction_points, interaction_analysis, behavior_analysis, frame_count)
        
        return {
            'success': True,
            'summary': summary,
            'frame_count': frame_count,
            'mouse_positions_count': len(mouse_positions),
            'friction_points': friction_points,
            'interaction_analysis': interaction_analysis,
            'behavior_analysis': behavior_analysis,
            'mouse_report_path': mouse_report_path,
            'interaction_report_path': interaction_report_path,
            'heat_map_path': heat_map_path
        }
        
    except Exception as e:
        return {'error': f'Analysis failed: {str(e)}'}

def create_web_summary(movement_data, friction_points, interaction_analysis, behavior_analysis, frame_count):
    """Create a summary suitable for web display."""
    summary = {
        'frames_analyzed': frame_count,
        'mouse_positions': movement_data.get('total_positions', 0),
        'total_movements': movement_data.get('total_movements', 0),
        'average_speed': movement_data.get('average_speed', 0),
        'friction_points': [],
        'interaction_patterns': [],
        'critical_issues': [],
        'recommendations': []
    }
    
    # Extract friction points from mouse tracking
    for point in friction_points:
        summary['friction_points'].append({
            'type': point['type'],
            'position': point['position'],
            'timestamp': point['timestamp'],
            'description': point['description']
        })
    
    # Extract interaction patterns from new format
    if interaction_analysis and 'frame_analyses' in interaction_analysis:
        for analysis in interaction_analysis['frame_analyses']:
            summary['interaction_patterns'].append({
                'frame': analysis.get('frame', 'Unknown'),
                'frame_index': analysis.get('frame', 'Unknown'),
                'analysis': analysis.get('analysis', '')
            })
    
    # Extract critical issues and recommendations from behavior analysis
    if behavior_analysis:
        # Simple parsing of the behavior analysis to extract key points
        lines = behavior_analysis.split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            if line.startswith('**') and line.endswith('**'):
                current_section = line.strip('*')
            elif line and current_section and line.startswith('-'):
                if 'friction' in current_section.lower() or 'problem' in current_section.lower():
                    summary['critical_issues'].append(line.strip('- '))
                elif 'solution' in current_section.lower() or 'recommendation' in current_section.lower():
                    summary['recommendations'].append(line.strip('- '))
    
    return summary

@app.route('/')
def index():
    """Main page."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and start analysis."""
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'})
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No file selected'})
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Please upload an MP4, AVI, MOV, or MKV file.'})
    
    if not check_ffmpeg():
        return jsonify({'error': 'ffmpeg is not installed. Please install ffmpeg to process videos.'})
    
    if not check_opencv():
        return jsonify({'error': 'OpenCV is not installed. Please install opencv-python: pip install opencv-python'})
    
    # Save uploaded file
    filename = secure_filename(file.filename)
    analysis_id = f"analysis_{int(time.time())}"
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{analysis_id}_{filename}")
    file.save(video_path)
    
    # Start analysis in background
    try:
        result = run_interaction_analysis(video_path, analysis_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {str(e)}'})

@app.route('/results/<analysis_id>')
def get_results(analysis_id):
    """Get analysis results."""
    analysis_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id)
    if not os.path.exists(analysis_dir):
        return jsonify({'error': 'Analysis not found'})
    
    # Look for the latest reports
    mouse_dir = os.path.join(analysis_dir, 'mouse_analysis')
    interaction_dir = os.path.join(analysis_dir, 'analysis')
    
    reports = {}
    
    if os.path.exists(mouse_dir):
        mouse_reports = list(Path(mouse_dir).glob('mouse_analysis_*.md'))
        if mouse_reports:
            latest_mouse_report = max(mouse_reports, key=os.path.getctime)
            with open(latest_mouse_report, 'r') as f:
                reports['mouse_report'] = f.read()
    
    if os.path.exists(interaction_dir):
        interaction_reports = list(Path(interaction_dir).glob('interaction_analysis_*.md'))
        if interaction_reports:
            latest_interaction_report = max(interaction_reports, key=os.path.getctime)
            with open(latest_interaction_report, 'r') as f:
                reports['interaction_report'] = f.read()
    
    if reports:
        return jsonify(reports)
    
    return jsonify({'error': 'No reports found'})

@app.route('/download/<analysis_id>/<report_type>')
def download_report(analysis_id, report_type):
    """Download analysis reports."""
    analysis_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id)
    if not os.path.exists(analysis_dir):
        return jsonify({'error': 'Analysis not found'})
    
    if report_type == 'mouse':
        report_dir = os.path.join(analysis_dir, 'mouse_analysis')
        pattern = 'mouse_analysis_*.md'
    elif report_type == 'interaction':
        report_dir = os.path.join(analysis_dir, 'analysis')
        pattern = 'interaction_analysis_*.md'
    else:
        return jsonify({'error': 'Invalid report type'})
    
    if os.path.exists(report_dir):
        reports = list(Path(report_dir).glob(pattern))
        if reports:
            latest_report = max(reports, key=os.path.getctime)
            return send_file(latest_report, as_attachment=True)
    
    return jsonify({'error': 'No report found'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080) 