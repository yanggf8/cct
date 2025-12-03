/**
 * Production Guard Stub - No Mock Data Allowed
 * This file intentionally throws errors when mock imports are attempted in production builds
 */
export declare function createMockData<T>(data: T): T;
export declare function mockApiResponse<T>(response: T): T;
export declare function generateFakeTimestamp(): Date;
export declare function createPlaceholderContent(content: string): string;
export declare function mockMarketData(data: any): any;
export declare function debugLog(...args: any[]): void;
export declare function testOnlyFeature(...args: any[]): any;
export declare const MockDatabase: {};
export declare const MockCache: {};
export declare const TestEnvironment: {
    setup: () => never;
    teardown: () => never;
};
export declare const DevelopmentConfig: {
    enableDebugMode: boolean;
    mockData: boolean;
    skipAuth: boolean;
};
declare const _default: {
    createMockData: typeof createMockData;
    mockApiResponse: typeof mockApiResponse;
    generateFakeTimestamp: typeof generateFakeTimestamp;
    createPlaceholderContent: typeof createPlaceholderContent;
    mockMarketData: typeof mockMarketData;
    debugLog: typeof debugLog;
    testOnlyFeature: typeof testOnlyFeature;
    MockDatabase: {};
    MockCache: {};
    TestEnvironment: {
        setup: () => never;
        teardown: () => never;
    };
    DevelopmentConfig: {
        enableDebugMode: boolean;
        mockData: boolean;
        skipAuth: boolean;
    };
};
export default _default;
//# sourceMappingURL=no-mock-stub.d.ts.map