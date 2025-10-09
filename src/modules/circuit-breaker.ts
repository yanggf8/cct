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

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  // Failure threshold
  failureThreshold: number;

  // Success threshold for recovery
  successThreshold: number;

  // Timeout for OPEN state (ms)
  openTimeout: number;

  // Timeout for HALF_OPEN state (ms)
  halfOpenTimeout: number;

  // Number of requests to test in HALF_OPEN state
  halfOpenMaxCalls: number;

  // Reset timeout after which failure count resets (ms)
  resetTimeout: number;

  // Whether to track individual call results
  trackResults: boolean;

  // Optional name for identification
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
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalCalls: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private stateChangedTime: number = Date.now();
  private halfOpenCallCount: number = 0;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private callResults: CallResult[] = [];
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      openTimeout: 60000, // 1 minute
      halfOpenTimeout: 30000, // 30 seconds
      halfOpenMaxCalls: 5,
      resetTimeout: 300000, // 5 minutes
      trackResults: true,
      ...config
    };
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      if (!this.canExecute()) {
        throw new Error(`Circuit breaker is ${this.state}. Rejecting call.`);
      }

      const result = await operation();
      const duration = Date.now() - startTime;

      this.onSuccess(duration);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.onFailure(error instanceof Error ? error : new Error(String(error)), duration);
      throw error;
    }
  }

  /**
   * Check if operation can be executed
   */
  canExecute(): boolean {
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
  private onSuccess(duration: number): void {
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
  private onFailure(error: Error, duration: number): void {
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
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN);
    }
  }

  /**
   * Update state based on timeouts
   */
  private updateStateIfNeeded(): void {
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
  private setState(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.stateChangedTime = Date.now();

    // Log state change
    console.log(`Circuit breaker ${this.config.name || 'unnamed'} changed from ${oldState} to ${newState}`);
  }

  /**
   * Reset counters for new state
   */
  private resetCounters(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.halfOpenCallCount = 0;
  }

  /**
   * Trim call results to prevent memory leaks
   */
  private trimCallResults(): void {
    const maxResults = 1000;
    if (this.callResults.length > maxResults) {
      this.callResults = this.callResults.slice(-maxResults);
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitMetrics {
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
  getSuccessRate(): number {
    if (this.totalCalls === 0) return 1.0;
    return this.successCount / this.totalCalls;
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    if (this.totalCalls === 0) return 0.0;
    return this.failureCount / this.totalCalls;
  }

  /**
   * Check if circuit is healthy (not OPEN and reasonable failure rate)
   */
  isHealthy(): boolean {
    return this.state !== CircuitState.OPEN && this.getFailureRate() < 0.5;
  }

  /**
   * Force circuit to specific state (for testing/manual override)
   */
  forceState(state: CircuitState): void {
    this.setState(state);
    this.resetCounters();
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.setState(CircuitState.CLOSED);
    this.resetCounters();
    this.callResults = [];
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Circuit breaker factory for creating multiple instances
 */
export class CircuitBreakerFactory {
  private static instances: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker with given name and config
   */
  static getInstance(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.instances.has(name)) {
      const breaker = new CircuitBreaker({ ...config, name });
      this.instances.set(name, breaker);
    }
    return this.instances.get(name)!;
  }

  /**
   * Get all circuit breaker instances
   */
  static getAllInstances(): Map<string, CircuitBreaker> {
    return new Map(this.instances);
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.instances.forEach(breaker => breaker.reset());
  }

  /**
   * Get health status of all circuit breakers
   */
  static getHealthStatus(): Array<{ name: string; healthy: boolean; metrics: CircuitMetrics }> {
    const result: Array<{ name: string; healthy: boolean; metrics: CircuitMetrics }> = [];

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

/**
 * Pre-configured circuit breakers for common use cases
 */
export const CommonCircuitBreakers = {
  /**
   * Circuit breaker for Yahoo Finance API
   */
  yahooFinance: () => CircuitBreakerFactory.getInstance('yahoo-finance', {
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
    failureThreshold: 2,
    successThreshold: 5,
    openTimeout: 15000, // 15 seconds
    halfOpenTimeout: 10000, // 10 seconds
    halfOpenMaxCalls: 10,
    resetTimeout: 60000 // 1 minute
  })
};