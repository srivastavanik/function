import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const analyzeVideoStep = createStep({
  id: 'analyze-video',
  description: 'Analyze uploaded video for friction points and user behavior',
  inputSchema: z.object({
    sessionId: z.string(),
    videoUrl: z.string(),
    userId: z.string().optional(),
    metadata: z.object({
      duration: z.number(),
      resolution: z.string(),
      fps: z.number(),
    }).optional(),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    frictionPoints: z.array(z.object({
      timestamp: z.number(),
      type: z.string(),
      description: z.string(),
      severity: z.enum(['high', 'medium', 'low']),
      coordinates: z.object({
        x: z.number(),
        y: z.number(),
      }).optional(),
    })),
    mousePositions: z.array(z.object({
      timestamp: z.number(),
      x: z.number(),
      y: z.number(),
    })),
    stats: z.object({
      totalMovements: z.number(),
      averageSpeed: z.number(),
      totalDistance: z.number(),
    }),
  }),
  execute: async ({ inputData }) => {
    // Simulate video analysis processing
    console.log(`Processing video analysis for session: ${inputData.sessionId}`);
    
    // Mock data - in production this would call the actual video processor
    return {
      sessionId: inputData.sessionId,
      frictionPoints: [
        {
          timestamp: 30.5,
          type: 'hesitation',
          description: 'User hesitated on form field',
          severity: 'medium' as const,
          coordinates: { x: 350, y: 200 },
        },
      ],
      mousePositions: [
        { timestamp: 0, x: 100, y: 100 },
        { timestamp: 1, x: 120, y: 110 },
        { timestamp: 2, x: 140, y: 120 },
      ],
      stats: {
        totalMovements: 150,
        averageSpeed: 2.5,
        totalDistance: 1200,
      },
    };
  },
});

const generateInsightsStep = createStep({
  id: 'generate-insights',
  description: 'Generate AI insights from analysis data',
  inputSchema: z.object({
    sessionId: z.string(),
    frictionPoints: z.array(z.any()),
    mousePositions: z.array(z.any()),
    stats: z.object({
      totalMovements: z.number(),
      averageSpeed: z.number(),
      totalDistance: z.number(),
    }),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    insights: z.string(),
    recommendations: z.array(z.string()),
    priority: z.enum(['high', 'medium', 'low']),
  }),
  execute: async ({ inputData }) => {
    console.log(`Generating insights for session: ${inputData.sessionId}`);
    
    return {
      sessionId: inputData.sessionId,
      insights: `Analysis of session ${inputData.sessionId} revealed ${inputData.frictionPoints.length} friction points. User showed ${inputData.stats.totalMovements} mouse movements with average speed of ${inputData.stats.averageSpeed}px/s.`,
      recommendations: [
        'Improve form field clarity and labeling',
        'Add progress indicators for multi-step processes',
        'Optimize button placement and size',
      ],
      priority: 'medium' as const,
    };
  },
});

export const sessionProcessingWorkflow = createWorkflow({
  id: 'session-processing-workflow',
  description: 'Complete workflow for processing and analyzing user sessions',
  inputSchema: z.object({
    sessionId: z.string(),
    videoUrl: z.string(),
    userId: z.string().optional(),
    metadata: z.object({
      duration: z.number(),
      resolution: z.string(),
      fps: z.number(),
    }).optional(),
  }),
  outputSchema: z.object({
    sessionId: z.string(),
    frictionPoints: z.array(z.any()),
    insights: z.string(),
    recommendations: z.array(z.string()),
    priority: z.enum(['high', 'medium', 'low']),
  }),
})
  .then(analyzeVideoStep)
  .then(generateInsightsStep);