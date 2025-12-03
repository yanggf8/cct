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
export var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
/**
 * Circuit breaker implementation for external service protection
 */
export class CircuitBreaker {
    constructor(config = {}) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.totalCalls = 0;
        this.stateChangedTime = Date.now();
        this.halfOpenCallCount = 0;
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures = 0;
        this.callResults = [];
        const defaultConfig = {
            failureThreshold: 5,
            successThreshold: 3,
            openTimeout: 60000, // 1 minute
            halfOpenTimeout: 30000, // 30 seconds
            halfOpenMaxCalls: 5,
            resetTimeout: 300000, // 5 minutes
            trackResults: true,
            name: config.name
        };
        this.config = { ...defaultConfig, ...config };
    }
    /**
     * Execute an operation with circuit breaker protection
     */
    async execute(operation) {
        const startTime = Date.now();
        try {
            if (!this.canExecute()) {
                throw new Error(`Circuit breaker is ${this.state}. Rejecting call.`);
            }
            const result = await operation();
            const duration = Date.now() - startTime;
            this.onSuccess(duration);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.onFailure(error instanceof Error ? error : new Error(String(error)), duration);
            throw error;
        }
    }
    /**
     * Check if operation can be executed
     */
    canExecute() {
        this.updateStateIfNeeded();
        switch (this.state) {
            case CircuitState.CLOSED:
                return true;
            case CircuitState.OPEN:
                return false;
            case CircuitState.HALF_OPEN:
                return this.halfOpenCallCount < this.config.halfOpenMaxCalls;
            default:
                return false;
        }
    }
    /**
     * Handle successful operation
     */
    onSuccess(duration) {
        this.totalCalls++;
        this.successCount++;
        this.consecutiveSuccesses++;
        this.consecutiveFailures = 0;
        this.lastSuccessTime = Date.now();
        if (this.config.trackResults) {
            this.callResults.push({
                success: true,
                timestamp: Date.now(),
                duration
            });
            this.trimCallResults();
        }
        // State transitions
        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenCallCount++;
            if (this.consecutiveSuccesses >= this.config.successThreshold) {
                this.setState(CircuitState.CLOSED);
                this.resetCounters();
            }
        }
    }
    /**
     * Handle failed operation
     */
    onFailure(error, duration) {
        this.totalCalls++;
        this.failureCount++;
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
        this.lastFailureTime = Date.now();
        if (this.config.trackResults) {
            this.callResults.push({
                success: false,
                timestamp: Date.now(),
                duration,
                error
            });
            this.trimCallResults();
        }
        // State transitions
        if (this.state === CircuitState.CLOSED) {
            if (this.failureCount >= this.config.failureThreshold) {
                this.setState(CircuitState.OPEN);
            }
        }
        else if (this.state === CircuitState.HALF_OPEN) {
            this.setState(CircuitState.OPEN);
        }
    }
    /**
     * Update state based on timeouts
     */
    updateStateIfNeeded() {
        const now = Date.now();
        switch (this.state) {
            case CircuitState.OPEN:
                if (this.stateChangedTime && now - this.stateChangedTime >= this.config.openTimeout) {
                    this.setState(CircuitState.HALF_OPEN);
                    this.halfOpenCallCount = 0;
                }
                break;
            case CircuitState.HALF_OPEN:
                if (this.stateChangedTime && now - this.stateChangedTime >= this.config.halfOpenTimeout) {
                    this.setState(CircuitState.OPEN);
                }
                break;
            case CircuitState.CLOSED:
                // Reset failure count after reset timeout
                if (this.lastFailureTime && now - this.lastFailureTime >= this.config.resetTimeout) {
                    this.resetCounters();
                }
                break;
        }
    }
    /**
     * Set new state and update timestamp
     */
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.stateChangedTime = Date.now();
        // Log state change
        console.log(`Circuit breaker ${this.config.name || 'unnamed'} changed from ${oldState} to ${newState}`);
    }
    /**
     * Reset counters for new state
     */
    resetCounters() {
        this.failureCount = 0;
        this.successCount = 0;
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures = 0;
        this.halfOpenCallCount = 0;
    }
    /**
     * Trim call results to prevent memory leaks
     */
    trimCallResults() {
        const maxResults = 1000;
        if (this.callResults.length > maxResults) {
            this.callResults = this.callResults.slice(-maxResults);
        }
    }
    /**
     * Get current circuit breaker metrics
     */
    getMetrics() {
        const recentResults = this.callResults.slice(-100);
        const averageCallDuration = recentResults.length > 0
            ? recentResults.reduce((sum, r) => sum + (r.duration || 0), 0) / recentResults.length
            : 0;
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalCalls: this.totalCalls,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            stateChangedTime: this.stateChangedTime,
            halfOpenCallCount: this.halfOpenCallCount,
            consecutiveSuccesses: this.consecutiveSuccesses,
            consecutiveFailures: this.consecutiveFailures,
            averageCallDuration
        };
    }
    /**
     * Get success rate
     */
    getSuccessRate() {
        if (this.totalCalls === 0)
            return 1.0;
        return this.successCount / this.totalCalls;
    }
    /**
     * Get failure rate
     */
    getFailureRate() {
        if (this.totalCalls === 0)
            return 0.0;
        return this.failureCount / this.totalCalls;
    }
    /**
     * Check if circuit is healthy (not OPEN and reasonable failure rate)
     */
    isHealthy() {
        return this.state !== CircuitState.OPEN && this.getFailureRate() < 0.5;
    }
    /**
     * Force circuit to specific state (for testing/manual override)
     */
    forceState(state) {
        this.setState(state);
        this.resetCounters();
    }
    /**
     * Reset circuit breaker to initial state
     */
    reset() {
        this.setState(CircuitState.CLOSED);
        this.resetCounters();
        this.callResults = [];
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}
/**
 * Circuit breaker factory for creating multiple instances
 */
