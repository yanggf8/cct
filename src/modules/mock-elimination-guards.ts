/**
 * Mock Elimination Guards
 * Prevents any mock/placeholder data from being used in production
 * Enforces strict real data requirements across all modules
 */

import { createLogger } from './logging.js';

const logger = createLogger('mock-elimination-guards');

export interface MockDataDetection {
  isMock: boolean;
  detectionReason: string;
  location: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: string;
}

export interface RealDataRequirement {
  dataSource: 'FRED' | 'YahooFinance' | 'AlphaVantage' | 'TreasuryDirect' | 'Bloomberg' | 'Reuters';
  seriesId?: string;
  apiKeyRequired: boolean;
  refreshInterval: number; // minutes
  fallbackStrategy: 'graceful-degradation' | 'error' | 'cached-data';
}

/**
 * Detects if data appears to be mock/placeholder
 */
export function detectMockData(value: any, fieldName: string, location: string): MockDataDetection {
  const stringValue = String(value).toLowerCase();

  // Critical mock patterns - immediately fail
  const criticalPatterns = [
    'mock', 'placeholder', 'todo', 'fixme', 'dummy', 'fake', 'sample', 'test',
    'coming soon', 'tbd', 'n/a', 'not available', 'not implemented'
  ];

  for (const pattern of criticalPatterns) {
    if (stringValue.includes(pattern)) {
      return {
        isMock: true,
        detectionReason: `Contains critical mock pattern: "${pattern}"`,
        location: `${location}.${fieldName}`,
        severity: 'critical',
        recommendedAction: 'Immediately replace with real data source'
      };
    }
  }

  // Hardcoded value patterns that suggest mock data
  if (typeof value === 'number') {
    // Obviously fake prices (round numbers ending in .00 or .5)
    if (fieldName.toLowerCase().includes('price') && (value === 0 || value % 1 === 0 || value % 1 === 0.5)) {
      return {
        isMock: true,
        detectionReason: `Suspicious price value: ${value} (appears hardcoded)`,
        location: `${location}.${fieldName}`,
        severity: 'high',
        recommendedAction: 'Replace with live market data from Yahoo Finance'
      };
    }

    // Obviously fake percentages (round numbers)
    if (fieldName.toLowerCase().includes('rate') && (value === 0 || value % 10 === 0 || value % 5 === 0)) {
      return {
        isMock: true,
        detectionReason: `Suspicious rate value: ${value}% (appears hardcoded)`,
        location: `${location}.${fieldName}`,
        severity: 'high',
        recommendedAction: 'Replace with real economic data from FRED'
      };
    }

    // Fake stock prices under $1 (unless it's actually a penny stock)
    if (fieldName.toLowerCase().includes('price') && value > 0 && value < 1 && !fieldName.toLowerCase().includes('penny')) {
      return {
        isMock: true,
        detectionReason: `Suspiciously low stock price: $${value}`,
        location: `${location}.${fieldName}`,
        severity: 'medium',
        recommendedAction: 'Verify this is correct or replace with real data'
      };
    }
  }

  // String patterns that suggest test data
  if (typeof value === 'string') {
    // Date patterns that are obviously mock
    if (stringValue.match(/202[0-9]-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])/)) {
      const testDate = new Date(stringValue);
      const today = new Date();
      if (testDate > today) {
        return {
          isMock: true,
          detectionReason: `Future date detected: ${value} (likely test data)`,
          location: `${location}.${fieldName}`,
          severity: 'medium',
          recommendedAction: 'Use current or historical dates'
        };
      }
    }
  }

  return {
    isMock: false,
    detectionReason: 'No mock patterns detected',
    location: `${location}.${fieldName}`,
    severity: 'low',
    recommendedAction: 'Data appears legitimate'
  };
}

/**
 * Validates that a data source configuration requires real data
 */
