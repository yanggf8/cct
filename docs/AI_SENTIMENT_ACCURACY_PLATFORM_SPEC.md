# AI Sentiment Model Accuracy Testing Platform
## Product Specification

**Version:** 1.1
**Date:** 2026-01-16
**Purpose:** Research platform for validating AI sentiment model accuracy against actual market outcomes

---

## 1. Overview

### 1.1 Problem Statement

**Current Reality:** LLM-based sentiment analysis for stocks is popular but unvalidated.

- Do bullish predictions actually correlate with positive returns?
- How does model confidence relate to prediction accuracy?
- Are some sectors/symbols easier to predict than others?
- How do different AI models compare?

**Solution:** A research tool to scientifically measure and track AI sentiment model accuracy against actual market outcomes.

### 1.2 Research Goal

**Primary Objective:** Accuracy validation - testing how accurate AI sentiment analysis is for predicting stock price movements.

**Success Metrics:**
- **Directional Accuracy:** Model predicted direction correctly (up/down)
- **Classification Metrics:** Confusion matrix, precision, recall, F1 score

### 1.3 Key Design Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Prediction Horizons** | 1 day, 5 days (configurable) | Short-term signal vs multi-day trend validation |
| **Neutral Threshold** | Default ±1.0% (100 bps), configurable per holding period | Filters intraday noise; widen for longer horizons |
| **Duplicate Prevention** | Unique constraint on (symbol, model_name, prediction_timestamp, holding_period_days) | Prevents stat inflation from duplicate predictions |
| **Baseline Comparison** | Random guess, always-bullish, buy-and-hold S&P 500 | Establishes statistical validity |

---

## 2. System Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │      SENTIMENT PREDICTION (T0)              │
                    ├─────────────────────────────────────────────┤
                    │  Input: News + Price Data                   │
                    │  Model: AI Sentiment Analysis                │
                    │  Output: {direction, confidence, reasoning} │
                    │  Store: Record prediction with timestamp    │
                    │  DB: Cloudflare D1 (PREDICT_JOBS_DB)        │
                    └─────────────────────────────────────────────┘
                                      │
                                      │ Time passes (1d, 5d, etc.)
                                      ▼
                    ┌─────────────────────────────────────────────┐
                    │      OUTCOME MEASUREMENT (T1)                │
                    ├─────────────────────────────────────────────┤
                    │  Fetch: Actual price at T1 (Yahoo Finance)  │
                    │  Retry: Exponential backoff, max 3 attempts │
                    │  Compare: Predicted vs Actual direction      │
                    │  Calculate: Was prediction correct?          │
                    │  Store: Outcome record linked to prediction  │
                    └─────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────────┐
                    │      ACCURACY ANALYTICS                      │
                    ├─────────────────────────────────────────────┤
                    │  • Overall accuracy rate                     │
                    │  • Accuracy by confidence level              │
                    │  • Accuracy by symbol/sector                 │
                    │  • Confusion matrix                          │
                    │  • Calibration curve (confidence vs actual)  │
                    │  • Baseline comparisons (random, buy-hold)   │
                    └─────────────────────────────────────────────┘
```

---

## 3. Data Model

The authoritative schema is defined once in Section 7 (Database Schema). See that section for the canonical D1 DDL; avoid duplicating or diverging from it elsewhere.

---

## 4. Accuracy Metrics

### 4.1 Primary Metrics

```typescript
interface AccuracyReport {
  // Overall performance
  total_predictions: number;
  validated_predictions: number;
  pending_predictions: number;
  overall_accuracy: number;              // correct / total

  // By confidence level
  accuracy_by_confidence: {
    high:   { count: number; accuracy: number };  // confidence > 0.7
    medium: { count: number; accuracy: number };  // confidence 0.4-0.7
    low:    { count: number; accuracy: number };  // confidence < 0.4
  };

  // By prediction direction
  accuracy_by_direction: {
    bullish:  { total: number; correct: number; accuracy: number };
    bearish:  { total: number; correct: number; accuracy: number };
    neutral:  { total: number; correct: number; accuracy: number };
  };

  // Classification metrics (bullish/bearish only)
  classification_metrics: {
    precision: number;      // TP / (TP + FP) - When model says bullish, how often right?
    recall: number;         // TP / (TP + FN) - Of all bullish outcomes, how many caught?
    f1_score: number;
    true_positives: number;
    true_negatives: number;
    false_positives: number;
    false_negatives: number;
  };

