/**
 * Professional Dashboard Handlers - TypeScript
 * Main dashboard with 7 key widgets using Pico.css framework
 *
 * This module handles the professional dashboard with comprehensive type safety
 * and widget data processing for the TFT Trading System.
 */
import type { CloudflareEnvironment } from '../../types.js';
/**
 * Market index data structure
 */
export interface MarketIndex {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
}
/**
 * Market data structure with indices and last update time
 */
export interface MarketData {
    indices: MarketIndex[];
    lastUpdate: string;
}
/**
 * AI model health status
 */
export interface ModelHealthStatus {
    status: 'active' | 'inactive' | 'error';
    lastUsed: string | null;
}
/**
 * Model health data structure
 */
export interface ModelHealthData {
    status: 'healthy' | 'error' | 'warning';
    models: Record<string, ModelHealthStatus>;
    lastAnalysis: string | null;
    analysisCount: number;
    error?: string;
}
/**
 * System health components status
 */
export interface HealthComponents {
    kv: string;
    ai: string;
    api: string;
    [key: string]: string;
}
/**
 * System health data structure
 */
export interface HealthData {
    status: 'healthy' | 'error' | 'warning';
    components?: HealthComponents;
    uptime: number;
    lastUpdate: string;
    error?: string;
}
/**
 * Sentiment signal data
 */
export interface SentimentSignal {
    symbol: string;
    sentiment: string;
    confidence: number;
    signal: string;
    reasoning?: string;
}
/**
 * Latest analysis data structure
 */
export interface LatestAnalysisData {
    status: 'available' | 'no_data' | 'error';
    timestamp?: string;
    signals: SentimentSignal[];
    confidence: number;
    summary?: string;
    market_sentiment?: string;
    message?: string;
    error?: string;
}
/**
 * Sector performance data
 */
export interface SectorPerformance {
    name: string;
    symbol: string;
    performance: number;
    status: 'bullish' | 'bearish' | 'neutral';
}
/**
 * Sector data structure
 */
export interface SectorData {
    sectors: SectorPerformance[];
    lastUpdate: string;
}
/**
 * Complete widget data for dashboard
 */
export interface DashboardWidgetData {
    health: HealthData;
    modelHealth: ModelHealthData;
    latestAnalysis: LatestAnalysisData;
    marketData: MarketData;
    sectorData: SectorData;
}
/**
 * Market status information
 */
export interface MarketStatus {
    isOpen: boolean;
    nextEvent: string;
}
/**
 * Dashboard generation context
 */
export interface DashboardContext {
    requestId: string;
    startTime: number;
}
/**
 * Format currency values with USD formatting
 * @param value - Numeric value to format
 * @returns Formatted currency string
 */
export declare function formatCurrency(value: number | string | undefined | null): string;
/**
 * Format percentage values
 * @param value - Numeric value to format as percentage
 * @returns Formatted percentage string
 */
export declare function formatPercentage(value: number | string | undefined | null): string;
/**
 * Format numbers with locale-specific formatting
 * @param value - Numeric value to format
 * @returns Formatted number string
 */
export declare function formatNumber(value: number | string | undefined | null): string;
/**
 * Determine CSS class for change values
 * @param change - Numeric change value
 * @returns CSS class name
 */
export declare function getChangeClass(change: number): string;
/**
 * Get current market status based on time
 * @returns Market status information
 */
export declare function getMarketStatus(): MarketStatus;
/**
 * Get default health data when actual data is unavailable
 * @returns Default health data structure
 */
export declare function getDefaultHealthData(): HealthData;
/**
 * Get default model health data when actual data is unavailable
 * @returns Default model health data structure
 */
export declare function getDefaultModelHealthData(): ModelHealthData;
/**
 * Get default analysis data when no analysis is available
 * @returns Default analysis data structure
 */
export declare function getDefaultAnalysisData(): LatestAnalysisData;
/**
 * Get default market data when market data is unavailable
 * @returns Default market data structure
 */
export declare function getDefaultMarketData(): MarketData;
/**
 * Get default sector data when sector data is unavailable
 * @returns Default sector data structure
 */
export declare function getDefaultSectorData(): SectorData;
/**
 * Fetch system health data from the environment
 * @param env - Cloudflare environment
 * @returns Health data structure
 */
export declare function fetchHealthData(env: CloudflareEnvironment): Promise<HealthData>;
/**
 * Fetch AI model health data
 * @param env - Cloudflare environment
 * @returns Model health data structure
 */
export declare function fetchModelHealthData(env: CloudflareEnvironment): Promise<ModelHealthData>;
/**
 * Fetch latest analysis data
 * @param env - Cloudflare environment
 * @returns Latest analysis data structure
 */
export declare function fetchLatestAnalysis(env: CloudflareEnvironment): Promise<LatestAnalysisData>;
/**
 * Fetch market data (indices) with caching
 * @param env - Cloudflare environment
 * @returns Market data structure
 */
export declare function fetchMarketData(env: CloudflareEnvironment): Promise<MarketData>;
/**
 * Fetch sector performance data
 * @param env - Cloudflare environment
 * @returns Sector data structure
 */
export declare function fetchSectorData(env: CloudflareEnvironment): Promise<SectorData>;
/**
 * Generate complete dashboard HTML with all widgets
 * @param data - Dashboard widget data
 * @param env - Cloudflare environment
 * @returns Complete HTML string for dashboard
 */
export declare function generateDashboardHTML(data: DashboardWidgetData, env: CloudflareEnvironment): string;
/**
 * Generate error dashboard HTML when dashboard fails to load
 * @param errorMessage - Error message to display
 * @param requestId - Request ID for tracking
 * @returns Error dashboard HTML string
 */
export declare function generateErrorDashboard(errorMessage: string, requestId: string): string;
/**
 * Handle main dashboard request with 7 professional widgets
 * This is the main entry point for the professional dashboard
 *
 * @param request - HTTP request object
 * @param env - Cloudflare environment
 * @param ctx - Execution context
 * @returns HTTP response with dashboard HTML
 */
export declare function handleProfessionalDashboard(request: Request, env: CloudflareEnvironment, ctx: any): Promise<Response>;
declare const _default: {
    handleProfessionalDashboard: typeof handleProfessionalDashboard;
    generateDashboardHTML: typeof generateDashboardHTML;
    generateErrorDashboard: typeof generateErrorDashboard;
    fetchHealthData: typeof fetchHealthData;
    fetchModelHealthData: typeof fetchModelHealthData;
    fetchLatestAnalysis: typeof fetchLatestAnalysis;
    fetchMarketData: typeof fetchMarketData;
    fetchSectorData: typeof fetchSectorData;
    formatCurrency: typeof formatCurrency;
    formatPercentage: typeof formatPercentage;
    formatNumber: typeof formatNumber;
    getChangeClass: typeof getChangeClass;
    getMarketStatus: typeof getMarketStatus;
    getDefaultHealthData: typeof getDefaultHealthData;
    getDefaultModelHealthData: typeof getDefaultModelHealthData;
    getDefaultAnalysisData: typeof getDefaultAnalysisData;
    getDefaultMarketData: typeof getDefaultMarketData;
    getDefaultSectorData: typeof getDefaultSectorData;
};
export default _default;
//# sourceMappingURL=dashboard-handlers.d.ts.map