/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides failure protection for external API calls and other operations
 * Prevents cascading failures and allows systems to recover gracefully
 *
 * States:
 * - CLOSED: Normal operation, passes all requests
 * - OPEN: Fails fast, no requests pass through
 * - HALF_OPEN: Limited requests to test recovery
 *
 * Features:
 * - Configurable failure thresholds
 * - Automatic recovery testing
 * - Timeout-based state transitions
 * - Comprehensive metrics tracking
 * - Integration with monitoring systems
 *
 * @author Sector Rotation Pipeline v1.3
 * @since 2025-10-10
 */
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    openTimeout: number;
    halfOpenTimeout: number;
    halfOpenMaxCalls: number;
    resetTimeout: number;
    trackResults: boolean;
    name?: string;
}
export interface CallResult {
    success: boolean;
    timestamp: number;
    duration?: number;
    error?: Error;
}
export interface CircuitMetrics {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    totalCalls: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    stateChangedTime: number;
    halfOpenCallCount: number;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    averageCallDuration: number;
}
/**
 * Circuit breaker implementation for external service protection
 */
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private successCount;
    private totalCalls;
    private lastFailureTime?;
    private lastSuccessTime?;
    private stateChangedTime;
    private halfOpenCallCount;
    private consecutiveSuccesses;
    private consecutiveFailures;
    private callResults;
    private config;
    constructor(config?: Partial<CircuitBreakerConfig>);
    /**
     * Execute an operation with circuit breaker protection
     */
    execute<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * Check if operation can be executed
     */
    canExecute(): boolean;
    /**
     * Handle successful operation
     */
    private onSuccess;
    /**
     * Handle failed operation
     */
    private onFailure;
    /**
     * Update state based on timeouts
     */
    private updateStateIfNeeded;
    /**
     * Set new state and update timestamp
     */
    private setState;
    /**
     * Reset counters for new state
     */
    private resetCounters;
    /**
     * Trim call results to prevent memory leaks
     */
    private trimCallResults;
    /**
     * Get current circuit breaker metrics
     */
    getMetrics(): CircuitMetrics;
    /**
     * Get success rate
     */
    getSuccessRate(): number;
    /**
     * Get failure rate
     */
    getFailureRate(): number;
    /**
     * Check if circuit is healthy (not OPEN and reasonable failure rate)
     */
    isHealthy(): boolean;
    /**
     * Force circuit to specific state (for testing/manual override)
     */
    forceState(state: CircuitState): void;
    /**
     * Reset circuit breaker to initial state
     */
    reset(): void;
    /**
     * Get configuration
     */
    getConfig(): CircuitBreakerConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<CircuitBreakerConfig>): void;
}
/**
 * Circuit breaker factory for creating multiple instances
 */
export declare class CircuitBreakerFactory {
    private static instances;
    /**
     * Get or create circuit breaker with given name and config
     */
    static getInstance(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    /**
     * Get all circuit breaker instances
     */
    static getAllInstances(): Map<string, CircuitBreaker>;
    /**
     * Reset all circuit breakers
     */
    static resetAll(): void;
    /**
     * Get health status of all circuit breakers
     */
    static getHealthStatus(): Array<{
        name: string;
        healthy: boolean;
        metrics: CircuitMetrics;
    }>;
}
/**
 * Pre-configured circuit breakers for common use cases
 */
export declare const CommonCircuitBreakers: {
    /**
     * Circuit breaker for Yahoo Finance API
     */
    yahooFinance: () => CircuitBreaker;
    /**
     * Circuit breaker for general API calls
     */
    api: () => CircuitBreaker;
    /**
     * Circuit breaker for database operations
     */
    database: () => CircuitBreaker;
};
//# sourceMappingURL=circuit-breaker.d.ts.map