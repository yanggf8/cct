/**
 * Shared Sentiment Analysis Utilities
 * Consolidates common functions used across sentiment modules
 */

// Type definitions
interface ParsedSentimentResponse {
  sentiment: string;
  confidence: number;
  price_impact: string;
  reasoning: string;
  time_horizon: string;
  key_factors: string[];
  market_context: string;
}

interface ModelCost {
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  model: string;
}

interface ModelPricing {
  input: number;
  output: number;
}

/**
 * Parse natural language response from AI models (GPT, Llama, etc.)
 * Extracts sentiment, confidence, and reasoning from unstructured text
 */
export function parseNaturalLanguageResponse(content: string): ParsedSentimentResponse {
  const lowerContent = content.toLowerCase();

  // Extract sentiment
  let sentiment = 'neutral';
  if (lowerContent.includes('bullish') || lowerContent.includes('positive') || lowerContent.includes('optimistic')) {
    sentiment = 'bullish';
  } else if (lowerContent.includes('bearish') || lowerContent.includes('negative') || lowerContent.includes('pessimistic')) {
    sentiment = 'bearish';
  }

  // Extract confidence (look for numbers between 0 and 1)
  let confidence = 0.6; // default
  const confidenceMatch = content.match(/confidence\s*level[:\s]*([0-9]*\.?[0-9]+)/i) ||
                          content.match(/confidence[:\s]*([0-9]*\.?[0-9]+)/i);
  if (confidenceMatch) {
    const confValue = parseFloat(confidenceMatch[1]);
    if (confValue <= 1) {
      confidence = confValue;
    } else if (confValue <= 100) {
      confidence = confValue / 100; // Convert percentage
    }
  }

  // Extract price impact
  let price_impact = 'medium';
  if (lowerContent.includes('high impact') || lowerContent.includes('significant')) {
    price_impact = 'high';
  } else if (lowerContent.includes('low impact') || lowerContent.includes('minimal')) {
    price_impact = 'low';
  }

  // Use the content as reasoning
  const reasoning = content.replace(/\n+/g, ' ').substring(0, 200) + '...';

  return {
    sentiment,
    confidence,
    price_impact,
    reasoning,
    time_horizon: 'days',
    key_factors: [],
    market_context: 'Parsed from AI natural language response'
  };
}

/**
 * Structured logger with log levels and request ID support
 */
export class SentimentLogger {
  private requestId: string;

  constructor(requestId: string | null = null) {
    this.requestId = requestId || Math.random().toString(36).substring(7);
  }

  private _log(level: string, message: string, data: any = null): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.requestId}]`;

    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  info(message: string, data?: any): void {
    this._log('INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this._log('WARN', message, data);
  }

  error(message: string, data?: any): void {
    this._log('ERROR', message, data);
  }

  debug(message: string, data?: any): void {
    this._log('DEBUG', message, data);
  }
}

/**
 * Calculate cost estimates for different AI models
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): ModelCost {
  const pricing: Record<string, ModelPricing> = {
    'glm-4.5': {
      input: 0.59 / 1000000,  // $0.59 per M tokens
      output: 2.19 / 1000000  // $2.19 per M tokens
    },
    'gpt-oss-120b': {
      input: 0.75 / 1000000,  // $0.75 per M tokens
      output: 0.75 / 1000000  // Same rate
    },
    'cloudflare-free': {
      input: 0,
      output: 0
    }
  };

  const rates = pricing[model] || pricing['cloudflare-free'];

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_cost: inputTokens * rates.input,
    output_cost: outputTokens * rates.output,
    total_cost: (inputTokens * rates.input) + (outputTokens * rates.output),
    model: model
  };
}

/**
 * Map sentiment strings to trading directions
 */
export function mapSentimentToDirection(sentiment: string): string {
  const mapping: Record<string, string> = {
    'BULLISH': 'UP',
    'BEARISH': 'DOWN',
    'NEUTRAL': 'NEUTRAL',
    'POSITIVE': 'UP',
    'NEGATIVE': 'DOWN'
  };
  return mapping[sentiment?.toUpperCase()] || 'NEUTRAL';
}

/**
 * Check if two sentiment directions agree
 */
export function checkDirectionAgreement(direction1: string, direction2: string): boolean {
  const normalize1 = direction1?.toUpperCase();
  const normalize2 = direction2?.toUpperCase();

  // Direct agreement
  if (normalize1 === normalize2) return true;

  // Cross-format agreement
  if ((normalize1 === 'UP' && normalize2 === 'BULLISH') ||
      (normalize1 === 'DOWN' && normalize2 === 'BEARISH') ||
      (normalize1 === 'NEUTRAL' && (normalize2 === 'FLAT' || normalize2 === 'NEUTRAL'))) {
    return true;
  }

  return false;
}

/**
 * Convert confidence percentage to reliability level
 */
export function confidenceToReliability(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Generate sentiment signal based on confidence and sentiment
 */
export function generateSentimentSignal(
  sentiment: string,
  confidence: number
): {
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: 'strong' | 'moderate' | 'weak';
  confidence: number;
} {
  const direction = mapSentimentToDirection(sentiment);
  const reliability = confidenceToReliability(confidence);

  let signal: 'BUY' | 'SELL' | 'HOLD';
  let strength: 'strong' | 'moderate' | 'weak';

  if (direction === 'UP') {
    signal = confidence >= 0.7 ? 'BUY' : 'HOLD';
  } else if (direction === 'DOWN') {
    signal = confidence >= 0.7 ? 'SELL' : 'HOLD';
  } else {
    signal = 'HOLD';
  }

  if (reliability === 'high') {
    strength = 'strong';
  } else if (reliability === 'medium') {
    strength = 'moderate';
  } else {
    strength = 'weak';
  }

  return {
    signal,
    strength,
    confidence
  };
}

/**
 * Format sentiment data for API response
 */
export function formatSentimentForAPI(
  parsed: ParsedSentimentResponse,
  symbol?: string,
  timestamp?: string
): {
  symbol?: string;
  sentiment: string;
  confidence: number;
  direction: string;
  price_impact: string;
  reasoning: string;
  signal: string;
  strength: string;
  timestamp: string;
} {
  const signal = generateSentimentSignal(parsed.sentiment, parsed.confidence);
  const direction = mapSentimentToDirection(parsed.sentiment);

  return {
    symbol,
    sentiment: parsed.sentiment,
    confidence: parsed.confidence,
    direction,
    price_impact: parsed.price_impact,
    reasoning: parsed.reasoning,
    signal: signal.signal,
    strength: signal.strength,
    timestamp: timestamp || new Date().toISOString()
  };
}

// Export types for external use
export type {
  ParsedSentimentResponse,
  ModelCost,
  ModelPricing
};