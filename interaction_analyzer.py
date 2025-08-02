#!/usr/bin/env python3
"""
Interaction Pattern Analyzer - Real User Behavior Detection

This script analyzes video frames to detect actual user interaction patterns:
- Mouse movements and cursor patterns
- Click locations and timing
- Scrolling behavior and pauses
- Text input patterns
- Hesitation moments
- Error patterns and repeated actions
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Dict, Any
import requests
import cv2
import numpy as np


def check_ffmpeg():
    """Check if ffmpeg is available in the system."""
    try:
        subprocess.run(['ffmpeg', '-version'], 
                      capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def extract_interaction_frames(video_path, output_dir, fps=1):
    """Extract frames at lower frequency for fast interaction tracking."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract frames at 1 FPS for fast processing (reduced from 2 FPS)
    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-vf', f'fps={fps}',
        '-y',
        os.path.join(output_dir, 'interaction_frame_%04d.png')
    ]
    
    try:
        print(f"🎬 Extracting interaction frames at {fps} FPS...")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        frame_files = list(Path(output_dir).glob('interaction_frame_*.png'))
        frame_files.sort()
        
        print(f"✅ Extracted {len(frame_files)} interaction frames")
        return len(frame_files), frame_files
        
    except subprocess.CalledProcessError as e:
        print(f"Error extracting interaction frames: {e}")
        return 0, []


def detect_cursor_movement(frame_files):
    """Detect cursor/mouse movement patterns between frames."""
    print("🔍 Analyzing cursor movement patterns...")
    
    movement_patterns = []
    
    for i in range(len(frame_files) - 1):
        frame1_path = str(frame_files[i])
        frame2_path = str(frame_files[i + 1])
        
        # Read frames
        frame1 = cv2.imread(frame1_path)
        frame2 = cv2.imread(frame2_path)
        
        if frame1 is None or frame2 is None:
            continue
        
        # Convert to grayscale
        gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)
        
        # Calculate frame difference
        diff = cv2.absdiff(gray1, gray2)
        
        # Threshold to detect significant changes
        _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
        
        # Find contours of changes
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Analyze movement patterns
        if contours:
            # Calculate movement area
            total_area = sum(cv2.contourArea(c) for c in contours)
            
            # Detect if it's likely cursor movement (small, focused changes)
            if total_area < 1000:  # Small changes likely cursor
                movement_patterns.append({
                    'frame_pair': (frame_files[i].name, frame_files[i + 1].name),
                    'movement_type': 'cursor',
                    'intensity': total_area,
                    'timestamp': i * 0.5  # Assuming 2 FPS
                })
            elif total_area > 5000:  # Large changes likely scrolling/clicking
                movement_patterns.append({
                    'frame_pair': (frame_files[i].name, frame_files[i + 1].name),
                    'movement_type': 'interaction',
                    'intensity': total_area,
                    'timestamp': i * 0.5
                })
    
    return movement_patterns


