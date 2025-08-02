/**
 * Voice Interface Integration for Function Insights
 * Provides natural language query capabilities via Vapi
 */

import VapiService from './vapi.js';
import { logger } from '../logger.js';

export class VoiceHandler {
  constructor(config) {
    this.vapiService = null;
    
    if (config.vapiApiKey) {
      this.vapiService = new VapiService({
        apiKey: config.vapiApiKey,
        phoneNumber: config.vapiPhoneNumber,
        assistantId: config.vapiAssistantId
      });
      
      this.initializeAssistant();
    }
  }

  async initializeAssistant() {
    try {
      const assistant = await this.vapiService.createAssistant();
      logger.info('Vapi assistant initialized', { 
        assistantId: assistant.id,
        name: assistant.name 
      });
      
      // Configure phone number if provided
      if (process.env.VAPI_PHONE_NUMBER) {
        await this.vapiService.configurePhoneNumber(process.env.VAPI_PHONE_NUMBER);
      }
    } catch (error) {
      logger.error('Failed to initialize Vapi assistant', error);
    }
  }

  async handleWebhook(payload) {
    if (!this.vapiService) {
      throw new Error('Voice interface not configured');
    }
    
    return await this.vapiService.handleWebhook(payload);
  }

  async getStatus() {
    if (!this.vapiService) {
      return { enabled: false };
    }
    
    try {
      const assistant = await this.vapiService.getAssistant();
      const phoneNumbers = await this.vapiService.listPhoneNumbers();
      
      return {
        enabled: true,
        assistant: {
          id: assistant.id,
          name: assistant.name,
          created: assistant.createdAt
        },
        phoneNumbers: phoneNumbers.map(pn => ({
          id: pn.id,
          number: pn.number,
          provider: pn.provider
        }))
      };
    } catch (error) {
      logger.error('Failed to get voice status', error);
      return { 
        enabled: true, 
        error: error.message 
      };
    }
  }

  isEnabled() {
    return this.vapiService !== null;
  }
}

export default VoiceHandler;
