/**
 * Advanced Alert System Module
 * Webhook-based alerting for KPI deviations and system issues
 */

import { createLogger } from './logging.js';
import { CONFIG } from './config.js';
import { BusinessKPI } from './monitoring.js';
import type { CloudflareEnvironment } from '../types.js';

// Type definitions
export const AlertSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type AlertSeverityType = typeof AlertSeverity[keyof typeof AlertSeverity];

export const AlertType = {
  PERFORMANCE: 'performance',
  KPI_DEVIATION: 'kpi_deviation',
  SYSTEM_ERROR: 'system_error',
  BUSINESS_METRIC: 'business_metric'
} as const;

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

type AlertHistoryEntry = Alert & { recordedAt: number };

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

const logger = createLogger('alert-system');

/**
 * Advanced Alert Manager
 */
export class AlertManager {
  private env: CloudflareEnvironment;
  private alertHistory: Map<string, AlertHistoryEntry> = new Map();
  private suppressionRules: Map<string, SuppressionRule> = new Map();

  constructor(env: CloudflareEnvironment) {
    this.env = env;
  }

  /**
   * Send alert with webhook integration
   */
  async sendAlert(alert: Alert): Promise<AlertResult> {
    try {
      // Check suppression rules
      if (this.isAlertSuppressed(alert)) {
        logger.debug('Alert suppressed by rules', { alert: alert.id });
        return { success: true, suppressed: true };
      }

      // Format alert for different channels
      const formattedAlert = this.formatAlert(alert);

      // Send to configured webhooks
      const results = await Promise.allSettled([
        this.sendSlackAlert(formattedAlert),
        this.sendDiscordAlert(formattedAlert),
        this.sendEmailAlert(formattedAlert)
      ]);

      // Record alert history
      this.recordAlert(alert);

      // Log alert activity
      logger.info('Alert sent', {
        alertId: alert.id,
        severity: alert.severity,
        type: alert.type,
        channels: results.map(r => r.status === 'fulfilled' ? 'success' : 'failed'),
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        results: results.map(r => ({
          status: r.status,
          value: r.status === 'fulfilled' ? r.value : null,
          reason: r.status === 'rejected' ? r.reason?.message || null : null
        }))
      };

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to send alert', {
        alertId: alert.id,
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });

      return { success: false, error: message };
    }
  }

  /**
   * Send Slack alert via webhook
   */
  private async sendSlackAlert(alert: FormattedAlert): Promise<ChannelResult> {
    const slackWebhook = this.env.SLACK_WEBHOOK_URL;
    if (!slackWebhook) {
      return { success: false, skipped: true, reason: 'No Slack webhook configured' };
    }

    const payload: SlackPayload = {
      text: `🚨 ${alert.title}`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          {
            title: 'Service',
            value: alert.service,
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Details',
            value: alert.description,
            short: false
          },
          {
            title: 'Current Value',
            value: alert.currentValue,
            short: true
          },
          {
            title: 'Target',
            value: alert.target || 'N/A',
            short: true
          }
        ],
        footer: 'TFT Trading System',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const response = await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }

    return { success: true, channel: 'slack' };
  }

  /**
   * Send Discord alert via webhook
   */
  private async sendDiscordAlert(alert: FormattedAlert): Promise<ChannelResult> {
    const discordWebhook = this.env.DISCORD_WEBHOOK_URL;
    if (!discordWebhook) {
      return { success: false, skipped: true, reason: 'No Discord webhook configured' };
    }

    const payload: DiscordPayload = {
      embeds: [{
        title: `🚨 ${alert.title}`,
        description: alert.description,
        color: this.getSeverityColorHex(alert.severity),
        fields: [
          {
            name: 'Service',
            value: alert.service,
            inline: true
          },
          {
            name: 'Severity',
            value: alert.severity.toUpperCase(),
            inline: true
          },
          {
            name: 'Current Value',
            value: alert.currentValue,
            inline: true
          },
          {
            name: 'Target',
            value: alert.target || 'N/A',
            inline: true
          }
        ],
        footer: {
          text: 'TFT Trading System'
        },
        timestamp: new Date().toISOString()
      }]
    };

    const response = await fetch(discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }

    return { success: true, channel: 'discord' };
  }

  /**
   * Send email alert (via webhook service)
   */
  private async sendEmailAlert(alert: FormattedAlert): Promise<ChannelResult> {
    const emailWebhook = this.env.EMAIL_WEBHOOK_URL;
    const alertEmail = this.env.ALERT_EMAIL;

    if (!emailWebhook || !alertEmail) {
      return { success: false, skipped: true, reason: 'No email webhook/address configured' };
    }

    const payload: EmailPayload = {
      to: alertEmail,
      subject: `🚨 TFT Trading System Alert: ${alert.title}`,
      html: this.generateEmailHTML(alert)
    };

    const response = await fetch(emailWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Email webhook failed: ${response.status}`);
    }

    return { success: true, channel: 'email' };
  }

  /**
   * Format alert for notifications
   */
  private formatAlert(alert: Alert): FormattedAlert {
    const targetValue = 'target' in alert ? alert.target : undefined;
    return {
      id: alert.id,
      title: alert.title || this.generateTitle(alert),
      description: alert.description || this.generateDescription(alert),
      severity: alert.severity,
      service: alert.service || 'TFT Trading System',
      currentValue: this.formatValue(this.extractCurrentValue(alert)),
      target: targetValue !== undefined ? this.formatValue(targetValue as number | string | null | undefined) : undefined,
      timestamp: alert.timestamp || new Date().toISOString()
    };
  }

  /**
   * Generate email HTML content
   */
  private generateEmailHTML(alert: FormattedAlert): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${this.getSeverityColor(alert.severity)};">
          🚨 ${alert.title}
        </h2>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Service:</strong> ${alert.service}</p>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
        </div>

        <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h3>Details</h3>
          <p>${alert.description}</p>

          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Current Value</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${alert.currentValue}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Target</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${alert.target || 'N/A'}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
          <p style="margin: 0;">
            <strong>🔗 Quick Actions:</strong><br>
            <a href="https://tft-trading-system.yanggf.workers.dev/health-optimized" style="color: #1976d2;">View System Health</a> |
            <a href="https://tft-trading-system.yanggf.workers.dev/daily-summary" style="color: #1976d2;">View Dashboard</a>
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Extract current value from alert based on type
   */
  private extractCurrentValue(alert: Alert): number | string {
    switch (alert.type) {
      case AlertType.KPI_DEVIATION:
        return alert.currentValue;
      case AlertType.PERFORMANCE:
        return 'currentValue' in alert && alert.currentValue !== undefined
          ? (alert.currentValue as number | string)
          : 'N/A';
      case AlertType.SYSTEM_ERROR:
        return 'N/A';
      default:
        return 'currentValue' in alert && alert.currentValue !== undefined
          ? (alert.currentValue as number | string)
          : 'N/A';
    }
  }

  /**
   * Check if alert should be suppressed
   */
  private isAlertSuppressed(alert: Alert): boolean {
    const key = `${alert.type}_${alert.operation || alert.service}`;
    const suppression = this.suppressionRules.get(key);

    if (!suppression) return false;

    const now = Date.now();
    return now < suppression.until;
  }

  /**
   * Record alert in history
   */
  private recordAlert(alert: Alert): void {
    const key = alert.id || `${alert.type}_${Date.now()}`;
    this.alertHistory.set(key, {
      ...alert,
      recordedAt: Date.now()
    });

    // Keep only recent alerts in memory (last 100)
    if (this.alertHistory.size > 100) {
      const iterator = this.alertHistory.keys().next();
      if (!iterator.done) {
        this.alertHistory.delete(iterator.value);
      }
    }
  }

  /**
   * Add alert suppression rule
   */
  suppressAlert(type: AlertTypeType, operation: string, durationMs: number): void {
    const key = `${type}_${operation}`;
    this.suppressionRules.set(key, {
      until: Date.now() + durationMs,
      createdAt: Date.now()
    });

    logger.info('Alert suppression added', {
      type,
      operation,
      durationMs,
      until: new Date(Date.now() + durationMs).toISOString()
    });
  }

  /**
   * Generate alert title
   */
  private generateTitle(alert: Alert): string {
    switch (alert.type) {
      case AlertType.KPI_DEVIATION:
        return `KPI Alert: ${(alert as KPIDeviationAlert).operation} ${(alert as KPIDeviationAlert).deviation}`;
      case AlertType.PERFORMANCE:
        return `Performance Alert: ${alert.operation}`;
      case AlertType.SYSTEM_ERROR:
        return `System Error: ${(alert as SystemErrorAlert).service}`;
      default:
        return `System Alert: ${alert.type}`;
    }
  }

  /**
   * Generate alert description
   */
  private generateDescription(alert: Alert): string {
    switch (alert.type) {
      case AlertType.KPI_DEVIATION:
        const kpiAlert = alert as KPIDeviationAlert;
        return `${kpiAlert.operation} is ${kpiAlert.deviation} (Current: ${kpiAlert.currentValue}, Target: ${kpiAlert.target})`;
      case AlertType.PERFORMANCE:
        return `Performance issue detected in ${alert.operation}`;
      case AlertType.SYSTEM_ERROR:
        return `System error occurred: ${(alert as SystemErrorAlert).error}`;
      default:
        return `Alert triggered for ${alert.operation || alert.service}`;
    }
  }

  /**
   * Format values for display
   */
  private formatValue(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      if (value > 1000) return `${Math.round(value)}ms`;
      if (value < 1) return `${Math.round(value * 100)}%`;
      return Math.round(value).toString();
    }
    return value.toString();
  }

  /**
   * Get severity color for Slack
   */
  private getSeverityColor(severity: AlertSeverityType): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 'danger';
      case AlertSeverity.HIGH: return 'warning';
      case AlertSeverity.MEDIUM: return '#ff9800';
      case AlertSeverity.LOW: return 'good';
      default: return '#2196f3';
    }
  }

  /**
   * Get severity color hex for Discord
   */
  private getSeverityColorHex(severity: AlertSeverityType): number {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 0xff0000;
      case AlertSeverity.HIGH: return 0xff6600;
      case AlertSeverity.MEDIUM: return 0xff9800;
      case AlertSeverity.LOW: return 0x4caf50;
      default: return 0x2196f3;
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): AlertHistoryEntry[] {
    const alerts = Array.from(this.alertHistory.values())
      .sort((a: any, b: any) => b.recordedAt - a.recordedAt)
      .slice(0, limit);

    return alerts;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(timeframe: string = '24h'): AlertStats {
    const timeframeMs = this.parseTimeframe(timeframe);
    const since = Date.now() - timeframeMs;

    const recentAlerts = Array.from(this.alertHistory.values())
      .filter(alert => alert.recordedAt >= since);

    const stats: AlertStats = {
      total: recentAlerts.length,
      bySeverity: {},
      byType: {},
      timeframe
    };

    recentAlerts.forEach(alert => {
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Parse timeframe string to milliseconds
   */
  private parseTimeframe(timeframe: string): number {
    const timeframeMap: Record<string, number> = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000
    };

    return timeframeMap[timeframe] || 86400000;
  }
}

/**
 * Global alert manager instance
 */
let globalAlertManager: AlertManager | null = null;

/**
 * Get or create global alert manager
 */
export function getAlertManager(env: CloudflareEnvironment): AlertManager {
  if (!globalAlertManager) {
    globalAlertManager = new AlertManager(env);
  }
  return globalAlertManager;
}

/**
 * Convenience function to send KPI alert
 */
export async function sendKPIAlert(
  env: CloudflareEnvironment,
  operation: string,
  currentValue: number,
  target: number,
  severity: AlertSeverityType = AlertSeverity.MEDIUM
): Promise<AlertResult> {
  const alertManager = getAlertManager(env);

  const alert: KPIDeviationAlert = {
    id: `kpi_${operation}_${Date.now()}`,
    type: AlertType.KPI_DEVIATION,
    operation,
    currentValue,
    target,
    severity,
    deviation: currentValue < target ? 'below target' : 'above target',
    timestamp: new Date().toISOString()
  };

  return await alertManager.sendAlert(alert);
}

/**
 * Convenience function to send performance alert
 */
export async function sendPerformanceAlert(
  env: CloudflareEnvironment,
  operation: string,
  details: Omit<PerformanceAlert, 'id' | 'type' | 'severity' | 'timestamp'>,
  severity: AlertSeverityType = AlertSeverity.MEDIUM
): Promise<AlertResult> {
  const alertManager = getAlertManager(env);

  const alert: PerformanceAlert = {
    id: `perf_${operation}_${Date.now()}`,
    type: AlertType.PERFORMANCE,
    operation,
    severity,
    ...details,
    timestamp: new Date().toISOString()
  };

  return await alertManager.sendAlert(alert);
}

/**
 * Convenience function to send system error alert
 */
export async function sendSystemErrorAlert(
  env: CloudflareEnvironment,
  service: string,
  error: Error | string,
  severity: AlertSeverityType = AlertSeverity.HIGH
): Promise<AlertResult> {
  const alertManager = getAlertManager(env);

  const errorMessage = error instanceof Error ? error.message : error;

  const alert: SystemErrorAlert = {
    id: `error_${service}_${Date.now()}`,
    type: AlertType.SYSTEM_ERROR,
    service,
    error: errorMessage,
    severity,
    timestamp: new Date().toISOString()
  };

  return await alertManager.sendAlert(alert);
}

// Export types for external use
export type {
  FormattedAlert,
  AlertHistoryEntry,
  AlertResult,
  ChannelResult,
  AlertStats,
  SuppressionRule,
  SlackPayload,
  DiscordPayload,
  EmailPayload
};