def analyze_interaction_patterns(frame_files, api_key):
    """Analyze frames for actual user interaction patterns."""
    if not frame_files:
        return []
    
    print(f"🔍 Analyzing {len(frame_files)} frames for interaction patterns...")
    
    # Detect cursor movement patterns
    movement_patterns = detect_cursor_movement(frame_files)
    
    # Analyze key interaction moments (optimized for speed)
    interaction_analyses = []
    
    # Sample frames for fast analysis (reduced from every 5th to every 20th)
    if len(frame_files) > 20:
        # Sample every 20th frame for very fast analysis
        sample_indices = list(range(0, len(frame_files), 20))
        # Ensure we get at least 6 frames
        if len(sample_indices) < 6:
            sample_indices = list(range(0, len(frame_files), len(frame_files) // 6))
    else:
        # Analyze all frames if video is short
        sample_indices = list(range(len(frame_files)))
    
    # Limit to maximum 8 frames for speed
    sample_indices = sample_indices[:8]
    
    print(f"🚀 Fast analysis: Analyzing {len(sample_indices)} key frames...")
    
    for i in sample_indices:
        if i >= len(frame_files):
            break
            
        frame_path = frame_files[i]
        print(f"🔍 Analyzing interaction frame {sample_indices.index(i)+1}/{len(sample_indices)}...")
        
        interaction_analysis = analyze_single_interaction_frame(
            frame_path, api_key, i, movement_patterns
        )
        if interaction_analysis:
            interaction_analyses.append(interaction_analysis)
        
        time.sleep(0.2)  # Reduced rate limiting for speed
    
    return interaction_analyses, movement_patterns


def analyze_interaction_patterns_fast(frames_dir: str, analysis_id: str) -> Dict[str, Any]:
    """
    Fast analysis of interaction patterns using AI vision.
    Optimized for speed: analyzes only 6 key frames with reduced rate limiting.
    """
    print("🤖 Analyzing interaction patterns with AI...")
    print("🔍 Analyzing cursor movement patterns...")
    
    # Get all frame files
    frame_files = sorted([f for f in os.listdir(frames_dir) if f.endswith('.png')])
    
    if not frame_files:
        return {"error": "No frames found for analysis"}
    
    # Fast analysis: analyze only 6 key frames (every 20th frame, max 6)
    step = max(1, len(frame_files) // 6)
    key_frames = frame_files[::step][:6]
    
    print(f"🚀 Fast analysis: Analyzing {len(key_frames)} key frames...")
    
    analyses = []
    for i, frame_file in enumerate(key_frames, 1):
        print(f"🔍 Analyzing interaction frame {i}/{len(key_frames)}...")
        
        frame_path = os.path.join(frames_dir, frame_file)
        
        # Enhanced prompt for more actionable insights
        prompt = f"""
        Analyze this video frame showing user interaction with a web interface. 
        Focus on identifying specific problems and providing actionable solutions.

        **Analysis Requirements:**
        1. **Problem Identification**: What specific issue is the user experiencing?
        2. **Root Cause**: Why is this happening? (UI/UX problem, unclear instructions, etc.)
        3. **Actionable Solution**: Provide 2-3 specific, implementable fixes
        4. **Priority**: Rate the urgency (High/Medium/Low)

        **Format your response as:**
        ## Problem: [Clear description of the issue]
        **Why it's happening:** [Root cause analysis]
        **How to fix it:**
        1. [Specific actionable solution]
        2. [Specific actionable solution]
        3. [Specific actionable solution]
        **Priority:** [High/Medium/Low]

        If no clear problem is visible, state: "No significant issues detected in this frame."
        """
        
        try:
            analysis = analyze_frame_with_ai(frame_path, prompt)
            analyses.append({
                "frame": frame_file,
                "analysis": analysis
            })
            time.sleep(0.2)  # Reduced rate limiting for speed
        except Exception as e:
            print(f"❌ Error analyzing frame {frame_file}: {e}")
            analyses.append({
                "frame": frame_file,
                "analysis": f"Error analyzing frame: {str(e)}"
            })
    
    return {
        "frame_analyses": analyses,
        "total_frames_analyzed": len(key_frames)
    }


def analyze_single_interaction_frame(frame_path, api_key, frame_index, movement_patterns):
    """Analyze a single frame for user interaction patterns."""
    base64_image = encode_image_to_base64(frame_path)
    if not base64_image:
        return None
    
    # Find relevant movement patterns for this frame
    relevant_movements = [
        m for m in movement_patterns 
        if frame_path.name in m['frame_pair']
    ]
    
    movement_context = ""
    if relevant_movements:
        movement_context = f"\n\nMovement detected: {relevant_movements[0]['movement_type']} (intensity: {relevant_movements[0]['intensity']})"
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "openai/gpt-4o",
        "messages": [
            {
                "role": "system",
                "content": """You are a user interaction analyst. Look at this frame and identify:

1. **Visible User Actions**: What is the user doing? (clicking, typing, scrolling, hovering)
2. **Interaction Patterns**: Are there signs of hesitation, confusion, or smooth flow?
3. **Potential Friction**: What might be causing the user to pause, repeat actions, or struggle?
4. **Interface Response**: How is the interface responding to user actions?

Focus on ACTUAL user behavior you can observe, not assumptions."""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Analyze this frame (Frame {frame_index + 1}) for actual user interaction patterns. What is the user doing and what friction points might be occurring?{movement_context}"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 600
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        analysis = result['choices'][0]['message']['content']
        
        return {
            'frame': frame_path.name,
            'frame_index': frame_index,
            'interaction_analysis': analysis,
            'movement_patterns': relevant_movements
        }
        
    except Exception as e:
        print(f"Error analyzing interaction frame {frame_path.name}: {e}")
        return None


def encode_image_to_base64(image_path):
    """Encode image to base64 for API transmission."""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


def analyze_frame_with_ai(image_path: str, prompt: str) -> str:
    """
    Analyze a single frame using OpenRouter API with GPT-4o Vision.
    
    Args:
        image_path: Path to the image file
        prompt: Analysis prompt for the AI
    
    Returns:
        Analysis result as string
    """
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable not set")
    
    # Encode image to base64
    base64_image = encode_image_to_base64(image_path)
    
    # Prepare API request
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "openai/gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1000,
        "temperature": 0.3
    }
    
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        if 'choices' in result and len(result['choices']) > 0:
            return result['choices'][0]['message']['content']
        else:
            return "No analysis result received from API"
            
    except requests.exceptions.RequestException as e:
        raise Exception(f"API request failed: {str(e)}")
    except Exception as e:
        raise Exception(f"Analysis failed: {str(e)}")


def analyze_user_behavior_patterns(interaction_analyses, movement_patterns, api_key):
    """Analyze overall user behavior patterns and friction points."""
    if not interaction_analyses:
        return None
    
    # Combine interaction analyses (new format)
    combined_analysis = "\n\n".join([
        f"Frame {i + 1} ({item.get('frame', 'Unknown')}):\n{item.get('analysis', '')}"
        for i, item in enumerate(interaction_analyses)
    ])
    
    # Add movement pattern summary
    movement_summary = "\n\nMovement Patterns:\n"
    for pattern in movement_patterns:
        movement_summary += f"- {pattern['movement_type']} at {pattern['timestamp']:.1f}s (intensity: {pattern['intensity']})\n"
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "openai/gpt-4o",
        "messages": [
            {
                "role": "system",
                "content": """You are a user behavior analyst. Based on the interaction patterns and movement data, identify:

1. **Real Friction Points**: Actual problems users encountered (not assumptions)
2. **Interaction Patterns**: How users navigated the interface
3. **Hesitation Moments**: When users paused or seemed confused
4. **Error Patterns**: Repeated actions or corrections
5. **Specific Solutions**: Actionable fixes for the observed problems

Focus on what you can actually observe from the user's behavior."""
            },
            {
                "role": "user",
                "content": f"Based on this user interaction analysis:{combined_analysis}{movement_summary}\n\nWhat real friction points did the user encounter and what specific solutions would fix them?"
            }
        ],
        "max_tokens": 1000
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        print(f"Error analyzing user behavior patterns: {e}")
        return None


def generate_interaction_report(interaction_analyses, movement_patterns, behavior_analysis, video_name, output_path):
    """Generate a report focused on actual user interactions."""
    print(f"\n📝 Generating interaction analysis report...")
    
    with open(output_path, 'w') as f:
        f.write(f"# User Interaction Analysis Report: {video_name}\n\n")
        f.write(f"Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Movement patterns summary
        f.write("## Movement Pattern Analysis\n\n")
        for pattern in movement_patterns:
            f.write(f"- **{pattern['movement_type'].title()}** at {pattern['timestamp']:.1f}s (intensity: {pattern['intensity']})\n")
        f.write("\n")
        
        # Frame-by-frame interaction analysis
        f.write("## Frame-by-Frame Interaction Analysis\n\n")
        for i, item in enumerate(interaction_analyses):
            f.write(f"### Frame {i + 1}: {item.get('frame', 'Unknown')}\n")
            f.write(f"{item.get('analysis', '')}\n\n")
        
        # Overall behavior analysis
        if behavior_analysis:
            f.write("## Real User Behavior & Friction Points\n\n")
            f.write(f"{behavior_analysis}\n\n")
        
        # Summary
        f.write("## Analysis Summary\n\n")
        f.write(f"- Interaction frames analyzed: {len(interaction_analyses)}\n")
        f.write(f"- Movement patterns detected: {len(movement_patterns)}\n")
        f.write(f"- Analysis focus: Actual user behavior and interaction patterns\n")
        f.write(f"- Analysis completed: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    print(f"✅ Interaction analysis report saved to: {output_path}")


def main():
    """Main function for interaction pattern analysis."""
    parser = argparse.ArgumentParser(
        description='Analyze video frames for actual user interaction patterns.'
    )
    parser.add_argument(
        'video_path',
        help='Path to the input video file (e.g., video.mp4)'
    )
    parser.add_argument(
        '-o', '--output',
        default='interaction_frames',
        help='Output directory for extracted frames (default: interaction_frames)'
    )
    parser.add_argument(
        '-a', '--analysis',
        default='interaction_analysis',
        help='Output directory for analysis results (default: interaction_analysis)'
    )
    parser.add_argument(
        '-f', '--fps',
        type=int,
        default=2,
        help='Frames per second to extract (default: 2)'
    )
    
    args = parser.parse_args()
    
    # Check if video file exists
    if not os.path.exists(args.video_path):
        print(f"Error: Video file '{args.video_path}' not found.")
        sys.exit(1)
    
    # Check if ffmpeg is available
    if not check_ffmpeg():
        print("Error: ffmpeg is not installed or not available in PATH.")
        sys.exit(1)
    
    # Check for OpenRouter API key
    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        print("Error: OPENROUTER_API_KEY environment variable not set.")
        sys.exit(1)
    
    print("🎯 Starting User Interaction Analysis...")
    
    # Extract interaction frames
    frame_count, frame_files = extract_interaction_frames(
        args.video_path, 
        args.output, 
        args.fps
    )
    
    if frame_count == 0:
        print("No frames extracted. Exiting.")
        sys.exit(1)
    
    # Analyze interaction patterns
    interaction_analyses, movement_patterns = analyze_interaction_patterns(frame_files, api_key)
    
    if not interaction_analyses:
        print("No interaction patterns were identified. Exiting.")
        sys.exit(1)
    
    # Analyze overall user behavior
    print(f"\n🎯 Analyzing user behavior patterns...")
    behavior_analysis = analyze_user_behavior_patterns(interaction_analyses, movement_patterns, api_key)
    
    # Generate report
    video_name = Path(args.video_path).stem
    analysis_dir = args.analysis
    os.makedirs(analysis_dir, exist_ok=True)
    
    timestamp = time.strftime('%Y%m%d_%H%M%S')
    report_path = os.path.join(analysis_dir, f'interaction_analysis_{video_name}_{timestamp}.md')
    
    generate_interaction_report(interaction_analyses, movement_patterns, behavior_analysis, video_name, report_path)
    
    print(f"\n🎉 User interaction analysis complete!")
    print(f"📊 Analyzed {len(interaction_analyses)} interaction frames")
    print(f"📊 Detected {len(movement_patterns)} movement patterns")
    print(f"📁 Results saved to: {analysis_dir}")
    print(f"📄 Report: {report_path}")


if __name__ == '__main__':
    main() 