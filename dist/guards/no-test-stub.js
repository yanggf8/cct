/**
 * Production Guard Stub - No Test Utilities Allowed
 * This file intentionally throws errors when test utilities are imported in production builds
 */
export function it(description, fn) {
    throw new Error('🚫 PRODUCTION GUARD: it() test function is not allowed in production builds.');
}
export function describe(description, fn) {
    throw new Error('🚫 PRODUCTION GUARD: describe() test function is not allowed in production builds.');
}
export function test(description, fn) {
    throw new Error('🚫 PRODUCTION GUARD: test() function is not allowed in production builds.');
}
export function expect(actual) {
    throw new Error('🚫 PRODUCTION GUARD: expect() assertion is not allowed in production builds.');
}
export function beforeEach(fn) {
    throw new Error('🚫 PRODUCTION GUARD: beforeEach() hook is not allowed in production builds.');
}
export function afterEach(fn) {
    throw new Error('🚫 PRODUCTION GUARD: afterEach() hook is not allowed in production builds.');
}
export function beforeAll(fn) {
    throw new Error('🚫 PRODUCTION GUARD: beforeAll() hook is not allowed in production builds.');
}
export function afterAll(fn) {
    throw new Error('🚫 PRODUCTION GUARD: afterAll() hook is not allowed in production builds.');
}
export function jest() {
    throw new Error('🚫 PRODUCTION GUARD: Jest testing framework is not allowed in production builds.');
}
export function vitest() {
    throw new Error('🚫 PRODUCTION GUARD: Vitest testing framework is not allowed in production builds.');
}
export function playwright() {
    throw new Error('🚫 PRODUCTION GUARD: Playwright testing framework is not allowed in production builds.');
}
// Block common test utilities
export const TestUtils = new Proxy({}, {
    get() {
        throw new Error('🚫 PRODUCTION GUARD: TestUtils are not allowed in production builds.');
    }
});
export const MockFactory = {
    create: () => {
        throw new Error('🚫 PRODUCTION GUARD: MockFactory.create() is not allowed in production builds.');
    }
};
export const TestDataGenerator = {
    user: () => {
        throw new Error('🚫 PRODUCTION GUARD: TestDataGenerator.user() is not allowed in production builds.');
    },
    market: () => {
        throw new Error('🚫 PRODUCTION GUARD: TestDataGenerator.market() is not allowed in production builds.');
    }
};
export const TestHelpers = {
    setupTestEnvironment: () => {
        throw new Error('🚫 PRODUCTION GUARD: TestHelpers.setupTestEnvironment() is not allowed in production builds.');
    },
    cleanupTestEnvironment: () => {
        throw new Error('🚫 PRODUCTION GUARD: TestHelpers.cleanupTestEnvironment() is not allowed in production builds.');
    }
};
export default {
    it,
    describe,
    test,
    expect,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
    jest,
    vitest,
    playwright,
    TestUtils,
    MockFactory,
    TestDataGenerator,
    TestHelpers
};
//# sourceMappingURL=no-test-stub.js.map