#!/bin/bash
# Function Insights Platform - Complete Startup Script
# Updated with correct paths and Google Cloud configuration

echo "🚀 Starting Function Insights Platform..."
echo "======================================"

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || echo "Port 3000 is free"
lsof -ti :4111 | xargs kill -9 2>/dev/null || echo "Port 4111 is free" 
lsof -ti :8081 | xargs kill -9 2>/dev/null || echo "Port 8081 is free"

# Set up environment variables
export GOOGLE_APPLICATION_CREDENTIALS="/Users/nicksriv/Downloads/agent-hack/function-467818-7fe47f9d420b.json"
export GOOGLE_CLOUD_PROJECT="function-467818"
export GOOGLE_API_KEY="AIzaSyBMlPFMd4ZN_tu9akluhc5FEfDhiUXkfhI"

echo ""
echo "📡 Starting Backend Server..."
cd /Users/nicksriv/Downloads/agent-hack/backend
python3 app.py &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

echo ""
echo "🤖 Starting Mastra AI Framework..."
cd /Users/nicksriv/Downloads/agent-hack/function-insights  
npm run dev &
MASTRA_PID=$!
echo "   Mastra PID: $MASTRA_PID"

echo ""
echo "⚛️ Starting Frontend..."
cd /Users/nicksriv/Downloads/agent-hack/frontend
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "⏳ Waiting for services to start..."
sleep 8

echo ""
echo "🔍 Testing services..."
echo "Backend Health:" 
curl -s http://localhost:8081/health || echo "❌ Backend not responding"

echo ""
echo "✅ All services started!"
echo "======================================"
echo "📱 Frontend:     http://localhost:3000"
echo "🤖 Mastra:       http://localhost:4111" 
echo "📡 Backend API:  http://localhost:8081"
echo "🔍 Health Check: http://localhost:8081/health"
echo "======================================"
echo ""
echo "Process IDs:"
echo "Backend: $BACKEND_PID"
echo "Mastra:  $MASTRA_PID" 
echo "Frontend: $FRONTEND_PID"
echo ""
echo "To stop all services, run:"
echo "kill $BACKEND_PID $MASTRA_PID $FRONTEND_PID"
echo ""
echo "Or use: pkill -f 'python3 app.py' && pkill -f 'mastra dev' && pkill -f 'next dev'"
echo ""

# Keep script running and wait for user input
read -p "Press Enter to stop all services and exit..."

echo "🛑 Stopping all services..."
kill $BACKEND_PID $MASTRA_PID $FRONTEND_PID 2>/dev/null

echo "✅ All services stopped."