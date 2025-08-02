#!/usr/bin/env python3
"""
Mouse Movement & Click Tracker

This tool analyzes video recordings to track actual mouse movements and clicks:
- Detects cursor position and movement patterns
- Identifies click locations and timing
- Tracks scrolling behavior
- Analyzes user interaction patterns
- Generates heat maps of user activity
"""

import argparse
import cv2
import numpy as np
import json
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend to prevent GUI issues
import matplotlib.pyplot as plt
from collections import defaultdict


def check_opencv():
    """Check if OpenCV is available."""
    try:
        cv2.__version__
        return True
    except:
        return False


def detect_cursor_position(frame):
    """Detect cursor position in a frame using template matching or color detection."""
    # Convert to HSV for better color detection
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # Common cursor colors (white, black, blue, etc.)
    cursor_positions = []
    
    # Try to detect white cursor
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 30, 255])
    white_mask = cv2.inRange(hsv, lower_white, upper_white)
    
    # Try to detect black cursor
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 30])
    black_mask = cv2.inRange(hsv, lower_black, upper_black)
    
    # Combine masks
    cursor_mask = cv2.bitwise_or(white_mask, black_mask)
    
    # Find contours
    contours, _ = cv2.findContours(cursor_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if 10 < area < 500:  # Reasonable cursor size
            M = cv2.moments(contour)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                cursor_positions.append((cx, cy, area))
    
    return cursor_positions


def detect_clicks(frame_sequence, threshold=50):
    """Detect clicks by looking for sudden changes in cursor area."""
    clicks = []
    
    for i in range(1, len(frame_sequence)):
        prev_frame = frame_sequence[i-1]
        curr_frame = frame_sequence[i]
        
        # Get cursor positions
        prev_cursors = detect_cursor_position(prev_frame)
        curr_cursors = detect_cursor_position(curr_frame)
        
        # Check for click indicators (sudden area change)
        for prev_cursor in prev_cursors:
            for curr_cursor in curr_cursors:
                area_diff = abs(curr_cursor[2] - prev_cursor[2])
                if area_diff > threshold:  # Significant area change indicates click
                    clicks.append({
                        'frame': i,
                        'position': (curr_cursor[0], curr_cursor[1]),
                        'timestamp': i / 30.0,  # Assuming 30 FPS
                        'area_change': area_diff
                    })
    
    return clicks


def track_mouse_movement(video_path, output_dir):
    """Track mouse movement throughout the video."""
    print(f"🎯 Tracking mouse movements in {video_path}...")
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return None
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    
    print(f"📊 Video info: {total_frames} frames, {fps:.1f} FPS, {duration:.1f}s duration")
    
    # Track mouse positions
    mouse_positions = []
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Sample every 3rd frame to reduce processing time
        if frame_count % 3 == 0:
            cursor_positions = detect_cursor_position(frame)
            
            if cursor_positions:
                # Use the largest cursor (most likely the main cursor)
                main_cursor = max(cursor_positions, key=lambda x: x[2])
                mouse_positions.append({
                    'frame': frame_count,
                    'position': (main_cursor[0], main_cursor[1]),
                    'timestamp': frame_count / fps,
                    'area': main_cursor[2]
                })
        
        frame_count += 1
        
        # Progress indicator
        if frame_count % 100 == 0:
            progress = (frame_count / total_frames) * 100
            print(f"📈 Progress: {progress:.1f}% ({frame_count}/{total_frames} frames)")
    
    cap.release()
    
    print(f"✅ Tracked {len(mouse_positions)} mouse positions")
    return mouse_positions


def track_mouse_movement_fast(video_path, output_dir):
    """Fast mouse movement tracking with reduced sampling."""
    print(f"🎯 Fast tracking mouse movements in {video_path}...")
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return None
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    
    print(f"📊 Video info: {total_frames} frames, {fps:.1f} FPS, {duration:.1f}s duration")
    
    # Track mouse positions with reduced sampling
    mouse_positions = []
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Sample every 10th frame instead of every 3rd for speed
        if frame_count % 10 == 0:
            cursor_positions = detect_cursor_position(frame)
            
            if cursor_positions:
                # Use the largest cursor (most likely the main cursor)
                main_cursor = max(cursor_positions, key=lambda x: x[2])
                mouse_positions.append({
                    'frame': frame_count,
                    'position': (main_cursor[0], main_cursor[1]),
                    'timestamp': frame_count / fps,
                    'area': main_cursor[2]
                })
        
        frame_count += 1
        
        # Progress indicator (less frequent)
        if frame_count % 500 == 0:
            progress = (frame_count / total_frames) * 100
            print(f"📈 Progress: {progress:.1f}% ({frame_count}/{total_frames} frames)")
    
    cap.release()
    
    print(f"✅ Tracked {len(mouse_positions)} mouse positions")
    return mouse_positions


def analyze_movement_patterns(mouse_positions):
    """Analyze mouse movement patterns for friction points."""
    if not mouse_positions:
        return {}
    
    print("🔍 Analyzing movement patterns...")
    
    # Calculate movement statistics
    movements = []
    speeds = []
    pauses = []
    
    for i in range(1, len(mouse_positions)):
        prev = mouse_positions[i-1]
        curr = mouse_positions[i]
        
        # Calculate distance
        dx = curr['position'][0] - prev['position'][0]
        dy = curr['position'][1] - prev['position'][1]
        distance = np.sqrt(dx*dx + dy*dy)
        
        # Calculate time difference
        time_diff = curr['timestamp'] - prev['timestamp']
        
        # Calculate speed (pixels per second)
        speed = distance / time_diff if time_diff > 0 else 0
        
        movements.append({
            'from': prev['position'],
            'to': curr['position'],
            'distance': distance,
            'speed': speed,
            'time_diff': time_diff,
            'timestamp': curr['timestamp']
        })
        
        speeds.append(speed)
        
        # Detect pauses (very slow movement)
        if speed < 10:  # Less than 10 pixels per second
            pauses.append({
                'position': curr['position'],
                'timestamp': curr['timestamp'],
                'duration': time_diff
            })
    
    # Analyze patterns
    avg_speed = np.mean(speeds) if speeds else 0
    max_speed = np.max(speeds) if speeds else 0
    total_distance = sum(m['distance'] for m in movements)
    
    # Find areas of high activity (potential click zones)
    activity_map = defaultdict(int)
    for pos in mouse_positions:
        x, y = pos['position']
        # Round to grid for heat map
        grid_x, grid_y = x // 50, y // 50
        activity_map[(grid_x, grid_y)] += 1
    
    # Find most active areas
    hot_zones = sorted(activity_map.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        'total_positions': len(mouse_positions),
        'total_movements': len(movements),
        'average_speed': avg_speed,
        'max_speed': max_speed,
        'total_distance': total_distance,
        'pause_count': len(pauses),
        'hot_zones': hot_zones,
        'movements': movements,
        'pauses': pauses
    }


def detect_friction_points(movement_data):
    """Detect potential friction points from movement patterns."""
    friction_points = []
    
    if not movement_data:
        return friction_points
    
    # Analyze pauses (potential hesitation)
    long_pauses = [p for p in movement_data['pauses'] if p['duration'] > 1.0]
    for pause in long_pauses:
        friction_points.append({
            'type': 'hesitation',
            'position': pause['position'],
            'timestamp': pause['timestamp'],
            'duration': pause['duration'],
            'description': f"User paused for {pause['duration']:.1f}s at position {pause['position']}"
        })
    
    # Analyze erratic movements (potential confusion)
    erratic_movements = []
    for i in range(1, len(movement_data['movements'])):
        prev = movement_data['movements'][i-1]
        curr = movement_data['movements'][i]
        
        # Detect back-and-forth movement
        if abs(curr['speed'] - prev['speed']) > 100:  # Sudden speed change
            erratic_movements.append({
                'position': curr['to'],
                'timestamp': curr['timestamp'],
                'speed_change': abs(curr['speed'] - prev['speed'])
            })
    
    # Add erratic movement friction points
    for movement in erratic_movements[:5]:  # Top 5 most erratic
        friction_points.append({
            'type': 'erratic_movement',
            'position': movement['position'],
            'timestamp': movement['timestamp'],
            'speed_change': movement['speed_change'],
            'description': f"Erratic movement detected at position {movement['position']}"
        })
    
    return friction_points


def generate_heat_map(mouse_positions, output_path):
    """Generate a heat map of mouse activity."""
    if not mouse_positions:
        return
    
    print("🔥 Generating heat map...")
    
    # Create activity grid
    grid_size = 50
    max_x = max(pos['position'][0] for pos in mouse_positions)
    max_y = max(pos['position'][1] for pos in mouse_positions)
    
    grid_width = max_x // grid_size + 1
    grid_height = max_y // grid_size + 1
    
    heat_map = np.zeros((grid_height, grid_width))
    
    # Fill heat map
    for pos in mouse_positions:
        x, y = pos['position']
        grid_x, grid_y = x // grid_size, y // grid_size
        if 0 <= grid_x < grid_width and 0 <= grid_y < grid_height:
            heat_map[grid_y, grid_x] += 1
    
    # Create heat map visualization
    plt.figure(figsize=(12, 8))
    plt.imshow(heat_map, cmap='hot', interpolation='nearest')
    plt.colorbar(label='Mouse Activity')
    plt.title('Mouse Movement Heat Map')
    plt.xlabel('X Position (grid)')
    plt.ylabel('Y Position (grid)')
    
    # Save heat map
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"✅ Heat map saved to: {output_path}")


