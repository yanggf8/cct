/**
 * CCT API v1 Type Definitions
 * TypeScript-style type definitions for all API v1 responses
 * Provides comprehensive type safety for frontend API interactions
 * Phase 3: Frontend API Client - Data Access Improvement Plan
 */

/**
 * Base API Response Structure
 */
export const BaseApiResponse = {
  success: 'boolean',
  timestamp: 'string',
  metadata: {
    version: 'string',
    requestId: 'string?',
    processingTime: 'number?',
    cacheStatus: 'string?'
  }
};

/**
 * Error Response Structure
 */
export const ErrorResponse = {
  ...BaseApiResponse,
  success: false,
  error: 'string',
  error_code: 'string',
  error_details: 'object?'
};

/**
 * Success Response Structure
 */
export const SuccessResponse = {
  ...BaseApiResponse,
  success: true,
  data: 'any',
  cached: 'boolean?'
};

/**
 * Sentiment Analysis Types
 */
export const SentimentAnalysisResponse = {
  ...SuccessResponse,
  data: {
    analysis_date: 'string',
    symbols_analyzed: [
      {
        symbol: 'string',
        sentiment_score: 'number',
        confidence: 'number',
        sentiment_label: 'string', // 'positive', 'negative', 'neutral'
        articles_analyzed: 'number',
        key_insights: 'string[]',
        price_impact: 'number?',
        volume_anomaly: 'boolean?'
      }
    ],
    market_sentiment: {
      overall_score: 'number',
      overall_label: 'string',
      positive_count: 'number',
      negative_count: 'number',
      neutral_count: 'number'
    },
    performance_metrics: {
      analysis_time_ms: 'number',
      articles_processed: 'number',
      ai_models_used: 'string[]'
    }
  }
};

export const SymbolSentimentResponse = {
  ...SuccessResponse,
  data: {
    symbol: 'string',
    sentiment_analysis: {
      current_sentiment: {
        score: 'number',
        label: 'string',
        confidence: 'number'
      },
      sentiment_trend: 'string', // 'improving', 'declining', 'stable'
      price_correlation: 'number',
      volume_sentiment: 'number'
    },
    article_analysis: [
      {
        title: 'string',
        url: 'string',
        sentiment_score: 'number',
        confidence: 'number',
        published_date: 'string',
        summary: 'string'
      }
    ],
    technical_indicators: {
      rsi: 'number?',
      macd_signal: 'string?',
      moving_avg_50: 'number?',
      moving_avg_200: 'number?'
    }
  }
};

export const MarketSentimentResponse = {
  ...SuccessResponse,
  data: {
    market_overview: {
      sentiment_index: 'number',
      sentiment_label: 'string',
      market_bias: 'string', // 'bullish', 'bearish', 'neutral'
      confidence_level: 'number'
    },
    sector_sentiment: [
      {
        sector: 'string',
        etf_symbol: 'string',
        sentiment_score: 'number',
        sentiment_label: 'string',
        relative_strength: 'number'
      }
    ],
    market_indicators: {
      vix_level: 'number?',
      sp500_change: 'number?',
      volume_profile: 'string?',
      market_regime: 'string?'
    },
    sentiment_distribution: {
      positive_percentage: 'number',
      negative_percentage: 'number',
      neutral_percentage: 'number'
    }
  }
};

export const SectorSentimentResponse = {
  ...SuccessResponse,
  data: {
    sectors: [
      {
        name: 'string',
        symbol: 'string',
        sentiment: {
          score: 'number',
          label: 'string',
          confidence: 'number',
          trend: 'string'
        },
        performance: {
          daily_change: 'number',
          weekly_change: 'number',
          monthly_change: 'number',
          relative_to_sp500: 'number'
        },
        key_stocks: [
          {
            symbol: 'string',
            sentiment_score: 'number',
            weight: 'number'
          }
        ]
      }
    ],
    market_breadth: {
      advancing_sectors: 'number',
      declining_sectors: 'number',
      neutral_sectors: 'number'
    },
    rotation_signals: [
      {
        from_sector: 'string',
        to_sector: 'string',
        strength: 'number',
        confidence: 'number'
      }
    ]
  }
};

