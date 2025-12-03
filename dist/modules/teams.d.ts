/**
 * Microsoft Teams Messaging Module - TypeScript
 * Handles Microsoft Teams integration with trading analysis notifications
 */
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
export declare function sendTeamsMessage(message: TeamsMessage, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
/**
 * Send trading analysis notification to Teams
 */
export declare function sendTeamsAnalysisMessage(title: string, analysisText: string, reportUrl: string, analysisType: string, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
/**
 * Send error notification to Teams
 */
export declare function sendTeamsErrorAlert(errorTitle: string, errorDetails: string, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
/**
 * Send success/completion notification to Teams
 */
export declare function sendTeamsSuccessMessage(title: string, successText: string, reportUrl: string, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
/**
 * Send morning pre-market briefing to Teams
 */
export declare function sendTeamsMorningBriefing(reportText: string, reportUrl: string, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
/**
 * Send midday intraday check to Teams
 */
export declare function sendTeamsMiddayUpdate(reportText: string, reportUrl: string, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
/**
 * Send end-of-day summary to Teams
 */
export declare function sendTeamsDailySummary(reportText: string, reportUrl: string, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
/**
 * Send weekly review to Teams
 */
export declare function sendTeamsWeeklyReview(reportText: string, reportUrl: string, env: CloudflareEnvironment): Promise<TeamsMessageResult>;
declare const _default: {
    sendTeamsMessage: typeof sendTeamsMessage;
    sendTeamsAnalysisMessage: typeof sendTeamsAnalysisMessage;
    sendTeamsErrorAlert: typeof sendTeamsErrorAlert;
    sendTeamsSuccessMessage: typeof sendTeamsSuccessMessage;
    sendTeamsMorningBriefing: typeof sendTeamsMorningBriefing;
    sendTeamsMiddayUpdate: typeof sendTeamsMiddayUpdate;
    sendTeamsDailySummary: typeof sendTeamsDailySummary;
    sendTeamsWeeklyReview: typeof sendTeamsWeeklyReview;
};
export default _default;
//# sourceMappingURL=teams.d.ts.map