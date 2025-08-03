#!/bin/bash

# Deploy Enhanced Function Hackathon Components
# This script deploys the enhanced versions with all advanced features

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying Enhanced Function Components${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Validate required environment variables
required_vars=("GOOGLE_CLOUD_PROJECT" "GCS_BUCKET_NAME" "GCS_RESULTS_BUCKET" "ANTHROPIC_API_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: $var is not set${NC}"
        exit 1
    fi
done

echo -e "\n${YELLOW}1. Building Enhanced Backend Docker Image...${NC}"
cd backend
docker build -f Dockerfile -t gcr.io/${GOOGLE_CLOUD_PROJECT}/function-backend-enhanced:latest .
docker push gcr.io/${GOOGLE_CLOUD_PROJECT}/function-backend-enhanced:latest

echo -e "\n${YELLOW}2. Building Enhanced Video Processor Docker Image...${NC}"
docker build -f Dockerfile.processor -t gcr.io/${GOOGLE_CLOUD_PROJECT}/video-processor-enhanced:latest .
docker push gcr.io/${GOOGLE_CLOUD_PROJECT}/video-processor-enhanced:latest

echo -e "\n${YELLOW}3. Deploying Enhanced Backend to GKE...${NC}"
kubectl apply -f deploy-enhanced.yaml

echo -e "\n${YELLOW}4. Creating/Updating Secrets...${NC}"
# Create secret if it doesn't exist
kubectl create secret generic api-secrets \
    --from-literal=anthropic-api-key="${ANTHROPIC_API_KEY}" \
    --from-literal=api-key="${API_KEY:-$(openssl rand -hex 32)}" \
    --from-literal=vapi-webhook-secret="${VAPI_WEBHOOK_SECRET:-$(openssl rand -hex 32)}" \
    --dry-run=client -o yaml | kubectl apply -f -

echo -e "\n${YELLOW}5. Deploying Enhanced Frontend...${NC}"
cd ../frontend

# Update environment variables for enhanced features
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=http://$(kubectl get service function-backend-enhanced -o jsonpath='{.status.loadBalancer.ingress[0].ip}')/api
NEXT_PUBLIC_API_KEY=${API_KEY:-$(kubectl get secret api-secrets -o jsonpath='{.data.api-key}' | base64 -d)}
NEXT_PUBLIC_ENHANCED_MODE=true
EOF

# Build and deploy frontend
npm install
npm run build

# Deploy to Cloud Run
gcloud run deploy function-frontend-enhanced \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars "$(cat .env.production | tr '\n' ',')"

echo -e "\n${YELLOW}6. Setting up Enhanced Pub/Sub Subscription...${NC}"
# Create dead letter topic for failed messages
gcloud pubsub topics create video-processing-dlq --project=${GOOGLE_CLOUD_PROJECT} || true

# Create or update subscription with enhanced settings
gcloud pubsub subscriptions create video-uploads-sub-enhanced \
    --topic=video-uploads \
    --ack-deadline=600 \
    --max-retry-delay=600 \
    --min-retry-delay=10 \
    --dead-letter-topic=video-processing-dlq \
    --max-delivery-attempts=5 \
    --project=${GOOGLE_CLOUD_PROJECT} || true

echo -e "\n${YELLOW}7. Creating Enhanced Firestore Indexes...${NC}"
cd ../backend

# Create indexes for enhanced queries
cat > firestore.indexes.json << EOF
{
  "indexes": [
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "uploadTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "enhanced", "order": "ASCENDING" },
        { "fieldPath": "uploadTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "frictionSeverity.high", "order": "DESCENDING" }
      ]
    }
  ]
}
EOF

gcloud firestore indexes create --project=${GOOGLE_CLOUD_PROJECT} < firestore.indexes.json

echo -e "\n${YELLOW}8. Configuring Storage Buckets...${NC}"
# Set CORS for results bucket (needed for heatmap and HLS streaming)
cat > cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Range", "Content-Range"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://${GCS_RESULTS_BUCKET}

# Enable versioning for safety
gsutil versioning set on gs://${GCS_BUCKET_NAME}
gsutil versioning set on gs://${GCS_RESULTS_BUCKET}

echo -e "\n${YELLOW}9. Waiting for services to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/function-backend-enhanced

# Get service URLs
BACKEND_URL=$(kubectl get service function-backend-enhanced -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
FRONTEND_URL=$(gcloud run services describe function-frontend-enhanced --platform managed --region us-central1 --format 'value(status.url)')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Enhanced Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nService URLs:"
echo -e "Backend API: ${GREEN}http://${BACKEND_URL}/api${NC}"
echo -e "Frontend: ${GREEN}${FRONTEND_URL}${NC}"
echo -e "\nAPI Key: ${GREEN}$(kubectl get secret api-secrets -o jsonpath='{.data.api-key}' | base64 -d)${NC}"
echo -e "\n${YELLOW}Note: It may take a few minutes for all services to be fully operational.${NC}"
echo -e "${YELLOW}Check the health endpoint: http://${BACKEND_URL}/health${NC}"

# Optional: Run a health check
sleep 10
if curl -s -o /dev/null -w "%{http_code}" http://${BACKEND_URL}/health | grep -q "200"; then
    echo -e "\n${GREEN}✓ Backend is healthy!${NC}"
else
    echo -e "\n${YELLOW}⚠ Backend is still starting up. Please wait a few minutes.${NC}"
fi