/**
 * Report Types
 */
export const DailyReportResponse = {
  ...SuccessResponse,
  data: {
    report_date: 'string',
    market_summary: {
      market_status: 'string',
      sp500_level: 'number',
      sp500_change: 'number',
      market_sentiment: 'string',
      trading_volume: 'string'
    },
    sentiment_analysis: {
      overall_sentiment: 'string',
      confidence_score: 'number',
      key_signals: 'string[]',
      sentiment_drivers: 'string[]'
    },
    symbol_insights: [
      {
        symbol: 'string',
        sentiment: 'string',
        confidence: 'number',
        price_action: 'string',
        recommendation: 'string?'
      }
    ],
    top_movers: {
      gainers: [
        {
          symbol: 'string',
          change_percent: 'number',
          sentiment: 'string'
        }
      ],
      losers: [
        {
          symbol: 'string',
          change_percent: 'number',
          sentiment: 'string'
        }
      ]
    },
    market_outlook: {
      tomorrow_bias: 'string',
      confidence_level: 'number',
      key_factors: 'string[]',
      risk_factors: 'string[]'
    }
  }
};

export const WeeklyReportResponse = {
  ...SuccessResponse,
  data: {
    week_ending: 'string',
    weekly_summary: {
      market_performance: 'string',
      sentiment_trend: 'string',
      volatility_level: 'string',
      key_events: 'string[]'
    },
    sentiment_patterns: {
      weekly_average: 'number',
      sentiment_volatility: 'number',
      accuracy_rate: 'number',
      pattern_changes: 'string[]'
    },
    sector_analysis: [
      {
        sector: 'string',
        weekly_performance: 'number',
        sentiment_score: 'number',
        leadership_status: 'string'
      }
    ],
    model_performance: {
      prediction_accuracy: 'number',
      confidence_trends: 'number[]',
      improvement_areas: 'string[]',
      optimization_suggestions: 'string[]'
    },
    forward_outlook: {
      next_week_expectation: 'string',
      confidence_level: 'number',
      key_watch_items: 'string[]'
    }
  }
};

export const PreMarketReportResponse = {
  ...SuccessResponse,
  data: {
    report_date: 'string',
    pre_market_status: {
      futures_status: 'string',
      futures_change: 'number',
      market_sentiment: 'string',
      key_pre_market_moves: 'string[]'
    },
    high_confidence_signals: [
      {
        symbol: 'string',
        signal_type: 'string', // 'bullish', 'bearish', 'neutral'
        confidence: 'number',
        reasoning: 'string',
        price_target: 'number?'
      }
    ],
    market_preparation: {
      key_levels: 'object',
      economic_events: 'string[]',
      earnings_watch: 'string[]'
    },
    sentiment_briefing: {
      overall_bias: 'string',
      conviction_level: 'number',
      supporting_factors: 'string[]',
      risk_factors: 'string[]'
    }
  }
};

export const IntradayReportResponse = {
  ...SuccessResponse,
  data: {
    check_time: 'string',
    market_status: {
      current_level: 'number',
      intraday_change: 'number',
      volume_status: 'string',
      market_sentiment: 'string'
    },
    morning_predictions: {
      accuracy_status: 'string',
      correct_predictions: 'number',
      incorrect_predictions: 'number',
      confidence_alignment: 'string'
    },
    real_time_sentiment: {
      current_score: 'number',
      sentiment_drift: 'number',
      momentum_indicators: 'object'
    },
    alert_status: {
      active_alerts: 'string[]',
      model_health: 'string',
      recalibration_needed: 'boolean'
    }
  }
};

export const EndOfDayReportResponse = {
  ...SuccessResponse,
  data: {
    report_date: 'string',
    closing_summary: {
      final_level: 'number',
      daily_change: 'number',
      daily_range: 'string',
      closing_sentiment: 'string'
    },
    sentiment_performance: {
      morning_accuracy: 'number',
      intray_tracking: 'string',
      sentiment_efficiency: 'number',
      prediction_quality: 'string'
    },
    performance_rankings: {
      top_performers: [
        {
          symbol: 'string',
          performance: 'number',
          sentiment_alignment: 'string'
        }
      ],
      underperformers: [
        {
          symbol: 'string',
          performance: 'number',
          sentiment_alignment: 'string'
        }
      ]
    },
    tomorrow_outlook: {
      sentiment_bias: 'string',
      confidence_level: 'number',
      key_factors: 'string[]',
      trading_strategy: 'string'
    }
  }
};

