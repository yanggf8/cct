# 🕐 Temporal Sentiment Analysis - Professional Framework

## 📋 Executive Summary

**Your Question**: Can our sentiment analysis support temporal (multi-timeframe) analysis?

**Gemini's Answer**: ✅ **YES - And it's exactly how to evolve from basic sentiment to alpha-generating signals**

**Key Insight**: Temporal sentiment analysis is NOT just running analysis more frequently. It's about interpreting **sentiment changes and relationships across different timeframes** - like using multiple moving averages in technical analysis.

---

## 🎯 What is Temporal Sentiment Analysis?

### **Core Concept: Sentiment Term Structure**

Just like yield curve (term structure of interest rates), we create a **Sentiment Term Structure** by calculating sentiment scores over various lookback windows:

```
Sentiment Term Structure:
├─ Ultra-Short (1-2 hours)   → Immediate reaction to breaking news
├─ Short (24 hours)          → Daily confirmation and noise filtering
├─ Medium (7 days)           → Weekly narrative and trend
└─ Long (30 days)            → Monthly sentiment direction
```

### **Professional Methodology: Analyze the Dynamics**

1. **Alignment**: Is short-term sentiment confirming long-term trend? (High conviction)
2. **Divergence**: Is short-term diverging from long-term? (Potential reversal/warning)
3. **Momentum**: What is the rate of change (velocity) of sentiment?

---

## 📊 News Sentiment Temporal Patterns

### **News as a Decaying Asset (Alpha Decay)**

News sentiment impact diminishes over time:

| Timeframe | Impact | Characteristics | Use Case |
|-----------|--------|-----------------|----------|
| **Fresh (0-2 hrs)** | Maximum | Pure "shock value", market overreaction | Scalping, breaking news trades |
| **Recent (2-24 hrs)** | High | Initial shock absorbed, still influential | Intraday/swing entry points |
| **Aged (24+ hrs)** | Medium | Market's considered, stable view | Trend confirmation |
| **Old (7+ days)** | Low | Priced in, background narrative | Long-term positioning |

**Our System Advantage**:
- ✅ **DistilBERT**: Fast, perfect for fresh news (0-2 hour window)
- ✅ **GPT-OSS-120B**: Contextual, ideal for aged news (24+ hour narrative)

### **Key Temporal Patterns**

#### **1. Sentiment Momentum (Trend Following)**
```
Series of positive articles → Positive feedback loop → Sentiment + Price rising
Signal: Strong momentum = Continue trend
```

#### **2. Sentiment Reversals (Counter-trend)**
```
Sharp negative spike + Strong positive long-term sentiment → Buy the dip opportunity
Signal: Divergence = Potential reversal
```

#### **3. News Volume Spikes (Conviction Amplifier)**
```
Sentiment +0.8 from 3 articles    → Noise
Sentiment +0.6 from 50 articles   → Powerful consensus
Signal: Volume × Sentiment = True conviction
```

---

## 🎯 Multi-Timeframe Sentiment Strategy

### **The Three Timeframe System**

#### **1. Intraday (1-hour): The "Reaction" Timeframe**

**Role**: Capture immediate reactions to breaking news
- Earnings surprises
- FDA announcements
- Fed speeches
- Geopolitical events

**Signals**:
- Sharp sentiment spikes (positive or negative)
- News volume explosions
- Fastest but noisiest

**Use Case**: Scalping, quick trades on breaking news

---

#### **2. Daily (24-hour): The "Confirmation" Timeframe** ✅ *Current System*

**Role**: Smooth out intraday noise, confirm if sentiment shift has staying power

**Signals**:
- Sustained sentiment direction over 24 hours
- Confirmation of intraday spikes
- Good for swing trading (2-5 day holds)

**Use Case**: Our current dual AI analysis operates here

---

#### **3. Weekly (7-day): The "Narrative" Timeframe**

**Role**: Filter daily noise, reveal underlying market narrative

**Signals**:
- Slow-moving sentiment trend
- Persistent bullish or bearish narrative
- Strong signal for position trading

**Use Case**:
- Consistently rising weekly sentiment = Don't short
- Declining weekly sentiment = Avoid new longs

---

### **Timeframe Interaction: The Strongest Signals**

**Maximum Conviction Pattern**:
```
Weekly Sentiment: Positive (underlying narrative bullish)
         ↓
Daily Sentiment: Just turned positive (confirmation)
         ↓
Intraday Sentiment: Strong positive spike (catalyst)
         ↓
= HIGH CONVICTION BUY SIGNAL
```

