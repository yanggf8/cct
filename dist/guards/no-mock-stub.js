/**
 * Production Guard Stub - No Mock Data Allowed
 * This file intentionally throws errors when mock imports are attempted in production builds
 */
export function createMockData(data) {
    throw new Error('🚫 PRODUCTION GUARD: createMockData() is not allowed in production builds. Remove mock data before deployment.');
}
export function mockApiResponse(response) {
    throw new Error('🚫 PRODUCTION GUARD: mockApiResponse() is not allowed in production builds. Use real API endpoints instead.');
}
export function generateFakeTimestamp() {
    throw new Error('🚫 PRODUCTION GUARD: generateFakeTimestamp() is not allowed in production builds. Use real timestamps instead.');
}
export function createPlaceholderContent(content) {
    throw new Error('🚫 PRODUCTION GUARD: createPlaceholderContent() is not allowed in production builds. Provide real content instead.');
}
export function mockMarketData(data) {
    throw new Error('🚫 PRODUCTION GUARD: mockMarketData() is not allowed in production builds. Use real market data sources instead.');
}
export function debugLog(...args) {
    throw new Error('🚫 PRODUCTION GUARD: debugLog() is not allowed in production builds. Use proper logging instead.');
}
export function testOnlyFeature(...args) {
    throw new Error('🚫 PRODUCTION GUARD: testOnlyFeature() is not allowed in production builds. Remove test-only code before deployment.');
}
// Block common test utilities that shouldn't be in production
export const MockDatabase = new Proxy({}, {
    get() {
        throw new Error('🚫 PRODUCTION GUARD: MockDatabase is not allowed in production builds.');
    }
});
export const MockCache = new Proxy({}, {
    get() {
        throw new Error('🚫 PRODUCTION GUARD: MockCache is not allowed in production builds.');
    }
});
export const TestEnvironment = {
    setup: () => {
        throw new Error('🚫 PRODUCTION GUARD: TestEnvironment.setup() is not allowed in production builds.');
    },
    teardown: () => {
        throw new Error('🚫 PRODUCTION GUARD: TestEnvironment.teardown() is not allowed in production builds.');
    }
};
// Block development-only configurations
export const DevelopmentConfig = {
    enableDebugMode: false,
    mockData: false,
    skipAuth: false
};
export default {
    createMockData,
    mockApiResponse,
    generateFakeTimestamp,
    createPlaceholderContent,
    mockMarketData,
    debugLog,
    testOnlyFeature,
    MockDatabase,
    MockCache,
    TestEnvironment,
    DevelopmentConfig
};
//# sourceMappingURL=no-mock-stub.js.map