/**
 * Data Types
 */
export const SymbolsResponse = {
  ...SuccessResponse,
  data: {
    available_symbols: [
      {
        symbol: 'string',
        name: 'string',
        sector: 'string',
        market_cap: 'string?',
        exchange: 'string'
      }
    ],
    total_count: 'number',
    last_updated: 'string'
  }
};

export const HistoricalDataResponse = {
  ...SuccessResponse,
  data: {
    symbol: 'string',
    period: 'string',
    data_points: [
      {
        date: 'string',
        open: 'number',
        high: 'number',
        low: 'number',
        close: 'number',
        volume: 'number',
        adjusted_close: 'number?'
      }
    ],
    metadata: {
      start_date: 'string',
      end_date: 'string',
      total_points: 'number',
      data_quality: 'string'
    }
  }
};

export const SystemHealthResponse = {
  ...SuccessResponse,
  data: {
    system_status: 'string',
    uptime: 'number',
    version: 'string',
    components: [
      {
        name: 'string',
        status: 'string',
        last_check: 'string',
        response_time_ms: 'number?',
        error_rate: 'number?'
      }
    ],
    performance_metrics: {
      avg_response_time: 'number',
      requests_per_minute: 'number',
      success_rate: 'number',
      cache_hit_rate: 'number?'
    },
    ai_models: [
      {
        name: 'string',
        status: 'string',
        last_used: 'string',
        avg_response_time: 'number',
        accuracy: 'number?'
      }
    ]
  }
};

/**
 * Sector Types
 */
export const SectorSnapshotResponse = {
  ...SuccessResponse,
  data: {
    snapshot_time: 'string',
    market_overview: {
      sp500_level: 'number',
      market_change: 'number',
      market_bias: 'string',
      sector_count: 'number'
    },
    sector_performance: [
      {
        sector: 'string',
        etf_symbol: 'string',
        price: 'number',
        change: 'number',
        change_percent: 'number',
        volume: 'number',
        relative_strength: 'number',
        momentum: 'string'
      }
    ],
    rotation_analysis: {
      leading_sectors: 'string[]',
      lagging_sectors: 'string[]',
      rotation_strength: 'number',
      capital_flow_direction: 'string'
    },
    technical_signals: [
      {
        sector: 'string',
        signal: 'string',
        strength: 'number',
        confidence: 'number'
      }
    ]
  }
};

export const SectorHealthResponse = {
  ...SuccessResponse,
  data: {
    health_status: 'string',
    last_update: 'string',
    data_quality: {
      completeness_score: 'number',
      timeliness_score: 'number',
      accuracy_score: 'number'
    },
    sector_coverage: {
      total_sectors: 'number',
      active_sectors: 'number',
      data_freshness: 'string'
    },
    performance_metrics: {
      avg_update_time: 'number',
      cache_hit_rate: 'number',
      error_rate: 'number'
    }
  }
};

export const SectorSymbolsResponse = {
  ...SuccessResponse,
  data: {
    sector_etfs: [
      {
        symbol: 'string',
        name: 'string',
        sector: 'string',
        description: 'string'
      }
    ],
    benchmark: {
      symbol: 'string',
      name: 'string',
      description: 'string'
    },
    sector_mapping: {
      [key: string]: 'string'
    }
  }
};

/**
 * Market Drivers Types
 */
export const MarketDriversSnapshotResponse = {
  ...SuccessResponse,
  data: {
    snapshot_time: 'string',
    macro_environment: {
      interest_rate_outlook: 'string',
      inflation_trend: 'string',
      employment_strength: 'string',
      gdp_growth: 'string'
    },
    market_structure: {
      vix_level: 'number',
      yield_curve: 'string',
      dollar_strength: 'string',
      credit_conditions: 'string'
    },
    risk_factors: [
      {
        factor: 'string',
        impact_level: 'string',
        trend: 'string',
        confidence: 'number'
      }
    ],
    market_regime: {
      current_regime: 'string',
      confidence: 'number',
      regime_duration: 'number',
      key_drivers: 'string[]'
    }
  }
};

