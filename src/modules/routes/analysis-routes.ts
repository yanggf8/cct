/**
 * Analysis Route Definitions
 * Handles all trading analysis endpoints
 */

import { Router } from '../router/index.js';
import {
  handleManualAnalysis,
  handleEnhancedFeatureAnalysis,
  handleIndependentTechnicalAnalysis,
  handlePerSymbolAnalysis,
  handleSentimentTest
} from '../handlers/index.js';

/**
 * Register all analysis routes
 */
export function registerAnalysisRoutes(router: Router): void {
  // Core analysis endpoints
  router.get('/analyze', handleManualAnalysis);
  router.get('/analyze-symbol', handlePerSymbolAnalysis);

  // Sentiment analysis
  router.get('/sentiment-test', handleSentimentTest);
  router.get('/test-sentiment', handleSentimentTest); // Alias

  // Enhanced analysis features
  router.get('/enhanced-feature-analysis', handleEnhancedFeatureAnalysis);
  router.get('/independent-technical-analysis', handleIndependentTechnicalAnalysis);
}
