# Slack Setup Instructions

Your Slack app credentials have been added to the `.env` file. You still need to complete these steps in your Slack app settings:

## 1. Create an Incoming Webhook

1. Go to your Slack app at: https://api.slack.com/apps/A098QJRNPNG
2. Navigate to **Features** → **Incoming Webhooks**
3. Toggle **Activate Incoming Webhooks** to ON
4. Click **Add New Webhook to Workspace**
5. Select the channel where you want notifications (e.g., #friction-alerts)
6. Copy the webhook URL (it will look like: `https://hooks.slack.com/services/T.../B.../...`)
7. Update `SLACK_WEBHOOK_URL` in your .env file with this URL

## 2. Install App and Get Bot Token

1. Go to **OAuth & Permissions** in your Slack app settings
2. Click **Install to Workspace**
3. Review and allow the permissions
4. After installation, copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Update `SLACK_BOT_TOKEN` in your .env file with this token

## 3. Configure Bot Permissions

Make sure your bot has these OAuth scopes under **OAuth & Permissions** → **Scopes**:
- `chat:write` - Send messages
- `chat:write.public` - Send messages to channels the bot isn't a member of
- `incoming-webhook` - Post messages via webhooks

## 4. Update Channel Name

Update `SLACK_CHANNEL` in your .env file with your desired channel (e.g., `#friction-alerts`)

## Testing Your Setup

Once configured, the Function app will:
- Send notifications when video analysis completes
- Alert on high-priority friction points
- Provide links to view details in the dashboard

## Troubleshooting

- Make sure your app is installed to the correct workspace
- Verify the bot has been invited to the channel (type `/invite @your-bot-name` in the channel)
- Check that all tokens and URLs are correctly copied without extra spaces
