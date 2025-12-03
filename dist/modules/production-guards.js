/**
 * Production Guards - Runtime Mock Detection and Prevention
 *
 * Provides utilities to detect and prevent mock data usage in production environments.
 * Enforces strict data integrity and prevents accidental fallback to synthetic data.
 *
 * Features:
 * - Runtime mock detection in API responses
 * - Production-only validation middleware
 * - Data source verification and tracking
 * - Automatic failure on mock data detection
 *
 * @author Sprint 1-B - Macro/FRED Strict Mode Implementation
 * @since 2025-01-XX
 */
import { createLogger } from './logging.js';
const logger = createLogger('production-guards');
/**
 * Production guards class for runtime mock detection
 */
export class ProductionGuards {
    constructor(options = {}) {
        this.options = {
            strictMode: options.strictMode ?? true,
            environment: options.environment,
            allowedMockSources: options.allowedMockSources ?? [],
            failOnMock: options.failOnMock ?? true
        };
        this.isProduction = this.options.environment?.ENVIRONMENT === 'production';
        if (this.isProduction && this.options.strictMode) {
            logger.warn('Production strict mode enabled - mock data detection active');
        }
    }
    /**
     * Verify API response contains real data (not mock)
     */
    verifyApiResponse(response, endpoint) {
        const verification = {
            isReal: true,
            source: 'unknown',
            confidence: 1.0,
            flags: []
        };
        try {
            // Check for obvious mock data indicators
            if (this.isMockResponse(response)) {
                verification.isReal = false;
                verification.confidence = 0.9;
                verification.source = 'detected_mock';
                verification.flags.push('mock_data_detected');
                if (this.isProduction && this.options.strictMode) {
                    throw new Error(`Production strict mode: Mock data detected in ${endpoint} response`);
                }
            }
            // Check data source metadata
            const sourceMetadata = this.extractDataSource(response);
            if (sourceMetadata) {
                verification.source = sourceMetadata.source;
                verification.confidence = sourceMetadata.confidence;
                if (sourceMetadata.mock) {
                    verification.isReal = false;
                    verification.flags.push('mock_source_metadata');
                    if (this.isProduction && this.options.strictMode) {
                        throw new Error(`Production strict mode: Mock source metadata found in ${endpoint}`);
                    }
                }
            }
            // Validate data quality indicators
            const qualityCheck = this.validateDataQuality(response);
            if (!qualityCheck.isValid) {
                verification.confidence *= 0.8;
                verification.flags.push(...qualityCheck.issues);
                if (this.isProduction && this.options.strictMode && qualityCheck.isMockLike) {
                    throw new Error(`Production strict mode: Low data quality in ${endpoint} response`);
                }
            }
            // Log verification results
            if (this.isProduction || !verification.isReal) {
                logger.info('API response verification', {
                    endpoint,
                    isReal: verification.isReal,
                    source: verification.source,
                    confidence: verification.confidence,
                    flags: verification.flags
                });
            }
            return verification;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Production strict mode')) {
                throw error; // Re-throw production guard errors
            }
            logger.warn('API response verification failed', {
                endpoint,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                isReal: false,
                source: 'verification_failed',
                confidence: 0.0,
                flags: ['verification_error']
            };
        }
    }
    /**
     * Detect if response contains mock data patterns
     */
    isMockResponse(response) {
        if (!response || typeof response !== 'object') {
            return true;
        }
        const responseStr = JSON.stringify(response).toLowerCase();
        // Check for mock data indicators
        const mockIndicators = [
            'coming soon',
            'placeholder',
            'test data',
            'demo data',
            'mock data',
            'synthetic data',
            'estimated: true',
            'sample_data',
            'fake_data',
            'development_mode'
        ];
        return mockIndicators.some(indicator => responseStr.includes(indicator));
    }
    /**
     * Extract data source information from response
     */
    extractDataSource(response) {
        // Check common metadata patterns
        const metadata = response.metadata || response._metadata || response.source;
        if (metadata) {
            return {
                source: metadata.source || 'unknown',
                confidence: metadata.confidence || 0.5,
                mock: metadata.mock === true || metadata.mock === 'mock'
            };
        }
        // Check data property for source info
        if (response.data && response.data.source) {
            return {
                source: response.data.source,
                confidence: response.data.confidence || 0.7,
                mock: response.data.mock === true
            };
        }
        return null;
    }
    /**
     * Validate data quality indicators
     */
    validateDataQuality(response) {
        const issues = [];
        let isValid = true;
        let isMockLike = false;
        if (!response || typeof response !== 'object') {
            return { isValid: false, issues: ['invalid_response_structure'], isMockLike: true };
        }
        // Check for placeholder values
        const placeholderPatterns = [null, undefined, 'N/A', 'TBD', 'COMING SOON', 'PLACEHOLDER'];
        const checkForPlaceholders = (obj) => {
            if (obj && typeof obj === 'object') {
                Object.values(obj).forEach(value => {
                    if (placeholderPatterns.includes(value) ||
                        (typeof value === 'string' && placeholderPatterns.includes(value.toUpperCase()))) {
                        issues.push('placeholder_values_detected');
                        isMockLike = true;
                    }
                });
            }
        };
        checkForPlaceholders(response);
        // Check for unrealistic data patterns
        if (response.data || response.prices) {
            const data = response.data || response.prices;
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    issues.push('empty_data_array');
                }
                else {
                    // Check for identical values (possible mock data)
                    const firstValue = data[0];
                    if (data.every(item => JSON.stringify(item) === JSON.stringify(firstValue))) {
                        issues.push('identical_values_pattern');
                        isMockLike = true;
                    }
                }
            }
        }
        // Check timestamp patterns
        if (response.timestamp || response.lastUpdated) {
            const timestamp = response.timestamp || response.lastUpdated;
            if (typeof timestamp === 'string' && timestamp.includes('1969') || timestamp.includes('1970')) {
                issues.push('suspicious_timestamp');
                isMockLike = true;
            }
        }
        isValid = issues.length === 0;
        return { isValid, issues, isMockLike };
    }
    /**
     * Middleware function to wrap API handlers with production guards
     */
    createMiddleware(endpoint) {
        return (response) => {
            if (this.isProduction && this.options.strictMode) {
                const verification = this.verifyApiResponse(response, endpoint);
                if (!verification.isReal) {
                    throw new Error(`Production strict mode: Invalid data detected in ${endpoint}`);
                }
            }
            return response;
        };
    }
    /**
     * Check if the current environment allows mock data
     */
    allowsMockData() {
        return !this.isProduction || !this.options.strictMode;
    }
    /**
     * Get current guard configuration
     */
    getConfiguration() {
        return {
            isProduction: this.isProduction,
            strictMode: this.options.strictMode,
            failOnMock: this.options.failOnMock,
            allowedMockSources: this.options.allowedMockSources
        };
    }
}
/**
 * Create production guards instance
 */
export function createProductionGuards(options = {}) {
    return new ProductionGuards(options);
}
/**
 * Default production guards instance for production use
 */
export const defaultProductionGuards = createProductionGuards({
    strictMode: true,
    failOnMock: true
});
//# sourceMappingURL=production-guards.js.map