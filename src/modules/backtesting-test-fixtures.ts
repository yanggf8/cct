/**
 * Backtesting Test Data Fixtures
 * Mock data for testing back endpoints that expect existing backtest data
 */

export const BACKTEST_FIXTURES = {
  // Mock backtest status for test_12345
  'test_12345': {
    id: 'test_12345',
    status: 'completed',
    progress: 100,
    currentStep: 'Completed',
    createdAt: '2025-01-15T10:00:00Z',
    estimatedCompletion: '2025-01-15T10:05:00Z',
    resultId: 'result_test_12345',
    config: {
      id: 'test_12345',
      name: 'Test Backtest Strategy',
      strategy: { type: 'momentum', parameters: {} },
      data: { symbols: ['AAPL', 'MSFT', 'GOOGL'], startDate: '2024-01-01', endDate: '2024-12-31' },
      execution: { initialCapital: 100000 }
    }
  },

  // Mock backtest results for test_12345
  'result_test_12345': {
    id: 'result_test_12345',
    backtestId: 'test_12345',
    performanceMetrics: {
      totalReturn: 0.156,
      annualizedReturn: 0.145,
      sharpeRatio: 1.23,
      sortinoRatio: 1.67,
      maxDrawdown: 0.089,
      calmarRatio: 1.63,
      winRate: 0.624,
      profitFactor: 1.89,
      totalTrades: 156,
      winningTrades: 97,
      losingTrades: 59
    },
    riskMetrics: {
      var95: 0.0234,
      cvar95: 0.0312,
      beta: 0.95,
      volatility: 0.142,
      informationRatio: 0.78
    },
    equityCurve: [
      { date: '2024-01-01', value: 100000, return: 0 },
      { date: '2024-12-31', value: 115600, return: 0.156 }
    ],
    trades: [
      {
        symbol: 'AAPL',
        direction: 'long',
        entryDate: '2024-01-15',
        exitDate: '2024-03-20',
        entryPrice: 185.32,
        exitPrice: 178.45,
        quantity: 100,
        pnl: -687.00,
        return: -0.0371
      }
    ],
    positions: [
      {
        symbol: 'AAPL',
        quantity: 100,
        avgPrice: 185.32,
        currentValue: 17845.00,
        weight: 0.154,
        unrealizedPnl: -687.00
      }
    ],
    attributionAnalysis: {
      allocationEffect: 0.0234,
      selectionEffect: -0.0123,
      interactionEffect: 0.0045,
      totalActiveReturn: 0.0156
    },
    sectorAnalysis: {
      'Technology': { weight: 0.45, return: 0.167, contribution: 0.0752 },
      'Healthcare': { weight: 0.20, return: 0.123, contribution: 0.0246 },
      'Finance': { weight: 0.15, return: 0.189, contribution: 0.0284 },
      'Consumer': { weight: 0.12, return: 0.145, contribution: 0.0174 },
      'Industrial': { weight: 0.08, return: 0.078, contribution: 0.0062 }
    },
    regimeAnalysis: {
      'Bull Market': { periods: 3, return: 0.089, duration: 145 },
      'Bear Market': { periods: 1, return: -0.034, duration: 62 },
      'Transitional': { periods: 2, return: 0.012, duration: 158 }
    },
    correlationAnalysis: {
      averageCorrelation: 0.34,
      maxCorrelation: 0.67,
      minCorrelation: 0.12,
      correlationMatrix: [
        [1.0, 0.45, 0.32, 0.28, 0.19],
        [0.45, 1.0, 0.38, 0.34, 0.22],
        [0.32, 0.38, 1.0, 0.41, 0.29],
        [0.28, 0.34, 0.41, 1.0, 0.26],
        [0.19, 0.22, 0.29, 0.26, 1.0]
      ]
    },
    metadata: {
      runTime: 4.2,
      dataPoints: 252,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      generatedAt: '2025-01-15T10:05:00Z'
    }
  },

  // Additional mock backtests for testing
  'test_1': {
    id: 'test_1',
    status: 'completed',
    progress: 100,
    currentStep: 'Completed',
    createdAt: '2025-01-14T09:00:00Z',
    resultId: 'result_test_1'
  },

  'test_2': {
    id: 'test_2',
    status: 'completed',
    progress: 100,
    currentStep: 'Completed',
    createdAt: '2025-01-13T14:30:00Z',
    resultId: 'result_test_2'
  }
};

/**
 * Get mock backtest data for testing
 */
export function getBacktestFixture(backtestId: string): any {
  return (BACKTEST_FIXTURES as any)[backtestId] || null;
}

/**
 * Check if backtest exists in fixtures
 */
export function hasBacktestFixture(backtestId: string): boolean {
  return backtestId in BACKTEST_FIXTURES;
}

/**
 * Get all available backtest fixture IDs
 */
export function getBacktestFixtureIds(): string[] {
  return Object.keys(BACKTEST_FIXTURES);
}