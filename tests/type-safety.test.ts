/**
 * Type Safety Tests
 *
 * Tests for the new type definitions and error handling utilities.
 * Validates that the new types work correctly and catch common errors.
 */

import { describe, it, expect } from 'vitest';
import {
  toAppError,
  createValidationError,
  createNetworkError,
  createDatabaseError,
  isValidationError,
  isNetworkError,
  isDatabaseError,
  isAppError
} from '../types/errors.js';

import {
  CloudflareAI,
  isGPTAnalysisResult,
  isDistilBERTAnalysisResult,
  isDualAIAnalysisResult
} from '../types/ai-analysis.js';

import {
  createSuccessResponse,
  createErrorResponse,
  isErrorResponse,
  isSuccessResponse
} from '../types/api.js';

describe('Error Type Safety', () => {
  describe('toAppError', () => {
    it('should convert Error objects to AppError', () => {
      const originalError = new Error('Test error');
      const appError = toAppError(originalError);

      expect(isAppError(appError)).toBe(true);
      expect(appError.name).toBe('Error');
      expect(appError.message).toBe('Test error');
      expect(appError.category).toBeDefined();
      expect(appError.severity).toBeDefined();
      expect(appError.retryable).toBeDefined();
      expect(appError.timestamp).toBeDefined();
    });

    it('should convert string errors to AppError', () => {
      const appError = toAppError('String error');

      expect(isAppError(appError)).toBe(true);
      expect(appError.name).toBe('StringError');
      expect(appError.message).toBe('String error');
      expect(appError.category).toBe('unknown');
    });

    it('should convert timeout errors correctly', () => {
      const timeoutError = new Error('Request timeout');
      const appError = toAppError(timeoutError);

      expect(appError.category).toBe('timeout');
      expect(appError.retryable).toBe(true);
    });

    it('should include context in converted errors', () => {
      const error = new Error('Test error');
      const context = { operation: 'test', key: 'test-key' };
      const appError = toAppError(error, context);

      expect(appError.context).toEqual(context);
    });
  });

  describe('Specific Error Creators', () => {
    it('should create ValidationError with correct properties', () => {
      const error = createValidationError('Invalid input', 'email', 'invalid-email', 'required');

      expect(isValidationError(error)).toBe(true);
      expect(error.category).toBe('validation');
      expect(error.retryable).toBe(false);
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.constraint).toBe('required');
    });

    it('should create NetworkError with correct properties', () => {
      const error = createNetworkError('Connection failed', 'https://api.example.com', 'POST', 500);

      expect(isNetworkError(error)).toBe(true);
      expect(error.category).toBe('network');
      expect(error.retryable).toBe(true);
      expect(error.url).toBe('https://api.example.com');
      expect(error.method).toBe('POST');
      expect(error.statusCode).toBe(500);
    });

    it('should create DatabaseError with correct properties', () => {
      const error = createDatabaseError('KV operation failed', 'get', 'test-key', 'TEST_NAMESPACE');

      expect(isDatabaseError(error)).toBe(true);
      expect(error.category).toBe('database');
      expect(error.retryable).toBe(true);
      expect(error.operation).toBe('get');
      expect(error.key).toBe('test-key');
      expect(error.namespace).toBe('TEST_NAMESPACE');
    });
  });
});

describe('AI Analysis Type Safety', () => {
  describe('Type Guards', () => {
    it('should identify GPT analysis results', () => {
      const gptResult = {
        model: 'gpt' as const,
        sentiment: 'bullish' as const,
        confidence: 0.85,
        reasoning: 'Strong positive indicators',
        keyPoints: ['Good earnings', 'Market trend'],
        riskFactors: ['Competition'],
        opportunities: ['New market'],
        recommendation: 'BUY' as const,
        articlesAnalyzed: 5,
        processingTime: 1500,
        metadata: {
          modelVersion: 'gpt-4',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          processingTimeMs: 1500
        }
      };

      expect(isGPTAnalysisResult(gptResult)).toBe(true);
      expect(isDistilBERTAnalysisResult(gptResult)).toBe(false);
    });

    it('should identify DistilBERT analysis results', () => {
      const distilbertResult = {
        model: 'distilbert' as const,
        sentiment: 'bullish' as const,
        confidence: 0.75,
        scores: {
          positive: 0.75,
          negative: 0.15,
          neutral: 0.10
        },
        articlesAnalyzed: 10,
        averageConfidence: 0.72,
        processingTime: 200,
        metadata: {
          modelVersion: 'distilbert-sst-2',
          processedArticles: 10,
          processingTimeMs: 200
        }
      };

      expect(isDistilBERTAnalysisResult(distilbertResult)).toBe(true);
      expect(isGPTAnalysisResult(distilbertResult)).toBe(false);
    });

    it('should identify dual AI analysis results', () => {
      const dualResult = {
        symbol: 'AAPL',
        timestamp: '2025-01-01T12:00:00Z',
        analysis: {
          gpt: {
            model: 'gpt' as const,
            sentiment: 'bullish' as const,
            confidence: 0.85,
            reasoning: 'Strong fundamentals'
          }
        },
        comparison: {
          status: 'AGREE' as const,
          confidenceGap: 0.1,
          sentimentMatch: true,
          recommendationMatch: true,
          consensusReasoning: 'Both models agree',
          confidence: 0.80
        },
        recommendation: {
          signal: 'BUY' as const,
          confidence: 0.80,
          reasoning: 'Strong buy signal',
          supportingFactors: ['Earnings', 'Market trend'],
          riskFactors: ['Competition'],
          timeHorizon: 'medium_term' as const,
          conviction: 'high' as const
        },
        marketContext: {
          overallSentiment: 'bullish',
          marketTrend: 'bullish' as const,
          volatility: 'medium' as const
        },
        metadata: {
          totalArticles: 5,
          processingTimeMs: 2000,
          apiCalls: 2,
          cacheHits: 1,
          analysisVersion: '1.0'
        }
      };

      expect(isDualAIAnalysisResult(dualResult)).toBe(true);
    });

    it('should reject invalid analysis results', () => {
      const invalidResult = {
        model: 'invalid-model',
        confidence: 'invalid-confidence',
        sentiment: 123
      };

      expect(isGPTAnalysisResult(invalidResult)).toBe(false);
      expect(isDistilBERTAnalysisResult(invalidResult)).toBe(false);
      expect(isDualAIAnalysisResult(invalidResult)).toBe(false);
    });
  });
});

