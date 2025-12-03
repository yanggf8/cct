/**
 * Historical Data Backfill Module
 * Creates daily summaries for historical dates to make system immediately useful
 */
import { generateDailySummary } from './daily-summary.js';
import { getLastNDaysEST, getDailySummaryKVKey, isTradingDay } from './timezone-utils.js';
import { createDAL } from './dal.js';
/**
 * Backfill daily summaries for the last N days
 * @param {Object} env - Cloudflare environment
 * @param {number} days - Number of days to backfill (default: 30)
 * @param {boolean} skipExisting - Skip dates that already have summaries (default: true)
 * @returns {Object} Backfill results
 */
export async function backfillDailySummaries(env, days = 30, skipExisting = true) {
    console.log(`🔄 [BACKFILL] Starting backfill for last ${days} days`);
    const dal = createDAL(env);
    const dates = getLastNDaysEST(days);
    const results = [];
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    for (const dateStr of dates) {
        try {
            const kvKey = getDailySummaryKVKey(dateStr);
            // Check if summary already exists
            if (skipExisting) {
                const existingResult = await dal.read(kvKey);
                if (existingResult.success && existingResult.data) {
                    console.log(`⏭️ [BACKFILL] Skipping ${dateStr} - already exists`);
                    results.push({
                        date: dateStr,
                        status: 'skipped',
                        reason: 'already_exists',
                        is_trading_day: isTradingDay(dateStr)
                    });
                    skipped++;
                    continue;
                }
            }
            console.log(`📊 [BACKFILL] Processing ${dateStr}...`);
            // Generate summary for this date
            const summary = await generateDailySummary(dateStr, env);
            // Store in KV with 90-day TTL using DAL
            const writeResult = await dal.write(kvKey, summary, { expirationTtl: 7776000 } // 90 days
            );
            if (!writeResult.success) {
                console.error(`❌ [BACKFILL] Failed to write ${dateStr}: ${writeResult.error}`);
                throw new Error(`KV write failed: ${writeResult.error}`);
            }
            results.push({
                date: dateStr,
                status: 'success',
                total_predictions: summary.summary.total_predictions,
                accuracy: summary.summary.overall_accuracy,
                is_trading_day: summary.is_trading_day,
                kv_key: kvKey
            });
            processed++;
            console.log(`✅ [BACKFILL] Successfully processed ${dateStr}: ${summary.summary.total_predictions} predictions`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ [BACKFILL] Failed to process ${dateStr}:`, errorMessage);
            results.push({
                date: dateStr,
                status: 'failed',
                error: errorMessage,
                is_trading_day: isTradingDay(dateStr)
            });
            failed++;
        }
    }
    const backfillSummary = {
        backfill_date: new Date().toISOString(),
        days_requested: days,
        total_dates: dates.length,
        processed: processed,
        skipped: skipped,
        failed: failed,
        skip_existing: skipExisting,
        results: results
    };
    console.log(`🎯 [BACKFILL] Completed: ${processed} processed, ${skipped} skipped, ${failed} failed`);
    return backfillSummary;
}
/**
 * Backfill summaries for trading days only (skip weekends)
 * @param {Object} env - Cloudflare environment
 * @param {number} tradingDays - Number of trading days to backfill
 * @returns {Object} Backfill results
 */
export async function backfillTradingDaysOnly(env, tradingDays = 20) {
    console.log(`📈 [BACKFILL] Starting backfill for last ${tradingDays} trading days`);
    const dal = createDAL(env);
    const allDates = getLastNDaysEST(60); // Get extra days to account for weekends
    const tradingDates = allDates.filter(date => isTradingDay(date)).slice(0, tradingDays);
    console.log(`📅 [BACKFILL] Found ${tradingDates.length} trading days to process`);
    const results = [];
    let processed = 0;
    let failed = 0;
    for (const dateStr of tradingDates) {
        try {
            const kvKey = getDailySummaryKVKey(dateStr);
            // Check if summary already exists
            const existingResult = await dal.read(kvKey);
            if (existingResult.success && existingResult.data) {
                console.log(`⏭️ [BACKFILL] Skipping ${dateStr} - already exists`);
                results.push({
                    date: dateStr,
                    status: 'skipped',
                    reason: 'already_exists'
                });
                continue;
            }
            console.log(`📊 [BACKFILL] Processing trading day ${dateStr}...`);
            // Generate summary for this trading day
            const summary = await generateDailySummary(dateStr, env);
            // Store in KV using DAL
            const writeResult = await dal.write(kvKey, summary, { expirationTtl: 7776000 });
            if (!writeResult.success) {
                console.error(`❌ [BACKFILL] Failed to write ${dateStr}: ${writeResult.error}`);
                throw new Error(`KV write failed: ${writeResult.error}`);
            }
            results.push({
                date: dateStr,
                status: 'success',
                total_predictions: summary.summary.total_predictions,
                accuracy: summary.summary.overall_accuracy
            });
            processed++;
            console.log(`✅ [BACKFILL] Successfully processed trading day ${dateStr}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ [BACKFILL] Failed to process trading day ${dateStr}:`, errorMessage);
            results.push({
                date: dateStr,
                status: 'failed',
                error: errorMessage
            });
            failed++;
        }
    }
    const summary = {
        backfill_date: new Date().toISOString(),
        trading_days_requested: tradingDays,
        trading_days_found: tradingDates.length,
        processed: processed,
        failed: failed,
        results: results
    };
    console.log(`🎯 [BACKFILL-TRADING] Completed: ${processed} processed, ${failed} failed`);
    return summary;
}
/**
 * Verify backfill results by checking KV storage
 * @param {Object} env - Cloudflare environment
 * @param {number} days - Number of recent days to verify
 * @returns {Object} Verification results
 */
export async function verifyBackfill(env, days = 10) {
    console.log(`🔍 [BACKFILL-VERIFY] Verifying last ${days} days`);
    const dal = createDAL(env);
    const dates = getLastNDaysEST(days);
    const verification = [];
    let found = 0;
    let missing = 0;
    for (const dateStr of dates) {
        try {
            const kvKey = getDailySummaryKVKey(dateStr);
            const result = await dal.read(kvKey);
            if (result.success && result.data) {
                const data = result.data;
                verification.push({
                    date: dateStr,
                    status: 'found',
                    predictions: data.summary.total_predictions,
                    accuracy: data.summary.overall_accuracy,
                    generated_at: data.generated_at,
                    is_trading_day: data.is_trading_day
                });
                found++;
            }
            else {
                verification.push({
                    date: dateStr,
                    status: 'missing',
                    is_trading_day: isTradingDay(dateStr)
                });
                missing++;
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            verification.push({
                date: dateStr,
                status: 'error',
                error: errorMessage
            });
            missing++;
        }
    }
    const results = {
        verification_date: new Date().toISOString(),
        days_checked: days,
        found: found,
        missing: missing,
        coverage_percentage: Math.round((found / dates.length) * 100),
        details: verification
    };
    console.log(`🎯 [BACKFILL-VERIFY] Results: ${found} found, ${missing} missing (${results.coverage_percentage}% coverage)`);
    return results;
}
//# sourceMappingURL=backfill.js.map