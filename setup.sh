#!/bin/bash

# Function Hackathon Setup Script
# This script helps set up the development environment

echo "==================================="
echo "Function Hackathon Setup"
echo "==================================="

# Check if .env exists
if [ -f .env ]; then
    echo "✓ .env file already exists"
else
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ Created .env file - Please edit it with your API keys"
fi

# Create required directories
echo ""
echo "Creating required directories..."
mkdir -p backend/temp
mkdir -p agents/logs
mkdir -p frontend/public/uploads
echo "✓ Directories created"

# Install backend dependencies
echo ""
echo "Installing backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..
echo "✓ Backend dependencies installed"

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..
echo "✓ Frontend dependencies installed"

# Install agent dependencies
echo ""
echo "Installing agent dependencies..."
cd agents
npm install
cd ..
echo "✓ Agent dependencies installed"

# Check for required environment variables
echo ""
echo "Checking environment variables..."
source .env

required_vars=(
    "GOOGLE_CLOUD_PROJECT"
    "ANTHROPIC_API_KEY"
    "COMPOSIO_API_KEY"
    "SECRET_KEY"
    "API_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "✓ All required environment variables are set"
else
    echo "⚠️  Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please edit .env and set these variables before running the application"
fi

echo ""
echo "==================================="
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys and configuration"
echo "2. Set up Google Cloud project and enable required APIs"
echo "3. Run the services:"
echo "   - Backend: cd backend && python app.py"
echo "   - Frontend: cd frontend && npm run dev"
echo "   - Agents: cd agents && npm start"
echo "==================================="