export const EnhancedMarketDriversResponse = {
  ...SuccessResponse,
  data: {
    snapshot_time: 'string',
    comprehensive_analysis: {
      macro_drivers: {
        monetary_policy: 'object',
        fiscal_policy: 'object',
        economic_indicators: 'object',
        global_factors: 'object'
      },
      market_technicals: {
        sentiment_indicators: 'object',
        flow_indicators: 'object',
        volatility_metrics: 'object',
        intermarket_relationships: 'object'
      },
      risk_assessment: {
        geopolitical_risks: 'object',
        financial_stability: 'object',
        market_stress: 'object',
        systemic_factors: 'object'
      }
    },
    forward_indicators: [
      {
        indicator: 'string',
        current_value: 'number',
        trend: 'string',
        significance: 'string',
        time_horizon: 'string'
      }
    ],
    scenario_analysis: {
      base_case: 'object',
      bull_case: 'object',
      bear_case: 'object',
      key_assumptions: 'string[]'
    }
  }
};

export const MacroDriversResponse = {
  ...SuccessResponse,
  data: {
    economic_indicators: [
      {
        indicator: 'string',
        current_value: 'number',
        previous_value: 'number',
        trend: 'string',
        significance: 'string',
        last_updated: 'string'
      }
    ],
    monetary_policy: {
      fed_stance: 'string',
      interest_rate_outlook: 'string',
      quantitative_easing: 'string',
      policy_impact: 'string'
    },
    fiscal_policy: {
      government_stance: 'string',
      tax_policy: 'string',
      spending_priorities: 'string',
      fiscal_impact: 'string'
    },
    global_factors: [
      {
        factor: 'string',
        impact: 'string',
        trend: 'string',
        significance: 'number'
      }
    ]
  }
};

export const MarketStructureResponse = {
  ...SuccessResponse,
  data: {
    volatility_metrics: {
      vix_current: 'number',
      vix_trend: 'string',
      implied_volatility: 'number',
      realized_volatility: 'number'
    },
    yield_curve: {
      spread_10y_2y: 'number',
      curve_shape: 'string',
      trend: 'string',
      significance: 'string'
    },
    market_breadth: {
      advance_decline_ratio: 'number',
      new_highs_lows: 'object',
      breadth_momentum: 'string'
    },
    intermarket_relationships: [
      {
        market_1: 'string',
        market_2: 'string',
        correlation: 'number',
        trend: 'string'
      }
    ]
  }
};

export const MarketRegimeResponse = {
  ...SuccessResponse,
  data: {
    current_regime: {
      name: 'string',
      description: 'string',
      characteristics: 'string[]',
      typical_duration: 'string'
    },
    regime_probability: {
      current_regime_prob: 'number',
      alternative_regimes: [
        {
          regime: 'string',
          probability: 'number',
          key_drivers: 'string[]'
        }
      ]
    },
    regime_history: [
      {
        start_date: 'string',
        end_date: 'string',
        regime: 'string',
        duration_months: 'number',
      }
    ],
    regime_indicators: [
      {
        indicator: 'string',
        value: 'number',
        signal: 'string',
        confidence: 'number'
      }
    ]
  }
};

export const GeopoliticalResponse = {
  ...SuccessResponse,
  data: {
    risk_level: 'string',
    overall_score: 'number',
    key_events: [
      {
        event: 'string',
        region: 'string',
        impact_level: 'string',
        market_impact: 'string',
        timeline: 'string'
      }
    ],
    regional_risks: [
      {
        region: 'string',
        risk_level: 'string',
        key_factors: 'string[]',
        market_exposure: 'string'
      }
    ],
    sentiment_analysis: {
      news_sentiment_score: 'number',
      social_media_sentiment: 'number',
      institutional_positioning: 'string',
      risk_premium: 'number'
    }
  }
};

