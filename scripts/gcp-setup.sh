#!/bin/bash

# Google Cloud Setup Script for Function Hackathon
# This script sets up the necessary Google Cloud infrastructure

set -e

echo "======================================"
echo "Google Cloud Setup for Function Hackathon"
echo "======================================"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found. Please create it first."
    exit 1
fi

# Set project
echo "Setting project to: $GOOGLE_CLOUD_PROJECT"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Enable required APIs
echo ""
echo "Enabling required APIs..."
apis=(
    "storage-component.googleapis.com"
    "run.googleapis.com"
    "firestore.googleapis.com"
    "pubsub.googleapis.com"
    "cloudbuild.googleapis.com"
    "secretmanager.googleapis.com"
    "cloudresourcemanager.googleapis.com"
)

for api in "${apis[@]}"; do
    echo "Enabling $api..."
    gcloud services enable $api
done

# Create Cloud Storage buckets
echo ""
echo "Creating Cloud Storage buckets..."

# Create video storage bucket
if ! gsutil ls -b gs://$GCS_BUCKET_NAME &> /dev/null; then
    echo "Creating bucket: $GCS_BUCKET_NAME"
    gsutil mb -p $GOOGLE_CLOUD_PROJECT -c STANDARD -l $CLOUD_RUN_REGION gs://$GCS_BUCKET_NAME
else
    echo "Bucket $GCS_BUCKET_NAME already exists"
fi

# Create results bucket
if ! gsutil ls -b gs://$GCS_RESULTS_BUCKET &> /dev/null; then
    echo "Creating bucket: $GCS_RESULTS_BUCKET"
    gsutil mb -p $GOOGLE_CLOUD_PROJECT -c STANDARD -l $CLOUD_RUN_REGION gs://$GCS_RESULTS_BUCKET
else
    echo "Bucket $GCS_RESULTS_BUCKET already exists"
fi

# Set bucket lifecycle rules (optional - delete old videos after 30 days)
echo ""
echo "Setting bucket lifecycle rules..."
cat > /tmp/lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": [""]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set /tmp/lifecycle.json gs://$GCS_BUCKET_NAME
rm /tmp/lifecycle.json

# Create Pub/Sub topic
echo ""
echo "Creating Pub/Sub topic..."
if ! gcloud pubsub topics describe $PUBSUB_TOPIC_VIDEO_UPLOADS &> /dev/null; then
    echo "Creating topic: $PUBSUB_TOPIC_VIDEO_UPLOADS"
    gcloud pubsub topics create $PUBSUB_TOPIC_VIDEO_UPLOADS
else
    echo "Topic $PUBSUB_TOPIC_VIDEO_UPLOADS already exists"
fi

# Create Pub/Sub subscription
echo ""
echo "Creating Pub/Sub subscription..."
if ! gcloud pubsub subscriptions describe $PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR &> /dev/null; then
    echo "Creating subscription: $PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR"
    gcloud pubsub subscriptions create $PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR \
        --topic=$PUBSUB_TOPIC_VIDEO_UPLOADS \
        --ack-deadline=600 \
        --max-retry-delay=600
else
    echo "Subscription $PUBSUB_SUBSCRIPTION_VIDEO_PROCESSOR already exists"
fi

# Initialize Firestore
echo ""
echo "Initializing Firestore..."
echo "Note: If Firestore is not initialized, you may need to do this manually in the console:"
echo "https://console.cloud.google.com/firestore/databases/-/create?project=$GOOGLE_CLOUD_PROJECT"

# Create Secret Manager secrets
echo ""
echo "Creating secrets in Secret Manager..."
secrets=(
    "anthropic-api-key:$ANTHROPIC_API_KEY"
    "api-key:$API_KEY"
    "composio-api-key:$COMPOSIO_API_KEY"
    "github-token:$GITHUB_TOKEN"
    "slack-webhook-url:$SLACK_WEBHOOK_URL"
    "slack-bot-token:$SLACK_BOT_TOKEN"
    "basic-api-key:$BASIC_API_KEY"
)

for secret_pair in "${secrets[@]}"; do
    secret_name="${secret_pair%%:*}"
    secret_value="${secret_pair#*:}"
    
    if [ ! -z "$secret_value" ] && [ "$secret_value" != "null" ]; then
        if ! gcloud secrets describe $secret_name &> /dev/null; then
            echo "Creating secret: $secret_name"
            echo -n "$secret_value" | gcloud secrets create $secret_name --data-file=-
        else
            echo "Secret $secret_name already exists"
        fi
    fi
done

# Create service account for Cloud Run
echo ""
echo "Creating service account..."
SERVICE_ACCOUNT_NAME="function-hackathon-sa"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL &> /dev/null; then
    echo "Creating service account: $SERVICE_ACCOUNT_NAME"
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Function Hackathon Service Account"
else
    echo "Service account $SERVICE_ACCOUNT_NAME already exists"
fi

# Grant necessary roles to service account
echo ""
echo "Granting roles to service account..."
roles=(
    "storage.admin"
    "firestore.user"
    "pubsub.publisher"
    "pubsub.subscriber"
    "secretmanager.secretAccessor"
    "logging.logWriter"
)

for role in "${roles[@]}"; do
    echo "Granting role: $role"
    gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/$role" \
        --quiet
done

echo ""
echo "======================================"
echo "Google Cloud setup completed!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Make sure Firestore is initialized in Native mode"
echo "2. Update your .env file with any missing values"
echo "3. Run the deployment scripts to deploy services to Cloud Run"
echo ""
echo "Service account created: $SERVICE_ACCOUNT_EMAIL"
echo "This will be used for Cloud Run deployments"
