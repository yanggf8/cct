/**
 * Backtesting Test Data Fixtures
 * Mock data for testing back endpoints that expect existing backtest data
 */
export declare const BACKTEST_FIXTURES: {
    test_12345: {
        id: string;
        status: string;
        progress: number;
        currentStep: string;
        createdAt: string;
        estimatedCompletion: string;
        resultId: string;
        config: {
            id: string;
            name: string;
            strategy: {
                type: string;
                parameters: {};
            };
            data: {
                symbols: string[];
                startDate: string;
                endDate: string;
            };
            execution: {
                initialCapital: number;
            };
        };
    };
    result_test_12345: {
        id: string;
        backtestId: string;
        performanceMetrics: {
            totalReturn: number;
            annualizedReturn: number;
            sharpeRatio: number;
            sortinoRatio: number;
            maxDrawdown: number;
            calmarRatio: number;
            winRate: number;
            profitFactor: number;
            totalTrades: number;
            winningTrades: number;
            losingTrades: number;
        };
        riskMetrics: {
            var95: number;
            cvar95: number;
            beta: number;
            volatility: number;
            informationRatio: number;
        };
        equityCurve: {
            date: string;
            value: number;
            return: number;
        }[];
        trades: {
            symbol: string;
            direction: string;
            entryDate: string;
            exitDate: string;
            entryPrice: number;
            exitPrice: number;
            quantity: number;
            pnl: number;
            return: number;
        }[];
        positions: {
            symbol: string;
            quantity: number;
            avgPrice: number;
            currentValue: number;
            weight: number;
            unrealizedPnl: number;
        }[];
        attributionAnalysis: {
            allocationEffect: number;
            selectionEffect: number;
            interactionEffect: number;
            totalActiveReturn: number;
        };
        sectorAnalysis: {
            Technology: {
                weight: number;
                return: number;
                contribution: number;
            };
            Healthcare: {
                weight: number;
                return: number;
                contribution: number;
            };
            Finance: {
                weight: number;
                return: number;
                contribution: number;
            };
            Consumer: {
                weight: number;
                return: number;
                contribution: number;
            };
            Industrial: {
                weight: number;
                return: number;
                contribution: number;
            };
        };
        regimeAnalysis: {
            'Bull Market': {
                periods: number;
                return: number;
                duration: number;
            };
            'Bear Market': {
                periods: number;
                return: number;
                duration: number;
            };
            Transitional: {
                periods: number;
                return: number;
                duration: number;
            };
        };
        correlationAnalysis: {
            averageCorrelation: number;
            maxCorrelation: number;
            minCorrelation: number;
            correlationMatrix: number[][];
        };
        metadata: {
            runTime: number;
            dataPoints: number;
            startDate: string;
            endDate: string;
            generatedAt: string;
        };
    };
    test_1: {
        id: string;
        status: string;
        progress: number;
        currentStep: string;
        createdAt: string;
        resultId: string;
    };
    test_2: {
        id: string;
        status: string;
        progress: number;
        currentStep: string;
        createdAt: string;
        resultId: string;
    };
};
/**
 * Get mock backtest data for testing
 */
export declare function getBacktestFixture(backtestId: string): any;
/**
 * Check if backtest exists in fixtures
 */
export declare function hasBacktestFixture(backtestId: string): boolean;
/**
 * Get all available backtest fixture IDs
 */
export declare function getBacktestFixtureIds(): string[];
//# sourceMappingURL=backtesting-test-fixtures.d.ts.map