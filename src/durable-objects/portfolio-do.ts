/**
 * Portfolio Durable Object
 * Manages trading portfolio symbols with persistent storage
 * Allows runtime updates via API without redeployment
 */

import { DurableObject } from 'cloudflare:workers';

interface PortfolioState {
  symbols: string[];
  lastUpdated: string;
  updatedBy?: string;
}

export class PortfolioDO extends DurableObject {
  private symbols: string[] = [];
  private lastUpdated: string = new Date().toISOString();

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
  }

  /**
   * Initialize portfolio from storage on first access
   */
  async initialize(): Promise<void> {
    const stored = await this.ctx.storage.get<PortfolioState>('portfolio');
    if (stored) {
      this.symbols = stored.symbols || [];
      this.lastUpdated = stored.lastUpdated || new Date().toISOString();
    } else {
      // Default portfolio
      this.symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
      this.lastUpdated = new Date().toISOString();
      await this.save();
    }
  }

  /**
   * Save current state to storage
   */
  private async save(): Promise<void> {
    const state: PortfolioState = {
      symbols: this.symbols,
      lastUpdated: this.lastUpdated
    };
    await this.ctx.storage.put('portfolio', state);
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Initialize on first request
      if (this.symbols.length === 0) {
        await this.initialize();
      }

      // GET /symbols - Get current portfolio
      if (request.method === 'GET' && path === '/symbols') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            symbols: this.symbols,
            lastUpdated: this.lastUpdated,
            count: this.symbols.length
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /symbols - Update portfolio
      if (request.method === 'POST' && path === '/symbols') {
        const body = await request.json() as { symbols: string[]; updatedBy?: string };

        if (!body.symbols || !Array.isArray(body.symbols)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid request: symbols array required'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Validate symbols (basic format check)
        const validSymbols = body.symbols
          .map(s => s.trim().toUpperCase())
          .filter(s => /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(s));

        if (validSymbols.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No valid symbols provided'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const oldSymbols = [...this.symbols];
        this.symbols = validSymbols;
        this.lastUpdated = new Date().toISOString();
        await this.save();

        return new Response(JSON.stringify({
          success: true,
          data: {
            symbols: this.symbols,
            lastUpdated: this.lastUpdated,
            count: this.symbols.length,
            previous: oldSymbols
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /add - Add symbol(s) to portfolio
      if (request.method === 'POST' && path === '/add') {
        const body = await request.json() as { symbols: string | string[] };
        const symbolsToAdd = Array.isArray(body.symbols) ? body.symbols : [body.symbols];

        const validSymbols = symbolsToAdd
          .map(s => s.trim().toUpperCase())
          .filter(s => /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(s) && !this.symbols.includes(s));

        if (validSymbols.length > 0) {
          this.symbols.push(...validSymbols);
          this.lastUpdated = new Date().toISOString();
          await this.save();
        }

        return new Response(JSON.stringify({
          success: true,
          data: {
            symbols: this.symbols,
            added: validSymbols,
            count: this.symbols.length
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /remove - Remove symbol(s) from portfolio
      if (request.method === 'POST' && path === '/remove') {
        const body = await request.json() as { symbols: string | string[] };
        const symbolsToRemove = Array.isArray(body.symbols) ? body.symbols : [body.symbols];

        const removed: string[] = [];
        symbolsToRemove.forEach(s => {
          const symbol = s.trim().toUpperCase();
          const index = this.symbols.indexOf(symbol);
          if (index !== -1) {
            this.symbols.splice(index, 1);
            removed.push(symbol);
          }
        });

        if (removed.length > 0) {
          this.lastUpdated = new Date().toISOString();
          await this.save();
        }

        return new Response(JSON.stringify({
          success: true,
          data: {
            symbols: this.symbols,
            removed,
            count: this.symbols.length
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /reset - Reset to default portfolio
      if (request.method === 'POST' && path === '/reset') {
        const oldSymbols = [...this.symbols];
        this.symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
        this.lastUpdated = new Date().toISOString();
        await this.save();

        return new Response(JSON.stringify({
          success: true,
          data: {
            symbols: this.symbols,
            previous: oldSymbols,
            count: this.symbols.length
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
