import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const videoAnalysisTool = createTool({
  id: 'analyze-video',
  description: 'Analyze a video file for user behavior and friction points',
  inputSchema: z.object({
    videoUrl: z.string().describe('URL or path to the video file'),
    sessionId: z.string().describe('Unique session identifier'),
    options: z.object({
      trackMouse: z.boolean().default(true),
      detectClicks: z.boolean().default(true),
      identifyFriction: z.boolean().default(true),
    }).optional(),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    duration: z.number(),
    frictionPoints: z.array(z.object({
      timestamp: z.number(),
      type: z.string(),
      description: z.string(),
      severity: z.enum(['high', 'medium', 'low']),
    })),
    mouseData: z.object({
      positions: z.array(z.object({
        timestamp: z.number(),
        x: z.number(),
        y: z.number(),
      })),
      clicks: z.array(z.object({
        timestamp: z.number(),
        x: z.number(),
        y: z.number(),
        type: z.enum(['left', 'right', 'middle']),
      })),
    }),
    stats: z.object({
      totalMovements: z.number(),
      averageSpeed: z.number(),
      clickCount: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    console.log(`Analyzing video: ${context.videoUrl} for session: ${context.sessionId}`);
    
    // Mock analysis - replace with actual video processing
    return {
      sessionId: context.sessionId,
      duration: 120.5,
      frictionPoints: [
        {
          timestamp: 45.2,
          type: 'hesitation',
          description: 'User paused for 3 seconds on form input',
          severity: 'medium' as const,
        },
        {
          timestamp: 78.1,
          type: 'confusion',
          description: 'Multiple clicks on non-clickable element',
          severity: 'high' as const,
        },
      ],
      mouseData: {
        positions: [
          { timestamp: 0, x: 100, y: 200 },
          { timestamp: 1, x: 105, y: 205 },
          { timestamp: 2, x: 110, y: 210 },
        ],
        clicks: [
          { timestamp: 10.5, x: 250, y: 350, type: 'left' as const },
          { timestamp: 45.8, x: 180, y: 200, type: 'left' as const },
        ],
      },
      stats: {
        totalMovements: 847,
        averageSpeed: 3.2,
        clickCount: 15,
      },
    };
  },
});

export const slackNotificationTool = createTool({
  id: 'send-slack-notification',
  description: 'Send friction analysis results to Slack channel',
  inputSchema: z.object({
    sessionId: z.string(),
    message: z.string(),
    channel: z.string().default('#func-notifications'),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    console.log(`Sending Slack notification for session: ${context.sessionId}`);
    
    // Mock Slack API call
    const success = Math.random() > 0.1; // 90% success rate
    
    return {
      success,
      messageId: success ? `msg_${Date.now()}` : undefined,
      error: success ? undefined : 'Failed to send Slack notification',
    };
  },
});