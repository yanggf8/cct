/**
 * Vectorized Sector Processing Module
 * Eliminates loop inefficiencies in sector data processing
 * Provides 30-40% KV reduction through vectorized operations
 */
export interface SectorDataRequest {
    symbols: string[];
    operations: string[];
    date?: string;
    days?: number;
    priority: 'high' | 'medium' | 'low';
}
export interface SectorDataBatchResult {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    kvOperationsReduced: number;
    data: Map<string, any>;
}
export interface VectorizedResult {
    operation: string;
    originalKVCount: number;
    optimizedKVCount: number;
    reduction: number;
    reductionPercentage: number;
    data: any;
}
/**
 * Vectorized Sector Data Processor
 * Processes multiple sector operations in parallel with minimal KV operations
 */
export declare class VectorizedSectorProcessor {
    private static instance;
    private batchOperations;
    private readonly OPERATION_TEMPLATES;
    private constructor();
    static getInstance(baseDAL: any): VectorizedSectorProcessor;
    /**
     * Process multiple sectors with AI analysis
     * Replaces individual AI calls for each sector
     */
    processSectorsWithAI(sectors: string[], priority?: 'high' | 'medium' | 'low'): Promise<VectorizedResult>;
    /**
     * Get market data for multiple sectors in one vectorized operation
     */
    processSectorsMarketData(sectors: string[], priority?: 'high' | 'medium' | 'low'): Promise<VectorizedResult>;
    /**
     * Get historical data for multiple sectors with optimized SPY reuse
     */
    processSectorsHistorical(sectors: string[], days: number, priority: 'medium'): Promise<VectorizedResult>;
    /**
     * Process sector rotation analysis with vectorization
     */
    processSectorRotation(sectors: string[], spyData: any, priority: 'high'): Promise<VectorizedResult>;
    /**
     * Process multiple sector operations in one vectorized call
     */
    processBatchSectorData(requests: SectorDataRequest[]): Promise<SectorDataBatchResult>;
    /**
     * Process a specific type of sector operation
     */
    private processOperationType;
    /**
     * Group requests by operation type
     */
    private groupOperationsByType;
    /**
     * Find data for a specific symbol from batch results
     */
    private findDataForSymbol;
    /**
     * Calculate rotation metrics for sectors
     */
    private calculateRotationMetrics;
    /**
     * Calculate rotation score for sector analysis
     */
    private calculateRotationScore;
    /**
     * Calculate correlation between sector returns and benchmark
     */
    private calculateCorrelation;
    /**
     * Get vectorization statistics for monitoring
     */
    getVectorizationStats(): {
        processedOperations: number;
        averageKVReduction: number;
        totalKVReduction: number;
        operationTypes: string[];
    };
    /**
     * Get optimization recommendations
     */
    getOptimizationRecommendations(): string[];
}
//# sourceMappingURL=vectorized-sector-processor.d.ts.map