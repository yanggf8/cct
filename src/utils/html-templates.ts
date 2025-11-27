/**
 * HTML Template Utilities
 * Provides fallback HTML templates for empty states and error conditions
 * Ensures graceful degradation when data is unavailable
 */

import type { CloudflareEnvironment } from '../types.js';

/**
 * Generate empty state HTML with warning badge
 */
export function generateEmptyStateHTML(options: {
  title: string;
  reportType: string;
  message?: string;
  diagnosticsLink?: string;
  requestId?: string;
}): string {
  const {
    title,
    reportType,
    message = 'No data available at this time',
    diagnosticsLink = '/api/v1/health',
    requestId = crypto.randomUUID()
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - TFT Trading System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #ffffff;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #00d4ff, #0099ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .warning-badge {
            display: inline-block;
            background: #ff6b35;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
            margin: 10px 0;
        }
        .empty-state {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            margin: 20px 0;
        }
        .empty-state-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        .empty-state h3 {
            font-size: 1.5rem;
            margin-bottom: 15px;
            color: #00d4ff;
        }
        .empty-state p {
            color: #b0b0b0;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .retry-button {
            background: linear-gradient(45deg, #00d4ff, #0099ff);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin: 0 10px;
            transition: transform 0.2s;
        }
        .retry-button:hover {
            transform: translateY(-2px);
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 0.9rem;
        }
        .request-id {
            background: rgba(255, 255, 255, 0.1);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.8rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <div class="warning-badge">⚠️ Data Unavailable</div>
        </div>

        <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3>${reportType}</h3>
            <p>${message}</p>
            <p>The system couldn't retrieve the required data. This could be due to:</p>
            <ul style="text-align: left; max-width: 600px; margin: 20px auto; color: #b0b0b0;">
                <li>Market data source temporarily unavailable</li>
                <li>Scheduled system maintenance</li>
                <li>Data processing in progress</li>
                <li>API rate limits or connectivity issues</li>
            </ul>
            <div style="margin-top: 30px;">
                <a href="${diagnosticsLink}" class="retry-button">🔍 Check System Status</a>
                <a href="javascript:location.reload()" class="retry-button">🔄 Retry</a>
            </div>
        </div>

        <div class="footer">
            <p>Request ID: <span class="request-id">${requestId}</span></p>
            <p>TFT Trading System - Enterprise AI Market Intelligence</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate error state HTML with error details
 */
export function generateErrorStateHTML(options: {
  title: string;
  error: string;
  reportType: string;
  requestId?: string;
  showRetry?: boolean;
}): string {
  const {
    title,
    error,
    reportType,
    requestId = crypto.randomUUID(),
    showRetry = true
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Error | TFT Trading System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #ffffff;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #ff6b35, #ff4444);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .error-badge {
            display: inline-block;
            background: #dc3545;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
            margin: 10px 0;
        }
        .error-state {
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            margin: 20px 0;
        }
        .error-state-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        .error-state h3 {
            font-size: 1.5rem;
            margin-bottom: 15px;
            color: #ff6b35;
        }
        .error-details {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
            font-family: monospace;
            font-size: 0.9rem;
            color: #ffcccc;
            word-break: break-word;
        }
        .action-buttons {
            margin-top: 30px;
        }
        .action-button {
            background: linear-gradient(45deg, #00d4ff, #0099ff);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin: 0 10px;
            transition: transform 0.2s;
        }
        .action-button:hover {
            transform: translateY(-2px);
        }
        .secondary-button {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 0.9rem;
        }
        .request-id {
            background: rgba(255, 255, 255, 0.1);
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.8rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <div class="error-badge">❌ Error Occurred</div>
        </div>

        <div class="error-state">
            <div class="error-state-icon">⚠️</div>
            <h3>${reportType}</h3>
            <p>An unexpected error occurred while generating this report.</p>

            <div class="error-details">
                <strong>Error Details:</strong><br>
                ${error}
            </div>

            ${showRetry ? `
            <div class="action-buttons">
                <a href="javascript:location.reload()" class="action-button">🔄 Retry</a>
                <a href="/api/v1/health" class="action-button secondary-button">🔍 Check System Health</a>
                <a href="/" class="action-button secondary-button">🏠 Home Dashboard</a>
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>Request ID: <span class="request-id">${requestId}</span></p>
            <p>TFT Trading System - Enterprise AI Market Intelligence</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate security headers for HTML responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https: cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' https: cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
}

/**
 * Add cache headers for HTML responses
 */
export function getCacheHeaders(isStatic: boolean = false): Record<string, string> {
  if (isStatic) {
    return {
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year for static assets
      'ETag': `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`
    };
  } else {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'ETag': `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`
    };
  }
}

/**
 * Create a safe report handler with fallback HTML
 */
export function createSafeReportHandler(options: {
  title: string;
  reportType: string;
  generateReportHTML: () => Promise<string>;
  env: CloudflareEnvironment;
  isStatic?: boolean; // For static-like content
}) {
  const { title, reportType, generateReportHTML, env } = options;

  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();

    try {
      // Generate the actual report
      const htmlContent = await generateReportHTML();

      // Validate that we got actual HTML content
      if (!htmlContent || typeof htmlContent !== 'string') {
        throw new Error('Report generation returned empty content');
      }

      // Check if HTML contains actual content (not just error message)
      if (htmlContent.length < 1000 || !htmlContent.includes('<html')) {
        return new Response(generateEmptyStateHTML({
          title,
          reportType,
          message: 'Report generated minimal content. Data sources may be unavailable.',
          requestId
        }), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });

    } catch (error) {
      console.error(`Report generation failed for ${reportType}:`, error);

      // Return graceful error HTML instead of JSON error
      return new Response(generateErrorStateHTML({
        title,
        error: error instanceof Error ? error.message : 'Unknown error',
        reportType,
        requestId
      }), {
        status: 500,
        headers: getSecurityHeaders()
      });
    }
  };
}