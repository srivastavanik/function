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

2. Install dependencies:
```bash
npm install
cd backend && pip install -r requirements.txt
```

3. Set up environment variables (see `.env.example` in each directory)

4. Configure Google Cloud:
```bash
gcloud auth login
gcloud config set project function-hackathon
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