**Divergence Warning**:
```
Weekly Sentiment: Positive
Daily Sentiment: Turning negative
Intraday Sentiment: Sharp negative spike
= WARNING - Potential trend reversal
```

---

## 🔧 Technical Implementation

### **✅ Can Our Current Models Support This? YES!**

**We DON'T need different models**. Use the **same models on different data windows**:

#### **DistilBERT (Our Fast Model)**
- ✅ Perfect for high-frequency calculations
- Use for: Intraday (1-hour), Daily (24-hour)
- Speed advantage critical for real-time analysis

#### **GPT-OSS-120B (Our Contextual Model)**
- ✅ Perfect for deeper narrative analysis
- Use for: Weekly (7-day) narrative understanding
- Context understanding identifies subtle story shifts

---

### **Professional Aggregation Method: Exponential Moving Average (EMA)**

**Why NOT simple average?**
- ❌ Simple average treats old and new news equally
- ❌ Doesn't capture sentiment momentum
- ❌ Slow to react to changes

**Why EMA?**
- ✅ Weights recent data more heavily (natural decay)
- ✅ Computationally efficient
- ✅ Industry standard for time-series analysis
- ✅ Smooth yet responsive

**EMA Formula**:
```
EMA_today = (Price_today × α) + (EMA_yesterday × (1 - α))

where α = smoothing factor (2 / (N + 1))
N = number of periods

Example for 24-hour EMA: α = 2/(24+1) = 0.08
```

---

### **Proposed Architecture**

```typescript
// 1. Store Raw Scores (Every article analysis)
interface RawSentimentScore {
  timestamp: number;
  symbol: string;
  sentiment: number;        // -1 to +1
  confidence: number;
  articleCount: number;     // Volume metric
  source: 'distilbert' | 'gpt';
}

// 2. Calculate EMAs (Aggregated temporal features)
interface TemporalSentimentFeatures {
  symbol: string;
  date: string;

  // EMAs for different timeframes
  sentiment_EMA_1hr: number;
  sentiment_EMA_24hr: number;
  sentiment_EMA_7day: number;

  // Momentum (rate of change)
  momentum_1hr: number;
  momentum_24hr: number;
  momentum_7day: number;

  // Volume-weighted metrics
  volumeWeighted_24hr: number;

  // Meta
  calculatedAt: string;
}

// 3. Temporal Analysis Module
class TemporalSentimentAnalyzer {
  // Calculate EMA for a given window
  calculateEMA(rawScores: RawSentimentScore[], windowHours: number): number;

  // Calculate momentum (rate of change)
  calculateMomentum(currentEMA: number, previousEMA: number): number;

  // Detect divergence
  detectDivergence(sentiment: TemporalSentimentFeatures, price: PriceData): boolean;

  // Generate signals
  generateSignals(features: TemporalSentimentFeatures): TradingSignal;
}
```

---

### **Data Flow**

```
Step 1: Collect Raw Scores
├─ Every news article analyzed by DistilBERT
├─ Store: (timestamp, symbol, sentiment, confidence, volume)
└─ KV Key: raw_sentiment_{symbol}_{timestamp}

Step 2: Calculate Temporal Features (Scheduled)
├─ Read recent raw scores from KV
├─ Calculate EMAs: 1hr, 24hr, 7day
├─ Calculate momentum for each EMA
├─ Store aggregated features
└─ KV Key: temporal_sentiment_{symbol}_{date}

Step 3: Use in Analysis
├─ Fetch temporal features for symbol
├─ Feed to dual AI as additional context
├─ Generate context-aware signals
└─ Output: Signal + rationale with temporal context
```

---

## 📈 Sentiment Momentum & Divergence

### **Sentiment Momentum (Velocity)**

**Definition**: Rate of change of sentiment EMA

**Calculation**:
```typescript
momentum_24hr = sentiment_EMA_24hr_current - sentiment_EMA_24hr_previous

Interpretation:
• momentum > 0.1  → Rapidly improving (bullish acceleration)
• momentum > 0    → Improving (bullish)
• momentum = 0    → Stable
• momentum < 0    → Declining (bearish)
• momentum < -0.1 → Rapidly declining (bearish acceleration)
```

**Trading Signal**: Strong positive momentum is bullish signal in itself, independent of price

---

### **Sentiment Divergence (Reversal Signals)**

#### **Bullish Divergence** (Buy Signal)
```
Price: Making new lows (lower lows)
Sentiment EMA (24hr): Making higher lows

Interpretation: Negative sentiment losing steam
Signal: Potential bottom, consider buying
```

#### **Bearish Divergence** (Sell Warning)
```
Price: Making new highs (higher highs)
Sentiment EMA (24hr): Making lower highs

Interpretation: Positive sentiment waning
Signal: Major warning, potential top, reduce positions
```

