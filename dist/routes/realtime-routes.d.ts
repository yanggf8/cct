/**
 * Real-time Streaming Routes
 * Server-Sent Events (SSE) endpoints for real-time dashboard updates
 */
interface RealtimeConnection {
    id: string;
    response: Response;
    controller: ReadableStreamDefaultController;
    lastActivity: number;
    subscriptions: Set<string>;
}
declare class RealtimeManager {
    private connections;
    private intervals;
    private cacheManager;
    constructor();
    /**
     * Get cache instance (DO cache if enabled, otherwise null)
     */
    private getCacheManager;
    /**
     * Simple cache for real-time data
     */
    private cache;
    /**
     * Create new SSE connection
     */
    createConnection(request: Request, env: any, ctx: ExecutionContext): Promise<Response>;
    /**
     * Send data to specific client
     */
    sendToClient(clientId: string, data: any): boolean;
    /**
     * Broadcast data to all connected clients
     */
    broadcast(data: any, filter?: (connection: RealtimeConnection) => boolean): number;
    /**
     * Send initial data to new client
     */
    sendInitialData(clientId: string, env: any): Promise<void>;
    /**
     * Start data generators for real-time updates
     */
    startDataGenerators(env?: any): void;
    /**
     * Schedule random alert generation
     */
    scheduleRandomAlert(): void;
    /**
     * Get market overview data
     */
    getMarketOverview(env?: any): Promise<any>;
    /**
     * Get sentiment data
     */
    getSentimentData(env?: any): Promise<any>;
    /**
     * Get sector data
     */
    getSectorData(env?: any): Promise<any>;
    /**
     * Get predictive analytics data
     */
    getPredictiveData(env?: any): Promise<any>;
    /**
     * Generate random alert
     */
    generateRandomAlert(): any;
    /**
     * Generate sentiment time series data
     */
    generateSentimentTimeSeries(): any[];
    /**
     * Clean up inactive connections
     */
    cleanupConnections(): void;
    /**
     * Generate random client ID
     */
    generateClientId(): string;
    /**
     * Get random regime
     */
    getRandomRegime(): string;
    /**
     * Get random sentiment
     */
    getRandomSentiment(): string;
    /**
     * Get random direction
     */
    getRandomDirection(): string;
    /**
     * Get random risk level
     */
    getRandomRiskLevel(): string;
    /**
     * Default data methods
     */
    getDefaultMarketData(): any;
    getDefaultSentimentData(): any;
    getDefaultSectorData(): any;
    getDefaultPredictiveData(): any;
    /**
     * Get connection stats
     */
    getConnectionStats(): any;
}
declare function getRealtimeManager(): RealtimeManager;
/**
 * Handle real-time streaming requests
 */
export declare function handleRealtimeRoutes(request: Request, env: any, path: string, headers: Record<string, string>): Promise<Response>;
export { getRealtimeManager };
//# sourceMappingURL=realtime-routes.d.ts.map