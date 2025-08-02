/**
 * Function Insights Agent Implementation
 * Handles session analysis and takes action based on friction points
 */

import axios from 'axios';
import { ComposioService } from './composio.js';
import { logger } from './logger.js';
import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore();

export class FrictionAnalysisAgent {
    constructor() {
        this.composioService = new ComposioService(process.env.COMPOSIO_API_KEY);
        this.initialized = false;
    }
    
    async initialize() {
        try {
            await this.composioService.initialize();
            this.initialized = true;
            logger.info('Friction Analysis Agent initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize agent:', error);
            throw error;
        }
    }

    async processSession(sessionId) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        try {
            // Fetch session data from Firestore
            const sessionData = await this.getSessionData(sessionId);
            
            if (!sessionData) {
                throw new Error(`Session ${sessionId} not found`);
            }
            
            // Analyze friction points
            const analysis = await this.analyzeFrictionPoints(sessionData);
            
            // Create GitHub issues for high-priority friction points
            if (analysis.highPriorityIssues && analysis.highPriorityIssues.length > 0) {
                await this.createGitHubIssues(analysis.highPriorityIssues, sessionId);
            }
            
            // Send Slack notifications
            await this.sendSlackNotifications(analysis, sessionId);
            
            return {
                sessionId,
                analysis,
                actionsCreated: true
            };
            
        } catch (error) {
            logger.error(`Error processing session ${sessionId}:`, error);
            throw error;
        }
    }

    async getSessionData(sessionId) {
        try {
            const doc = await firestore
                .collection(process.env.FIRESTORE_COLLECTION_SESSIONS)
                .doc(sessionId)
                .get();
            
            if (!doc.exists) {
                return null;
            }
            
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            logger.error(`Error fetching session ${sessionId}:`, error);
            throw error;
        }
    }

    async analyzeFrictionPoints(sessionData) {
        try {
            const { frictionPoints = [], stats = {} } = sessionData;
            
            // Categorize friction points by severity
            const highPriorityIssues = frictionPoints.filter(point => 
                point.priority === 'high' || point.type === 'rage_click'
            );
            
            const mediumPriorityIssues = frictionPoints.filter(point => 
                point.priority === 'medium'
            );
            
            // Calculate metrics
            const totalFrictionPoints = frictionPoints.length;
            const rageClickCount = frictionPoints.filter(p => p.type === 'rage_click').length;
            const averageTaskTime = stats.averageTaskTime || 0;
            
            // Generate insights
            const insights = this.generateInsights(frictionPoints, stats);
            
            return {
                totalFrictionPoints,
                highPriorityIssues: highPriorityIssues.map(this.formatIssueForGitHub),
                mediumPriorityIssues,
                rageClickCount,
                averageTaskTime,
                insights,
                topIssues: highPriorityIssues.slice(0, 3) // Top 3 for Slack
            };
        } catch (error) {
            logger.error('Error analyzing friction points:', error);
            throw error;
        }
    }

    formatIssueForGitHub(issue) {
        return {
            title: issue.description || `${issue.type} detected`,
            description: issue.description || `Friction point of type ${issue.type} detected`,
            severity: issue.priority || 'medium',
            frequency: issue.frequency || 1,
            recommendation: this.generateRecommendation(issue)
        };
    }

    generateRecommendation(issue) {
        const recommendations = {
            rage_click: 'Consider improving button responsiveness or providing clearer visual feedback',
            slow_loading: 'Optimize page load times and add loading indicators',
            form_error: 'Improve form validation and error messaging',
            navigation_confusion: 'Simplify navigation structure and add breadcrumbs'
        };
        
        return recommendations[issue.type] || 'Review user experience for this interaction';
    }

    generateInsights(frictionPoints, stats) {
        const insights = [];
        
        if (frictionPoints.length > 5) {
            insights.push('High number of friction points detected - consider UX review');
        }
        
        if (stats.averageTaskTime > 120) {
            insights.push('Users taking longer than expected to complete tasks');
        }
        
        const rageClicks = frictionPoints.filter(p => p.type === 'rage_click').length;
        if (rageClicks > 0) {
            insights.push(`${rageClicks} rage click events detected - check UI responsiveness`);
        }
        
        return insights;
    }

    async createGitHubIssues(issues, sessionId) {
        for (const issue of issues) {
            try {
                const result = await this.composioService.createGitHubIssue({
                    title: `[Friction Point] ${issue.title}`,
                    body: `**Session ID:** ${sessionId}\n\n**Description:** ${issue.description}\n\n**Severity:** ${issue.severity}\n\n**Frequency:** ${issue.frequency}\n\n**Recommendation:** ${issue.recommendation}\n\n**Session Analysis:** View detailed session data at ${process.env.FRONTEND_URL}/session/${sessionId}`,
                    labels: ['friction-point', `severity-${issue.severity.toLowerCase()}`, 'automated'],
                    assignees: [process.env.GITHUB_REPO_OWNER]
                });
                
                logger.info(`Created GitHub issue: ${result.url}`);
            } catch (error) {
                logger.error('Failed to create GitHub issue:', error);
            }
        }
    }

    async sendSlackNotifications(analysis, sessionId) {
        try {
            const message = this.formatSlackMessage(analysis, sessionId);
            
            const result = await this.composioService.sendSlackNotification({
                channel: process.env.SLACK_CHANNEL,
                message: message.text,
                attachments: message.attachments
            });
            
            logger.info('Sent Slack notification');
        } catch (error) {
            logger.error('Failed to send Slack notification:', error);
        }
    }

    formatSlackMessage(analysis, sessionId) {
        const highPriorityCount = analysis.highPriorityIssues?.length || 0;
        const totalIssues = analysis.totalFrictionPoints || 0;
        
        let text = `🚨 *New Friction Analysis Report*\n`;
        text += `📊 **Session ID:** ${sessionId}\n`;
        text += `📈 **Total Issues:** ${totalIssues}\n`;
        text += `⚠️ **High Priority:** ${highPriorityCount}\n`;
        text += `🔗 **View Details:** ${process.env.FRONTEND_URL}/session/${sessionId}`;
        
        const attachments = [];
        
        if (analysis.topIssues && analysis.topIssues.length > 0) {
            const fields = analysis.topIssues.map(issue => ({
                title: issue.title,
                value: `${issue.description} (${issue.severity})`,
                short: false
            }));
            
            attachments.push({
                color: highPriorityCount > 0 ? 'danger' : 'warning',
                title: 'Top Friction Points',
                fields: fields.slice(0, 3), // Limit to top 3
                footer: 'Function Insights',
                ts: Math.floor(Date.now() / 1000)
            });
        }
        
        return { text, attachments };
    }
}

// Export the agent creation function
export async function createMastraAgent() {
    const agent = new FrictionAnalysisAgent();
    await agent.initialize();
    return agent;
}