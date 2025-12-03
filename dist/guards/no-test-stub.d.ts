/**
 * Production Guard Stub - No Test Utilities Allowed
 * This file intentionally throws errors when test utilities are imported in production builds
 */
export declare function it(description: string, fn: () => void): void;
export declare function describe(description: string, fn: () => void): void;
export declare function test(description: string, fn: () => void): void;
export declare function expect(actual: any): any;
export declare function beforeEach(fn: () => void): void;
export declare function afterEach(fn: () => void): void;
export declare function beforeAll(fn: () => void): void;
export declare function afterAll(fn: () => void): void;
export declare function jest(): any;
export declare function vitest(): any;
export declare function playwright(): any;
export declare const TestUtils: {};
export declare const MockFactory: {
    create: () => never;
};
export declare const TestDataGenerator: {
    user: () => never;
    market: () => never;
};
export declare const TestHelpers: {
    setupTestEnvironment: () => never;
    cleanupTestEnvironment: () => never;
};
declare const _default: {
    it: typeof it;
    describe: typeof describe;
    test: typeof test;
    expect: typeof expect;
    beforeEach: typeof beforeEach;
    afterEach: typeof afterEach;
    beforeAll: typeof beforeAll;
    afterAll: typeof afterAll;
    jest: typeof jest;
    vitest: typeof vitest;
    playwright: typeof playwright;
    TestUtils: {};
    MockFactory: {
        create: () => never;
    };
    TestDataGenerator: {
        user: () => never;
        market: () => never;
    };
    TestHelpers: {
        setupTestEnvironment: () => never;
        cleanupTestEnvironment: () => never;
    };
};
export default _default;
//# sourceMappingURL=no-test-stub.d.ts.map