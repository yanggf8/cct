export interface SimpleCacheOptions {
    ttl?: number;
    namespace?: string;
}
export declare class SimpleCacheDO {
    private state;
    constructor(state: DurableObjectState);
    private buildStorageKey;
    private buildNamespacePrefix;
    private safeJson;
    fetch(request: Request): Promise<Response>;
}
export declare class SimpleCache {
    private doNamespace;
    constructor(doNamespace: DurableObjectNamespace);
    private getStub;
    private buildUrl;
    get(key: string, options?: SimpleCacheOptions): Promise<any>;
    set(key: string, value: any, options?: SimpleCacheOptions): Promise<void>;
    clear(options?: SimpleCacheOptions): Promise<void>;
    getMetadata(options?: SimpleCacheOptions): Promise<Record<string, true>>;
}
//# sourceMappingURL=simple-cache-do.d.ts.map