# Function Hackathon - AI-Powered Session Friction Analysis Platform

A monorepo project that uses AI to analyze user session videos, detect friction points, and automatically create actionable insights and bug tickets.

## Project Structure

```
function-hackathon/
├── backend/        # Server-side code and AI pipelines
├── agents/         # Mastra agent orchestration code
├── frontend/       # Web dashboard and upload UI
└── package.json    # Root monorepo configuration
```

## Tech Stack

- **Backend**: Python (Flask), Google Cloud Platform (Storage, Run, Firestore, Pub/Sub)
- **Frontend**: Next.js (React) with TypeScript
- **AI**: Anthropic Claude API for multimodal analysis
- **Orchestration**: n8n, Mastra agents
- **Integrations**: Composio (GitHub, Slack), Basic.tech, Vapi

## Features

- 📹 Video upload and storage in Google Cloud Storage
- 🔍 Automatic frame extraction and mouse tracking
- 🤖 AI-powered friction point detection using Anthropic
- 📊 Natural language queries across sessions
- 🎫 Automated bug ticket creation via Composio
- 🎙️ Voice interface via Vapi (optional)
- 📈 Comprehensive dashboards and heat maps

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- Google Cloud Platform account
- Anthropic API key
- Composio account
- Basic.tech account (beta access)
- n8n instance (self-hosted or cloud)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/srivastavanik/function.git
cd function
```

2. Run the setup script:
```bash
./setup.sh
```

3. Configure environment variables:
```bash
# The setup script creates a .env file from .env.example
# Edit .env with your API keys
nano .env
```

4. Required API Keys:
   - **Google Cloud**: Project ID and service account credentials
   - **Anthropic**: API key for Claude AI analysis  
   - **Composio**: API key for GitHub/Slack integrations
   - **GitHub**: Personal access token for issue creation
   - **Slack**: Webhook URL for notifications
   - **Basic.tech** (optional): For agent memory
   - **Vapi** (optional): For voice interface

5. Configure Google Cloud:
```bash
gcloud auth login
gcloud config set project <your-project-id>
```

### Development

Run all services:
```bash
npm run dev
```

Or run individually:
```bash
npm run dev:backend   # Backend server
npm run dev:frontend  # Frontend dashboard
```

## Deployment

The project is designed to deploy on Google Cloud Platform:

- Backend: Cloud Run
- Storage: Cloud Storage
- Database: Firestore
- Messaging: Pub/Sub
- Frontend: Cloud Run or Vercel

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
