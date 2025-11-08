/**
 * API Types for Predictive Analytics Dashboard
 * TypeScript-like type definitions for API responses
 */

// ========================================
// SENTIMENT ANALYSIS TYPES
// ========================================

/**
 * @typedef {Object} FineGrainedSentimentResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Sentiment analysis data
 * @property {string} data.symbol - Stock symbol
 * @property {number} data.overall_sentiment - Overall sentiment score (-1 to 1)
 * @property {number} data.confidence - Confidence level (0 to 1)
 * @property {number} data.agreement_rate - AI model agreement rate (0 to 1)
 * @property {number} data.articles_analyzed - Number of articles analyzed
 * @property {Object} data.sentiment_layers - Layer-by-layer sentiment analysis
 * @property {Object} data.sentiment_patterns - Sentiment pattern analysis
 * @property {Object} data.trading_signals - Generated trading signals
 * @property {Object} data.enhanced_prediction - Enhanced prediction data
 * @property {Object} data.execution_metadata - Execution metadata
 */

/**
 * @typedef {Object} FineGrainedBatchResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Batch response data
 * @property {Object[]} data.results - Array of individual sentiment results
 * @property {Object} data.summary - Batch summary statistics
 * @property {Object} data.metadata - Batch execution metadata
 */

// ========================================
// TECHNICAL ANALYSIS TYPES
// ========================================

/**
 * @typedef {Object} TechnicalSignalResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Technical analysis data
 * @property {string} data.symbol - Stock symbol
 * @property {string} data.direction - Trading direction (UP/DOWN/NEUTRAL)
 * @property {number} data.confidence - Confidence level (0 to 1)
 * @property {number} data.signal_strength - Signal strength score
 * @property {string} data.reasoning - Analysis reasoning
 * @property {Object} data.technical_features - All technical features
 * @property {Object} data.execution_metadata - Execution metadata
 */

/**
 * @typedef {Object} TechnicalBatchResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Batch technical analysis data
 * @property {Object[]} data.results - Array of individual technical analyses
 * @property {Object} data.summary - Batch summary statistics
 * @property {Object} data.coverage - Feature coverage analysis
 */

// ========================================
// SECTOR INDICATORS TYPES
// ========================================

/**
 * @typedef {Object} SectorIndicatorsResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Sector indicators data
 * @property {string} data.symbol - Sector symbol
 * @property {number} data.obv - On-Balance Volume
 * @property {number} data.cmf - Chaikin Money Flow
 * @property {Object} data.relative_strength - Relative strength data
 * @property {string} data.overall_signal - Overall sector signal
 * @property {number} data.confidence - Signal confidence
 * @property {string} data.timestamp - Analysis timestamp
 */

// ========================================
// MARKET REGIME TYPES
// ========================================

/**
 * @typedef {Object} EnhancedRegimeResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Enhanced regime analysis data
 * @property {string} data.date - Analysis date
 * @property {string} data.timestamp - Analysis timestamp
 * @property {Object} data.regime - Current regime information
 * @property {Object} data.enhanced_regime - Enhanced regime analysis
 * @property {Object} data.transition_risk - Transition risk assessment
 * @property {Object} data.factor_contributions - Factor contribution analysis
 * @property {Object} data.regime_strength - Regime strength metrics
 * @property {Object[]} data.history - Historical regime data
 */

// ========================================
// PREDICTIVE SIGNALS TYPES
// ========================================

/**
 * @typedef {Object} PredictiveSignalsResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Predictive signals data
 * @property {Object[]} data.predictions - Array of predictions
 * @property {Object} data.market_outlook - Market outlook analysis
 * @property {Object} data.sector_predictions - Sector predictions
 * @property {Object} data.risk_indicators - Risk indicators
 * @property {Object} data.prediction_metadata - Prediction metadata
 */

/**
 * @typedef {Object} Prediction
 * @property {string} symbol - Stock symbol
 * @property {string} direction - Prediction direction (BULLISH/BEARISH/NEUTRAL)
 * @property {number} confidence - Confidence level (0 to 100)
 * @property {number} target_price - Predicted target price
 * @property {string} time_horizon - Prediction time horizon
 * @property {number} model_score - Model confidence score
 * @property {string[]} catalysts - Prediction catalysts
 * @property {Object} risk_factors - Risk factor analysis
 */

