/**
 * Tomorrow Outlook Tracking System
 * Store and evaluate tomorrow outlook predictions
 */
import { createLogger } from './logging.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
const logger = createLogger('tomorrow-outlook-tracker');
/**
 * Tomorrow Outlook Tracker
 */
export class TomorrowOutlookTracker {
    constructor() {
        this.outlookHistory = new Map();
    }
    /**
     * Store tomorrow outlook when generated at EOD
     */
    async storeTomorrowOutlook(env, currentDate, outlookData) {
        const currentDateString = currentDate.toISOString().split('T')[0];
        // Calculate tomorrow's date
        const tomorrow = new Date(currentDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowString = tomorrow.toISOString().split('T')[0];
        const outlookKey = `tomorrow_outlook_${tomorrowString}`;
        try {
            const outlookRecord = {
                targetDate: tomorrowString,
                generatedOn: currentDateString,
                generatedAt: new Date().toISOString(),
                outlook: outlookData,
                evaluationStatus: 'pending', // pending, evaluated, expired
                actualPerformance: null,
                accuracyScore: null,
                evaluationDate: null
            };
            const dal = createSimplifiedEnhancedDAL(env);
            await dal.write(outlookKey, outlookRecord);
            logger.info('Stored tomorrow outlook', {
                targetDate: tomorrowString,
                generatedOn: currentDateString,
                marketBias: outlookData.marketBias,
                confidence: outlookData.confidence
            });
            return true;
        }
        catch (error) {
            logger.error('Failed to store tomorrow outlook', {
                targetDate: tomorrowString,
                error: (error instanceof Error ? error.message : String(error))
            });
            return false;
        }
    }
    /**
     * Get today's outlook (generated yesterday)
     */
    async getTodaysOutlook(env, currentDate) {
        const currentDateString = currentDate.toISOString().split('T')[0];
        const outlookKey = `tomorrow_outlook_${currentDateString}`;
        try {
            const dal = createSimplifiedEnhancedDAL(env);
            const result = await dal.read(outlookKey);
            if (result.data) {
                const parsed = result.data;
                logger.debug('Retrieved today\'s outlook', {
                    targetDate: currentDateString,
                    marketBias: parsed.outlook.marketBias,
                    confidence: parsed.outlook.confidence
                });
                return parsed;
            }
        }
        catch (error) {
            logger.error('Failed to retrieve today\'s outlook', {
                targetDate: currentDateString,
                error: (error instanceof Error ? error.message : String(error))
            });
        }
        return null;
    }
    /**
     * Evaluate today's outlook against actual performance
     */
    async evaluateTodaysOutlook(env, currentDate, actualMarketData) {
        const currentDateString = currentDate.toISOString().split('T')[0];
        const outlookKey = `tomorrow_outlook_${currentDateString}`;
        try {
            const dal = createSimplifiedEnhancedDAL(env);
            // Get the outlook that was made for today
            const result = await dal.read(outlookKey);
            if (!result.data) {
                logger.warn('No outlook found to evaluate', { targetDate: currentDateString });
                return null;
            }
            const outlookRecord = result.data;
            // Evaluate the outlook
            const evaluation = this.evaluateOutlookAccuracy(outlookRecord.outlook, actualMarketData);
            // Update the record with evaluation results
            outlookRecord.evaluationStatus = 'evaluated';
            outlookRecord.actualPerformance = actualMarketData;
            outlookRecord.accuracyScore = evaluation.score;
            outlookRecord.evaluationDetails = evaluation.details;
            outlookRecord.evaluationDate = new Date().toISOString();
            // Save the updated record
            await dal.write(outlookKey, outlookRecord);
            logger.info('Evaluated today\'s outlook', {
                targetDate: currentDateString,
                predictedBias: outlookRecord.outlook.marketBias,
                actualBias: actualMarketData.marketBias,
                accuracyScore: evaluation.score,
                wasCorrect: evaluation.details.biasCorrect
            });
            return outlookRecord;
        }
        catch (error) {
            logger.error('Failed to evaluate today\'s outlook', {
                targetDate: currentDateString,
                error: (error instanceof Error ? error.message : String(error))
            });
            return null;
        }
    }
    /**
     * Evaluate outlook accuracy
     */
    evaluateOutlookAccuracy(predictedOutlook, actualMarketData) {
        const evaluation = {
            score: 0,
            details: {
                biasCorrect: false,
                confidenceCorrect: false,
                performanceFactors: []
            }
        };
        try {
            // Check if market bias prediction was correct
            const biasCorrect = predictedOutlook.marketBias === actualMarketData.marketBias;
            evaluation.details.biasCorrect = biasCorrect;
            // Check if confidence level was appropriate
            const confidenceCorrect = this.wasConfidenceAppropriate(predictedOutlook.confidence, actualMarketData);
            evaluation.details.confidenceCorrect = confidenceCorrect;
            // Calculate overall accuracy score (0-100)
            let score = 0;
            if (biasCorrect)
                score += 50; // 50 points for correct bias
            if (confidenceCorrect)
                score += 30; // 30 points for appropriate confidence
            // Bonus points for performance factors
            const performanceBonus = this.calculatePerformanceBonus(predictedOutlook, actualMarketData);
            score += performanceBonus;
            evaluation.score = Math.min(100, Math.max(0, score));
            // Add performance factors details
            evaluation.details.performanceFactors = this.getPerformanceFactors(predictedOutlook, actualMarketData);
        }
        catch (error) {
            logger.error('Failed to evaluate outlook accuracy', { error: (error instanceof Error ? error.message : String(error)) });
            evaluation.score = 0;
        }
        return evaluation;
    }
    /**
     * Check if confidence level was appropriate
     */
    wasConfidenceAppropriate(predictedConfidence, actualMarketData) {
        const actualVolatility = actualMarketData.volatility || 'moderate';
        const actualChange = Math.abs(actualMarketData.averageChange || 0);
        // High confidence should correspond to predictable markets
        if (predictedConfidence === 'high') {
            return actualVolatility === 'low' || actualChange < 1;
        }
        // Low confidence should correspond to volatile/unpredictable markets
        if (predictedConfidence === 'low') {
            return actualVolatility === 'high' || actualChange > 2;
        }
        // Medium confidence is the default
        return predictedConfidence === 'medium';
    }
    /**
     * Calculate performance bonus points
     */
    calculatePerformanceBonus(predictedOutlook, actualMarketData) {
        let bonus = 0;
        // Bonus if key focus was appropriate
        if (predictedOutlook.keyFocus === 'Long opportunities' && actualMarketData.marketBias === 'bullish') {
            bonus += 10;
        }
        else if (predictedOutlook.keyFocus === 'Risk management' && actualMarketData.marketBias === 'bearish') {
            bonus += 10;
        }
        // Bonus if recommendations were relevant
        if (predictedOutlook.recommendations && predictedOutlook.recommendations.length > 0) {
            bonus += 5;
        }
        return bonus;
    }
    /**
     * Get performance factors details
     */
    getPerformanceFactors(predictedOutlook, actualMarketData) {
        const factors = [];
        // Bias accuracy
        if (predictedOutlook.marketBias === actualMarketData.marketBias) {
            factors.push(`Correctly predicted ${predictedOutlook.marketBias} bias`);
        }
        else {
            factors.push(`Incorrect bias prediction: predicted ${predictedOutlook.marketBias}, actual ${actualMarketData.marketBias}`);
        }
        // Volatility match
        const predictedVolatility = this.predictVolatilityFromOutlook(predictedOutlook);
        if (predictedVolatility === actualMarketData.volatility) {
            factors.push(`Correctly predicted ${predictedVolatility} volatility`);
        }
        // Key focus relevance
        if (predictedOutlook.keyFocus === 'Long opportunities' &&
            actualMarketData.marketBias === 'bullish') {
            factors.push('Key focus aligned with market direction');
        }
        return factors;
    }
    /**
     * Predict volatility from outlook
     */
    predictVolatilityFromOutlook(outlook) {
        if (outlook.confidence === 'low')
            return 'high';
        if (outlook.confidence === 'high')
            return 'low';
        return 'moderate';
    }
    /**
     * Get outlook accuracy history (last N days)
     */
    async getOutlookAccuracyHistory(env, days = 30) {
        const history = [];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        try {
            // This would require listing all keys or maintaining an index
            // For now, we'll implement a simplified version
            const recentEvaluations = await this.getRecentOutlookEvaluations(env, cutoffDate);
            for (const evaluation of recentEvaluations) {
                if (evaluation.evaluationStatus === 'evaluated') {
                    history.push({
                        date: evaluation.targetDate,
                        predictedBias: evaluation.outlook.marketBias,
                        actualBias: evaluation.actualPerformance?.marketBias || 'neutral',
                        confidence: evaluation.outlook.confidence,
                        accuracyScore: evaluation.accuracyScore || 0,
                        biasCorrect: evaluation.evaluationDetails?.biasCorrect || false
                    });
                }
            }
            // Sort by date
            history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            logger.info('Retrieved outlook accuracy history', {
                daysRequested: days,
                recordsFound: history.length,
                averageAccuracy: history.length > 0
                    ? history.reduce((sum, h) => sum + h.accuracyScore, 0) / history.length
                    : 0
            });
            return history;
        }
        catch (error) {
            logger.error('Failed to get outlook accuracy history', { error: (error instanceof Error ? error.message : String(error)) });
            return [];
        }
    }
    /**
     * Get recent outlook evaluations (simplified implementation)
     */
    async getRecentOutlookEvaluations(env, cutoffDate) {
        // Note: In a real implementation, you'd want to maintain an index
        // or use KV list functionality. For now, this is a placeholder.
        return [];
    }
    /**
     * Get outlook accuracy statistics
     */
    async getOutlookAccuracyStats(env) {
        try {
            const history = await this.getOutlookAccuracyHistory(env, 30);
            if (history.length === 0) {
                return {
                    totalOutlooks: 0,
                    averageAccuracy: 0,
                    biasAccuracy: 0,
                    bestPrediction: null,
                    worstPrediction: null
                };
            }
            const totalOutlooks = history.length;
            const averageAccuracy = history.reduce((sum, h) => sum + h.accuracyScore, 0) / totalOutlooks;
            const biasCorrectCount = history.filter(h => h.biasCorrect).length;
            const biasAccuracy = (biasCorrectCount / totalOutlooks) * 100;
            const bestPrediction = history.reduce((best, current) => current.accuracyScore > best.accuracyScore ? current : best);
            const worstPrediction = history.reduce((worst, current) => current.accuracyScore < worst.accuracyScore ? current : worst);
            return {
                totalOutlooks,
                averageAccuracy: Math.round(averageAccuracy),
                biasAccuracy: Math.round(biasAccuracy),
                bestPrediction: {
                    date: bestPrediction.date,
                    accuracy: bestPrediction.accuracyScore,
                    predictedBias: bestPrediction.predictedBias,
                    actualBias: bestPrediction.actualBias
                },
                worstPrediction: {
                    date: worstPrediction.date,
                    accuracy: worstPrediction.accuracyScore,
                    predictedBias: worstPrediction.predictedBias,
                    actualBias: worstPrediction.actualBias
                }
            };
        }
        catch (error) {
            logger.error('Failed to get outlook accuracy stats', { error: (error instanceof Error ? error.message : String(error)) });
            return {
                totalOutlooks: 0,
                averageAccuracy: 0,
                biasAccuracy: 0,
                bestPrediction: null,
                worstPrediction: null
            };
        }
    }
    /**
     * Get outlook performance trends
     */
    async getOutlookPerformanceTrends(env, days = 30) {
        try {
            const history = await this.getOutlookAccuracyHistory(env, days);
            if (history.length < 7) {
                return {
                    accuracyTrend: 'stable',
                    biasAccuracyTrend: 'stable',
                    confidenceAccuracyTrend: 'stable',
                    weeklyAverages: []
                };
            }
            // Calculate weekly averages
            const weeklyData = new Map();
            for (const record of history) {
                const weekStart = this.getWeekStart(new Date(record.date));
                const weekKey = weekStart.toISOString().split('T')[0];
                if (!weeklyData.has(weekKey)) {
                    weeklyData.set(weekKey, { accuracies: [], biasCorrect: [] });
                }
                const weekData = weeklyData.get(weekKey);
                weekData.accuracies.push(record.accuracyScore);
                if (record.biasCorrect) {
                    weekData.biasCorrect.push(1);
                }
            }
            const weeklyAverages = Array.from(weeklyData.entries())
                .map(([week, data]) => ({
                week,
                accuracy: data.accuracies.reduce((sum, acc) => sum + acc, 0) / data.accuracies.length,
                biasAccuracy: (data.biasCorrect.reduce((sum, count) => sum + count, 0) / data.accuracies.length) * 100
            }))
                .sort((a, b) => a.week.localeCompare(b.week));
            // Calculate trends
            const accuracyTrend = this.calculateTrend(weeklyAverages.map(w => w.accuracy));
            const biasAccuracyTrend = this.calculateTrend(weeklyAverages.map(w => w.biasAccuracy));
            return {
                accuracyTrend,
                biasAccuracyTrend,
                confidenceAccuracyTrend: 'stable', // Would need more data to calculate
                weeklyAverages
            };
        }
        catch (error) {
            logger.error('Failed to get outlook performance trends', { error: (error instanceof Error ? error.message : String(error)) });
            return {
                accuracyTrend: 'stable',
                biasAccuracyTrend: 'stable',
                confidenceAccuracyTrend: 'stable',
                weeklyAverages: []
            };
        }
    }
    /**
     * Calculate trend from series of values
     */
    calculateTrend(values) {
        if (values.length < 2)
            return 'stable';
        const recent = values.slice(-3);
        const older = values.slice(-6, -3);
        if (older.length === 0)
            return 'stable';
        const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
        const change = recentAvg - olderAvg;
        const threshold = Math.abs(olderAvg) * 0.1; // 10% change threshold
        if (Math.abs(change) < threshold)
            return 'stable';
        return change > 0 ? 'improving' : 'declining';
    }
    /**
     * Get week start date for a given date
     */
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        return new Date(d.setDate(diff));
    }
    /**
     * Clean up expired outlook records
     */
    async cleanupExpiredOutlooks(env) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 14); // 14 days old
        try {
            // This would require listing keys or maintaining an index
            // For now, return 0 as placeholder
            logger.info('Cleanup expired outlooks', { cutoffDate: cutoffDate.toISOString() });
            return 0;
        }
        catch (error) {
            logger.error('Failed to cleanup expired outlooks', { error: (error instanceof Error ? error.message : String(error)) });
            return 0;
        }
    }
}
// Global instance
const tomorrowOutlookTracker = new TomorrowOutlookTracker();
export { tomorrowOutlookTracker };
// Note: Types are already exported via 'export type' declarations above
//# sourceMappingURL=tomorrow-outlook-tracker.js.map