  // Calibration - do confidence scores mean anything?
  calibration: {
    avg_confidence_when_correct: number;
    avg_confidence_when_wrong: number;
    calibration_error: number;         // Difference between predicted and actual confidence
  };

  // Baseline comparisons (illustrative; weight by sample size in implementation)
  baseline_comparison: {
    model_vs_random: number;           // Model accuracy minus random baseline
    model_vs_always_bullish: number;   // Model accuracy minus always-bullish baseline
    model_vs_buy_hold: number;         // Model accuracy minus buy-and-hold S&P 500
  };
}
```

### 4.2 Confusion Matrix

```
                    ACTUAL OUTCOME
              ┌─────────┬─────────┬─────────┐
              │   UP    │  FLAT   │  DOWN   │
    ┌─────────┼─────────┼─────────┼─────────┤
 P   │ BULLISH │   TP    │   FP    │   FP    │
 R   ├─────────┼─────────┼─────────┼─────────┤
 E   │ NEUTRAL │   FN    │   TN    │   FN    │
 D   ├─────────┼─────────┼─────────┼─────────┤
 I   │ BEARISH │   FN    │   FP    │   TN    │
 C   └─────────┴─────────┴─────────┴─────────┘

TP = True Positive  (predicted bullish, price went up)
FP = False Positive (predicted bullish, price went down/flat)
TN = True Negative  (predicted bearish, price went down)
FN = False Negative (predicted bearish, price went up/flat)
```

### 4.3 Accuracy Calculation

```typescript
interface AccuracyConfig {
  neutral_threshold_pct: number;       // Default: 1.0 (100 bps)
  holding_period_days: number;         // Default: 1
}

