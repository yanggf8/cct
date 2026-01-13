/**
 * Integration test: Verify SimplifiedEnhancedDAL hot reads stay on DO cache
 * - Uses a mock Durable Object namespace to count get/set calls
 * - Asserts second read hits cache (cached=true) and DO calls are limited
 *
 * Run: node --loader ts-node/register tests/integration/dac/test-do-hot-read.ts
 */

import { SimplifiedEnhancedDAL } from '../../../src/modules/simplified-enhanced-dal.js';

// Mock Durable Object namespace/stub
class MockDOStub {
  private store: Map<string, any>;
  private calls: { get: number; set: number };

  constructor(store: Map<string, any>, calls: { get: number; set: number }) {
    this.store = store;
    this.calls = calls;
  }

  async fetch(_url: string, init?: RequestInit): Promise<Response> {
    const path = new URL(_url).pathname;
    const payload = init?.body ? JSON.parse(init.body as string) : {};

    if (path === '/get') {
      this.calls.get += 1;
      const value = this.store.get(payload.key) ?? null;
      return new Response(JSON.stringify({ value }), { status: 200 });
    }

    if (path === '/set') {
      this.calls.set += 1;
      this.store.set(payload.key, payload.value);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'unknown' }), { status: 400 });
  }
}

class MockDONamespace {
  public calls = { get: 0, set: 0 };
  private store = new Map<string, any>();

  idFromName(_name: string) {
    return {};
  }

  get(_id: any) {
    return new MockDOStub(this.store, this.calls);
  }
}

async function main() {
  const mockNamespace = new MockDONamespace();
  const env: any = {
    FEATURE_FLAG_DO_CACHE: 'true',
    CACHE_DO: mockNamespace
  };

  const dal = new SimplifiedEnhancedDAL(env, { enableCache: true, environment: 'test', defaultTTL: 60 });

  // Write to DO cache
  const writeResult = await dal.write('test_hot_read', { foo: 'bar' }, { expirationTtl: 60 });
  if (!writeResult.success) {
    throw new Error(`Write failed: ${writeResult.error}`);
  }

  // First read (should hit DO)
  const first = await dal.read<{ foo: string }>('test_hot_read');
  if (!first.success || !first.cached || first.data?.foo !== 'bar') {
    throw new Error(`First read failed or not cached: ${JSON.stringify(first)}`);
  }

  // Second read (should still be cached)
  const second = await dal.read<{ foo: string }>('test_hot_read');
  if (!second.success || !second.cached || second.data?.foo !== 'bar') {
    throw new Error(`Second read failed or not cached: ${JSON.stringify(second)}`);
  }

  // Validate DO call counts: 1 set, 2 gets
  if (mockNamespace.calls.set !== 1 || mockNamespace.calls.get !== 2) {
    throw new Error(`Unexpected DO call counts: ${JSON.stringify(mockNamespace.calls)}`);
  }

  console.log('✅ DO hot read test passed');
}

main().catch((err) => {
  console.error('❌ DO hot read test failed', err);
  process.exit(1);
});
