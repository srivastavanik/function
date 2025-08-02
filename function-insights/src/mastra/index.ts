
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { sessionProcessingWorkflow } from './workflows/session-processing-workflow';
import { sessionAnalysisAgent } from './agents/session-analysis-agent';
import { frictionAnalyzerAgent } from './agents/friction-analyzer-agent';
import { videoAnalysisTool, slackNotificationTool } from './tools/video-analysis-tool';
import { createGitHubIssueTool, sendSlackAlertTool, composioGitHubTool } from './tools/mcp-integrations';

export const mastra = new Mastra({
  workflows: { sessionProcessingWorkflow },
  agents: { sessionAnalysisAgent, frictionAnalyzerAgent },
  tools: { 
    videoAnalysisTool, 
    slackNotificationTool, 
    createGitHubIssueTool, 
    sendSlackAlertTool, 
    composioGitHubTool 
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Function Insights',
    level: 'info',
  }),
});