export function validateDataSourceConfig(config: any, location: string): MockDataDetection[] {
  const detections: MockDataDetection[] = [];

  // Check for mock API keys
  if (config.apiKey) {
    const mockDetection = detectMockData(config.apiKey, 'apiKey', location);
    if (mockDetection.isMock) {
      mockDetection.severity = 'critical';
      mockDetection.recommendedAction = 'Set real API key in environment variables';
      detections.push(mockDetection);
    }
  }

  // Check for hardcoded values that should come from APIs
  if (config.dataSource === 'static' || config.dataSource === 'mock') {
    detections.push({
      isMock: true,
      detectionReason: `Using static/mock data source: ${config.dataSource}`,
      location: `${location}.dataSource`,
      severity: 'critical',
      recommendedAction: 'Configure real data source (FRED, Yahoo Finance, etc.)'
    });
  }

  return detections;
}

/**
 * Enforces real data usage for critical economic indicators
 */
export const REAL_DATA_REQUIREMENTS: Record<string, RealDataRequirement> = {
  // Federal Reserve Economic Data (FRED) requirements
  'fedFundsRate': {
    dataSource: 'FRED',
    seriesId: 'FEDFUNDS',
    apiKeyRequired: true,
    refreshInterval: 60, // 1 hour
    fallbackStrategy: 'graceful-degradation'
  },
  'treasury10Y': {
    dataSource: 'FRED',
    seriesId: 'DGS10',
    apiKeyRequired: true,
    refreshInterval: 60,
    fallbackStrategy: 'cached-data'
  },
  'treasury2Y': {
    dataSource: 'FRED',
    seriesId: 'DGS2',
    apiKeyRequired: true,
    refreshInterval: 60,
    fallbackStrategy: 'cached-data'
  },
  'sofrRate': {
    dataSource: 'FRED',
    seriesId: 'SOFR',
    apiKeyRequired: true,
    refreshInterval: 1440, // 24 hours
    fallbackStrategy: 'graceful-degradation'
  },
  'vix': {
    dataSource: 'YahooFinance',
    apiKeyRequired: false,
    refreshInterval: 5, // 5 minutes
    fallbackStrategy: 'cached-data'
  },
  'cpi': {
    dataSource: 'FRED',
    seriesId: 'CPIAUCSL',
    apiKeyRequired: true,
    refreshInterval: 1440, // Daily
    fallbackStrategy: 'cached-data'
  },
  'unemploymentRate': {
    dataSource: 'FRED',
    seriesId: 'UNRATE',
    apiKeyRequired: true,
    refreshInterval: 1440, // Daily
    fallbackStrategy: 'cached-data'
  },
  'gdp': {
    dataSource: 'FRED',
    seriesId: 'GDP',
    apiKeyRequired: true,
    refreshInterval: 10080, // Weekly
    fallbackStrategy: 'cached-data'
  }
};

/**
 * Validates that data meets real data requirements
 */
export function validateRealDataUsage(
  data: Record<string, any>,
  location: string
): { isValid: boolean; violations: MockDataDetection[] } {
  const violations: MockDataDetection[] = [];

  // Check each field against real data requirements
  for (const [fieldName, requirement] of Object.entries(REAL_DATA_REQUIREMENTS)) {
    if (data[fieldName] !== undefined) {
      const mockDetection = detectMockData(data[fieldName], fieldName, location);

      if (mockDetection.isMock) {
        // Check if this violates a real data requirement
        violations.push({
          ...mockDetection,
          detectionReason: `${mockDetection.detectionReason} (Required: ${requirement.dataSource} data)`,
          recommendedAction: `Replace with ${requirement.dataSource} ${requirement.seriesId || 'data'}`
        });
      }

      // Validate data quality for real data
      if (!mockDetection.isMock) {
        violations.push(...validateDataQuality(data[fieldName], fieldName, location, requirement));
      }
    }
  }

  return {
    isValid: violations.filter(v => v.severity === 'critical').length === 0,
    violations
  };
}

/**
 * Validates data quality for real data sources
 */
