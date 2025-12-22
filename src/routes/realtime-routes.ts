/**
 * Real-time Streaming Routes
 * Server-Sent Events (SSE) endpoints for real-time dashboard updates
 */

import { ApiResponseFactory, HttpStatus, generateRequestId } from '../modules/api-v1-responses.js';
import { createCacheInstance } from '../modules/dual-cache-do.js';
import { fetchRealMarketIndices, fetchRealSectorData } from '../modules/real-analytics-data.js';
import { createLogger } from '../modules/logging.js';

const logger = createLogger('realtime-routes');

interface RealtimeConnection {
    id: string;
    response: Response;
    controller: ReadableStreamDefaultController;
    lastActivity: number;
    subscriptions: Set<string>;
}

class RealtimeManager {
    private connections: Map<string, RealtimeConnection> = new Map();
    private intervals: Map<string, number> = new Map();
    private cacheManager: any = null;

    constructor() {
        // Clean up inactive connections every 30 seconds
        setInterval(() => {
            this.cleanupConnections();
        }, 30000);

        // Start data generators
        this.startDataGenerators();
    }

    /**
     * Get cache instance (DO cache if enabled, otherwise null)
     */
    private async getCacheManager(env: any) {
        return createCacheInstance(env, true); // Returns null if DO not available
    }

    /**
     * Simple cache for real-time data
     */
    private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

    /**
     * Create new SSE connection
     */
    async createConnection(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        const clientId = this.generateClientId();
        const headers = {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
        };

        const stream = new ReadableStream({
            start: (controller: any) => {
                const connection: RealtimeConnection = {
                    id: clientId,
                    response: new Response(),
                    controller,
                    lastActivity: Date.now(),
                    subscriptions: new Set(['market', 'sentiment', 'alerts'])
                };

                this.connections.set(clientId, connection);

                // Send initial connection message
                this.sendToClient(clientId, {
                    type: 'connection',
                    data: {
                        clientId,
                        message: 'Connected to TFT Trading System real-time stream',
                        timestamp: new Date().toISOString()
                    }
                });

                // Send initial data
                this.sendInitialData(clientId, env);

                console.log(`📡 Real-time connection established: ${clientId}`);
            },

            cancel: () => {
                this.connections.delete(clientId);
                console.log(`📡 Real-time connection closed: ${clientId}`);
            }
        });

        ctx.waitUntil(
            new Promise((resolve: any) => {
                stream.cancel().then(resolve);
            })
        );

        return new Response(stream, { headers });
    }

    /**
     * Send data to specific client
     */
    sendToClient(clientId: string, data: any): boolean {
        const connection = this.connections.get(clientId);
        if (!connection || connection.controller.desiredSize === null) {
            this.connections.delete(clientId);
            return false;
        }

        try {
            const eventData = `data: ${JSON.stringify(data)}\n\n`;
            connection.controller.enqueue(new TextEncoder().encode(eventData));
            connection.lastActivity = Date.now();
            return true;
        } catch (error: unknown) {
            console.error(`Failed to send data to client ${clientId}:`, error);
            this.connections.delete(clientId);
            return false;
        }
    }

    /**
     * Broadcast data to all connected clients
     */
    broadcast(data: any, filter?: (connection: RealtimeConnection) => boolean): number {
        let sentCount = 0;
        const deadConnections: string[] = [];

        this.connections.forEach((connection: any, clientId: any) => {
            if (filter && !filter(connection)) {
                return;
            }

            if (this.sendToClient(clientId, data)) {
                sentCount++;
            } else {
                deadConnections.push(clientId);
            }
        });

        // Clean up dead connections
        deadConnections.forEach(clientId => {
            this.connections.delete(clientId);
        });

        return sentCount;
    }