describe('API Response Type Safety', () => {
  describe('Response Creators', () => {
    it('should create success responses', () => {
      const data = { message: 'Success' };
      const response = createSuccessResponse(data, { processingTime: 100 });

      expect(isSuccessResponse(response)).toBe(true);
      expect(isErrorResponse(response)).toBe(false);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.metadata?.processingTime).toBe(100);
      expect(response.timestamp).toBeDefined();
      expect(response.version).toBeDefined();
    });

    it('should create validation error responses', () => {
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input', [
        { field: 'email', message: 'Required', value: null }
      ]);

      expect(isErrorResponse(response)).toBe(true);
      expect(isSuccessResponse(response)).toBe(false);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.message).toBe('Invalid input');
      expect(Array.isArray(response.error.details)).toBe(true);
      expect(response.timestamp).toBeDefined();
    });

    it('should create not found error responses', () => {
      const response = createErrorResponse('NOT_FOUND', 'Resource not found', {
        resource: 'User',
        identifier: '123'
      });

      expect(isErrorResponse(response)).toBe(true);
      expect(response.error.code).toBe('NOT_FOUND');
      expect(response.error.details.resource).toBe('User');
    });

    it('should create rate limit error responses', () => {
      const response = createErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests', {
        limit: 100,
        windowMs: 60000,
        resetTime: Date.now() + 60000,
        retryAfter: 30
      });

      expect(isErrorResponse(response)).toBe(true);
      expect(response.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.error.details.limit).toBe(100);
    });

    it('should create server error responses for unknown errors', () => {
      const response = createErrorResponse('UNKNOWN_ERROR', 'Something went wrong');

      expect(isErrorResponse(response)).toBe(true);
      expect(response.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.error.details?.errorId).toBeDefined();
    });
  });
});

describe('Error Handling Migration', () => {
  it('should handle unknown errors safely', () => {
    // Test with various error types
    const testCases = [
      new Error('Standard error'),
      'String error',
      { custom: 'error object' },
      null,
      undefined,
      123
    ];

    testCases.forEach((error, index) => {
      expect(() => {
        const appError = toAppError(error, { testCase: index });
        expect(isAppError(appError)).toBe(true);
        expect(appError.message).toBeDefined();
        expect(appError.category).toBeDefined();
      }).not.toThrow();
    });
  });

  it('should preserve error context through conversion', () => {
    const originalError = new Error('Test error');
    const context = {
      operation: 'test-operation',
      userId: 'user-123',
      metadata: { key: 'value' }
    };

    const appError = toAppError(originalError, context);

    expect(appError.context).toEqual(context);
    expect(appError.context.operation).toBe('test-operation');
    expect(appError.context.userId).toBe('user-123');
    expect(appError.context.metadata).toEqual({ key: 'value' });
  });

  it('should handle retry logic correctly', () => {
    const retryableErrors = [
      new Error('Request timeout'),
      new Error('Network connection failed'),
      new Error('Connection refused')
    ];

    const nonRetryableErrors = [
      new Error('Validation failed'),
      new Error('Unauthorized access'),
      new Error('Permission denied')
    ];

    retryableErrors.forEach(error => {
      const appError = toAppError(error);
      expect(appError.retryable).toBe(true);
    });

    nonRetryableErrors.forEach(error => {
      const appError = toAppError(error);
      expect(appError.retryable).toBe(false);
    });
  });
});

describe('Type Compatibility', () => {
  it('should maintain backward compatibility', () => {
    // Test that our types work with existing code patterns
    const mockEnv = {
      TRADING_RESULTS: {
        get: async () => 'test-value',
        put: async () => {},
        delete: async () => {},
        list: async () => ({ keys: [] })
      },
      AI: {
        run: async () => ({ response: 'test-response' })
      }
    } as any;

    // Should not throw type errors
    expect(typeof mockEnv.TRADING_RESULTS.get).toBe('function');
    expect(typeof mockEnv.AI.run).toBe('function');
  });

  it('should handle optional properties gracefully', () => {
    const partialError: Partial<ValidationError> = {
      message: 'Test error',
      field: 'test'
    };

    // Should not throw
    expect(partialError.message).toBe('Test error');
    expect(partialError.field).toBe('test');
    expect(partialError.value).toBeUndefined();
  });
});