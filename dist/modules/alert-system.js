/**
 * Advanced Alert System Module
 * Webhook-based alerting for KPI deviations and system issues
 */
import { createLogger } from './logging.js';
// Type definitions
export const AlertSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};
export const AlertType = {
    PERFORMANCE: 'performance',
    KPI_DEVIATION: 'kpi_deviation',
    SYSTEM_ERROR: 'system_error',
    BUSINESS_METRIC: 'business_metric'
};
const logger = createLogger('alert-system');
/**
 * Advanced Alert Manager
 */
export class AlertManager {
    constructor(env) {
        this.alertHistory = new Map();
        this.suppressionRules = new Map();
        this.env = env;
    }
    /**
     * Send alert with webhook integration
     */
    async sendAlert(alert) {
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
        }
        catch (error) {
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
    async sendSlackAlert(alert) {
        const slackWebhook = this.env.SLACK_WEBHOOK_URL;
        if (!slackWebhook) {
            return { success: false, skipped: true, reason: 'No Slack webhook configured' };
        }
        const payload = {
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
    async sendDiscordAlert(alert) {
        const discordWebhook = this.env.DISCORD_WEBHOOK_URL;
        if (!discordWebhook) {
            return { success: false, skipped: true, reason: 'No Discord webhook configured' };
        }
        const payload = {
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
    async sendEmailAlert(alert) {
        const emailWebhook = this.env.EMAIL_WEBHOOK_URL;
        const alertEmail = this.env.ALERT_EMAIL;
        if (!emailWebhook || !alertEmail) {
            return { success: false, skipped: true, reason: 'No email webhook/address configured' };
        }
        const payload = {
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
    formatAlert(alert) {
        const targetValue = 'target' in alert ? alert.target : undefined;
        return {
            id: alert.id,
            title: alert.title || this.generateTitle(alert),
            description: alert.description || this.generateDescription(alert),
            severity: alert.severity,
            service: alert.service || 'TFT Trading System',
            currentValue: this.formatValue(this.extractCurrentValue(alert)),
            target: targetValue !== undefined ? this.formatValue(targetValue) : undefined,
            timestamp: alert.timestamp || new Date().toISOString()
        };
    }
    /**
     * Generate email HTML content
     */
    generateEmailHTML(alert) {
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
    extractCurrentValue(alert) {
        switch (alert.type) {
            case AlertType.KPI_DEVIATION:
                return alert.currentValue;
            case AlertType.PERFORMANCE:
                return 'currentValue' in alert && alert.currentValue !== undefined
                    ? alert.currentValue
                    : 'N/A';
            case AlertType.SYSTEM_ERROR:
                return 'N/A';
            default:
                return 'currentValue' in alert && alert.currentValue !== undefined
                    ? alert.currentValue
                    : 'N/A';
        }
    }
    /**
     * Check if alert should be suppressed
     */
    isAlertSuppressed(alert) {
        const key = `${alert.type}_${alert.operation || alert.service}`;
        const suppression = this.suppressionRules.get(key);
        if (!suppression)
            return false;
        const now = Date.now();
        return now < suppression.until;
    }
    /**
     * Record alert in history
     */
    recordAlert(alert) {
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
    suppressAlert(type, operation, durationMs) {
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
    generateTitle(alert) {
        switch (alert.type) {
            case AlertType.KPI_DEVIATION:
                return `KPI Alert: ${alert.operation} ${alert.deviation}`;
            case AlertType.PERFORMANCE:
                return `Performance Alert: ${alert.operation}`;
            case AlertType.SYSTEM_ERROR:
                return `System Error: ${alert.service}`;
            default:
                return `System Alert: ${alert.type}`;
        }
    }
    /**
     * Generate alert description
     */
    generateDescription(alert) {
        switch (alert.type) {
            case AlertType.KPI_DEVIATION:
                const kpiAlert = alert;
                return `${kpiAlert.operation} is ${kpiAlert.deviation} (Current: ${kpiAlert.currentValue}, Target: ${kpiAlert.target})`;
            case AlertType.PERFORMANCE:
                return `Performance issue detected in ${alert.operation}`;
            case AlertType.SYSTEM_ERROR:
                return `System error occurred: ${alert.error}`;
            default:
                return `Alert triggered for ${alert.operation || alert.service}`;
        }
    }
    /**
     * Format values for display
     */
    formatValue(value) {
        if (value === null || value === undefined)
            return 'N/A';
        if (typeof value === 'number') {
            if (value > 1000)
                return `${Math.round(value)}ms`;
            if (value < 1)
                return `${Math.round(value * 100)}%`;
            return Math.round(value).toString();
        }
        return value.toString();
    }
    /**
     * Get severity color for Slack
     */
    getSeverityColor(severity) {
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
    getSeverityColorHex(severity) {
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
    getRecentAlerts(limit = 10) {
        const alerts = Array.from(this.alertHistory.values())
            .sort((a, b) => b.recordedAt - a.recordedAt)
            .slice(0, limit);
        return alerts;
    }
    /**
     * Get alert statistics
     */
    getAlertStats(timeframe = '24h') {
        const timeframeMs = this.parseTimeframe(timeframe);
        const since = Date.now() - timeframeMs;
        const recentAlerts = Array.from(this.alertHistory.values())
            .filter(alert => alert.recordedAt >= since);
        const stats = {
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
    parseTimeframe(timeframe) {
        const timeframeMap = {
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
let globalAlertManager = null;
/**
 * Get or create global alert manager
 */
export function getAlertManager(env) {
    if (!globalAlertManager) {
        globalAlertManager = new AlertManager(env);
    }
    return globalAlertManager;
}
/**
 * Convenience function to send KPI alert
 */
export async function sendKPIAlert(env, operation, currentValue, target, severity = AlertSeverity.MEDIUM) {
    const alertManager = getAlertManager(env);
    const alert = {
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
export async function sendPerformanceAlert(env, operation, details, severity = AlertSeverity.MEDIUM) {
    const alertManager = getAlertManager(env);
    const alert = {
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
export async function sendSystemErrorAlert(env, service, error, severity = AlertSeverity.HIGH) {
    const alertManager = getAlertManager(env);
    const errorMessage = error instanceof Error ? error.message : error;
    const alert = {
        id: `error_${service}_${Date.now()}`,
        type: AlertType.SYSTEM_ERROR,
        service,
        error: errorMessage,
        severity,
        timestamp: new Date().toISOString()
    };
    return await alertManager.sendAlert(alert);
}
//# sourceMappingURL=alert-system.js.map