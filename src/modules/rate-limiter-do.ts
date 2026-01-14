/**
 * Durable Object Rate Limiter
 * Provides distributed rate limiting with sliding window algorithm
 * Single source of truth across all isolates
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiterDO {
  private state: DurableObjectState;
  private limits: Map<string, RateLimitEntry> = new Map();
  private initialized = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    const stored = await this.state.storage.get<Map<string, RateLimitEntry>>('limits');
    if (stored) this.limits = stored;
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    await this.state.storage.put('limits', this.limits);
  }

  async fetch(request: Request): Promise<Response> {
    await this.init();
    const url = new URL(request.url);
    const action = url.pathname.slice(1);

    if (request.method === 'POST' && action === 'check') {
      const { identifier, maxRequests, windowMs } = await request.json() as {
        identifier: string;
        maxRequests: number;
        windowMs: number;
      };

      const now = Date.now();
      const entry = this.limits.get(identifier) || { timestamps: [] };
      
      // Sliding window: remove expired
      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
      
      const allowed = entry.timestamps.length < maxRequests;
      if (allowed) {
        entry.timestamps.push(now);
        this.limits.set(identifier, entry);
        await this.persist();
      }

      const remaining = Math.max(0, maxRequests - entry.timestamps.length);
      const retryAfter = allowed ? undefined : Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);

      return Response.json({ allowed, remaining, retryAfter });
    }

    if (request.method === 'POST' && action === 'reset') {
      const { identifier } = await request.json() as { identifier: string };
      this.limits.delete(identifier);
      await this.persist();
      return Response.json({ success: true });
    }

    if (request.method === 'GET' && action === 'stats') {
      return Response.json({ 
        entries: this.limits.size,
        keys: Array.from(this.limits.keys()).slice(0, 100)
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  }
}
