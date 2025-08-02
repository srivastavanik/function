#!/bin/bash

# Video Interaction Analyzer - Startup Script
echo "🎬 Video Interaction Analyzer"
echo "=================================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "🔧 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Check for API key
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "❌ OPENROUTER_API_KEY environment variable not set."
    echo "   Please set your OpenRouter API key:"
    echo "   export OPENROUTER_API_KEY='your_api_key_here'"
    echo ""
    echo "   Or create a .env file with:"
    echo "   OPENROUTER_API_KEY=your_api_key_here"
    exit 1
fi

# Check dependencies
echo "🔍 Checking dependencies..."

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg is not installed. Please install ffmpeg:"
    echo "   macOS: brew install ffmpeg"
    echo "   Ubuntu: sudo apt install ffmpeg"
    echo "   Windows: Download from https://ffmpeg.org/"
    exit 1
else
    echo "✅ ffmpeg is installed"
fi

# Check OpenCV
python3 -c "import cv2" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ OpenCV is available"
else
    echo "❌ OpenCV is not installed. Installing..."
    pip install opencv-python matplotlib
fi

echo "✅ All dependencies are ready!"
echo ""
echo "🚀 Starting Video Interaction Analyzer..."
echo "   Web application will be available at: http://localhost:8080"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start the application
python app.py 