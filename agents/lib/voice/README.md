# Voice Interface Module

This module provides voice-based natural language query capabilities for Function Insights using Vapi.

## Features

- Phone-based voice queries for session analysis
- Natural language understanding of friction point queries
- Automated summarization of analysis results
- Integration with the main query API

## Setup

1. Sign up for Vapi at https://vapi.ai
2. Apply for their Startup Program for free minutes
3. Create a Twilio account for phone number provisioning
4. Add the following environment variables:

```env
# Vapi Configuration
VAPI_API_KEY=your_vapi_api_key
VAPI_PHONE_NUMBER=+1234567890  # Your Twilio number
VAPI_ASSISTANT_ID=  # Optional, will be created automatically
VAPI_WEBHOOK_SECRET=your_webhook_secret

# Twilio Configuration (for phone provisioning)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

## Usage

### Calling the Voice Assistant

Once configured, users can call the provisioned phone number and interact with the assistant using natural language:

- "Show me sessions with rage clicks from the last week"
- "What are the most common friction points today?"
- "Get details for session ABC123"
- "Summarize all high-priority issues"

### Voice Webhook Integration

The backend provides a `/api/voice/webhook` endpoint that Vapi calls to process voice queries. The webhook handles:

1. Function calls from the assistant
2. Speech-to-text updates
3. Call lifecycle events

### Supported Functions

The voice assistant can execute these functions:

- `searchSessions`: Find sessions matching natural language criteria
- `getSessionDetails`: Get specific session information
- `summarizeFriction`: Aggregate friction points across time periods

## Architecture

```
User Phone Call
     ↓
Vapi Voice Service
     ↓
Voice Webhook (/api/voice/webhook)
     ↓
Function Handler (agents/lib/voice)
     ↓
Backend Query API
     ↓
Firestore + AI Analysis
```

## Testing

1. Call your configured phone number
2. Try example queries:
   - "Find sessions where users struggled with the checkout process"
   - "Show me all friction points from yesterday"
   - "What's the biggest UX issue we're facing?"

## Monitoring

Voice interactions are logged and can be monitored through:
- Vapi dashboard for call logs and transcripts
- Application logs for function execution
- Backend metrics for query performance

## Cost Considerations

- Vapi charges per minute of voice interaction
- Twilio charges for phone number rental and usage
- Consider implementing call duration limits for cost control