function validateDataQuality(
  value: any,
  fieldName: string,
  location: string,
  requirement: RealDataRequirement
): MockDataDetection[] {
  const violations: MockDataDetection[] = [];

  if (typeof value !== 'number') {
    violations.push({
      isMock: true,
      detectionReason: `Expected numeric value for ${requirement.dataSource} data`,
      location: `${location}.${fieldName}`,
      severity: 'high',
      recommendedAction: `Ensure ${fieldName} returns numeric data from ${requirement.dataSource}`
    });
  } else {
    // Check for obviously invalid values
    if (requirement.dataSource === 'FRED' && value === 0) {
      violations.push({
        isMock: true,
        detectionReason: `FRED series cannot be 0 (likely mock/default value)`,
        location: `${location}.${fieldName}`,
        severity: 'high',
        recommendedAction: `Verify FRED API connection and series ID ${requirement.seriesId}`
      });
    }

    // Check for reasonable ranges
    if (fieldName.includes('Rate') && (value < 0 || value > 100)) {
      violations.push({
        isMock: true,
        detectionReason: `Rate ${value}% outside reasonable range (0-100%)`,
        location: `${location}.${fieldName}`,
        severity: 'medium',
        recommendedAction: 'Verify data source and calculation logic'
      });
    }
  }

  return violations;
}

/**
 * Production guard that blocks mock data usage
 */
export class ProductionMockGuard {
  private static instance: ProductionMockGuard;
  private enabled: boolean = true;
  private strictMode: boolean = true;
  private violations: MockDataDetection[] = [];

  private constructor() {
    // Enable in production environment
    this.enabled = process.env.NODE_ENV === 'production' ||
                   process.env.DEPLOYMENT_ENV === 'production';
    this.strictMode = this.enabled || process.env.MOCK_GUARDS_STRICT === 'true';
  }

  static getInstance(): ProductionMockGuard {
    if (!ProductionMockGuard.instance) {
      ProductionMockGuard.instance = new ProductionMockGuard();
    }
    return ProductionMockGuard.instance;
  }

  /**
   * Validates data and throws error if mock detected in production
   */
  validateData(data: any, location: string): void {
    if (!this.enabled) return;

    const violations = validateRealDataUsage(data, location);

    if (violations.length > 0) {
      this.violations.push(...violations);

      const criticalViolations = violations.filter(v => v.severity === 'critical');

      if (criticalViolations.length > 0 || this.strictMode) {
        const errorMessage = `
🚨 PRODUCTION MOCK DATA DETECTION 🚨

Location: ${location}
Critical Violations: ${criticalViolations.length}

Violations:
${violations.map(v => `  • ${v.detectionReason} (${v.location})`).join('\n')}

Recommended Actions:
${violations.map(v => `  • ${v.recommendedAction}`).join('\n')}

This violates the production-only real data policy.
        `.trim();

        logger.error('Production mock data detected', {
          location,
          violations: violations.length,
          criticalViolations: criticalViolations.length
        });

        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Validates API configuration
   */
  validateConfig(config: any, location: string): void {
    if (!this.enabled) return;

    const violations = validateDataSourceConfig(config, location);

    if (violations.length > 0) {
      this.violations.push(...violations);

      logger.error('Invalid data source configuration detected', {
        location,
        violations: violations.map(v => v.detectionReason)
      });

      throw new Error(`
Configuration Error in ${location}:
${violations.map(v => `• ${v.detectionReason}`).join('\n')}
      `.trim());
    }
  }

  /**
   * Get all violations detected
   */
  getViolations(): MockDataDetection[] {
    return [...this.violations];
  }

  /**
   * Clear violation history
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Enable/disable guard (for testing)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set strict mode
   */
  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
  }

  /**
   * Check if guard is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get compliance status
   */
  getComplianceStatus(): {
    isCompliant: boolean;
    violationCount: number;
    criticalViolations: number;
    recommendations: string[];
  } {
    const criticalViolations = this.violations.filter(v => v.severity === 'critical');
    const recommendations = Array.from(new Set(
      this.violations.map(v => v.recommendedAction)
    ));

    return {
      isCompliant: criticalViolations.length === 0,
      violationCount: this.violations.length,
      criticalViolations: criticalViolations.length,
      recommendations
    };
  }
}

/**
 * Global mock guard instance
 */
export const mockGuard = ProductionMockGuard.getInstance();

/**
 * Decorator for functions that must return real data
 */
export function requireRealData(location: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const result = method.apply(this, args);

      // Validate the result if it's an object
      if (result && typeof result === 'object') {
        mockGuard.validateData(result, `${target.constructor.name}.${propertyName}`);
      }

      return result;
    };
  };
}

export default mockGuard;