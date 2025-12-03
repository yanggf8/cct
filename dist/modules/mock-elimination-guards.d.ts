/**
 * Mock Elimination Guards
 * Prevents any mock/placeholder data from being used in production
 * Enforces strict real data requirements across all modules
 */
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
    refreshInterval: number;
    fallbackStrategy: 'graceful-degradation' | 'error' | 'cached-data';
}
/**
 * Detects if data appears to be mock/placeholder
 * Enhanced with proper TypeScript generics for better type safety
 */
export declare function detectMockData<T>(value: T, fieldName: keyof T, location: string): MockDataDetection;
/**
 * Validates that a data source configuration requires real data
 */
export declare function validateDataSourceConfig(config: any, location: string): MockDataDetection[];
/**
 * Enforces real data usage for critical economic indicators
 */
export declare const REAL_DATA_REQUIREMENTS: Record<string, RealDataRequirement>;
/**
 * Validates that data meets real data requirements
 */
export declare function validateRealDataUsage(data: Record<string, any>, location: string): {
    isValid: boolean;
    violations: MockDataDetection[];
};
/**
 * Production guard that blocks mock data usage
 */
export declare class ProductionMockGuard {
    private static instance;
    private enabled;
    private strictMode;
    private violations;
    private constructor();
    static getInstance(): ProductionMockGuard;
    /**
     * Validates data and throws error if mock detected in production
     */
    validateData(data: any, location: string): void;
    /**
     * Validates API configuration
     */
    validateConfig(config: any, location: string): void;
    /**
     * Get all violations detected
     */
    getViolations(): MockDataDetection[];
    /**
     * Clear violation history
     */
    clearViolations(): void;
    /**
     * Enable/disable guard (for testing)
     */
    setEnabled(enabled: boolean): void;
    /**
     * Set strict mode
     */
    setStrictMode(strict: boolean): void;
    /**
     * Check if guard is enabled
     */
    isEnabled(): boolean;
    /**
     * Get compliance status
     */
    getComplianceStatus(): {
        isCompliant: boolean;
        violationCount: number;
        criticalViolations: number;
        recommendations: string[];
    };
}
/**
 * Global mock guard instance
 */
export declare const mockGuard: ProductionMockGuard;
/**
 * Decorator for functions that must return real data
 */
export declare function requireRealData(location: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => void;
export default mockGuard;
//# sourceMappingURL=mock-elimination-guards.d.ts.map