// ========================================
// REAL-TIME STATUS TYPES
// ========================================

/**
 * @typedef {Object} RealtimeStatusResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Real-time status data
 * @property {Object[]} data.sources - Data source status information
 * @property {Object} data.freshness - Data freshness metrics
 * @property {Object} data.system_health - System health status
 * @property {string} data.last_update - Last update timestamp
 */

/**
 * @typedef {Object} DataSourceStatus
 * @property {string} source - Data source name
 * @property {string} status - Source status (healthy/degraded/error)
 * @property {number} freshness_minutes - Data freshness in minutes
 * @property {string} last_update - Last update timestamp
 * @property {Object} details - Additional status details
 */

// ========================================
// ADVANCED FEATURES TYPES
// ========================================

/**
 * @typedef {Object} ModelComparisonResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Model comparison data
 * @property {Object[]} data.models - Array of model performances
 * @property {Object} data.comparison_matrix - Model comparison matrix
 * @property {Object} data.ensemble_prediction - Ensemble prediction
 * @property {Object} data.confidence_intervals - Confidence intervals for predictions
 */

/**
 * @typedef {Object} ModelPerformance
 * @property {string} model_name - Model name
 * @property {number} accuracy - Model accuracy
 * @property {number} precision - Model precision
 * @property {number} recall - Model recall
 * @property {number} f1_score - F1 score
 * @property {Object} performance_metrics - Detailed performance metrics
 * @property {string} last_updated - Last update timestamp
 */

/**
 * @typedef {Object} ConfidenceInterval
 * @property {number} lower_bound - Lower bound of confidence interval
 * @property {number} upper_bound - Upper bound of confidence interval
 * @property {number} confidence_level - Confidence level (e.g., 0.95 for 95%)
 * @property {string} prediction_type - Type of prediction (price/direction/volatility)
 */

/**
 * @typedef {Object} RiskAssessmentResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Risk assessment data
 * @property {number} data.overall_risk_score - Overall risk score (0-100)
 * @property {Object} data.risk_factors - Individual risk factors
 * @property {Object} data.portfolio_risk - Portfolio risk metrics
 * @property {Object} data.stress_test_results - Stress test results
 * @property {Object} data.risk_recommendations - Risk management recommendations
 */

/**
 * @typedef {Object} PredictionAccuracyResponse
 * @property {boolean} success - Whether the request was successful
 * @property {Object} data - Accuracy tracking data
 * @property {number} data.overall_accuracy - Overall prediction accuracy
 * @property {Object} data.accuracy_by_model - Accuracy breakdown by model
 * @property {Object} data.accuracy_by_timeframe - Accuracy by timeframe
 * @property {Object} data.accuracy_by_sector - Accuracy by sector
 * @property {Object} data.recent_predictions - Recent prediction performance
 * @property {Object} data.historical_trends - Historical accuracy trends
 */

// ========================================
// UTILITY TYPES
// ========================================

/**
 * @typedef {Object} ProcessingMetadata
 * @property {string} source - Data source (fresh/cache)
 * @property {number} processingTime - Processing time in milliseconds
 * @property {string} requestId - Request ID
 * @property {string} timestamp - Response timestamp
 * @property {Object} cacheInfo - Cache information (if applicable)
 */

/**
 * @typedef {Object} CacheInfo
 * @property {boolean} cached - Whether response was from cache
 * @property {number} ttl - Cache TTL in seconds
 * @property {string} cacheKey - Cache key
 */

// Export types for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Response types
        FineGrainedSentimentResponse,
        FineGrainedBatchResponse,
        TechnicalSignalResponse,
        TechnicalBatchResponse,
        SectorIndicatorsResponse,
        EnhancedRegimeResponse,
        PredictiveSignalsResponse,
        RealtimeStatusResponse,
        ModelComparisonResponse,
        RiskAssessmentResponse,
        PredictionAccuracyResponse,

        // Data types
        Prediction,
        DataSourceStatus,
        ModelPerformance,
        ConfidenceInterval,
        ProcessingMetadata,
        CacheInfo
    };
}