export class CircuitBreakerFactory {
    /**
     * Get or create circuit breaker with given name and config
     */
    static getInstance(name, config) {
        if (!this.instances.has(name)) {
            const breaker = new CircuitBreaker({ ...(config || {}), name });
            this.instances.set(name, breaker);
        }
        return this.instances.get(name);
    }
    /**
     * Get all circuit breaker instances
     */
    static getAllInstances() {
        return new Map(this.instances);
    }
    /**
     * Reset all circuit breakers
     */
    static resetAll() {
        this.instances.forEach(breaker => breaker.reset());
    }
    /**
     * Get health status of all circuit breakers
     */
    static getHealthStatus() {
        const result = [];
        this.instances.forEach((breaker, name) => {
            result.push({
                name,
                healthy: breaker.isHealthy(),
                metrics: breaker.getMetrics()
            });
        });
        return result;
    }
}
CircuitBreakerFactory.instances = new Map();
/**
 * Pre-configured circuit breakers for common use cases
 */
export const CommonCircuitBreakers = {
    /**
     * Circuit breaker for Yahoo Finance API
     */
    yahooFinance: () => CircuitBreakerFactory.getInstance('yahoo-finance', {
        trackResults: true,
        failureThreshold: 3,
        successThreshold: 2,
        openTimeout: 30000, // 30 seconds
        halfOpenTimeout: 15000, // 15 seconds
        halfOpenMaxCalls: 3,
        resetTimeout: 120000 // 2 minutes
    }),
    /**
     * Circuit breaker for general API calls
     */
    api: () => CircuitBreakerFactory.getInstance('api', {
        trackResults: true,
        failureThreshold: 5,
        successThreshold: 3,
        openTimeout: 60000, // 1 minute
        halfOpenTimeout: 30000, // 30 seconds
        halfOpenMaxCalls: 5,
        resetTimeout: 300000 // 5 minutes
    }),
    /**
     * Circuit breaker for database operations
     */
    database: () => CircuitBreakerFactory.getInstance('database', {
        trackResults: true,
        failureThreshold: 2,
        successThreshold: 5,
        openTimeout: 15000, // 15 seconds
        halfOpenTimeout: 10000, // 10 seconds
        halfOpenMaxCalls: 10,
        resetTimeout: 60000 // 1 minute
    })
};
//# sourceMappingURL=circuit-breaker.js.map