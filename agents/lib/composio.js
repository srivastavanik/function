/**
 * Composio integration for GitHub and Slack automation
 */

// Mock Composio class
class Composio {
  constructor(config) {
    this.apiKey = config.apiKey;
  }
  
  async getConnectedAccounts() {
    return [];
  }
}
import { logger } from './logger.js';

export class ComposioService {
  constructor(apiKey) {
    this.composio = new Composio({
      apiKey: apiKey || process.env.COMPOSIO_API_KEY
    });
    this.initialized = false;
  }

  async initialize() {
    try {
      // Verify connection
      await this.composio.getConnectedAccounts();
      this.initialized = true;
      logger.info('Composio service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Composio:', error);
      throw error;
    }
  }

  /**
   * Create a GitHub issue for high-priority friction points
   */
  async createGitHubIssue(sessionData) {
    try {
      const { sessionId, frictionPoints, behaviorSummary, stats } = sessionData;
      
      // Count high-priority friction points
      const highPriorityCount = frictionPoints.filter(fp => 
        fp.description && (
          fp.description.toLowerCase().includes('error') ||
          fp.description.toLowerCase().includes('critical') ||
          fp.description.toLowerCase().includes('failure')
        )
      ).length;

      if (highPriorityCount === 0) {
        logger.info(`No high-priority friction points for session ${sessionId}`);
        return null;
      }

      // Format issue body
      const issueBody = this._formatGitHubIssue(sessionData, highPriorityCount);

      // Create issue using Composio GitHub tool
      const result = await this.composio.executeAction('github_create_issue', {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        title: `[User Session] ${highPriorityCount} high-priority friction points detected`,
        body: issueBody,
        labels: ['user-friction', 'auto-generated', 'ux-issue'],
        assignees: process.env.GITHUB_ASSIGNEES?.split(',') || []
      });

      logger.info(`Created GitHub issue for session ${sessionId}: ${result.data.html_url}`);
      return result.data;
    } catch (error) {
      logger.error('Failed to create GitHub issue:', error);
      throw error;
    }
  }

  /**
   * Send a Slack notification for analysis results
   */
  async sendSlackNotification(sessionData, issueUrl = null) {
    try {
      const { sessionId, stats, frictionPoints } = sessionData;
      
      // Build Slack message blocks
      const blocks = this._buildSlackBlocks(sessionData, issueUrl);

      // Send message using Composio Slack tool
      const result = await this.composio.executeAction('slack_send_message', {
        channel: process.env.SLACK_CHANNEL || '#function-alerts',
        blocks: blocks,
        text: `Session ${sessionId} analysis complete: ${frictionPoints.length} friction points found`
      });

      logger.info(`Sent Slack notification for session ${sessionId}`);
      return result.data;
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  /**
   * Create a Linear issue for tracking UX improvements
   */
  async createLinearIssue(sessionData) {
    try {
      const { sessionId, frictionPoints, behaviorSummary } = sessionData;
      
      if (!process.env.LINEAR_TEAM_ID) {
        logger.warn('LINEAR_TEAM_ID not configured, skipping Linear issue creation');
        return null;
      }

      const result = await this.composio.executeAction('linear_create_issue', {
        teamId: process.env.LINEAR_TEAM_ID,
        title: `UX Friction: Session ${sessionId}`,
        description: this._formatLinearDescription(sessionData),
        priority: this._calculatePriority(frictionPoints),
        labels: ['ux-friction', 'user-feedback']
      });

      logger.info(`Created Linear issue for session ${sessionId}: ${result.data.url}`);
      return result.data;
    } catch (error) {
      logger.error('Failed to create Linear issue:', error);
      throw error;
    }
  }

  /**
   * Format GitHub issue body
   */
  _formatGitHubIssue(sessionData, highPriorityCount) {
    const { sessionId, frictionPoints, behaviorSummary, stats } = sessionData;
    
    return `## User Session Analysis Report

**Session ID:** ${sessionId}
**Date:** ${new Date().toISOString()}
**High-Priority Friction Points:** ${highPriorityCount}
**Total Friction Points:** ${frictionPoints.length}

### Session Statistics
- **Total Frames Analyzed:** ${stats.totalFrames || 'N/A'}
- **Video Duration:** ${stats.videoDuration ? `${stats.videoDuration}s` : 'N/A'}
- **Mouse Positions Tracked:** ${stats.mousePositionsCount || 0}

### Behavior Summary
${behaviorSummary || 'No summary available'}

### Friction Points
${frictionPoints.map((fp, index) => `
#### ${index + 1}. ${fp.type || 'Unknown Type'}
- **Timestamp:** ${fp.timestamp}s
- **Frame:** ${fp.frameIndex}
- **Description:** ${fp.description}
`).join('\n')}

### Action Items
- [ ] Review friction points and identify root causes
- [ ] Implement UX improvements
- [ ] Test fixes with user group
- [ ] Monitor for recurrence

---
*This issue was automatically generated from user session analysis*
`;
  }

  /**
   * Build Slack message blocks
   */
  _buildSlackBlocks(sessionData, issueUrl) {
    const { sessionId, stats, frictionPoints } = sessionData;
    const frictionCount = frictionPoints.length;
    const highPriorityCount = frictionPoints.filter(fp => 
      fp.description?.toLowerCase().includes('error') ||
      fp.description?.toLowerCase().includes('critical')
    ).length;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎥 Session Analysis Complete'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Session ID:*\n${sessionId}`
          },
          {
            type: 'mrkdwn',
            text: `*Analysis Time:*\n${new Date().toLocaleString()}`
          }
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Friction Points:*\n${frictionCount}`
          },
          {
            type: 'mrkdwn',
            text: `*High Priority:*\n${highPriorityCount}`
          }
        ]
      }
    ];

    // Add summary section if available
    if (stats.behaviorSummary) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:*\n${stats.behaviorSummary.substring(0, 200)}...`
        }
      });
    }

    // Add GitHub issue link if created
    if (issueUrl) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*GitHub Issue Created:*\n<${issueUrl}|View Issue>`
        }
      });
    }

    // Add action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Session Details'
          },
          url: `${process.env.FRONTEND_URL}/session/${sessionId}`,
          style: 'primary'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Dashboard'
          },
          url: `${process.env.FRONTEND_URL}/sessions`
        }
      ]
    });

    return blocks;
  }

  /**
   * Format Linear issue description
   */
  _formatLinearDescription(sessionData) {
    const { sessionId, frictionPoints, behaviorSummary } = sessionData;
    
    return `Session ID: ${sessionId}

## Summary
${behaviorSummary || 'No summary available'}

## Friction Points (${frictionPoints.length} total)
${frictionPoints.map(fp => `- [${fp.timestamp}s] ${fp.description}`).join('\n')}

## Next Steps
- Review session recording
- Identify UX improvement opportunities
- Create implementation tasks
`;
  }

  /**
   * Calculate priority based on friction points
   */
  _calculatePriority(frictionPoints) {
    const highPriorityCount = frictionPoints.filter(fp => 
      fp.description?.toLowerCase().includes('error') ||
      fp.description?.toLowerCase().includes('critical')
    ).length;

    if (highPriorityCount >= 3) return 1; // Urgent
    if (highPriorityCount >= 1) return 2; // High
    if (frictionPoints.length >= 5) return 3; // Medium
    return 4; // Low
  }
}