export const MarketDriversHistoryResponse = {
  ...SuccessResponse,
  data: {
    history_period: 'string',
    data_points: [
      {
        date: 'string',
        regime: 'string',
        risk_level: 'number',
        macro_score: 'number',
        market_structure_score: 'number',
        key_events: 'string[]'
      }
    ],
    trend_analysis: {
      regime_changes: 'number',
      risk_trend: 'string',
      macro_trend: 'string',
      volatility_trend: 'string'
    },
    performance_attribution: [
      {
        factor: 'string',
        contribution: 'number',
        consistency: 'string'
      }
    ]
  }
};

export const MarketDriversHealthResponse = {
  ...SuccessResponse,
  data: {
    overall_health: 'string',
    data_sources: [
      {
        source: 'string',
        status: 'string',
        last_update: 'string',
        data_quality: 'string'
      }
    ],
    model_performance: {
      regime_accuracy: 'number',
      risk_prediction_accuracy: 'number',
      signal_reliability: 'number'
    },
    update_frequency: {
      macro_data: 'string',
      market_data: 'string',
      risk_assessment: 'string'
    }
  }
};

/**
 * API Documentation Response
 */
export const ApiDocumentationResponse = {
  ...SuccessResponse,
  data: {
    title: 'string',
    version: 'string',
    description: 'string',
    available_endpoints: 'object',
    documentation: 'string',
    status: 'string'
  }
};

/**
 * Comprehensive Type Registry
 * Export all types for easy importing
 */
export const ApiTypes = {
  // Base Types
  BaseApiResponse,
  ErrorResponse,
  SuccessResponse,

  // Sentiment Types
  SentimentAnalysisResponse,
  SymbolSentimentResponse,
  MarketSentimentResponse,
  SectorSentimentResponse,

  // Report Types
  DailyReportResponse,
  WeeklyReportResponse,
  PreMarketReportResponse,
  IntradayReportResponse,
  EndOfDayReportResponse,

  // Data Types
  SymbolsResponse,
  HistoricalDataResponse,
  SystemHealthResponse,

  // Sector Types
  SectorSnapshotResponse,
  SectorHealthResponse,
  SectorSymbolsResponse,

  // Market Drivers Types
  MarketDriversSnapshotResponse,
  EnhancedMarketDriversResponse,
  MacroDriversResponse,
  MarketStructureResponse,
  MarketRegimeResponse,
  GeopoliticalResponse,
  MarketDriversHistoryResponse,
  MarketDriversHealthResponse,

  // Documentation
  ApiDocumentationResponse
};

/**
 * Type validation utilities
 */
export function validateApiResponse(data, expectedType) {
  // Basic validation - can be expanded for comprehensive type checking
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid response format' };
  }

  if (data.success === false) {
    return { valid: false, error: data.error || 'API returned error' };
  }

  if (data.success !== true) {
    return { valid: false, error: 'Missing success flag' };
  }

  if (!data.timestamp) {
    return { valid: false, error: 'Missing timestamp' };
  }

  return { valid: true };
}

/**
 * Response type guards
 */
export function isSentimentAnalysisResponse(data) {
  return data?.success && data?.data?.symbols_analyzed && Array.isArray(data.data.symbols_analyzed);
}

export function isMarketSentimentResponse(data) {
  return data?.success && data?.data?.market_overview && data?.data?.sentiment_distribution;
}

export function isSectorSnapshotResponse(data) {
  return data?.success && data?.data?.sector_performance && Array.isArray(data.data.sector_performance);
}

export function isSystemHealthResponse(data) {
  return data?.success && data?.data?.system_status && data?.data?.components;
}

// Export for global use
if (typeof window !== 'undefined') {
  window.ApiTypes = ApiTypes;
  window.validateApiResponse = validateApiResponse;
  window.isSentimentAnalysisResponse = isSentimentAnalysisResponse;
  window.isMarketSentimentResponse = isMarketSentimentResponse;
  window.isSectorSnapshotResponse = isSectorSnapshotResponse;
  window.isSystemHealthResponse = isSystemHealthResponse;
}