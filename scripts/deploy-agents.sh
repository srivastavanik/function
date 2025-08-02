#!/bin/bash

# Deploy Agents Service to Cloud Run
# This script deploys the Mastra agent orchestration service

set -e

echo "======================================="
echo "Deploying Agents Service to Cloud Run"
echo "======================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found. Please create it first."
    exit 1
fi

# Validate required variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ] || [ -z "$CLOUD_RUN_REGION" ] || [ -z "$CLOUD_RUN_AGENTS_SERVICE" ]; then
    echo "Error: Missing required environment variables."
    echo "Please ensure GOOGLE_CLOUD_PROJECT, CLOUD_RUN_REGION, and CLOUD_RUN_AGENTS_SERVICE are set."
    exit 1
fi

# Set project
echo "Setting project to: $GOOGLE_CLOUD_PROJECT"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Build and push container image
echo ""
echo "Building container image..."
cd agents

# Build using Cloud Build
gcloud builds submit \
    --tag gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_AGENTS_SERVICE:latest \
    --timeout=20m

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy $CLOUD_RUN_AGENTS_SERVICE \
    --image gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_AGENTS_SERVICE:latest \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production" \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT" \
    --set-env-vars "FIRESTORE_COLLECTION_SESSIONS=$FIRESTORE_COLLECTION_SESSIONS" \
    --set-env-vars "BASIC_TECH_API_KEY=$BASIC_TECH_API_KEY" \
    --set-env-vars "BASIC_TECH_USER_ID=$BASIC_TECH_USER_ID" \
    --set-env-vars "COMPOSIO_API_KEY=$COMPOSIO_API_KEY" \
    --set-env-vars "GITHUB_OWNER=$GITHUB_OWNER" \
    --set-env-vars "GITHUB_REPO=$GITHUB_REPO" \
    --set-env-vars "SLACK_CHANNEL=$SLACK_CHANNEL" \
    --set-env-vars "VAPI_API_KEY=$VAPI_API_KEY" \
    --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest" \
    --service-account function-hackathon-sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com \
    --memory 1Gi \
    --cpu 1 \
    --timeout 60 \
    --concurrency 100 \
    --max-instances 10 \
    --port 3000

# Get the service URL
SERVICE_URL=$(gcloud run services describe $CLOUD_RUN_AGENTS_SERVICE \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --format 'value(status.url)')

echo ""
echo "======================================="
echo "Agents Service deployed successfully!"
echo "======================================="
echo "Service URL: $SERVICE_URL"
echo ""
echo "The agent webhook URL is: $SERVICE_URL/webhook"
echo ""
echo "Next steps:"
echo "1. Update the AGENT_WEBHOOK_URL in your .env file to: $SERVICE_URL/webhook"
echo "2. Redeploy the video processor to use the new webhook URL"
echo "3. Configure Composio webhook (if using) to point to: $SERVICE_URL/composio/webhook"

cd ..
