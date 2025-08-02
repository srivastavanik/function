/**
 * Mastra Agent Orchestration for Function Hackathon
 * This agent monitors session analysis results and takes action based on friction points
 */

import { config } from 'dotenv';
import { Firestore } from '@google-cloud/firestore';
import express from 'express';
import { createMastraAgent } from './lib/agent.js';
import { sessionMonitor } from './lib/monitor.js';

// Load environment variables
config();

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize Firestore
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Create Mastra agent
const agent = await createMastraAgent();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', agent: 'active' });
});

// Webhook endpoint for session completion notifications
app.post('/webhook/session-completed', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }
    
    console.log(`Received completion notification for session: ${sessionId}`);
    
    // Process the session with our agent
    await agent.processSession(sessionId);
    
    res.json({ status: 'processed' });
  } catch (error) {
    console.error('Error processing session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual trigger endpoint for testing
app.post('/process/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`Manual trigger for session: ${sessionId}`);
    
    // Process the session with our agent
    await agent.processSession(sessionId);
    
    res.json({ status: 'processed' });
  } catch (error) {
    console.error('Error processing session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start session monitor (polls Firestore for completed sessions)
sessionMonitor.start(firestore, agent);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Agent server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/session-completed`);
});
