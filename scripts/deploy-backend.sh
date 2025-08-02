#!/bin/bash

# Deploy Backend API to Cloud Run
# This script builds and deploys the Flask backend API

set -e

echo "======================================="
echo "Deploying Backend API to Cloud Run"
echo "======================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found. Please create it first."
    exit 1
fi

# Validate required variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ] || [ -z "$CLOUD_RUN_REGION" ] || [ -z "$CLOUD_RUN_API_SERVICE" ]; then
    echo "Error: Missing required environment variables."
    echo "Please ensure GOOGLE_CLOUD_PROJECT, CLOUD_RUN_REGION, and CLOUD_RUN_API_SERVICE are set."
    exit 1
fi

# Set project
echo "Setting project to: $GOOGLE_CLOUD_PROJECT"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Build and push container image
echo ""
echo "Building container image..."
cd backend

# Build using Cloud Build
gcloud builds submit \
    --tag gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_API_SERVICE:latest \
    --timeout=20m

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy $CLOUD_RUN_API_SERVICE \
    --image gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_API_SERVICE:latest \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --allow-unauthenticated \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT" \
    --set-env-vars "GCS_BUCKET_NAME=$GCS_BUCKET_NAME" \
    --set-env-vars "GCS_RESULTS_BUCKET=$GCS_RESULTS_BUCKET" \
    --set-env-vars "PUBSUB_TOPIC_VIDEO_UPLOADS=$PUBSUB_TOPIC_VIDEO_UPLOADS" \
    --set-env-vars "FIRESTORE_COLLECTION_SESSIONS=$FIRESTORE_COLLECTION_SESSIONS" \
    --set-env-vars "FLASK_ENV=$FLASK_ENV" \
    --set-env-vars "MAX_UPLOAD_SIZE=$MAX_UPLOAD_SIZE" \
    --set-env-vars "ALLOWED_EXTENSIONS=$ALLOWED_EXTENSIONS" \
    --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest" \
    --set-secrets "API_KEY=api-key:latest" \
    --set-secrets "SECRET_KEY=flask-secret-key:latest" \
    --service-account function-hackathon-sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --concurrency 100 \
    --max-instances 10

# Create flask-secret-key if it doesn't exist
if ! gcloud secrets describe flask-secret-key &> /dev/null; then
    echo "Creating flask-secret-key secret..."
    echo -n "$SECRET_KEY" | gcloud secrets create flask-secret-key --data-file=-
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe $CLOUD_RUN_API_SERVICE \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --format 'value(status.url)')

echo ""
echo "======================================="
echo "Backend API deployed successfully!"
echo "======================================="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Update your frontend .env with:"
echo "NEXT_PUBLIC_API_URL=$SERVICE_URL/api"
echo ""
echo "Test the API:"
echo "curl -H 'X-API-Key: $API_KEY' $SERVICE_URL/health"

cd ..