    /**
     * Send initial data to new client
     */
    async sendInitialData(clientId: string, env: any): Promise<void> {
        try {
            // Send market overview
            const marketData = await this.getMarketOverview(env);
            this.sendToClient(clientId, {
                type: 'market',
                payload: marketData,
                timestamp: new Date().toISOString()
            });

            // Send sentiment data
            const sentimentData = await this.getSentimentData(env);
            this.sendToClient(clientId, {
                type: 'sentiment',
                payload: sentimentData,
                timestamp: new Date().toISOString()
            });

            // Send sector data
            const sectorData = await this.getSectorData(env);
            this.sendToClient(clientId, {
                type: 'sector',
                payload: sectorData,
                timestamp: new Date().toISOString()
            });

            // Send predictive data
            const predictiveData = await this.getPredictiveData(env);
            this.sendToClient(clientId, {
                type: 'predictive',
                payload: predictiveData,
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            console.error('Failed to send initial data:', error);
        }
    }

    /**
     * Start data generators for real-time updates
     */
    startDataGenerators(env?: any): void {
        // Market data updates every 5 seconds
        this.intervals.set('market', setInterval(async () => {
            if (this.connections.size > 0) {
                const marketData = await this.getMarketOverview(env);
                this.broadcast({
                    type: 'market',
                    payload: marketData,
                    timestamp: new Date().toISOString()
                }, (conn: any) => conn.subscriptions.has('market'));
            }
        }, 5000));

        // Sentiment updates every 10 seconds
        this.intervals.set('sentiment', setInterval(async () => {
            if (this.connections.size > 0) {
                const sentimentData = await this.getSentimentData(env);
                this.broadcast({
                    type: 'sentiment',
                    payload: sentimentData,
                    timestamp: new Date().toISOString()
                }, (conn: any) => conn.subscriptions.has('sentiment'));
            }
        }, 10000));

        // Sector updates every 15 seconds
        this.intervals.set('sector', setInterval(async () => {
            if (this.connections.size > 0) {
                const sectorData = await this.getSectorData(env);
                this.broadcast({
                    type: 'sector',
                    payload: sectorData,
                    timestamp: new Date().toISOString()
                }, (conn: any) => conn.subscriptions.has('sector'));
            }
        }, 15000));

        // Predictive updates every 30 seconds
        this.intervals.set('predictive', setInterval(async () => {
            if (this.connections.size > 0) {
                const predictiveData = await this.getPredictiveData(env);
                this.broadcast({
                    type: 'predictive',
                    payload: predictiveData,
                    timestamp: new Date().toISOString()
                }, (conn: any) => conn.subscriptions.has('predictive'));
            }
        }, 30000));

        // Random alerts every 45-90 seconds
        this.scheduleRandomAlert();
    }

    /**
     * Schedule random alert generation
     */
    scheduleRandomAlert(): void {
        const delay = 45000 + Math.random() * 45000; // 45-90 seconds

        setTimeout(() => {
            if (this.connections.size > 0) {
                const alert = this.generateRandomAlert();
                this.broadcast({
                    type: 'alert',
                    payload: alert,
                    timestamp: new Date().toISOString()
                }, (conn: any) => conn.subscriptions.has('alerts'));
            }

            // Schedule next alert
            this.scheduleRandomAlert();
        }, delay);
    }

    /**
     * Get market overview data
     */
    async getMarketOverview(env?: any): Promise<any> {
        try {
            // Try to get from simple cache first
            const cacheKey = 'realtime:market-overview';
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < cached.ttl) {
                return cached.data;
            }

            // Fetch real market data from Yahoo Finance
            try {
                const realData = await fetchRealMarketIndices();
                
                const marketData = {
                    indices: realData.indices,
                    vix: realData.vix,
                    regime: this.determineMarketRegime(realData.vix, realData.indices.sp500.change),
                    timestamp: realData.timestamp,
                    dataSource: 'yahoo_finance',
                    status: 'live'
                };

                // Cache for 30 seconds
                this.cache.set(cacheKey, {
                    data: marketData,
                    timestamp: Date.now(),
                    ttl: 30000
                });

                return marketData;
            } catch (fetchError) {
                logger.warn('Yahoo Finance fetch failed, returning unavailable status', { error: fetchError });
                return {
                    indices: {
                        sp500: { value: null, change: null },
                        nasdaq: { value: null, change: null },
                        dow: { value: null, change: null }
                    },
                    vix: null,
                    regime: 'unknown',
                    timestamp: new Date().toISOString(),
                    dataSource: 'unavailable',
                    status: 'data_fetch_failed',
                    error: 'Unable to fetch real-time market data'
                };
            }
        } catch (error: unknown) {
            logger.error('Failed to get market overview:', { error });
            return {
                indices: { sp500: { value: null, change: null }, nasdaq: { value: null, change: null }, dow: { value: null, change: null } },
                vix: null,
                regime: 'unknown',
                timestamp: new Date().toISOString(),
                dataSource: 'unavailable',
                status: 'error'
            };
        }
    }

    /**
     * Determine market regime based on VIX and market change
     */
    private determineMarketRegime(vix: number | null, spChange: number | null): string {
        if (vix === null || spChange === null) return 'unknown';
        if (vix > 30) return 'high-volatility';
        if (vix > 20) return 'elevated-volatility';
        if (spChange > 1) return 'bullish';
        if (spChange < -1) return 'bearish';
        return 'neutral';
    }

    /**
     * Get sentiment data
     */
    async getSentimentData(env?: any): Promise<any> {
        try {
            const cacheKey = 'realtime:sentiment';
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < cached.ttl) {
                return cached.data;
            }

            // Generate mock sentiment data
            const sentimentData = {
                overallSentiment: {
                    label: this.getRandomSentiment(),
                    sentiment: this.getRandomSentiment().toLowerCase(),
                    confidence: 0.6 + Math.random() * 0.3
                },
                timeSeries: this.generateSentimentTimeSeries(),
                symbols: [
                    { symbol: 'AAPL', sentiment: (Math.random() - 0.5) * 2, confidence: 0.7 + Math.random() * 0.2 },
                    { symbol: 'MSFT', sentiment: (Math.random() - 0.5) * 2, confidence: 0.7 + Math.random() * 0.2 },
                    { symbol: 'GOOGL', sentiment: (Math.random() - 0.5) * 2, confidence: 0.7 + Math.random() * 0.2 },
                    { symbol: 'TSLA', sentiment: (Math.random() - 0.5) * 2, confidence: 0.7 + Math.random() * 0.2 },
                    { symbol: 'NVDA', sentiment: (Math.random() - 0.5) * 2, confidence: 0.7 + Math.random() * 0.2 }
                ],
                timestamp: new Date().toISOString()
            };

            // Cache for 60 seconds
            this.cache.set(cacheKey, {
                data: sentimentData,
                timestamp: Date.now(),
                ttl: 60000
            });

            return sentimentData;
        } catch (error: unknown) {
            console.error('Failed to get sentiment data:', error);
            return this.getDefaultSentimentData();
        }
    }

