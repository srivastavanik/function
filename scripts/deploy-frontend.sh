#!/bin/bash

# Deploy Frontend to Vercel or Google Cloud Run
# This script deploys the Next.js frontend

set -e

echo "======================================="
echo "Deploying Frontend"
echo "======================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found. Please create it first."
    exit 1
fi

# Get backend service URL
BACKEND_URL=$(gcloud run services describe $CLOUD_RUN_API_SERVICE \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --format 'value(status.url)' 2>/dev/null || echo "")

if [ -z "$BACKEND_URL" ]; then
    echo "Warning: Backend service not deployed yet. Please deploy backend first."
    echo "Using placeholder URL for now."
    BACKEND_URL="https://your-backend-url.run.app"
fi

# Update frontend environment variables
cd frontend

# Create or update .env.local with backend URL
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=$BACKEND_URL/api
NEXT_PUBLIC_API_KEY=$API_KEY
EOF

echo ""
echo "Frontend environment configured with:"
echo "NEXT_PUBLIC_API_URL=$BACKEND_URL/api"

# Option 1: Deploy to Cloud Run (Recommended for consistency)
echo ""
echo "Deploying to Cloud Run..."

# Create Dockerfile for Next.js if it doesn't exist
if [ ! -f Dockerfile ]; then
    cat > Dockerfile << 'EOF'
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
EOF
fi

# Build and deploy to Cloud Run
gcloud builds submit \
    --tag gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_FRONTEND_SERVICE:latest \
    --timeout=20m

gcloud run deploy $CLOUD_RUN_FRONTEND_SERVICE \
    --image gcr.io/$GOOGLE_CLOUD_PROJECT/$CLOUD_RUN_FRONTEND_SERVICE:latest \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 60 \
    --concurrency 100 \
    --max-instances 10

# Get the frontend URL
FRONTEND_URL=$(gcloud run services describe $CLOUD_RUN_FRONTEND_SERVICE \
    --platform managed \
    --region $CLOUD_RUN_REGION \
    --format 'value(status.url)')

echo ""
echo "======================================="
echo "Frontend deployed successfully!"
echo "======================================="
echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "You can now access your application at: $FRONTEND_URL"

cd ..

# Option 2: Deploy to Vercel (Alternative)
echo ""
echo "Alternative: To deploy to Vercel instead, run:"
echo "cd frontend && vercel --prod"
