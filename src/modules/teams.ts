/**
 * Microsoft Teams Messaging Module - TypeScript
 * Handles Microsoft Teams integration with trading analysis notifications
 */

import { getSymbolAnalysisByDate, getFactTableDataWithRange } from './data.js';
import { validateEnvironment, validateAnalysisData, validateUserInput, sanitizeHTML, safeValidate } from './validation.js';
import { KVUtils } from './shared-utilities.js';
import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createMessageTracker, MessageTracker } from './msg-tracking.js';
import type { CloudflareEnvironment } from '../types.js';

/**
 * Type Definitions for Teams Integration
 */

export interface TeamsMessage {
  title?: string;
  text: string;
  themeColor?: string;
  sections?: TeamsSection[];
  potentialAction?: TeamsAction[];
}

export interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityText?: string;
  facts?: TeamsFact[];
  markdown?: boolean;
}

export interface TeamsFact {
  name: string;
  value: string;
}

export interface TeamsAction {
  '@type': string;
  name: string;
  target?: string;
}

export interface TeamsMessageResult {
  success: boolean;
  response?: string;
  error?: string;
  message_id?: string;
}

/**
 * Generic Teams Message Sender with Error Handling
 */
export async function sendTeamsMessage(message: TeamsMessage, env: CloudflareEnvironment): Promise<TeamsMessageResult> {
  const executionId = `teams_send_${Date.now()}`;

  console.log(`🔍 [TEAMS-DEBUG] ${executionId} Starting Teams message send`);
  console.log(`🔍 [TEAMS-DEBUG] ${executionId} Teams config check:`);
  console.log(`  - TEAMS_WEBHOOK_URL: ${env.TEAMS_WEBHOOK_URL ? '✅ Present (' + env.TEAMS_WEBHOOK_URL.substring(0, 50) + '...)' : '❌ Missing'}`);

  if (!env.TEAMS_WEBHOOK_URL) {
    console.error(`❌ [TEAMS-DEBUG] ${executionId} Teams configuration incomplete - skipping send`);
    return { success: false, error: 'TEAMS_WEBHOOK_URL not configured' };
  }

  // Construct Teams message payload
  const teamsPayload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": message.themeColor || "00FF00",
    "summary": message.title || "Trading Analysis Update",
    "sections": message.sections || [
      {
        "activityTitle": message.title,
        "activitySubtitle": new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        "activityText": message.text,
        "markdown": true
      }
    ],
    "potentialAction": message.potentialAction || []
  };

  console.log(`🔍 [TEAMS-DEBUG] ${executionId} Payload constructed`);

  try {
    console.log(`📤 [TEAMS-DEBUG] ${executionId} Sending to Teams webhook...`);

    const response = await fetch(env.TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsPayload)
    });

    console.log(`🔍 [TEAMS-DEBUG] ${executionId} Response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const responseText = await response.text();
      console.log(`✅ [TEAMS-DEBUG] ${executionId} Teams message sent successfully`);
      console.log(`🔍 [TEAMS-DEBUG] ${executionId} Response: ${responseText}`);
      return { success: true, response: responseText };
    } else {
      const errorText = await response.text();
      console.error(`❌ [TEAMS-DEBUG] ${executionId} Teams API error:`, errorText);
      console.error(`🔍 [TEAMS-DEBUG] ${executionId} Error details:`, {
        status: response.status,
        statusText: response.statusText,
        responseText: errorText,
        payload: teamsPayload
      });
      return { success: false, error: errorText };
    }
  } catch (error: any) {
    console.error(`❌ [TEAMS-DEBUG] ${executionId} Teams send error:`, (error instanceof Error ? error.message : String(error)));
    return { success: false, error: error.message };
  }
}

/**
 * Send trading analysis notification to Teams
 */
export async function sendTeamsAnalysisMessage(
  title: string,
  analysisText: string,
  reportUrl: string,
  analysisType: string,
  env: CloudflareEnvironment
): Promise<TeamsMessageResult> {
  const executionId = `teams_analysis_${Date.now()}`;

  // Determine theme color based on analysis type
  const themeColors = {
    'morning': '0084FF',    // Blue for morning briefing
    'midday': 'FF8C00',     // Orange for intraday check
    'daily': '00B294',      // Green for end-of-day
    'weekly': '8B008B',     // Purple for weekly review
    'error': 'FF0000'       // Red for errors
  };

  const message: TeamsMessage = {
    title: title,
    text: analysisText,
    themeColor: themeColors[analysisType as keyof typeof themeColors] || '0084FF',
    sections: [
      {
        activityTitle: title,
        activitySubtitle: new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        activityText: analysisText,
        facts: [
          {
            name: "Analysis Type",
            value: title
          },
          {
            name: "Report",
            value: `[View Detailed Report](${reportUrl})`
          },
          {
            name: "System Status",
            value: "🟢 Operational"
          }
        ],
        markdown: true
      }
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "📊 View Full Report",
        target: [reportUrl]
      }
    ]
  };

  console.log(`📤 [TEAMS-ANALYSIS] ${executionId} Sending ${analysisType} analysis to Teams...`);

  const result = await sendTeamsMessage(message, env);

  if (result.success) {
    console.log(`✅ [TEAMS-ANALYSIS] ${executionId} ${analysisType} Teams message sent successfully`);
  } else {
    console.error(`❌ [TEAMS-ANALYSIS] ${executionId} ${analysisType} Teams message failed:`, result.error);
  }

  return result;
}

/**
 * Send error notification to Teams
 */
export async function sendTeamsErrorAlert(
  errorTitle: string,
  errorDetails: string,
  env: CloudflareEnvironment
): Promise<TeamsMessageResult> {
  const executionId = `teams_error_${Date.now()}`;

  const message: TeamsMessage = {
    title: `🚨 Trading System Error`,
    text: `${errorTitle}\n\n**Details:** ${errorDetails}`,
    themeColor: 'FF0000', // Red for errors
    sections: [
      {
        activityTitle: '🚨 System Error Alert',
        activitySubtitle: new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        activityText: errorDetails,
        facts: [
          {
            name: "Error Type",
            value: errorTitle
          },
          {
            name: "System Status",
            value: "🔴 Error"
          },
          {
            name: "Time",
            value: new Date().toISOString()
          }
        ],
        markdown: true
      }
    ]
  };

  console.log(`📤 [TEAMS-ERROR] ${executionId} Sending error alert to Teams...`);

  const result = await sendTeamsMessage(message, env);

  if (result.success) {
    console.log(`✅ [TEAMS-ERROR] ${executionId} Error alert sent successfully`);
  } else {
    console.error(`❌ [TEAMS-ERROR] ${executionId} Error alert failed:`, result.error);
  }

  return result;
}

/**
 * Send success/completion notification to Teams
 */
export async function sendTeamsSuccessMessage(
  title: string,
  successText: string,
  reportUrl: string,
  env: CloudflareEnvironment
): Promise<TeamsMessageResult> {
  const executionId = `teams_success_${Date.now()}`;

  const message: TeamsMessage = {
    title: `✅ ${title}`,
    text: successText,
    themeColor: '00B294', // Green for success
    sections: [
      {
        activityTitle: `✅ ${title}`,
        activitySubtitle: new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        activityText: successText,
        facts: [
          {
            name: "Status",
            value: "✅ Completed Successfully"
          },
          {
            name: "Report",
            value: `[View Results](${reportUrl})`
          }
        ],
        markdown: true
      }
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "📊 View Report",
        target: [reportUrl]
      }
    ]
  };

  console.log(`📤 [TEAMS-SUCCESS] ${executionId} Sending success message to Teams...`);

  const result = await sendTeamsMessage(message, env);

  if (result.success) {
    console.log(`✅ [TEAMS-SUCCESS] ${executionId} Success message sent successfully`);
  } else {
    console.error(`❌ [TEAMS-SUCCESS] ${executionId} Success message failed:`, result.error);
  }

  return result;
}

/**
 * Send morning pre-market briefing to Teams
 */
export async function sendTeamsMorningBriefing(
  reportText: string,
  reportUrl: string,
  env: CloudflareEnvironment
): Promise<TeamsMessageResult> {
  return sendTeamsAnalysisMessage(
    "🌅 Pre-Market Briefing",
    "Market analysis ready for trading day opening. High-confidence signals identified.",
    reportUrl,
    'morning',
    env
  );
}

/**
 * Send midday intraday check to Teams
 */
export async function sendTeamsMiddayUpdate(
  reportText: string,
  reportUrl: string,
  env: CloudflareEnvironment
): Promise<TeamsMessageResult> {
  return sendTeamsAnalysisMessage(
    "📈 Intraday Performance Check",
    "Real-time tracking of morning predictions and market performance.",
    reportUrl,
    'midday',
    env
  );
}

/**
 * Send end-of-day summary to Teams
 */
export async function sendTeamsDailySummary(
  reportText: string,
  reportUrl: string,
  env: CloudflareEnvironment
): Promise<TeamsMessageResult> {
  return sendTeamsAnalysisMessage(
    "📊 End-of-Day Summary",
    "Market close analysis with tomorrow's trading outlook and key insights.",
    reportUrl,
    'daily',
    env
  );
}

/**
 * Send weekly review to Teams
 */
export async function sendTeamsWeeklyReview(
  reportText: string,
  reportUrl: string,
  env: CloudflareEnvironment
): Promise<TeamsMessageResult> {
  return sendTeamsAnalysisMessage(
    "📈 Weekly Review & Analysis",
    "Comprehensive weekly performance analysis with trading pattern insights.",
    reportUrl,
    'weekly',
    env
  );
}

export default {
  sendTeamsMessage,
  sendTeamsAnalysisMessage,
  sendTeamsErrorAlert,
  sendTeamsSuccessMessage,
  sendTeamsMorningBriefing,
  sendTeamsMiddayUpdate,
  sendTeamsDailySummary,
  sendTeamsWeeklyReview
};