    /**
     * Get sector data
     */
    async getSectorData(env?: any): Promise<any> {
        try {
            const cacheKey = 'realtime:sectors';
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < cached.ttl) {
                return cached.data;
            }

            // Fetch real sector ETF data with graceful degradation
            try {
                const realSectors = await fetchRealSectorData();
                
                const sectorData = {
                    sectors: realSectors.map(s => ({
                        symbol: s.symbol,
                        name: s.name,
                        price: s.price,
                        change: s.change,
                        changePercent: s.changePercent
                    })),
                    timestamp: new Date().toISOString(),
                    dataSource: 'yahoo_finance',
                    status: 'live'
                };

                // Cache for 90 seconds
                this.cache.set(cacheKey, {
                    data: sectorData,
                    timestamp: Date.now(),
                    ttl: 90000
                });

                return sectorData;
            } catch (fetchError) {
                logger.warn('Yahoo Finance sector fetch failed, returning unavailable status', { error: fetchError });
                return {
                    sectors: [],
                    timestamp: new Date().toISOString(),
                    dataSource: 'unavailable',
                    status: 'data_fetch_failed',
                    error: 'Unable to fetch real-time sector data'
                };
            }
        } catch (error: unknown) {
            logger.error('Failed to get sector data:', { error });
            return {
                sectors: [],
                timestamp: new Date().toISOString(),
                dataSource: 'unavailable',
                status: 'error'
            };
        }
    }

    /**
     * Get predictive analytics data
     */
    async getPredictiveData(env?: any): Promise<any> {
        try {
            const cacheKey = 'realtime:predictive';
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < cached.ttl) {
                return cached.data;
            }

            const predictiveData = {
                confidence: 0.65 + Math.random() * 0.25,
                direction: this.getRandomDirection(),
                riskLevel: this.getRandomRiskLevel(),
                signals: [
                    { type: 'trend', strength: Math.random(), timeframe: '1D' },
                    { type: 'momentum', strength: Math.random(), timeframe: '1W' },
                    { type: 'volatility', strength: Math.random(), timeframe: '1M' }
                ],
                timestamp: new Date().toISOString()
            };

            // Cache for 120 seconds
            this.cache.set(cacheKey, {
                data: predictiveData,
                timestamp: Date.now(),
                ttl: 120000
            });

            return predictiveData;
        } catch (error: unknown) {
            console.error('Failed to get predictive data:', error);
            return this.getDefaultPredictiveData();
        }
    }

    /**
     * Generate random alert
     */
    generateRandomAlert(): any {
        const alertTypes = [
            { title: 'High Volatility Detected', priority: 'high', message: 'VIX has spiked above 25, indicating increased market volatility' },
            { title: 'Sentiment Shift', priority: 'medium', message: 'Market sentiment is shifting from bullish to neutral' },
            { title: 'Sector Rotation Alert', priority: 'medium', message: 'Technology sector showing signs of rotation to financials' },
            { title: 'Trading Signal', priority: 'low', message: 'Strong buy signal detected for AAPL based on technical indicators' },
            { title: 'Market Driver Update', priority: 'medium', message: 'Fed announcement expected to impact interest rate expectations' },
            { title: 'Predictive Alert', priority: 'high', message: 'AI models predicting increased downside risk in next 24 hours' }
        ];

        const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];

        return {
            id: Date.now(),
            ...alert,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate sentiment time series data
     */
    generateSentimentTimeSeries(): any[] {
        const data = [];
        const now = new Date();

        for (let i = 23; i >= 0; i--) {
            const timestamp = new Date(now.getTime() - i * 3600000);
            data.push({
                timestamp: timestamp.toISOString(),
                sentiment: (Math.sin(i / 4) * 0.5 + Math.random() * 0.3 - 0.15),
                confidence: 0.6 + Math.random() * 0.3
            });
        }

        return data;
    }

    /**
     * Clean up inactive connections
     */
    cleanupConnections(): void {
        const now = Date.now();
        const timeout = 60000; // 1 minute timeout
        const deadConnections: string[] = [];

        this.connections.forEach((connection: any, clientId: any) => {
            if (now - connection.lastActivity > timeout || connection.controller.closed) {
                deadConnections.push(clientId);
            }
        });

        deadConnections.forEach(clientId => {
            try {
                const connection = this.connections.get(clientId);
                if (connection && connection.controller.desiredSize !== null) {
                    connection.controller.close();
                }
            } catch (error: unknown) {
                // Ignore errors during cleanup
            }
            this.connections.delete(clientId);
        });

        if (deadConnections.length > 0) {
            console.log(`📡 Cleaned up ${deadConnections.length} inactive connections`);
        }
    }

    /**
     * Generate random client ID
     */
    generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get random regime
     */
    getRandomRegime(): string {
        const regimes = ['Bullish', 'Bearish', 'Neutral'];
        return regimes[Math.floor(Math.random() * regimes.length)];
    }

    /**
     * Get random sentiment
     */
    getRandomSentiment(): string {
        const sentiments = ['Bullish', 'Bearish', 'Neutral'];
        return sentiments[Math.floor(Math.random() * sentiments.length)];
    }

    /**
     * Get random direction
     */
    getRandomDirection(): string {
        const directions = ['bullish', 'bearish', 'neutral'];
        return directions[Math.floor(Math.random() * directions.length)];
    }

    /**
     * Get random risk level
     */
    getRandomRiskLevel(): string {
        const risks = ['low', 'moderate', 'high'];
        return risks[Math.floor(Math.random() * risks.length)];
    }

    /**
     * Default data methods
     */
    getDefaultMarketData(): any {
        return {
            indices: {
                sp500: { value: 4567.18, change: 0 },
                nasdaq: { value: 14234.56, change: 0 },
                dow: { value: 35678.90, change: 0 }
            },
            vix: 18.47,
            regime: 'Neutral',
            timestamp: new Date().toISOString()
        };
    }

    getDefaultSentimentData(): any {
        return {
            overallSentiment: { label: 'Neutral', sentiment: 'neutral', confidence: 0.5 },
            timeSeries: [],
            symbols: [],
            timestamp: new Date().toISOString()
        };
    }

    getDefaultSectorData(): any {
        return {
            sectors: [],
            timestamp: new Date().toISOString()
        };
    }

    getDefaultPredictiveData(): any {
        return {
            confidence: 0.5,
            direction: 'neutral',
            riskLevel: 'moderate',
            signals: [],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get connection stats
     */
    getConnectionStats(): any {
        return {
            activeConnections: this.connections.size,
            totalConnections: this.connections.size,
            uptime: Date.now()
        };
    }
}

// Global real-time manager instance (lazy initialization)
let realtimeManager: RealtimeManager | null = null;

function getRealtimeManager(): RealtimeManager {
    if (!realtimeManager) {
        realtimeManager = new RealtimeManager();
    }
    return realtimeManager;
}

/**
 * Handle real-time streaming requests
 */
export async function handleRealtimeRoutes(request: Request, env: any, path: string, headers: Record<string, string>): Promise<Response> {
    try {
        const manager = getRealtimeManager();

        if (path === '/api/v1/realtime/stream') {
            const mockCtx = {
                waitUntil: (promise: Promise<any>) => {
                    // Mock implementation for context
                    promise.catch(() => {});
                }
            };
            return await manager.createConnection(request, env, mockCtx as any);
        }

        if (path === '/api/v1/realtime/status') {
            const stats = manager.getConnectionStats();
            const body = ApiResponseFactory.success(stats, { requestId: headers['X-Request-ID'] });
            return new Response(JSON.stringify(body), {
                status: HttpStatus.OK,
                headers
            });
        }

        if (path === '/api/v1/realtime/refresh') {
            // Trigger immediate data refresh for all clients
            const marketData = await manager.getMarketOverview(env);
            const sentimentData = await manager.getSentimentData(env);
            const sectorData = await manager.getSectorData(env);

            manager.broadcast({
                type: 'market',
                payload: marketData,
                timestamp: new Date().toISOString()
            });

            manager.broadcast({
                type: 'sentiment',
                payload: sentimentData,
                timestamp: new Date().toISOString()
            });

            manager.broadcast({
                type: 'sector',
                payload: sectorData,
                timestamp: new Date().toISOString()
            });

            const body = ApiResponseFactory.success(
                { message: 'Data refresh triggered for all clients' },
                { requestId: headers['X-Request-ID'] }
            );
            return new Response(JSON.stringify(body), {
                status: HttpStatus.OK,
                headers
            });
        }

        const body = ApiResponseFactory.error('Real-time endpoint not found', 'NOT_FOUND', {
            requested_path: path
        });
        return new Response(JSON.stringify(body), {
            status: HttpStatus.NOT_FOUND,
            headers
        });

    } catch (error: unknown) {
        console.error('Real-time routes error:', error);
        const body = ApiResponseFactory.error('Internal server error', 'INTERNAL_ERROR', {
            message: (error as any)?.message || 'Unknown error'
        });
        return new Response(JSON.stringify(body), {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            headers
        });
    }
}

// Export manager for external access
export { getRealtimeManager };