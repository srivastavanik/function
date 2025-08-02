# Video Interaction Analyzer

A web-based tool that analyzes video recordings to detect user interaction patterns, friction points, and provides actionable UX insights using AI vision analysis.

## 🚀 Features

- **Mouse Movement Tracking**: Detects cursor positions and movement patterns
- **Interaction Analysis**: Analyzes user behavior using AI vision
- **Friction Point Detection**: Identifies hesitation, confusion, and usability issues
- **Actionable Insights**: Provides specific, implementable solutions
- **Fast Processing**: Optimized for 1-2 minute analysis of typical videos
- **Web Interface**: Modern, responsive UI with drag-and-drop upload

## 📋 Prerequisites

- **Python 3.8+**
- **ffmpeg** (for video processing)
- **OpenRouter API Key** (for AI analysis)

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd video-interaction-analyzer
   ```

2. **Set up your API key:**
   ```bash
   export OPENROUTER_API_KEY='your_api_key_here'
   ```

3. **Run the startup script:**
   ```bash
   ./start.sh
   ```

   Or manually:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```

4. **Open your browser:**
   Navigate to `http://localhost:8080`

## 🎯 Usage

1. **Upload a video** (MP4, AVI, MOV, MKV) by dragging and dropping
2. **Click "Analyze Interactions"** to start the analysis
3. **Wait 1-2 minutes** for the complete analysis
4. **Review the results** including:
   - Mouse movement statistics
   - Detected friction points
   - Actionable UX recommendations
   - Download detailed reports

## 📊 Analysis Results

The tool provides:

- **Problem Identification**: Clear description of UX issues
- **Root Cause Analysis**: Why problems are occurring
- **Actionable Solutions**: 2-3 specific fixes for each issue
- **Priority Ratings**: High/Medium/Low urgency indicators
- **Mouse Heat Maps**: Visual representation of user activity

## ⚡ Performance Optimizations

- **1 FPS frame extraction** (reduced from 2 FPS)
- **Fast mouse tracking** (every 10th frame)
- **6 key frames** for AI analysis (reduced from 46+)
- **0.2s rate limiting** (reduced from 0.5s)
- **Non-interactive matplotlib** (prevents GUI crashes)

## 📁 Project Structure

```
video-interaction-analyzer/
├── app.py                 # Main Flask application
├── mouse_tracker.py       # Mouse movement detection
├── interaction_analyzer.py # AI analysis engine
├── templates/             # Web interface templates
├── requirements.txt       # Python dependencies
├── start.sh              # Startup script
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI analysis

### Dependencies

- **Flask**: Web framework
- **OpenCV**: Computer vision for mouse tracking
- **Matplotlib**: Heat map generation
- **Requests**: API communication
- **NumPy**: Numerical processing

## 💡 Example Output

```
🚨 Problem: User hesitates when filling out the form
Why it's happening: The form field is too vague without clear guidance
How to fix it:
1. Add placeholder text with examples
2. Break down the question into smaller prompts
3. Add a character counter and progress indicator
Priority: High
```

## 🚨 Troubleshooting

### Common Issues

1. **"ffmpeg not found"**
   - Install ffmpeg: `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Ubuntu)

2. **"OpenCV not installed"**
   - Run: `pip install opencv-python matplotlib`

3. **"API key not set"**
   - Set: `export OPENROUTER_API_KEY='your_key_here'`

4. **"Port 8080 in use"**
   - Change port in `app.py` or kill existing process

## 📈 Cost Considerations

- **API Calls**: ~6-8 calls per video analysis
- **Estimated Cost**: $0.02-$0.05 per video (using GPT-4o)
- **Rate Limits**: 0.2s delay between API calls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- OpenRouter for AI vision analysis
- OpenCV for computer vision capabilities
- Flask for the web framework 