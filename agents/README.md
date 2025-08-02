# Function Hackathon - Mastra Agent Orchestration

This service provides intelligent agent orchestration for the Function Hackathon project using Mastra, Composio, and Basic.tech integrations.

## Overview

The agent monitors completed video analysis sessions and automatically:
- Creates GitHub issues for high-friction sessions
- Sends Slack notifications
- Stores session summaries in Basic.tech for historical comparison
- Tracks friction trends across sessions

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

3. Set up integrations:
   - **Composio**: Sign up at [composio.dev](https://composio.dev) and get API key
   - **Basic.tech**: Apply for beta access at [basic.tech](https://basic.tech)
   - **GitHub**: Configure repo access in Composio
   - **Slack**: Set up webhook URL for notifications

## Running the Agent

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Architecture

- **`index.js`**: Express server with webhook endpoints
- **`lib/agent.js`**: Mastra agent definition with tools and workflow
- **`lib/monitor.js`**: Firestore monitor that polls for completed sessions

## Endpoints

- `GET /health` - Health check
- `POST /webhook/session-completed` - Webhook for session completion notifications
- `POST /process/:sessionId` - Manual trigger for testing

## Agent Workflow

1. **Fetch Session Data**: Retrieves analysis results from backend API
2. **Analyze Friction**: Evaluates severity based on threshold and keywords
3. **Store in Basic.tech**: Saves summary for historical tracking
4. **Compare with History**: Checks trend vs recent sessions
5. **Create GitHub Issue**: If severity exceeds threshold
6. **Send Slack Notification**: Always sent for visibility

## Configuration

Key environment variables:

- `FRICTION_THRESHOLD`: Number of friction points to trigger action (default: 3)
- `HIGH_PRIORITY_KEYWORDS`: Comma-separated keywords that always trigger action
- `SLACK_CHANNEL`: Channel for notifications
- `GITHUB_REPO_OWNER`: GitHub organization/user
- `GITHUB_REPO_NAME`: Repository name

## Docker Deployment

Build the image:
```bash
docker build -t function-agents .
```

Run the container:
```bash
docker run -p 3001:3001 --env-file .env function-agents
```

## Monitoring

The agent logs all actions to stdout with emojis for easy scanning:
- 🤖 Processing start
- ✓ Successful steps
- ⚠️ Actions required
- ❌ Errors

Check Firestore for agent processing status:
- `agentProcessed`: Whether agent has processed
- `agentResult`: Processing outcome
- `agentProcessingError`: Any errors encountered
