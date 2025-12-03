/**
 * Advanced Alert System Module
 * Webhook-based alerting for KPI deviations and system issues
 */
import type { CloudflareEnvironment } from '../types.js';
export declare const AlertSeverity: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
export type AlertSeverityType = typeof AlertSeverity[keyof typeof AlertSeverity];
export declare const AlertType: {
    readonly PERFORMANCE: "performance";
    readonly KPI_DEVIATION: "kpi_deviation";
    readonly SYSTEM_ERROR: "system_error";
    readonly BUSINESS_METRIC: "business_metric";
};
export type AlertTypeType = typeof AlertType[keyof typeof AlertType];
interface BaseAlert {
    id: string;
    type: AlertTypeType;
    severity: AlertSeverityType;
    title?: string;
    description?: string;
    service?: string;
    operation?: string;
    timestamp?: string;
}
interface KPIDeviationAlert extends BaseAlert {
    type: typeof AlertType.KPI_DEVIATION;
    operation: string;
    currentValue: number | string;
    target?: number | string;
    deviation: string;
}
interface PerformanceAlert extends BaseAlert {
    type: typeof AlertType.PERFORMANCE;
    operation: string;
    error?: string;
    [key: string]: any;
}
interface SystemErrorAlert extends BaseAlert {
    type: typeof AlertType.SYSTEM_ERROR;
    service: string;
    error: string;
}
interface BusinessMetricAlert extends BaseAlert {
    type: typeof AlertType.BUSINESS_METRIC;
    [key: string]: any;
}
export type Alert = KPIDeviationAlert | PerformanceAlert | SystemErrorAlert | BusinessMetricAlert;
interface FormattedAlert {
    id: string;
    title: string;
    description: string;
    severity: AlertSeverityType;
    service: string;
    currentValue: string;
    target?: string;
    timestamp: string;
}
interface SuppressionRule {
    until: number;
    createdAt: number;
}
type AlertHistoryEntry = Alert & {
    recordedAt: number;
};
interface AlertResult {
    success: boolean;
    suppressed?: boolean;
    results?: Array<{
        status: 'fulfilled' | 'rejected';
        value: any;
        reason: string | null;
    }>;
    error?: string;
}
interface ChannelResult {
    success: boolean;
    skipped?: boolean;
    reason?: string;
    channel?: 'slack' | 'discord' | 'email';
}
interface SlackPayload {
    text: string;
    attachments: Array<{
        color: string;
        fields: Array<{
            title: string;
            value: string;
            short: boolean;
        }>;
        footer: string;
        ts: number;
    }>;
}
interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields: Array<{
        name: string;
        value: string;
        inline: boolean;
    }>;
    footer: {
        text: string;
    };
    timestamp: string;
}
interface DiscordPayload {
    embeds: DiscordEmbed[];
}
interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}
interface AlertStats {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    timeframe: string;
}
/**
 * Advanced Alert Manager
 */
export declare class AlertManager {
    private env;
    private alertHistory;
    private suppressionRules;
    constructor(env: CloudflareEnvironment);
    /**
     * Send alert with webhook integration
     */
    sendAlert(alert: Alert): Promise<AlertResult>;
    /**
     * Send Slack alert via webhook
     */
    private sendSlackAlert;
    /**
     * Send Discord alert via webhook
     */
    private sendDiscordAlert;
    /**
     * Send email alert (via webhook service)
     */
    private sendEmailAlert;
    /**
     * Format alert for notifications
     */
    private formatAlert;
    /**
     * Generate email HTML content
     */
    private generateEmailHTML;
    /**
     * Extract current value from alert based on type
     */
    private extractCurrentValue;
    /**
     * Check if alert should be suppressed
     */
    private isAlertSuppressed;
    /**
     * Record alert in history
     */
    private recordAlert;
    /**
     * Add alert suppression rule
     */
    suppressAlert(type: AlertTypeType, operation: string, durationMs: number): void;
    /**
     * Generate alert title
     */
    private generateTitle;
    /**
     * Generate alert description
     */
    private generateDescription;
    /**
     * Format values for display
     */
    private formatValue;
    /**
     * Get severity color for Slack
     */
    private getSeverityColor;
    /**
     * Get severity color hex for Discord
     */
    private getSeverityColorHex;
    /**
     * Get recent alerts
     */
    getRecentAlerts(limit?: number): AlertHistoryEntry[];
    /**
     * Get alert statistics
     */
    getAlertStats(timeframe?: string): AlertStats;
    /**
     * Parse timeframe string to milliseconds
     */
    private parseTimeframe;
}
/**
 * Get or create global alert manager
 */
export declare function getAlertManager(env: CloudflareEnvironment): AlertManager;
/**
 * Convenience function to send KPI alert
 */
export declare function sendKPIAlert(env: CloudflareEnvironment, operation: string, currentValue: number, target: number, severity?: AlertSeverityType): Promise<AlertResult>;
/**
 * Convenience function to send performance alert
 */
export declare function sendPerformanceAlert(env: CloudflareEnvironment, operation: string, details: Omit<PerformanceAlert, 'id' | 'type' | 'severity' | 'timestamp'>, severity?: AlertSeverityType): Promise<AlertResult>;
/**
 * Convenience function to send system error alert
 */
export declare function sendSystemErrorAlert(env: CloudflareEnvironment, service: string, error: Error | string, severity?: AlertSeverityType): Promise<AlertResult>;
export type { FormattedAlert, AlertHistoryEntry, AlertResult, ChannelResult, AlertStats, SuppressionRule, SlackPayload, DiscordPayload, EmailPayload };
//# sourceMappingURL=alert-system.d.ts.map