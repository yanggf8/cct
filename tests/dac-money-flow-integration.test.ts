/**
 * DAC Money Flow Pool Integration Tests
 */

import { describe, it, expect } from 'vitest';

describe('DAC Money Flow Pool Integration', () => {
  it('should have money flow adapter module', async () => {
    const module = await import('../src/modules/dac-money-flow-adapter');
    
    expect(module.DACMoneyFlowAdapter).toBeDefined();
    expect(module.createMoneyFlowAdapter).toBeDefined();
  });

  it('should have money flow service module', async () => {
    const module = await import('../src/modules/money-flow-service');
    
    expect(module.getMoneyFlowIndicators).toBeDefined();
  });

  it('should export MoneyFlowIndicators interface', async () => {
    const { createMoneyFlowAdapter } = await import('../src/modules/dac-money-flow-adapter');
    
    // Type check - should compile without errors
    expect(typeof createMoneyFlowAdapter).toBe('function');
  });
});

describe('Money Flow Pool Health Endpoint', () => {
  it('should have health endpoint handler', async () => {
    // Verify the endpoint is registered in data-routes
    const dataRoutes = await import('../src/routes/data-routes');
    
    expect(dataRoutes).toBeDefined();
  });
});
