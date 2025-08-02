/**
 * Mastra Agent Implementation
 * Handles session analysis and takes action based on friction points
 */

import { Mastra } from '@mastra/core';
import { ComposioIntegration } from '@mastra/composio';
import { BasicIntegration } from '@mastra/basic';
import axios from 'axios';
import { ComposioService } from './composio.js';
import { logger } from './logger.js';

export async function createMastraAgent() {
  // Initialize Mastra with integrations
  const mastra = new Mastra({
    integrations: [
      new ComposioIntegration({
        apiKey: process.env.COMPOSIO_API_KEY,
      }),
      new BasicIntegration({
        apiKey: process.env.BASIC_API_KEY,
      }),
    ],
  });

  // Define the agent
  const agent = mastra.createAgent({
    name: 'FunctionAnalysisAgent',
    description: 'Monitors video session analysis and takes action on friction points',
    
    tools: [
      {
        name: 'fetchSessionData',
        description: 'Fetch session data from the backend API',
        execute: async ({ sessionId }) => {
          try {
            const response = await axios.get(
              `${process.env.BACKEND_API_URL}/api/session/${sessionId}`,
              {
                headers: {
                  'X-API-Key': process.env.API_KEY,
                },
              }
            );
            return response.data;
          } catch (error) {
            console.error(`Error fetching session ${sessionId}:`, error.message);
            throw error;
          }
        },
      },
      
      {
        name: 'analyzeFriction',
        description: 'Analyze friction points and determine severity',
        execute: async ({ sessionData }) => {
          const frictionPoints = sessionData.frictionPoints || [];
          const behaviorSummary = sessionData.behaviorSummary || '';
          
          // Check for high-priority keywords
          const highPriorityKeywords = (process.env.HIGH_PRIORITY_KEYWORDS || '').split(',');
          const hasHighPriority = highPriorityKeywords.some(keyword => 
            behaviorSummary.toLowerCase().includes(keyword.toLowerCase())
          );
          
          // Calculate severity
          const severity = {
            total: frictionPoints.length,
            high: frictionPoints.filter(fp => 
              highPriorityKeywords.some(kw => 
                fp.description?.toLowerCase().includes(kw.toLowerCase())
              )
            ).length,
            threshold: parseInt(process.env.FRICTION_THRESHOLD || '3'),
            exceedsThreshold: frictionPoints.length >= parseInt(process.env.FRICTION_THRESHOLD || '3'),
            hasHighPriority,
          };
          
          return {
            frictionPoints,
            severity,
            actionRequired: severity.exceedsThreshold || hasHighPriority,
          };
        },
      },
      
      {
        name: 'createGitHubIssue',
        description: 'Create a GitHub issue for high-priority friction points',
        execute: async ({ sessionData, analysis }) => {
          const composio = mastra.getIntegration('composio');
          
          // Format issue body
          const issueBody = `
## Session Analysis Report

**Session ID:** ${sessionData.sessionId}
**Date:** ${new Date(sessionData.metadata?.uploadTime).toISOString()}
**Video:** ${sessionData.metadata?.filename}

### Friction Points Detected: ${analysis.frictionPoints.length}

${analysis.frictionPoints.map((fp, idx) => `
${idx + 1}. **${fp.type}** at ${fp.timestamp}s
   - ${fp.description}
`).join('\n')}

### AI Behavior Summary

${sessionData.behaviorSummary}

### Severity Analysis

- Total friction points: ${analysis.severity.total}
- High priority: ${analysis.severity.high}
- Exceeds threshold: ${analysis.severity.exceedsThreshold ? 'Yes' : 'No'}

---
*This issue was automatically created by the Function Analysis Agent*
`;

          const issue = await composio.github.createIssue({
            owner: process.env.GITHUB_REPO_OWNER,
            repo: process.env.GITHUB_REPO_NAME,
            title: `[Auto] High friction detected in session ${sessionData.sessionId}`,
            body: issueBody,
            labels: ['friction-analysis', 'auto-generated', analysis.severity.hasHighPriority ? 'high-priority' : 'medium-priority'],
          });
          
          return issue;
        },
      },
      
      {
        name: 'sendSlackNotification',
        description: 'Send notification to Slack',
        execute: async ({ sessionData, analysis, githubIssue }) => {
          const composio = mastra.getIntegration('composio');
          
          const message = {
            text: `🚨 Session Analysis Alert`,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: '🚨 High Friction Session Detected',
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Session ID:*\n${sessionData.sessionId}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Friction Points:*\n${analysis.frictionPoints.length}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Priority:*\n${analysis.severity.hasHighPriority ? '🔴 High' : '🟡 Medium'}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Video:*\n${sessionData.metadata?.filename || 'Unknown'}`,
                  },
                ],
              },
            ],
          };
          
          if (githubIssue) {
            message.blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `📝 *GitHub Issue Created:* <${githubIssue.html_url}|#${githubIssue.number}>`,
              },
            });
          }
          
          await composio.slack.sendMessage({
            channel: process.env.SLACK_CHANNEL,
            ...message,
          });
          
          return { sent: true };
        },
      },
      
      {
        name: 'storeInBasic',
        description: 'Store session summary in Basic.tech personal data store',
        execute: async ({ sessionData, analysis }) => {
          const basic = mastra.getIntegration('basic');
          
          const summary = {
            sessionId: sessionData.sessionId,
            timestamp: new Date().toISOString(),
            frictionCount: analysis.frictionPoints.length,
            topFriction: analysis.frictionPoints.slice(0, 3).map(fp => ({
              type: fp.type,
              description: fp.description.substring(0, 100),
            })),
            severity: analysis.severity,
            behaviorSummary: sessionData.behaviorSummary.substring(0, 500),
          };
          
          await basic.store('session_summaries', sessionData.sessionId, summary);
          
          return { stored: true };
        },
      },
      
      {
        name: 'compareWithHistory',
        description: 'Compare with historical sessions',
        execute: async ({ sessionData, analysis }) => {
          const basic = mastra.getIntegration('basic');
          
          // Get recent session summaries
          const recentSessions = await basic.query('session_summaries', {
            limit: 10,
            orderBy: 'timestamp',
            order: 'desc',
          });
          
          if (recentSessions.length > 0) {
            const avgFriction = recentSessions.reduce((sum, s) => sum + s.frictionCount, 0) / recentSessions.length;
            const trend = analysis.frictionPoints.length > avgFriction ? 'increasing' : 'decreasing';
            
            return {
              historicalAverage: avgFriction.toFixed(1),
              currentCount: analysis.frictionPoints.length,
              trend,
              comparison: `Current session has ${analysis.frictionPoints.length} friction points vs average of ${avgFriction.toFixed(1)}`,
            };
          }
          
          return {
            historicalAverage: 0,
            currentCount: analysis.frictionPoints.length,
            trend: 'no_data',
            comparison: 'No historical data available',
          };
        },
      },
    ],
    
    workflow: async ({ sessionId }) => {
      console.log(`\n🤖 Agent processing session: ${sessionId}`);
      
      try {
        // Step 1: Fetch session data
        const sessionData = await agent.execute('fetchSessionData', { sessionId });
        console.log(`✓ Fetched session data`);
        
        // Step 2: Analyze friction points
        const analysis = await agent.execute('analyzeFriction', { sessionData });
        console.log(`✓ Analyzed friction: ${analysis.frictionPoints.length} points found`);
        
        // Step 3: Store in Basic.tech
        await agent.execute('storeInBasic', { sessionData, analysis });
        console.log(`✓ Stored summary in Basic.tech`);
        
        // Step 4: Compare with history
        const comparison = await agent.execute('compareWithHistory', { sessionData, analysis });
        console.log(`✓ Historical comparison: ${comparison.comparison}`);
        
        // Step 5: Take action if needed
        let githubIssue = null;
        if (analysis.actionRequired) {
          console.log(`⚠️  Action required - severity exceeds threshold or has high priority`);
          
          // Create GitHub issue
          githubIssue = await agent.execute('createGitHubIssue', { sessionData, analysis });
          console.log(`✓ Created GitHub issue #${githubIssue.number}`);
        }
        
        // Step 6: Always send Slack notification for completed analysis
        await agent.execute('sendSlackNotification', { 
          sessionData, 
          analysis, 
          githubIssue,
          comparison 
        });
        console.log(`✓ Sent Slack notification`);
        
        return {
          sessionId,
          processed: true,
          actionTaken: analysis.actionRequired,
          githubIssue: githubIssue?.number,
          comparison,
        };
        
      } catch (error) {
        console.error(`❌ Error processing session ${sessionId}:`, error);
        throw error;
      }
    },
  });
  
  // Add processSession method
  agent.processSession = async (sessionId) => {
    return await agent.workflow({ sessionId });
  };
  
  return agent;
}
