/**
 * Intraday Performance Check Handler
 * Tracks performance of morning high-confidence signals
 */
import { type HandlerFunction } from '../handler-factory.js';
import type { CloudflareEnvironment } from '../../types';
/**
 * Intraday signal performance data
 */
export interface IntradaySignal {
    symbol: string;
    predicted: string;
    predictedDirection: 'up' | 'down' | 'flat';
    actual: string;
    actualDirection: 'up' | 'down' | 'flat';
    performance?: number;
    confidence?: number;
    reason?: string;
}
/**
 * Divergence tracking information
 */
export interface DivergenceData extends IntradaySignal {
    level: 'high' | 'medium' | 'low';
    reason?: string;
}
/**
 * Model health status information
 */
export interface ModelHealthStatus {
    status: 'on-track' | 'divergence' | 'off-track';
    display: string;
    accuracy?: number;
    lastUpdated?: string;
}
/**
 * Performance tracking summary
 */
export interface PerformanceTracking {
    totalSignals: number;
    correctCalls: number;
    wrongCalls: number;
    pendingCalls: number;
    avgDivergence: number;
    liveAccuracy: number;
}
/**
 * Recalibration alert information
 */
export interface RecalibrationAlert {
    status: 'yes' | 'no' | 'warning';
    message: string;
    threshold: number;
    currentValue?: number;
}
/**
 * Complete intraday performance data
 */
export interface IntradayPerformanceData {
    modelHealth: ModelHealthStatus;
    liveAccuracy: number;
    totalSignals: number;
    correctCalls: number;
    wrongCalls: number;
    pendingCalls: number;
    avgDivergence: number;
    divergences: DivergenceData[];
    onTrackSignals: IntradaySignal[];
    recalibrationAlert: RecalibrationAlert;
    lastUpdated?: string;
    generatedAt?: string;
}
/**
 * Dependency validation result
 */
export interface DependencyValidation {
    isValid: boolean;
    completed: string[];
    missing: string[];
    requiredJobs: string[];
    completionRate: number;
    date: string;
}
/**
 * Job status update metadata
 */
export interface JobStatusMetadata {
    requestId: string;
    startTime?: string;
    endTime?: string;
    processingTimeMs?: number;
    signalCount?: number;
    missingDependencies?: string[];
    error?: string;
    phase?: string;
    reason?: string;
}
/**
 * HTML generation context
 */
export interface HTMLGenerationContext {
    date: Date;
    env: CloudflareEnvironment;
    requestId?: string;
    processingTime?: number;
}
/**
 * API Response headers
 */
export interface ResponseHeaders {
    'Content-Type': string;
    'Cache-Control'?: string;
    'X-Request-ID'?: string;
    'X-Processing-Time'?: string;
}
/**
 * Generate Intraday Performance Check Page
 */
export declare const handleIntradayCheck: HandlerFunction;
//# sourceMappingURL=intraday-handlers.d.ts.map