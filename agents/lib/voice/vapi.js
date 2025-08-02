import axios from 'axios';
import { logger } from '../logger.js';

class VapiService {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.phoneNumber = config.phoneNumber || null;
    this.assistantId = config.assistantId || null;
    this.apiUrl = 'https://api.vapi.ai/v1';
    
    if (!this.apiKey) {
      throw new Error('Vapi API key is required');
    }
  }

  /**
   * Create a voice assistant for natural language queries
   */
  async createAssistant() {
    try {
      const assistant = await this.request('POST', '/assistant', {
        name: 'Function Insights Assistant',
        firstMessage: 'Welcome to Function Insights. I can help you analyze user session recordings and find friction points. What would you like to know?',
        voice: {
          provider: 'elevenlabs',
          voiceId: 'rachel', // Professional female voice
          stability: 0.8,
          similarityBoost: 0.75
        },
        model: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          systemPrompt: `You are a helpful assistant for Function Insights, a platform that analyzes user session recordings to identify friction points and UX issues.

Your capabilities include:
- Searching for sessions with specific types of friction points
- Summarizing analysis results across multiple sessions
- Explaining detected issues and their potential impact
- Providing recommendations for UX improvements

When users ask questions, you should:
1. Understand their intent (e.g., finding rage clicks, slow responses, error patterns)
2. Translate their question into a query for the Function Insights API
3. Summarize the results in a clear, concise manner
4. Offer actionable insights when appropriate

Keep responses brief and conversational since this is a voice interface.`
        },
        serverUrl: `${process.env.CLOUD_RUN_BACKEND_URL}/api/voice/webhook`,
        serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET
      });

      this.assistantId = assistant.id;
      logger.info('Vapi assistant created', { assistantId: assistant.id });
      return assistant;
    } catch (error) {
      logger.error('Failed to create Vapi assistant', error);
      throw error;
    }
  }

  /**
   * Configure a phone number for the voice assistant
   */
  async configurePhoneNumber(phoneNumber) {
    try {
      const response = await this.request('POST', '/phone-number', {
        provider: 'twilio',
        number: phoneNumber,
        assistantId: this.assistantId,
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN
      });

      this.phoneNumber = phoneNumber;
      logger.info('Phone number configured for Vapi', { phoneNumber });
      return response;
    } catch (error) {
      logger.error('Failed to configure phone number', error);
      throw error;
    }
  }

  /**
   * Handle webhook from Vapi for processing voice queries
   */
  async handleWebhook(payload) {
    const { type, call, assistant, messages } = payload;

    switch (type) {
      case 'function-call':
        return await this.handleFunctionCall(payload);
      
      case 'speech-update':
        logger.info('Speech update received', { 
          transcript: payload.transcript,
          callId: call?.id 
        });
        break;
        
      case 'call-ended':
        logger.info('Call ended', { 
          callId: call?.id,
          duration: call?.duration 
        });
        break;
        
      default:
        logger.info('Vapi webhook received', { type });
    }

    return { success: true };
  }

  /**
   * Handle function calls from the assistant
   */
  async handleFunctionCall(payload) {
    const { functionCall, call } = payload;
    const { name, parameters } = functionCall;

    logger.info('Handling function call', { name, parameters });

    try {
      switch (name) {
        case 'searchSessions':
          return await this.searchSessions(parameters);
          
        case 'getSessionDetails':
          return await this.getSessionDetails(parameters);
          
        case 'summarizeFriction':
          return await this.summarizeFriction(parameters);
          
        default:
          throw new Error(`Unknown function: ${name}`);
      }
    } catch (error) {
      logger.error('Function call failed', error);
      return {
        error: error.message
      };
    }
  }

  /**
   * Search for sessions based on natural language query
   */
  async searchSessions(params) {
    const { query, limit = 5 } = params;
    
    try {
      // Call the backend query API
      const response = await axios.post(
        `${process.env.CLOUD_RUN_BACKEND_URL}/api/query`,
        {
          question: query,
          limit
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { sessions, summary } = response.data;
      
      // Format response for voice
      let voiceResponse = summary || `Found ${sessions.length} relevant sessions. `;
      
      if (sessions.length > 0) {
        voiceResponse += `The most recent session had ${sessions[0].frictionPoints?.length || 0} friction points detected.`;
      }

      return {
        response: voiceResponse,
        data: {
          sessions: sessions.slice(0, 3), // Limit detailed data for voice
          totalFound: sessions.length
        }
      };
    } catch (error) {
      logger.error('Search sessions failed', error);
      return {
        response: 'I encountered an error searching for sessions. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Get details for a specific session
   */
  async getSessionDetails(params) {
    const { sessionId } = params;
    
    try {
      const response = await axios.get(
        `${process.env.CLOUD_RUN_BACKEND_URL}/api/session/${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.API_KEY}`
          }
        }
      );

      const session = response.data;
      const frictionCount = session.frictionPoints?.length || 0;
      
      let voiceResponse = `Session ${sessionId} was recorded on ${new Date(session.uploadTime).toLocaleDateString()}. `;
      voiceResponse += `I detected ${frictionCount} friction points. `;
      
      if (frictionCount > 0) {
        const highPriority = session.frictionPoints.filter(fp => fp.priority === 'high').length;
        if (highPriority > 0) {
          voiceResponse += `${highPriority} of them are high priority issues that should be addressed immediately.`;
        }
      }

      return {
        response: voiceResponse,
        data: {
          sessionId,
          frictionPoints: frictionCount,
          summary: session.behaviorSummary
        }
      };
    } catch (error) {
      logger.error('Get session details failed', error);
      return {
        response: 'I couldn\'t retrieve details for that session.',
        error: error.message
      };
    }
  }

  /**
   * Summarize friction points across sessions
   */
  async summarizeFriction(params) {
    const { timeRange = '7d' } = params;
    
    try {
      const response = await axios.post(
        `${process.env.CLOUD_RUN_BACKEND_URL}/api/query`,
        {
          question: `Summarize all friction points from the last ${timeRange}`,
          aggregate: true
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { summary, stats } = response.data;
      
      let voiceResponse = summary || 'Here\'s what I found: ';
      
      if (stats) {
        voiceResponse += `Across ${stats.totalSessions} sessions, `;
        voiceResponse += `the most common issue was ${stats.topIssue} appearing ${stats.topIssueCount} times. `;
        
        if (stats.recommendations) {
          voiceResponse += `My top recommendation is to ${stats.recommendations[0]}.`;
        }
      }

      return {
        response: voiceResponse,
        data: stats
      };
    } catch (error) {
      logger.error('Summarize friction failed', error);
      return {
        response: 'I had trouble summarizing the friction points.',
        error: error.message
      };
    }
  }

  /**
   * Make HTTP request to Vapi API
   */
  async request(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.apiUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error('Vapi API request failed', {
        method,
        endpoint,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * List all configured phone numbers
   */
  async listPhoneNumbers() {
    try {
      return await this.request('GET', '/phone-number');
    } catch (error) {
      logger.error('Failed to list phone numbers', error);
      throw error;
    }
  }

  /**
   * Get assistant details
   */
  async getAssistant(assistantId = null) {
    try {
      const id = assistantId || this.assistantId;
      if (!id) {
        throw new Error('No assistant ID provided');
      }
      
      return await this.request('GET', `/assistant/${id}`);
    } catch (error) {
      logger.error('Failed to get assistant details', error);
      throw error;
    }
  }

  /**
   * Delete phone number
   */
  async deletePhoneNumber(phoneNumberId) {
    try {
      return await this.request('DELETE', `/phone-number/${phoneNumberId}`);
    } catch (error) {
      logger.error('Failed to delete phone number', error);
      throw error;
    }
  }

  /**
   * Get call logs
   */
  async getCallLogs(limit = 20) {
    try {
      return await this.request('GET', '/call', { limit });
    } catch (error) {
      logger.error('Failed to get call logs', error);
      throw error;
    }
  }
}

export default VapiService;
