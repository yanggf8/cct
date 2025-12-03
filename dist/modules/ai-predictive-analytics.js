/**
 * AI-Powered Predictive Analytics Engine
 * Advanced forecasting system using dual AI models for market predictions
 * Integrates with existing GPT-OSS-120B and DistilBERT models
 */
import { createLogger } from './logging.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
const logger = createLogger('ai-predictive-analytics');
/**
 * AI-Powered Predictive Analytics Engine
 */
export class AIPredictiveAnalytics {
    constructor(env, config = {}) {
        this.env = env;
        this.dal = createSimplifiedEnhancedDAL(env, {
            enableCache: true,
            environment: env.ENVIRONMENT || 'production'
        });
        this.config = {
            enableCache: true,
            defaultTimeframe: '1w',
            minConfidenceThreshold: 60,
            maxPredictionAge: 24,
            enableEnsemble: true,
            riskAdjustment: true,
            ...config
        };
        logger.info('AI Predictive Analytics initialized', {
            defaultTimeframe: this.config.defaultTimeframe,
            minConfidence: this.config.minConfidenceThreshold,
            ensembleEnabled: this.config.enableEnsemble
        });
    }
    /**
     * Generate comprehensive market prediction using dual AI analysis
     */
    async generateMarketPrediction(predictionType, timeframe = this.config.defaultTimeframe) {
        const startTime = Date.now();
        logger.info('Generating market prediction', { predictionType, timeframe });
        try {
            // Gather comprehensive market data
            const marketData = await this.gatherMarketData();
            // Prepare context for AI analysis
            const analysisContext = this.prepareAnalysisContext(marketData, predictionType, timeframe);
            // Run parallel AI analysis
            const [gptResult, distilbertResult] = await Promise.all([
                this.runGPTAnalysis(analysisContext),
                this.runDistilbertAnalysis(analysisContext)
            ]);
            const gptTime = Date.now() - startTime;
            // Synthesize results and calculate agreement
            const synthesizedPrediction = await this.synthesizeResults(gptResult, distilbertResult, marketData, predictionType, timeframe);
            const totalTime = Date.now() - startTime;
            // Create final prediction object
            const prediction = {
                timestamp: new Date().toISOString(),
                predictionType,
                timeframe,
                prediction: synthesizedPrediction.direction,
                confidence: synthesizedPrediction.confidence,
                aiAgreement: synthesizedPrediction.agreement,
                gptAnalysis: {
                    reasoning: gptResult.reasoning,
                    keyFactors: gptResult.keyFactors,
                    riskFactors: gptResult.riskFactors,
                    predictedMove: gptResult.predictedMove,
                    confidenceBreakdown: gptResult.confidenceBreakdown
                },
                distilbertAnalysis: {
                    sentimentScore: distilbertResult.sentimentScore,
                    sentimentLabel: distilbertResult.sentimentLabel,
                    confidence: distilbertResult.confidence,
                    keySignals: distilbertResult.keySignals
                },
                synthesizedInsights: synthesizedPrediction.insights,
                dataSourceSummary: marketData.dataAvailability,
                modelPerformance: {
                    gptResponseTime: gptTime,
                    distilbertResponseTime: totalTime - gptTime,
                    totalProcessingTime: totalTime,
                    accuracyEstimate: this.calculateAccuracyEstimate(synthesizedPrediction)
                }
            };
            // Cache prediction if confidence meets threshold
            if (prediction.confidence >= this.config.minConfidenceThreshold) {
                await this.cachePrediction(prediction);
            }
            logger.info('Market prediction generated successfully', {
                predictionType,
                timeframe,
                direction: prediction.prediction,
                confidence: prediction.confidence,
                agreement: prediction.aiAgreement,
                processingTime: totalTime
            });
            return prediction;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Failed to generate market prediction', {
                predictionType,
                timeframe,
                error: message,
                processingTime: Date.now() - startTime
            });
            throw new Error(`Predictive analysis failed: ${message}`);
        }
    }
    /**
     * Gather comprehensive market data for AI analysis
     */
    async gatherMarketData() {
        try {
            // Fetch data from existing market intelligence systems
            const [marketDrivers, sectorRotation, sentiment] = await Promise.all([
                this.fetchMarketDrivers(),
                this.fetchSectorRotation(),
                this.fetchSentimentData()
            ]);
            return {
                marketDrivers: marketDrivers || {},
                sectorRotation: sectorRotation || {},
                sentiment: sentiment || {},
                dataAvailability: {
                    marketDrivers: !!marketDrivers,
                    sectorRotation: !!sectorRotation,
                    sentimentData: !!sentiment,
                    macroData: !!marketDrivers?.macro
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            logger.warn('Failed to gather complete market data', { error });
            return {
                marketDrivers: {},
                sectorRotation: {},
                sentiment: {},
                dataAvailability: {
                    marketDrivers: false,
                    sectorRotation: false,
                    sentimentData: false,
                    macroData: false
                },
                timestamp: new Date().toISOString()
            };
        }
    }
    /**
     * Fetch market drivers data
     */
    async fetchMarketDrivers() {
        try {
            // Import and use existing market drivers system
            const { initializeMarketDrivers } = await import('../modules/market-drivers.js');
            const marketDrivers = initializeMarketDrivers(this.env);
            return await marketDrivers.getMarketDriversSnapshot();
        }
        catch (error) {
            logger.warn('Failed to fetch market drivers', { error });
            return null;
        }
    }
    /**
     * Fetch sector rotation data
     */
    async fetchSectorRotation() {
        try {
            // Try to get cached sector rotation results
            const today = new Date().toISOString().split('T')[0];
            const result = await this.dal.read(`sector_rotation_${today}`);
            return result.success ? result.data : null;
        }
        catch (error) {
            logger.warn('Failed to fetch sector rotation data', { error });
            return null;
        }
    }
    /**
     * Fetch sentiment data
     */
    async fetchSentimentData() {
        try {
            // Try to get recent sentiment analysis
            const today = new Date().toISOString().split('T')[0];
            const result = await this.dal.getAnalysis(today);
            return result.success ? result.data : null;
        }
        catch (error) {
            logger.warn('Failed to fetch sentiment data', { error });
            return null;
        }
    }
    /**
     * Prepare analysis context for AI models
     */
    prepareAnalysisContext(marketData, predictionType, timeframe) {
        const context = {
            predictionType,
            timeframe,
            marketOverview: {
                regime: marketData.marketDrivers?.regime?.currentRegime || 'unknown',
                riskLevel: marketData.marketDrivers?.regime?.riskLevel || 'medium',
                confidence: marketData.marketDrivers?.regime?.confidence || 0
            },
            macroEnvironment: marketData.marketDrivers?.macro || {},
            marketStructure: marketData.marketDrivers?.marketStructure || {},
            sectorRotation: marketData.sectorRotation?.rotationSignals || {},
            sentiment: {
                overallSentiment: marketData.sentiment?.overall_sentiment || 0,
                confidence: marketData.sentiment?.overall_confidence || 0
            },
            currentTimestamp: new Date().toISOString()
        };
        return JSON.stringify(context, null, 2);
    }
    /**
     * Run GPT analysis for complex reasoning
     */
    async runGPTAnalysis(context) {
        const startTime = Date.now();
        try {
            const prompt = `
As a senior market analyst, analyze the following market data and provide a detailed prediction:

MARKET DATA:
${context}

ANALYSIS REQUIREMENTS:
1. Predict market direction (bullish/bearish/neutral/volatile)
2. Provide detailed reasoning with key factors
3. Identify primary and secondary risk factors
4. Predict percentage move (positive for bullish, negative for bearish)
5. Break down confidence by: technical (40%), fundamental (30%), sentiment (20%), risk (10%)
6. Focus on ${this.config.defaultTimeframe} timeframe

RESPONSE FORMAT (JSON):
{
  "direction": "bullish|bearish|neutral|volatile",
  "reasoning": "Detailed analysis explaining the prediction",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "riskFactors": ["risk1", "risk2"],
  "predictedMove": percentage_as_number,
  "confidenceBreakdown": {
    "technical": 0-100,
    "fundamental": 0-100,
    "sentiment": 0-100,
    "risk": 0-100
  }
}
`;
            const response = await this.env.AI.run('@cf/openchat/openchat-3.5-0106', {
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 1500
            });
            const responseText = response.response || '';
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                logger.debug('GPT analysis completed', {
                    processingTime: Date.now() - startTime,
                    direction: analysis.direction,
                    predictedMove: analysis.predictedMove
                });
                return analysis;
            }
            else {
                throw new Error('Failed to parse GPT response');
            }
        }
        catch (error) {
            logger.error('GPT analysis failed', { error, processingTime: Date.now() - startTime });
            // Return fallback analysis
            return {
                direction: 'neutral',
                reasoning: 'Analysis unavailable due to technical issues',
                keyFactors: ['Market uncertainty'],
                riskFactors: ['Technical failure'],
                predictedMove: 0,
                confidenceBreakdown: {
                    technical: 25,
                    fundamental: 25,
                    sentiment: 25,
                    risk: 25
                }
            };
        }
    }
    /**
     * Run DistilBERT analysis for sentiment classification
     */
    async runDistilbertAnalysis(context) {
        const startTime = Date.now();
        try {
            // Extract key sentiment-indicating text from context
            const sentimentPrompt = `
Market Analysis Context:
${context}

Based on this market data, classify the overall market sentiment as positive, negative, or neutral for investment purposes.
`;
            const response = await this.env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
                text: sentimentPrompt
            });
            if (response && response.length > 0) {
                const result = response[0];
                const sentimentScore = result.score;
                const sentimentLabel = sentimentScore > 0.1 ? 'positive' :
                    sentimentScore < -0.1 ? 'negative' : 'neutral';
                const keySignals = this.extractKeySignals(context, sentimentLabel);
                logger.debug('DistilBERT analysis completed', {
                    processingTime: Date.now() - startTime,
                    sentimentScore,
                    sentimentLabel
                });
                return {
                    sentimentScore,
                    sentimentLabel,
                    confidence: Math.abs(sentimentScore) * 100,
                    keySignals
                };
            }
            else {
                throw new Error('Empty DistilBERT response');
            }
        }
        catch (error) {
            logger.error('DistilBERT analysis failed', { error, processingTime: Date.now() - startTime });
            // Return fallback analysis
            return {
                sentimentScore: 0,
                sentimentLabel: 'neutral',
                confidence: 50,
                keySignals: ['Analysis unavailable']
            };
        }
    }
    /**
     * Extract key signals from context based on sentiment
     */
    extractKeySignals(context, sentiment) {
        const signals = [];
        if (sentiment === 'positive') {
            signals.push('Positive momentum indicators', 'Favorable risk conditions');
        }
        else if (sentiment === 'negative') {
            signals.push('Risk aversion detected', 'Defensive positioning advised');
        }
        else {
            signals.push('Mixed signals', 'Uncertain market direction');
        }
        // Add technical signals if available
        if (context.includes('VIX') || context.includes('volatility')) {
            signals.push('Volatility analysis considered');
        }
        if (context.includes('yield') || context.includes('interest')) {
            signals.push('Interest rate environment analyzed');
        }
        return signals.slice(0, 3); // Limit to 3 key signals
    }
    /**
     * Synthesize results from both AI models
     */
    async synthesizeResults(gptResult, distilbertResult, marketData, predictionType, timeframe) {
        // Calculate agreement level
        const agreement = this.calculateAgreement(gptResult.direction, distilbertResult.sentimentLabel);
        // Determine final direction
        const direction = this.determineFinalDirection(gptResult.direction, distilbertResult.sentimentLabel, agreement);
        // Calculate combined confidence
        const confidence = this.calculateCombinedConfidence(gptResult, distilbertResult, agreement);
        // Generate synthesized insights
        const insights = this.generateInsights(gptResult, distilbertResult, marketData, agreement);
        return {
            direction,
            confidence,
            agreement,
            insights
        };
    }
    /**
     * Calculate agreement between AI models
     */
    calculateAgreement(gptDirection, distilbertSentiment) {
        const gptBullish = ['bullish', 'volatile'].includes(gptDirection);
        const distilbertBullish = distilbertSentiment === 'positive';
        if (gptBullish === distilbertBullish) {
            return 'AGREE';
        }
        else if (gptDirection === 'neutral' || distilbertSentiment === 'neutral') {
            return 'PARTIAL_AGREE';
        }
        else {
            return 'DISAGREE';
        }
    }
    /**
     * Determine final direction based on AI agreement
     */
    determineFinalDirection(gptDirection, distilbertSentiment, agreement) {
        const normalizedGpt = this.normalizeDirection(gptDirection);
        const normalizedDistilbert = this.normalizeDirection(distilbertSentiment);
        if (agreement === 'AGREE') {
            return normalizedGpt;
        }
        if (agreement === 'PARTIAL_AGREE') {
            // Choose the more conservative option
            return normalizedGpt === 'neutral' || normalizedDistilbert === 'neutral'
                ? 'neutral'
                : normalizedGpt;
        }
        // Strong disagreement - default to neutral with warning
        return 'neutral';
    }
    normalizeDirection(direction) {
        switch (direction) {
            case 'bullish':
            case 'bearish':
            case 'neutral':
            case 'volatile':
                return direction;
            default:
                return 'neutral';
        }
    }
    /**
     * Calculate combined confidence score
     */
    calculateCombinedConfidence(gptResult, distilbertResult, agreement) {
        const breakdownValues = Object.values(gptResult?.confidenceBreakdown ?? {});
        const gptConfidenceTotal = breakdownValues.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
        const gptConfidenceCount = breakdownValues.length || 1;
        const gptConfidence = gptConfidenceTotal / gptConfidenceCount;
        const distilbertConfidence = typeof distilbertResult?.confidence === 'number' ? distilbertResult.confidence : 0;
        let baseConfidence = (gptConfidence + distilbertConfidence) / 2;
        // Adjust based on agreement
        if (agreement === 'AGREE') {
            baseConfidence = Math.min(95, baseConfidence * 1.1); // Boost confidence
        }
        else if (agreement === 'DISAGREE') {
            baseConfidence = Math.max(40, baseConfidence * 0.8); // Reduce confidence
        }
        return Math.round(baseConfidence);
    }
    /**
     * Generate synthesized insights
     */
    generateInsights(gptResult, distilbertResult, marketData, agreement) {
        const primaryDriver = this.identifyPrimaryDriver(gptResult.keyFactors, marketData);
        const riskLevel = this.assessRiskLevel(gptResult.riskFactors, agreement);
        return {
            primaryDriver,
            secondaryDrivers: gptResult.keyFactors.slice(1, 3),
            riskLevel,
            actionableSignals: this.generateActionableSignals(gptResult, distilbertResult, agreement),
            contrarianIndicators: this.identifyContrarianSignals(gptResult, distilbertResult, marketData)
        };
    }
    /**
     * Identify primary market driver
     */
    identifyPrimaryDriver(keyFactors, marketData) {
        // Analyze which factor is most influential based on current market conditions
        if (marketData.marketDrivers?.regime?.currentRegime) {
            return `Market regime: ${marketData.marketDrivers.regime.currentRegime}`;
        }
        if (marketData.marketDrivers?.macro?.fedFundsRate) {
            return `Monetary policy: Fed funds rate at ${marketData.marketDrivers.macro.fedFundsRate}%`;
        }
        return keyFactors[0] || 'Market conditions analysis';
    }
    /**
     * Assess overall risk level
     */
    assessRiskLevel(riskFactors, agreement) {
        let riskScore = 0;
        // Base risk on agreement level
        if (agreement === 'DISAGREE')
            riskScore += 2;
        if (agreement === 'PARTIAL_AGREE')
            riskScore += 1;
        // Add risk factors
        riskScore += Math.min(riskFactors.length, 3);
        if (riskScore >= 4)
            return 'extreme';
        if (riskScore >= 3)
            return 'high';
        if (riskScore >= 1)
            return 'medium';
        return 'low';
    }
    /**
     * Generate actionable signals
     */
    generateActionableSignals(gptResult, distilbertResult, agreement) {
        const signals = [];
        if (gptResult.predictedMove > 2) {
            signals.push('Strong upward momentum expected');
        }
        else if (gptResult.predictedMove < -2) {
            signals.push('Significant downside risk identified');
        }
        if (agreement === 'AGREE') {
            signals.push('High confidence signal - consider position sizing');
        }
        else if (agreement === 'DISAGREE') {
            signals.push('Mixed signals - risk management priority');
        }
        if (distilbertResult.confidence > 80) {
            signals.push('Strong sentiment confirmation');
        }
        return signals.slice(0, 3);
    }
    /**
     * Identify contrarian indicators
     */
    identifyContrarianSignals(gptResult, distilbertResult, marketData) {
        const contrarian = [];
        // Look for extreme sentiment
        if (distilbertResult.sentimentScore > 0.8) {
            contrarian.push('Extreme positive sentiment - potential reversal risk');
        }
        else if (distilbertResult.sentimentScore < -0.8) {
            contrarian.push('Extreme negative sentiment - potential bounce opportunity');
        }
        // Check for high confidence but conflicting signals
        if (gptResult.confidenceBreakdown.technical > 80 && distilbertResult.sentimentScore < -0.5) {
            contrarian.push('Technical strength vs sentiment weakness divergence');
        }
        return contrarian;
    }
    /**
     * Calculate accuracy estimate based on agreement and data quality
     */
    calculateAccuracyEstimate(synthesizedPrediction) {
        let accuracy = 50; // Base accuracy
        // Adjust based on agreement
        if (synthesizedPrediction.agreement === 'AGREE')
            accuracy += 20;
        if (synthesizedPrediction.agreement === 'PARTIAL_AGREE')
            accuracy += 10;
        if (synthesizedPrediction.agreement === 'DISAGREE')
            accuracy -= 15;
        // Adjust based on confidence
        accuracy += (synthesizedPrediction.confidence - 50) * 0.3;
        // Adjust based on risk level (higher risk = lower accuracy estimate)
        if (synthesizedPrediction.insights.riskLevel === 'low')
            accuracy += 10;
        if (synthesizedPrediction.insights.riskLevel === 'high')
            accuracy -= 10;
        if (synthesizedPrediction.insights.riskLevel === 'extreme')
            accuracy -= 20;
        return Math.max(20, Math.min(95, Math.round(accuracy)));
    }
    /**
     * Cache prediction for future reference
     */
    async cachePrediction(prediction) {
        try {
            const cacheKey = `prediction_${prediction.predictionType}_${prediction.timeframe}_${Date.now()}`;
            await this.dal.write(cacheKey, prediction, { expirationTtl: 3600 }); // 1 hour
            logger.debug('Prediction cached', {
                cacheKey,
                predictionType: prediction.predictionType,
                confidence: prediction.confidence
            });
        }
        catch (error) {
            logger.warn('Failed to cache prediction', { error });
        }
    }
    /**
     * Get recent predictions
     */
    async getRecentPredictions(predictionType, limit = 10) {
        try {
            const prefix = predictionType ? `prediction_${predictionType}_` : 'prediction_';
            const { keys } = await this.dal.listKeys(prefix, limit);
            const predictions = [];
            for (const key of keys.slice(0, limit)) {
                const result = await this.dal.read(key);
                if (result.success && result.data) {
                    predictions.push(result.data);
                }
            }
            const sortedPredictions = [...predictions].sort((a, b) => {
                const aTime = new Date(a.timestamp).getTime();
                const bTime = new Date(b.timestamp).getTime();
                return bTime - aTime;
            });
            return sortedPredictions;
        }
        catch (error) {
            logger.error('Failed to get recent predictions', {
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }
    /**
     * Get prediction accuracy statistics
     */
    async getPredictionAccuracy() {
        try {
            const predictions = await this.getRecentPredictions();
            const totalPredictions = predictions.length;
            const averageConfidence = totalPredictions > 0
                ? predictions.reduce((sum, prediction) => sum + (prediction.confidence ?? 0), 0) / totalPredictions
                : 0;
            const agreementDistribution = predictions.reduce((acc, prediction) => {
                const key = prediction.aiAgreement ?? 'UNKNOWN';
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
            }, {});
            const averageAccuracy = totalPredictions > 0
                ? predictions.reduce((sum, prediction) => sum + (prediction.modelPerformance?.accuracyEstimate ?? 0), 0) / totalPredictions
                : 0;
            return {
                totalPredictions,
                averageConfidence: Math.round(averageConfidence),
                agreementDistribution,
                averageAccuracy: Math.round(averageAccuracy)
            };
        }
        catch (error) {
            logger.error('Failed to get prediction accuracy', {
                error: error instanceof Error ? error.message : String(error)
            });
            return {
                totalPredictions: 0,
                averageConfidence: 0,
                agreementDistribution: {},
                averageAccuracy: 0
            };
        }
    }
}
/**
 * Factory function
 */
export function createAIPredictiveAnalytics(env, config) {
    return new AIPredictiveAnalytics(env, config);
}
export default AIPredictiveAnalytics;
//# sourceMappingURL=ai-predictive-analytics.js.map