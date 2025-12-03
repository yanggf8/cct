import { type CloudflareEnvironment } from '../types.js';
export interface KVCleanupRequest {
    prefixes?: string[];
    retentionDays?: number;
    dryRun?: boolean;
    limitPerPrefix?: number;
}
export interface KVCleanupResult {
    success: boolean;
    dryRun: boolean;
    retentionDays: number;
    examined: number;
    toDelete: number;
    deleted: number;
    errors: Array<{
        key: string;
        error: string;
    }>;
    samples: {
        examined: string[];
        toDelete: string[];
        deleted: string[];
    };
    details: Record<string, {
        examined: number;
        toDelete: number;
        deleted: number;
    }>;
}
export declare function cleanupKVCache(env: CloudflareEnvironment, req?: KVCleanupRequest): Promise<KVCleanupResult>;
//# sourceMappingURL=kv-cleanup.d.ts.map