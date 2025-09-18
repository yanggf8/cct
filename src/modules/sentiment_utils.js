/**
 * Shared Sentiment Analysis Utilities
 * Consolidates common functions used across sentiment modules
 */

/**
 * Parse natural language response from AI models (GPT, Llama, etc.)
 * Extracts sentiment, confidence, and reasoning from unstructured text
 */
export function parseNaturalLanguageResponse(content) {
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
  constructor(requestId = null) {
    this.requestId = requestId || Math.random().toString(36).substring(7);
  }

  _log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.requestId}]`;

    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  info(message, data) {
    this._log('INFO', message, data);
  }

  warn(message, data) {
    this._log('WARN', message, data);
  }

  error(message, data) {
    this._log('ERROR', message, data);
  }

  debug(message, data) {
    this._log('DEBUG', message, data);
  }
}

/**
 * Calculate cost estimates for different AI models
 */
export function calculateModelCost(model, inputTokens, outputTokens) {
  const pricing = {
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
export function mapSentimentToDirection(sentiment) {
  const mapping = {
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
export function checkDirectionAgreement(direction1, direction2) {
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