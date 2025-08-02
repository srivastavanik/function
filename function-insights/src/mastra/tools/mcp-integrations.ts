import { createTool } from '@mastra/core/tools';
import { MastraMCPClient } from '@mastra/mcp';
import { z } from 'zod';

// GitHub MCP integration using Mastra's MCP client
export const createGitHubIssueTool = createTool({
  id: 'create-github-issue',
  description: 'Create a GitHub issue when friction points are detected',
  inputSchema: z.object({
    title: z.string().describe('Issue title'),
    body: z.string().describe('Issue description with friction details'),
    labels: z.array(z.string()).default(['friction-analysis', 'ux-issue']),
    assignees: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    issueNumber: z.number().optional(),
    url: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      console.log(`Creating GitHub issue: ${context.title}`);
      
      // In production, this would use the actual GitHub API via Composio
      const mockIssueNumber = Math.floor(Math.random() * 1000) + 1;
      
      return {
        success: true,
        issueNumber: mockIssueNumber,
        url: `https://github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}/issues/${mockIssueNumber}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// Slack integration tool
export const sendSlackAlertTool = createTool({
  id: 'send-slack-alert',
  description: 'Send priority alerts to Slack for high-severity friction points',
  inputSchema: z.object({
    sessionId: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
    message: z.string(),
    frictionCount: z.number(),
    urgentActions: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Slack webhook URL not configured');
      }

      const color = context.severity === 'high' ? '#ff0000' : 
                   context.severity === 'medium' ? '#ffaa00' : '#00ff00';
      
      const slackMessage = {
        text: `🚨 Friction Analysis Alert - Session ${context.sessionId}`,
        attachments: [{
          color,
          fields: [
            {
              title: 'Severity',
              value: context.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Friction Points',
              value: context.frictionCount.toString(),
              short: true,
            },
            {
              title: 'Details',
              value: context.message,
              short: false,
            },
          ],
          actions: context.urgentActions?.map(action => ({
            type: 'button',
            text: action,
            style: context.severity === 'high' ? 'danger' : 'default',
          })) || [],
        }],
      };

      console.log(`Sending Slack alert for session: ${context.sessionId}`);
      // Mock successful response
      return {
        success: true,
        messageId: `slack_msg_${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// Composio GitHub integration
export const composioGitHubTool = createTool({
  id: 'composio-github-action',
  description: 'Use Composio to perform GitHub actions like creating issues or PRs',
  inputSchema: z.object({
    action: z.enum(['create_issue', 'create_pr', 'add_comment']),
    data: z.object({
      title: z.string().optional(),
      body: z.string().optional(),
      branch: z.string().optional(),
      issueNumber: z.number().optional(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.any().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      console.log(`Executing Composio GitHub action: ${context.action}`);
      
      // Mock Composio integration - in production this would use actual Composio SDK
      switch (context.action) {
        case 'create_issue':
          return {
            success: true,
            result: {
              id: Math.floor(Math.random() * 1000) + 1,
              number: Math.floor(Math.random() * 100) + 1,
              url: `https://github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}/issues/123`,
            },
          };
        case 'create_pr':
          return {
            success: true,
            result: {
              id: Math.floor(Math.random() * 1000) + 1,
              number: Math.floor(Math.random() * 100) + 1,
              url: `https://github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}/pull/45`,
            },
          };
        default:
          return {
            success: true,
            result: { message: 'Action completed successfully' },
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});