#!/bin/bash

# Deploy Video Processor to Cloud Run
# This script builds and deploys the video processor service

set -e

echo "======================================="
echo "Deploying Video Processor to Cloud Run"
echo "======================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found. Please create it first."
    exit 1
fi

# Validate required variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ] || [ -z "$CLOUD_RUN_REGION" ] || [ -z "$CLOUD_RUN_PROCESSOR_SERVICE" ]; then
    echo "Error: Missing required environment variables."
    echo "Please ensure GOOGLE_CLOUD_PROJECT, CLOUD_RUN_REGION, and CLOUD_RUN_PROCESSOR_SERVICE are set."
    exit 1
fi

# Set project
echo "Setting project to: $GOOGLE_CLOUD_PROJECT"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Build and push container image
echo ""
echo "Building container image..."
cd backend

# Build using Cloud Build with the processor Dockerfile
gcloud builds submit \
    --tag gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_PROCESSOR_SERVICE:latest \
    --file Dockerfile.processor \
    --timeout=20m

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy $CLOUD_RUN_PROCESSOR_SERVICE \
    --image gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_PROCESSOR_SERVICE:latest \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --no-allow-unauthenticated \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT" \
    --set-env-vars "GCS_BUCKET_NAME=$GCS_BUCKET_NAME" \
    --set-env-vars "GCS_RESULTS_BUCKET=$GCS_RESULTS_BUCKET" \
    --set-env-vars "PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR=$PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR" \
    --set-env-vars "FIRESTORE_COLLECTION_SESSIONS=$FIRESTORE_COLLECTION_SESSIONS" \
    --set-env-vars "AGENT_WEBHOOK_URL=$AGENT_WEBHOOK_URL" \
    --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest" \
    --set-secrets "API_KEY=api-key:latest" \
    --service-account function-hackathon-sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com \
    --memory 4Gi \
    --cpu 2 \
    --timeout 600 \
    --max-instances 5

# Get the service URL
SERVICE_URL=$(gcloud run services describe $CLOUD_RUN_PROCESSOR_SERVICE \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --format 'value(status.url)')

echo ""
echo "======================================="
echo "Video Processor deployed successfully!"
echo "======================================="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Note: This service is configured to process Pub/Sub messages"
echo "It will automatically start processing videos when they are uploaded"

cd ..