---

## 🎯 Professional Use Cases by Timeframe

### **Scalping/Intraday Trading**
**Timeframe Focus**: 1-hour sentiment EMA + news volume

**Strategy**:
```
IF sentiment_spike_1hr > 0.3 AND news_volume_1hr > 20 articles
THEN trade_immediate_reaction()
```

**Signal**: Trade the initial shock, exit within hours

---

### **Swing Trading (2-5 days)**
**Timeframe Focus**: 24-hour EMA + momentum

**Strategy**:
```
IF sentiment_EMA_7day > 0                    # Positive narrative
AND sentiment_momentum_24hr > 0              # Daily momentum turning positive
AND sentiment_EMA_24hr crosses above 0       # Daily confirms
THEN enter_swing_long()
```

**Signal**: Weekly narrative supports, daily confirms entry

---

### **Position Trading (Weeks+)**
**Timeframe Focus**: 7-day EMA as primary filter

**Strategy**:
```
IF sentiment_EMA_7day is declining           # Weekly trend negative
THEN avoid_new_longs()                       # Don't fight the narrative

IF sentiment_EMA_7day is rising              # Weekly trend positive
THEN look_for_long_entries()                 # Align with narrative
```

**Signal**: Never fight the weekly sentiment trend

---

## 📊 Data Requirements & Update Frequencies

### **Minimum Update Frequencies**

| Timeframe | Update Frequency | Data Source | Model | Rationale |
|-----------|-----------------|-------------|-------|-----------|
| **Intraday** | Every 15-30 min | News API | DistilBERT | Catch breaking news quickly |
| **Daily** | 4x per day ✅ | News API | DistilBERT | Current schedule works |
| **Weekly** | 1x per day | Aggregated | GPT-OSS-120B | Daily update builds weekly EMA |

**Good News**: We don't need expensive real-time news firehose. High-frequency batching (15-30 min) is extremely effective!

### **Storage Requirements**

```
Raw Scores Storage:
├─ Keep for 7 days (to calculate weekly EMA)
├─ ~100 articles/day × 5 symbols = 500 scores/day
├─ 7 days × 500 = 3,500 raw scores
└─ Minimal KV storage (~1MB total)

Temporal Features Storage:
├─ Keep for 30 days (historical analysis)
├─ 1 record per symbol per day × 5 symbols = 5 records/day
├─ 30 days × 5 = 150 feature records
└─ Minimal KV storage (~100KB total)
```

**Feasibility**: ✅ **VERY HIGH** - Minimal storage, existing KV infrastructure sufficient

---

## 🎨 Signal Generation Across Timeframes

### **Alignment Signals (Trend Following)**

```typescript
// Example: All timeframes align bullish
if (
  sentiment_EMA_7day > 0 &&                    // Weekly narrative positive
  sentiment_EMA_24hr > 0 &&                    // Daily positive
  sentiment_EMA_24hr crosses above 0 &&        // Daily just turned positive
  sentiment_momentum_24hr > 0.05               // Strong positive momentum
) {
  return {
    signal: 'STRONG_BUY',
    confidence: 0.9,
    rationale: 'All timeframes aligned bullish with strong momentum'
  };
}
```

### **Divergence Signals (Reversal/Warning)**

```typescript
// Example: Bearish divergence
if (
  price_change_24hr > 5% &&                    // Price making new highs
  sentiment_momentum_24hr < -0.05              // But sentiment declining
) {
  return {
    signal: 'WARNING',
    confidence: 0.8,
    rationale: 'Bearish divergence: Price up but sentiment declining'
  };
}
```

### **Timeframe Weighting Strategy**

**Feed full term structure to GPT-OSS-120B**:
```typescript
const sentimentContext = {
  raw_sentiment: 0.6,              // Current raw score
  sentiment_EMA_1hr: 0.5,          // Intraday reaction
  sentiment_EMA_24hr: 0.4,         // Daily confirmation
  sentiment_EMA_7day: 0.3,         // Weekly narrative
  momentum_24hr: 0.1,              // Daily momentum
  news_volume_24hr: 45             // Volume metric
};

// GPT analyzes the FULL context, not just a single static score
const analysis = await gpt.analyze(sentimentContext);
```

**Advantage**: GPT learns the temporal relationships and weights them intelligently based on market conditions

---

## 🔗 Integration with Sector Analysis & Market Drivers

### **Sector-Level Temporal Sentiment**

Apply same methodology to **aggregate sector sentiment**:

```typescript
// Calculate temporal sentiment for entire sector
const techSectorSentiment = {
  sentiment_EMA_24hr: aggregateSymbols(['AAPL', 'MSFT', 'NVDA', 'GOOGL']),
  momentum_24hr: calculateSectorMomentum('Technology'),
  newsVolume: aggregateSectorNews('Technology')
};

// Use as stock-level feature
if (techSector.momentum_24hr > 0.1) {
  // Tech sector has positive momentum - tailwind for tech stocks
  increaseConfidence(techStockSignals);
}
```

### **Market Regime + Temporal Sentiment**

```typescript
// Context-aware signal generation
const generateSignal = (stock, marketRegime, temporalSentiment) => {

  // Risk-Off + Negative sentiment momentum = Strong sell
  if (marketRegime === 'risk_off' && temporalSentiment.momentum_24hr < -0.1) {
    return { signal: 'STRONG_SELL', confidence: 0.95 };
  }

  // Risk-On + Positive sector momentum + Positive stock sentiment = Strong buy
  if (
    marketRegime === 'risk_on' &&
    sectorSentiment.momentum_24hr > 0.1 &&
    temporalSentiment.sentiment_EMA_24hr > 0.5
  ) {
    return { signal: 'STRONG_BUY', confidence: 0.9 };
  }

  // Context-aware weighting
};
```

---

## ✅ Implementation Summary

### **Phase 1: Foundation (Week 1)**
1. ✅ Update `kv-key-factory.ts` with new key types
2. ✅ Create `sentiment-aggregator.ts` module
3. ✅ Implement EMA calculation functions
4. ✅ Set up raw score storage

### **Phase 2: Temporal Features (Week 2)**
1. Calculate 1hr, 24hr, 7day EMAs
2. Calculate momentum for each timeframe
3. Store temporal features in KV
4. Scheduled calculation job (every 30 min)

### **Phase 3: Integration (Week 3)**
1. Feed temporal features to dual AI
2. Update signal generation logic
3. Add divergence detection
4. Enhanced recommendations with temporal context

### **Phase 4: Visualization (Week 4)**
1. Sentiment term structure charts
2. Momentum indicators
3. Divergence alerts
4. Multi-timeframe dashboards

---

## 🎯 Key Takeaways

### **✅ What We Learned**

1. **Temporal analysis is NOT just frequency** - It's about analyzing sentiment dynamics across timeframes

2. **Our models are perfect for this**:
   - DistilBERT → High-frequency (intraday, daily)
   - GPT-OSS-120B → Deep context (weekly narrative)

3. **Professional methodology is clear**:
   - Calculate EMAs for multiple windows
   - Analyze alignment vs divergence
   - Track momentum (rate of change)
   - Use volume as conviction amplifier

4. **Implementation is feasible**:
   - ✅ No new models needed
   - ✅ No expensive real-time data required
   - ✅ Existing infrastructure supports it
   - ✅ Minimal storage requirements

5. **Synergy with other features**:
   - Works with Sector Analysis (sector-level sentiment)
   - Works with Market Drivers (regime-aware signals)
   - Enhances stock selection with rich context

---

## 🚀 Next Steps

### **Recommended Approach**

**Do NOT implement temporal sentiment in isolation**. Instead:

1. ✅ **First**: Build Sector Analysis (Weeks 1-2)
2. ✅ **Second**: Build Market Drivers (Weeks 3-4)
3. ✅ **Third**: Add Temporal Sentiment (Weeks 5-6)

**Why This Order**:
- Temporal sentiment provides the MOST value when combined with sector and market context
- "Stock sentiment improving" is good
- "Stock sentiment improving + Sector positive + Risk-On regime" is ALPHA

### **Final Architecture**

```
Market Regime Detection
         ↓
Sector Analysis (with temporal sentiment)
         ↓
Stock Selection (with multi-timeframe sentiment context)
         ↓
= Institutional-Grade Intelligence Platform
```

---

**Last Updated**: 2025-10-01
**Strategic Guidance**: Gemini AI Analysis
**Status**: Ready for implementation after Phase 1 & 2 complete

---

## 📚 Additional Resources

**Key Concepts**:
- Alpha Decay: News impact diminishes over time
- Sentiment Term Structure: Multi-timeframe sentiment analysis
- EMA (Exponential Moving Average): Industry-standard aggregation
- Sentiment Divergence: Price vs sentiment misalignment (reversal signal)
- Sentiment Momentum: Rate of change in sentiment (acceleration)

**Professional Standards**:
- Timeframe alignment = High conviction signals
- Timeframe divergence = Warning/reversal signals
- Volume × Sentiment = True conviction measure
- Context-aware signals > Single-timeframe signals