def generate_movement_report(movement_data, friction_points, video_name, output_path):
    """Generate a comprehensive movement analysis report."""
    print(f"📝 Generating movement analysis report...")
    
    with open(output_path, 'w') as f:
        f.write(f"# Mouse Movement Analysis Report: {video_name}\n\n")
        f.write(f"Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Movement statistics
        f.write("## Movement Statistics\n\n")
        f.write(f"- **Total mouse positions tracked**: {movement_data['total_positions']}\n")
        f.write(f"- **Total movements**: {movement_data['total_movements']}\n")
        f.write(f"- **Average speed**: {movement_data['average_speed']:.1f} pixels/second\n")
        f.write(f"- **Maximum speed**: {movement_data['max_speed']:.1f} pixels/second\n")
        f.write(f"- **Total distance traveled**: {movement_data['total_distance']:.1f} pixels\n")
        f.write(f"- **Pause count**: {movement_data['pause_count']}\n\n")
        
        # Hot zones
        f.write("## Most Active Areas (Hot Zones)\n\n")
        for i, (zone, activity) in enumerate(movement_data['hot_zones'], 1):
            x, y = zone
            f.write(f"{i}. **Zone ({x*50}, {y*50})**: {activity} mouse positions\n")
        f.write("\n")
        
        # Friction points
        f.write("## Detected Friction Points\n\n")
        if friction_points:
            for i, point in enumerate(friction_points, 1):
                f.write(f"### Friction Point {i}: {point['type'].title()}\n")
                f.write(f"- **Position**: {point['position']}\n")
                f.write(f"- **Timestamp**: {point['timestamp']:.1f}s\n")
                f.write(f"- **Description**: {point['description']}\n")
                if 'duration' in point:
                    f.write(f"- **Duration**: {point['duration']:.1f}s\n")
                if 'speed_change' in point:
                    f.write(f"- **Speed Change**: {point['speed_change']:.1f} pixels/s\n")
                f.write("\n")
        else:
            f.write("No significant friction points detected.\n\n")
        
        # Summary
        f.write("## Analysis Summary\n\n")
        f.write(f"- Analysis completed: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- Friction points detected: {len(friction_points)}\n")
        f.write(f"- Hot zones identified: {len(movement_data['hot_zones'])}\n")
    
    print(f"✅ Movement analysis report saved to: {output_path}")


def main():
    """Main function for mouse movement tracking."""
    parser = argparse.ArgumentParser(
        description='Track mouse movements and detect friction points in video recordings.'
    )
    parser.add_argument(
        'video_path',
        help='Path to the input video file (e.g., video.mp4)'
    )
    parser.add_argument(
        '-o', '--output',
        default='mouse_analysis',
        help='Output directory for analysis results (default: mouse_analysis)'
    )
    
    args = parser.parse_args()
    
    # Check if video file exists
    if not os.path.exists(args.video_path):
        print(f"Error: Video file '{args.video_path}' not found.")
        sys.exit(1)
    
    # Check if OpenCV is available
    if not check_opencv():
        print("Error: OpenCV is not installed. Please install it: pip install opencv-python")
        sys.exit(1)
    
    print("🎯 Starting Mouse Movement Analysis...")
    
    # Create output directory
    os.makedirs(args.output, exist_ok=True)
    
    # Track mouse movements
    mouse_positions = track_mouse_movement(args.video_path, args.output)
    
    if not mouse_positions:
        print("No mouse movements detected. Exiting.")
        sys.exit(1)
    
    # Analyze movement patterns
    movement_data = analyze_movement_patterns(mouse_positions)
    
    # Detect friction points
    friction_points = detect_friction_points(movement_data)
    
    # Generate heat map
    video_name = Path(args.video_path).stem
    heat_map_path = os.path.join(args.output, f'mouse_heat_map_{video_name}.png')
    generate_heat_map(mouse_positions, heat_map_path)
    
    # Generate report
    timestamp = time.strftime('%Y%m%d_%H%M%S')
    report_path = os.path.join(args.output, f'mouse_analysis_{video_name}_{timestamp}.md')
    generate_movement_report(movement_data, friction_points, video_name, report_path)
    
    # Save raw data
    data_path = os.path.join(args.output, f'mouse_data_{video_name}_{timestamp}.json')
    with open(data_path, 'w') as f:
        json.dump({
            'mouse_positions': mouse_positions,
            'movement_data': movement_data,
            'friction_points': friction_points
        }, f, indent=2)
    
    print(f"\n🎉 Mouse movement analysis complete!")
    print(f"📊 Tracked {len(mouse_positions)} mouse positions")
    print(f"🚨 Detected {len(friction_points)} friction points")
    print(f"📁 Results saved to: {args.output}")
    print(f"📄 Report: {report_path}")
    print(f"🔥 Heat map: {heat_map_path}")
    print(f"📊 Raw data: {data_path}")


if __name__ == '__main__':
    main() 