function calculateAccuracy(
  predictedDirection: 'bullish' | 'bearish' | 'neutral',
  actualReturnPct: number,
  config: AccuracyConfig = { neutral_threshold_pct: 1.0, holding_period_days: 1 }
): { correct: boolean; actualDirection: string } {
  // Threshold is configurable per holding period (longer period = wider threshold)
  const threshold = config.neutral_threshold_pct;

  const actualDirection = actualReturnPct > threshold ? 'up'
                       : actualReturnPct < -threshold ? 'down'
                       : 'flat';

  // Correct if:
  // - Bullish prediction and actual direction is UP
  // - Bearish prediction and actual direction is DOWN
  // - Neutral prediction and actual direction is FLAT
  const correct = (
    (predictedDirection === 'bullish' && actualDirection === 'up') ||
    (predictedDirection === 'bearish' && actualDirection === 'down') ||
    (predictedDirection === 'neutral' && actualDirection === 'flat')
  );

  return { correct, actualDirection };
}
```

### 4.4 Baseline Accuracy

```typescript
async function calculateBaselineAccuracy(symbol: string, targetDate: string, holdingDays: number) {
  const sp500Return = await getMarketReturn('SPY', targetDate, holdingDays);

  // Random baseline: 50% expected accuracy (coin flip)
  const randomAccuracy = 0.5;

  // Always bullish: accuracy = % of days market went up
  const alwaysBullishAccuracy = sp500Return > 0 ? 1 : 0;

  // Buy and hold: accuracy based on actual S&P 500 direction
  const buyHoldAccuracy = sp500Return > 0.01 ? 1 : sp500Return < -0.01 ? 0 : 0.5;

  return { randomAccuracy, alwaysBullishAccuracy, buyHoldAccuracy };
}
```

---

## 5. API Endpoints

### 5.1 Authentication & Rate Limiting

All endpoints require:
- **Authentication:** `X-API-KEY` header (validated against secret)
- **Rate Limiting:** 60 requests/minute per IP, 10 requests/minute for write operations

```typescript
// Middleware applied to all accuracy routes
app.use('*', async (c, next) => {
  // Auth check
  const apiKey = c.req.header('X-API-KEY');
  if (!apiKey || apiKey !== c.env.X_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Rate limiting (example: per-IP AND per-key using KV/DO; adjust limits to match production)
  const rateLimitKey = `ratelimit:${c.req.header('CF-Connecting-IP')}`;
  const limit = await checkRateLimit(rateLimitKey, 60, 60); // 60 req/min
  if (!limit.allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  await next();
});
```

### 5.2 Prediction Management

#### Store Prediction
```http
POST /api/v1/predictions
Content-Type: application/json
X-API-KEY: your_key

{
  "model_name": "gemma-sea-lion-27b",
  "symbol": "AAPL",
  "predicted_direction": "bullish",
  "predicted_confidence": 0.82,
  "reasoning": "Strong earnings beat with raised guidance...",
  "news_headlines": ["headline1", "headline2"],
  "price_at_prediction": 178.50,
  "prediction_timestamp": "2026-01-16T08:30:00Z",
  "holding_period_days": 1
}
```

**Response:**
```json
{
  "id": "pred_abc123",
  "status": "pending",
  "target_outcome_date": "2026-01-17",
  "created_at": "2026-01-16T08:30:00Z"
}
```

#### Get Predictions (Paginated)
```http
GET /api/v1/predictions?status=validated&symbol=AAPL&limit=50&offset=0
GET /api/v1/predictions?status=pending&limit=20
GET /api/v1/predictions/:id
```

**Response:**
```json
{
  "predictions": [...],
  "pagination": {
    "total": 1247,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### 5.3 Validation

#### Trigger Validation (Protected)
```http
POST /api/v1/accuracy/validate
Content-Type: application/json
X-API-KEY: your_key

{
  "target_date": "2026-01-16",
  "dry_run": false
}
```

**Response:**
```json
{
  "status": "completed",
  "predictions_validated": 42,
  "predictions_failed": 3,
  "predictions_pending": 15,
  "summary": {
    "accuracy": 67.3,
    "bullish_correct": 18,
    "bearish_correct": 10,
    "neutral_correct": 0
  }
}
```

#### Get Validation Status
```http
GET /api/v1/accuracy/validation-status
```

### 5.4 Accuracy Analytics

#### Accuracy Dashboard
```http
GET /api/v1/accuracy/dashboard?days=30&model=gemma-sea-lion-27b
```

**Response:**
```typescript
interface AccuracyDashboard {
  // Overall stats
  overall_accuracy: number;
  total_validated: number;
  total_pending: number;

  // Model comparison (if testing multiple)
  model_comparison: Array<{
    model_name: string;
    accuracy: number;
    sample_size: number;
  }>;

  // Baseline comparison
  baseline_comparison: {
    model_vs_random: number;
    model_vs_always_bullish: number;
    model_vs_buy_hold: number;
  };

  // Time series (accuracy over time)
  accuracy_over_time: Array<{
    date: string;
    accuracy: number;
    predictions: number;
  }>;

  // By symbol
  accuracy_by_symbol: Array<{
    symbol: string;
    accuracy: number;
    predictions: number;
    bullish_accuracy: number;
    bearish_accuracy: number;
  }>;

  // By confidence bucket (calibration)
  confidence_calibration: Array<{
    confidence_range: string;
    predictions: number;
    accuracy: number;
    expected_accuracy: number;
  }>;

  // Recent predictions with outcomes
  recent_predictions: Array<{
    symbol: string;
    predicted: string;
    actual: string;
    confidence: number;
    was_correct: boolean;
    date: string;
  }>;
}
```

#### Classification Metrics
```http
GET /api/v1/accuracy/classification-metrics?model=gemma-sea-lion-27b
```

#### Confusion Matrix
```http
GET /api/v1/accuracy/confusion-matrix?model=gemma-sea-lion-27b&days=30
```

---

## 6. Web Interface

### 6.1 Main Accuracy Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  AI SENTIMENT ACCURACY TRACKER                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             │
│  │   67.3%       │ │   1,247       │ │   832         │             │
│  │   ACCURACY    │ │   TESTED      │ │   PENDING     │             │
│  │   +2.1% ↗     │ │   PREDICTIONS ││   VALIDATION  │             │
│  └───────────────┘ └───────────────┘ └───────────────┘             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  VERSUS BASELINES                                            │   │
│  │  • Model: 67.3%  • Random: 50.0%  • Always Bullish: 54.2%   │   │
│  │  • Buy & Hold S&P 500: 58.1%  • Edge: +9.2% vs random       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ACCURACY OVER TIME (Last 30 Days)                          │   │
│  │  [Line chart showing daily accuracy % with confidence band] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐   │
│  │  BY CONFIDENCE LEVEL        │ │  CLASSIFICATION METRICS     │   │
│  │  ┌─────────┬────────┬─────┐  │ │  Precision: 71.2%          │   │
│  │  │ High    │ 73.1%  │ 412 │  │ │  Recall:    68.4%          │   │
│  │  │ Medium  │ 65.8%  │ 512 │  │ │  F1 Score:  69.7%          │   │
│  │  │ Low     │ 58.3%  │ 323 │  │ │                            │   │
│  │  └─────────┴────────┴─────┘  │ └─────────────────────────────┘   │
│  └─────────────────────────────┘                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  RECENT PREDICTIONS                                          │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │   │
│  │  │ Symbol   │Predicted │Actual    │Confidence│Result    │   │   │
│  │  ├──────────┼──────────┼──────────┼──────────┼──────────┤   │   │
│  │  │ AAPL     │ Bullish  │ UP +2.3% │ 0.82     │ ✓        │   │   │
│  │  │ TSLA     │ Bearish  │ UP +1.1% │ 0.71     │ ✗        │   │   │
│  │  │ NVDA     │ Bullish  │ UP +4.2% │ 0.89     │ ✓        │   │   │
│  │  │ MSFT     │ Bullish  │ FLAT     │ 0.55     │ ✗        │   │   │
│  │  │ GOOGL    │ Bearish  │ DOWN -1.8%│ 0.67    │ ✓        │   │   │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Model Comparison Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  MODEL COMPARISON                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Model              │ Accuracy │ Samples │ F1 Score │Calib.  │ │
│  │  ├──────────────────┼──────────┼─────────┼──────────┼────────┤ │
│  │  │ Gemma Sea Lion   │  67.3%   │  1,247  │  69.7%   │  -8.2% │ │
│  │  │ DistilBERT SST-2 │  62.1%   │  1,247  │  64.3%   │  -3.1% │ │
│  │  │ Random (baseline)│  50.0%   │  5,000  │  N/A     │   N/A  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CONFUSION MATRIX - Gemma Sea Lion                          │   │
│  │  [Visual matrix heatmap with counts]                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CONFIDENCE CALIBRATION                                     │   │
│  │  [Scatter plot: predicted confidence vs actual accuracy]    │   │
│  │  Diagonal line = perfect calibration                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation

### 7.1 Database Schema

File: `schemas/accuracy-tracking.sql`

```sql
-- ============================================================
-- AI Sentiment Accuracy Tracking Schema
-- Database: Cloudflare D1 (PREDICT_JOBS_DB)
-- ============================================================

-- ============================================================
-- PREDICTIONS TABLE
-- Stores predictions at generation time
-- ============================================================
CREATE TABLE IF NOT EXISTS sentiment_predictions (
  -- Primary key
  id TEXT PRIMARY KEY,

  -- Model identification
  model_name TEXT NOT NULL,

  -- Symbol
  symbol TEXT NOT NULL,

  -- Model outputs
  predicted_direction TEXT NOT NULL CHECK(predicted_direction IN ('bullish', 'bearish', 'neutral')),
  predicted_confidence REAL NOT NULL CHECK(predicted_confidence >= 0 AND predicted_confidence <= 1),
  reasoning TEXT,

  -- Context (NOT NULL for data integrity)
  news_headlines TEXT,
  price_at_prediction REAL NOT NULL,
  prediction_timestamp TEXT NOT NULL,

  -- Validation parameters
  target_outcome_date TEXT NOT NULL,
  holding_period_days INTEGER NOT NULL DEFAULT 1 CHECK(holding_period_days IN (1, 5, 10)),

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'failed')),
  validation_attempts INTEGER DEFAULT 0,
  last_validation_attempt_at TEXT,
  failure_reason TEXT,

  -- Audit
  created_at TEXT DEFAULT (datetime('now')),

  -- Unique constraint prevents duplicate predictions inflating stats
  UNIQUE(symbol, model_name, prediction_timestamp, holding_period_days)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_predictions_status
  ON sentiment_predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_symbol
  ON sentiment_predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_predictions_target_date
  ON sentiment_predictions(target_outcome_date);
CREATE INDEX IF NOT EXISTS idx_predictions_model
  ON sentiment_predictions(model_name);

-- ============================================================
-- OUTCOMES TABLE
-- Stores validation results
-- ============================================================
CREATE TABLE IF NOT EXISTS sentiment_outcomes (
  -- Primary key
  id TEXT PRIMARY KEY,

  -- Link to prediction (with cascade cleanup)
  prediction_id TEXT NOT NULL,

  -- Market reality
  actual_price REAL NOT NULL,
  actual_return_pct REAL NOT NULL,
  actual_direction TEXT NOT NULL CHECK(actual_direction IN ('up', 'down', 'flat')),
  was_correct BOOLEAN NOT NULL,

  -- Validation metadata
  validated_at TEXT NOT NULL,
  holding_period_days INTEGER NOT NULL,

  -- Additional metrics for analysis
  volume_avg REAL,
  market_return_pct REAL,
  sector_return_pct REAL,
  vix_at_validation REAL,

  -- Audit
  created_at TEXT DEFAULT (datetime('now')),

  -- Foreign key with cascade cleanup
  FOREIGN KEY (prediction_id)
    REFERENCES sentiment_predictions(id)
    ON DELETE CASCADE
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_outcomes_prediction
  ON sentiment_outcomes(prediction_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_correct
  ON sentiment_outcomes(was_correct);
CREATE INDEX IF NOT EXISTS idx_outcomes_validated_at
  ON sentiment_outcomes(validated_at);

-- ============================================================
-- BASELINES TABLE
-- Tracks baseline methods for statistical comparison
-- ============================================================
CREATE TABLE IF NOT EXISTS sentiment_baselines (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  baseline_type TEXT NOT NULL CHECK(baseline_type IN ('random', 'always_bullish', 'buy_hold_sp500')),
  prediction_date TEXT NOT NULL,
  target_outcome_date TEXT NOT NULL,
  holding_period_days INTEGER NOT NULL,

  -- Baseline "prediction"
  predicted_direction TEXT NOT NULL,
  predicted_confidence REAL,

  -- Outcome
  actual_price REAL NOT NULL,
  actual_return_pct REAL NOT NULL,
  was_correct BOOLEAN NOT NULL,

  validated_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_baselines_symbol_date
  ON sentiment_baselines(symbol, prediction_date);
CREATE INDEX IF NOT EXISTS idx_baselines_type
  ON sentiment_baselines(baseline_type);
```

### 7.2 Validation Cron Job

File: `.github/workflows/validate-predictions.yml` (Wrangler note: unset `CLOUDFLARE_API_TOKEN` and use OAuth login per repo policy)

```yaml
name: Validate AI Predictions

on:
  schedule:
    # 4:30 PM ET, Monday-Friday (after market close)
    - cron: '30 20 * * 1-5'
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run validation
        run: node scripts/validate-predictions.js
        env:
          # IMPORTANT: Unset CLOUDFLARE_API_TOKEN to use OAuth flow
          # CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

File: `scripts/validate-predictions.js`

```javascript
/**
 * Validate pending predictions against actual market outcomes
 *
 * Features:
 * - Exponential backoff for price fetch failures
 * - Max 3 validation attempts before marking as failed
 * - Rate limiting to avoid overwhelming Yahoo Finance
 * - Configurable thresholds per holding period
 */

import { getConfig } from '../src/modules/config.js';
import { createD1Client } from '../src/utils/d1-client.js';

// Configuration
const MAX_VALIDATION_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 2000, 5000]; // Exponential backoff in ms
const RATE_LIMIT_DELAY = 200; // ms between requests
const THRESHOLDS = {
  1: 1.0,   // 1% threshold for 1-day horizon
  5: 2.0,   // 2% threshold for 5-day horizon
  10: 3.0   // 3% threshold for 10-day horizon
};

/**
 * Fetch historical price with retry logic
 */
async function getPriceWithRetry(symbol, targetDate, attempt = 0) {
  try {
    const price = await fetchHistoricalPrice(symbol, targetDate);
    if (!price && attempt < MAX_VALIDATION_ATTEMPTS - 1) {
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      console.log(`Retry ${attempt + 1} for ${symbol} after ${delay}ms`);
      await sleep(delay);
      return getPriceWithRetry(symbol, targetDate, attempt + 1);
    }
    return price;
  } catch (error) {
    if (attempt < MAX_VALIDATION_ATTEMPTS - 1) {
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await sleep(delay);
      return getPriceWithRetry(symbol, targetDate, attempt + 1);
    }
    throw error;
  }
}

/**
 * Calculate accuracy based on predicted direction and actual return
 */
function calculateAccuracy(predictedDirection, actualReturnPct, holdingPeriodDays) {
  const threshold = THRESHOLDS[holdingPeriodDays] || 1.0;

  const actualDirection = actualReturnPct > threshold ? 'up'
                       : actualReturnPct < -threshold ? 'down'
                       : 'flat';

  const wasCorrect = (
    (predictedDirection === 'bullish' && actualDirection === 'up') ||
    (predictedDirection === 'bearish' && actualDirection === 'down') ||
    (predictedDirection === 'neutral' && actualDirection === 'flat')
  );

  return { actualDirection, wasCorrect, threshold };
}

/**
 * Validate a single prediction
 */
async function validatePrediction(db, prediction) {
  const { id, symbol, target_outcome_date, price_at_prediction,
          predicted_direction, holding_period_days, validation_attempts } = prediction;

  // Check if we've exceeded max attempts
  if (validation_attempts >= MAX_VALIDATION_ATTEMPTS) {
    await db.exec({
      sql: `UPDATE sentiment_predictions
            SET status = 'failed',
                failure_reason = 'Max validation attempts exceeded',
                last_validation_attempt_at = datetime('now')
            WHERE id = ?`,
      args: [id]
    });
    return { success: false, reason: 'max_attempts_exceeded' };
  }

  // Increment attempt counter
  await db.exec({
    sql: `UPDATE sentiment_predictions
          SET validation_attempts = validation_attempts + 1,
              last_validation_attempt_at = datetime('now')
          WHERE id = ?`,
    args: [id]
  });

  // Fetch actual price with retry
  const actualPrice = await getPriceWithRetry(symbol, target_outcome_date);

  if (!actualPrice) {
    console.log(`No price data for ${symbol} on ${target_outcome_date} (attempt ${validation_attempts + 1})`);
    return { success: false, reason: 'no_price_data' };
  }

  // Calculate return and accuracy
  const actualReturn = (actualPrice - price_at_prediction) / price_at_prediction * 100;
  const { actualDirection, wasCorrect } = calculateAccuracy(
    predicted_direction,
    actualReturn,
    holding_period_days
  );

  // Store outcome
  const outcomeId = crypto.randomUUID();
  await db.exec({
    sql: `INSERT INTO sentiment_outcomes
          (id, prediction_id, actual_price, actual_return_pct,
           actual_direction, was_correct, validated_at, holding_period_days)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    args: [outcomeId, id, actualPrice, actualReturn, actualDirection, wasCorrect ? 1 : 0, holding_period_days]
  });

  // Update prediction status
  await db.exec({
    sql: `UPDATE sentiment_predictions SET status = 'validated' WHERE id = ?`,
    args: [id]
  });

  console.log(`${symbol}: ${predicted_direction} -> ${actualDirection} (${actualReturn.toFixed(2)}%) [${wasCorrect ? '✓' : '✗'}]`);

  return { success: true, wasCorrect, actualDirection, actualReturn };
}

/**
 * Main validation function
 */
async function validatePredictions(targetDate = null) {
  const db = createD1Client();
  const dateToValidate = targetDate || new Date().toISOString().split('T')[0];

  // Find all pending predictions due for validation
  const pending = await db.exec({
    sql: `SELECT * FROM sentiment_predictions
          WHERE status = 'pending'
          AND target_outcome_date <= ?
          ORDER BY target_outcome_date ASC`,
    args: [dateToValidate]
  });

  console.log(`Found ${pending.length} predictions to validate for ${dateToValidate}`);

  const results = {
    total: pending.length,
    validated: 0,
    failed: 0,
    correct: 0,
    incorrect: 0
  };

  for (const prediction of pending) {
    try {
      const result = await validatePrediction(db, prediction);

      if (result.success) {
        results.validated++;
        if (result.wasCorrect) results.correct++;
        else results.incorrect++;
      } else {
        results.failed++;
      }

      // Rate limiting between requests
      await sleep(RATE_LIMIT_DELAY);

    } catch (error) {
      console.error(`Error validating ${prediction.id}:`, error);
      results.failed++;
    }
  }

  // Log summary
  console.log(`\nValidation Summary:`);
  console.log(`  Total: ${results.total}`);
  console.log(`  Validated: ${results.validated}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Correct: ${results.correct}`);
  console.log(`  Incorrect: ${results.incorrect}`);
  console.log(`  Accuracy: ${results.validated > 0 ? (results.correct / results.validated * 100).toFixed(1) : 0}%`);

  return results;
}

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch historical price from Yahoo Finance
 * TODO: Implement actual Yahoo Finance API call
 */
async function fetchHistoricalPrice(symbol, date) {
  // Placeholder - implement actual API call
  // This would typically use a library like `yahoo-finance2` or direct API
  return null;
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const targetDate = process.argv[2] || null;
  validatePredictions(targetDate)
    .then(results => process.exit(results.failed > 0 ? 1 : 0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export { validatePredictions };
```

### 7.3 API Routes

File: `src/routes/accuracy-routes.ts`

```typescript
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

// Types for D1 binding (defined in wrangler.toml)
type Bindings = {
  DB: D1Database;
  X_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Auth middleware
app.use('*', async (c, next) => {
  const apiKey = c.req.header('X-API-KEY');
  if (!apiKey || apiKey !== c.env.X_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

/**
 * GET /api/v1/accuracy/dashboard
 * Returns comprehensive accuracy metrics
 */
app.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const days = parseInt(c.req.query('days') || '30');
  const modelFilter = c.req.query('model');

  // Build WHERE clause
  let whereClause = 'WHERE o.validated_at >= datetime("now", "-" || ? || " days")';
  let params = [days.toString()];

  if (modelFilter) {
    whereClause += ' AND p.model_name = ?';
    params.push(modelFilter);
  }

  // Overall stats
  const statsQuery = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN o.was_correct = 1 THEN 1 ELSE 0 END) as correct
    FROM sentiment_outcomes o
    JOIN sentiment_predictions p ON o.prediction_id = p.id
    ${whereClause}
  `;

  const stats = await db.prepare(statsQuery).bind(...params).first();
  const overallAccuracy = stats.total > 0 ? (stats.correct / stats.total * 100) : 0;

  // By confidence level
  const byConfidenceQuery = `
    SELECT
      CASE
        WHEN p.predicted_confidence > 0.7 THEN 'high'
        WHEN p.predicted_confidence > 0.4 THEN 'medium'
        ELSE 'low'
      END as confidence_level,
      COUNT(*) as count,
      SUM(CASE WHEN o.was_correct = 1 THEN 1 ELSE 0 END) as correct
    FROM sentiment_predictions p
    JOIN sentiment_outcomes o ON p.id = o.prediction_id
    ${whereClause}
    GROUP BY confidence_level
  `;

  const byConfidenceResults = await db.prepare(byConfidenceQuery).bind(...params).all();
  const accuracyByConfidence = byConfidenceResults.results.map(row => ({
    confidence_level: row.confidence_level,
    count: row.count,
    accuracy: row.count > 0 ? (row.correct / row.count * 100) : 0
  }));

  // Classification metrics (bullish/bearish only)
  const classificationQuery = `
    SELECT
      SUM(CASE WHEN p.predicted_direction = 'bullish' AND o.was_correct = 1 THEN 1 ELSE 0 END) as tp,
      SUM(CASE WHEN p.predicted_direction = 'bullish' AND o.was_correct = 0 THEN 1 ELSE 0 END) as fp,
      SUM(CASE WHEN p.predicted_direction = 'bearish' AND o.was_correct = 1 THEN 1 ELSE 0 END) as tn,
      SUM(CASE WHEN p.predicted_direction = 'bearish' AND o.was_correct = 0 THEN 1 ELSE 0 END) as fn
    FROM sentiment_predictions p
    JOIN sentiment_outcomes o ON p.id = o.prediction_id
    ${whereClause}
    AND p.predicted_direction IN ('bullish', 'bearish')
  `;

  const classification = await db.prepare(classificationQuery).bind(...params).first();

  const precision = (classification.tp + classification.fp) > 0
    ? (classification.tp / (classification.tp + classification.fp) * 100)
    : 0;
  const recall = (classification.tp + classification.fn) > 0
    ? (classification.tp / (classification.tp + classification.fn) * 100)
    : 0;
  const f1 = (precision + recall) > 0
    ? (2 * precision * recall / (precision + recall))
    : 0;

  // Baseline comparison
  const baselineQuery = `
    SELECT
      SUM(CASE WHEN was_correct = 1 THEN 1 ELSE 0 END) as correct,
      COUNT(*) as total,
      baseline_type
    FROM sentiment_baselines
    WHERE validated_at >= datetime("now", "-" || ? || " days")
    GROUP BY baseline_type
  `;
  const baselines = await db.prepare(baselineQuery).bind(days.toString()).all();

  const baselineComparison = {
    model_vs_random: overallAccuracy - 50,
    model_vs_always_bullish: overallAccuracy - (baselines.results.find(b => b.baseline_type === 'always_bullish')?.accuracy || 50),
    model_vs_buy_hold: overallAccuracy - (baselines.results.find(b => b.baseline_type === 'buy_hold_sp500')?.accuracy || 50)
  };

  return c.json({
    overall_accuracy: Number(overallAccuracy.toFixed(1)),
    total_validated: stats.total,
    accuracy_by_confidence: accuracyByConfidence,
    classification_metrics: {
      precision: Number(precision.toFixed(1)),
      recall: Number(recall.toFixed(1)),
      f1_score: Number(f1.toFixed(1)),
      true_positives: classification.tp,
      false_positives: classification.fp,
      true_negatives: classification.tn,
      false_negatives: classification.fn
    },
    baseline_comparison: {
      model_vs_random: Number(baselineComparison.model_vs_random.toFixed(1)),
      model_vs_always_bullish: Number(baselineComparison.model_vs_always_bullish.toFixed(1)),
      model_vs_buy_hold: Number(baselineComparison.model_vs_buy_hold.toFixed(1))
    }
  });
});

/**
 * POST /api/v1/accuracy/validate
 * Trigger validation for pending predictions
 */
app.post('/validate', async (c) => {
  const db = c.env.DB;
  const { target_date, dry_run = false } = await c.req.json();

  // Get count of pending predictions
  const pendingCount = await db.prepare(`
    SELECT COUNT(*) as count FROM sentiment_predictions
    WHERE status = 'pending'
    AND target_outcome_date <= ?
  `).bind(target_date || new Date().toISOString().split('T')[0]).first();

  if (dry_run) {
    return c.json({
      status: 'dry_run',
      pending_predictions: pendingCount.count
    });
  }

  // Trigger validation (this would typically call a worker or separate process)
  // For now, return a job identifier
  const jobId = crypto.randomUUID();
  return c.json({
    status: 'queued',
    job_id: jobId,
    pending_predictions: pendingCount.count
  });
});

export default app;
```

---

## 8. Resolved Open Questions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Prediction Horizon** | 1 day and 5 days (both tracked) | Short-term signal vs multi-day trend; configurable in schema |
| **Neutral Threshold** | ±1.0% (100 bps) for 1-day; scaled for longer periods | Filters intraday noise; configurable via THRESHOLDS |
| **Public vs Private** | Personal research (auth required) | X-API-KEY authentication on all endpoints |
| **Model Scope** | Support multiple models via `model_name` column | Schema designed for model comparison |
| **Baseline Comparison** | Track random, always-bullish, buy-and-hold S&P 500 | Implemented in `sentiment_baselines` table |

---

## 9. Success Metrics

The platform succeeds when:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Data Collection** | >1000 validated predictions | Automated tracking |
| **Statistical Power** | Minimum 100 predictions per model | Sample size tracking |
| **Calibration Quality** | Confidence within 10% of actual | Calibration curve |
| **Actionable Insights** | Clear performance differences | Model comparison vs baselines |
| **Reliability** | <5% validation failures | Error tracking with `validation_attempts` |
| **Duplicate Prevention** | Zero duplicate predictions | UNIQUE constraint enforcement |

---

## 10. Implementation Roadmap

### Phase 1: Data Foundation
- [ ] Apply schema to `PREDICT_JOBS_DB` (D1)
- [ ] Verify UNIQUE constraint prevents duplicates
- [ ] Test sample data insertion
- [ ] Verify FK CASCADE works

### Phase 2: Modify Existing Pipeline
- [ ] Update pre-market job to store predictions in `sentiment_predictions`
- [ ] Handle unique constraint violations (skip duplicates gracefully)
- [ ] Add prediction recording API endpoint with auth
- [ ] Verify data integrity

### Phase 3: Validation System
- [ ] Implement `getPriceWithRetry` with exponential backoff
- [ ] Create validation cron job (unset CLOUDFLARE_API_TOKEN for OAuth)
- [ ] Implement configurable thresholds per holding period
- [ ] Add failure state handling (max attempts before 'failed')
- [ ] Test with historical data

### Phase 4: Analytics & Dashboard
- [ ] Create accuracy calculation queries
- [ ] Build accuracy dashboard API with Hono
- [ ] Implement baseline comparison queries
- [ ] Create web dashboard UI
- [ ] Add model comparison views

### Phase 5: Refinement
- [ ] Add confidence calibration analysis
- [ ] Create confusion matrix visualization
- [ ] Add time series accuracy tracking
- [ ] Document findings and model performance

---

## Appendix A: Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-01-16 | Fixed SQL quote bug; added UNIQUE constraint; aligned with OAuth flow; added retry logic; clarified thresholds; added baselines |
| 1.0 | 2026-01-16 | Initial spec |

---

**Document Version:** 1.1
**Last Updated:** 2026-01-16
**Status:** Ready for implementation
