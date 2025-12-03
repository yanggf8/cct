/**
 * Daily Summary and Backfill HTTP Request Handlers
 * Handles daily summary system, backfill operations, and dashboard data
 */
import { getDailySummary, generateDailySummary } from '../daily-summary.js';
import { backfillDailySummaries } from '../backfill.js';
import { handleDailySummaryPage } from '../daily-summary-page.js';
import { createLogger, logBusinessMetric } from '../logging.js';
const logger = createLogger('summary-handlers');
/**
 * Handle daily summary API requests
 */
export async function handleDailySummaryAPI(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    try {
        logger.info('Daily summary API requested', {
            requestId,
            dateParam: dateParam || 'today'
        });
        // Use provided date or default to today
        const targetDate = dateParam || new Date().toISOString().split('T')[0];
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
            logger.warn('Invalid date format provided', {
                requestId,
                providedDate: dateParam,
                expectedFormat: 'YYYY-MM-DD'
            });
            const errorResponse = {
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD format.',
                provided_date: dateParam,
                example: '2025-09-27',
                request_id: requestId
            };
            return new Response(JSON.stringify(errorResponse, null, 2), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // Try to get existing daily summary
        let dailySummary = await getDailySummary(targetDate, env);
        if (!dailySummary) {
            logger.info('Daily summary not found, generating new one', {
                requestId,
                targetDate
            });
            // Generate new daily summary if it doesn't exist
            dailySummary = await generateDailySummary(targetDate, env);
        }
        logger.info('Daily summary API completed', {
            requestId,
            targetDate,
            totalPredictions: dailySummary?.summary?.total_predictions || 0,
            accuracy: dailySummary?.summary?.overall_accuracy || 0
        });
        logBusinessMetric('daily_summary_api_request', 1, {
            requestId,
            targetDate,
            generated: !dailySummary
        });
        const successResponse = {
            success: true,
            data: dailySummary,
            request_id: requestId,
            timestamp: new Date().toISOString()
        };
        return new Response(JSON.stringify(successResponse, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        logger.error('Daily summary API failed', {
            requestId,
            dateParam,
            error: (error instanceof Error ? error.message : String(error)),
            stack: error.stack
        });
        const errorResponse = {
            success: false,
            error: error.message,
            provided_date: dateParam,
            request_id: requestId,
            timestamp: new Date().toISOString()
        };
        return new Response(JSON.stringify(errorResponse, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
/**
 * Handle daily summary page requests
 */
export async function handleDailySummaryPageRequest(request, env) {
    const requestId = crypto.randomUUID();
    try {
        logger.info('Daily summary page requested', { requestId });
        const response = await handleDailySummaryPage(request, env);
        logger.info('Daily summary page served', {
            requestId,
            status: response.status,
            contentType: response.headers.get('Content-Type')
        });
        logBusinessMetric('daily_summary_page_view', 1, { requestId });
        return response;
    }
    catch (error) {
        logger.error('Daily summary page failed', {
            requestId,
            error: (error instanceof Error ? error.message : String(error)),
            stack: error.stack
        });
        return new Response(`
      <html>
        <head><title>Error - Daily Summary</title></head>
        <body>
          <h1>Daily Summary Error</h1>
          <p>Failed to load daily summary page: ${error.message}</p>
          <p>Request ID: ${requestId}</p>
        </body>
      </html>
    `, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}
/**
 * Handle backfill daily summaries requests
 */
export async function handleBackfillDailySummaries(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const skipExistingParam = url.searchParams.get('skipExisting');
    try {
        const days = daysParam ? parseInt(daysParam, 10) : 30;
        const skipExisting = skipExistingParam !== 'false'; // Default to true
        logger.info('Backfill daily summaries requested', {
            requestId,
            daysRequested: days,
            skipExisting
        });
        if (days > 365) {
            logger.warn('Backfill request exceeds maximum days', {
                requestId,
                daysRequested: days,
                maximum: 365
            });
            const errorResponse = {
                success: false,
                error: 'Maximum backfill period is 365 days',
                requested_days: days,
                maximum_days: 365,
                request_id: requestId
            };
            return new Response(JSON.stringify(errorResponse, null, 2), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const backfillResult = await backfillDailySummaries(env, days, skipExisting);
        logger.info('Backfill daily summaries completed', {
            requestId,
            daysRequested: days,
            processed: backfillResult.processed,
            skipped: backfillResult.skipped,
            failed: backfillResult.failed
        });
        logBusinessMetric('backfill_operation', 1, {
            requestId,
            daysProcessed: backfillResult.processed,
            daysSkipped: backfillResult.skipped,
            daysFailed: backfillResult.failed
        });
        const successResponse = {
            success: true,
            backfill_result: backfillResult,
            parameters: {
                days: days,
                skip_existing: skipExisting,
                trading_days_only: false
            },
            request_id: requestId,
            timestamp: new Date().toISOString()
        };
        return new Response(JSON.stringify(successResponse, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        logger.error('Backfill daily summaries failed', {
            requestId,
            daysParam,
            error: (error instanceof Error ? error.message : String(error)),
            stack: error.stack
        });
        const errorResponse = {
            success: false,
            error: error.message,
            parameters: {
                days: daysParam ? parseInt(daysParam, 10) : 0,
                skip_existing: skipExistingParam !== null
            },
            request_id: requestId,
            timestamp: new Date().toISOString()
        };
        return new Response(JSON.stringify(errorResponse, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
/**
 * Handle verify backfill requests
 */
export async function handleVerifyBackfill(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    try {
        const daysToCheck = daysParam ? parseInt(daysParam, 10) : 10;
        logger.info('Verify backfill requested', {
            requestId,
            daysToCheck
        });
        if (daysToCheck > 100) {
            logger.warn('Verify backfill request exceeds maximum days', {
                requestId,
                daysRequested: daysToCheck,
                maximum: 100
            });
            const errorResponse = {
                success: false,
                error: 'Maximum verification period is 100 days',
                requested_days: daysToCheck,
                maximum_days: 100,
                request_id: requestId
            };
            return new Response(JSON.stringify(errorResponse, null, 2), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const verificationResult = {
            verification_date: new Date().toISOString(),
            days_checked: daysToCheck,
            found: 0,
            missing: 0,
            coverage_percentage: 0,
            details: []
        };
        // Check each date for the specified number of days
        for (let i = 0; i < daysToCheck; i++) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];
            try {
                const summary = await getDailySummary(dateStr, env);
                if (summary) {
                    verificationResult.found++;
                    verificationResult.details.push({
                        date: dateStr,
                        status: 'found',
                        predictions: summary.summary?.total_predictions || 0,
                        accuracy: summary.summary?.overall_accuracy || 0,
                        generated_at: summary.generated_at,
                        is_trading_day: summary.is_trading_day
                    });
                }
                else {
                    verificationResult.missing++;
                    verificationResult.details.push({
                        date: dateStr,
                        status: 'missing'
                    });
                }
            }
            catch (error) {
                verificationResult.missing++;
                verificationResult.details.push({
                    date: dateStr,
                    status: 'error',
                    error: (error instanceof Error ? error.message : String(error))
                });
            }
        }
        verificationResult.coverage_percentage = Math.round((verificationResult.found / daysToCheck) * 100);
        logger.info('Verify backfill completed', {
            requestId,
            daysChecked: daysToCheck,
            found: verificationResult.found,
            missing: verificationResult.missing,
            coveragePercentage: verificationResult.coverage_percentage
        });
        logBusinessMetric('backfill_verification', 1, {
            requestId,
            coveragePercentage: verificationResult.coverage_percentage,
            daysChecked: daysToCheck
        });
        const successResponse = {
            success: true,
            verification_result: verificationResult,
            parameters: {
                days_checked: daysToCheck
            },
            request_id: requestId,
            timestamp: new Date().toISOString()
        };
        return new Response(JSON.stringify(successResponse, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        logger.error('Verify backfill failed', {
            requestId,
            daysParam,
            error: (error instanceof Error ? error.message : String(error)),
            stack: error.stack
        });
        const errorResponse = {
            success: false,
            error: error.message,
            request_id: requestId,
            timestamp: new Date().toISOString()
        };
        return new Response(JSON.stringify(errorResponse, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
//# sourceMappingURL=summary-handlers.js.map