# 📖 User Guide - Dual AI Sentiment Analysis System

**Updated**: 2025-10-03
**System**: A+ (99/100) Production Ready
**Access**: https://tft-trading-system.yanggf.workers.dev/

## 🎯 Welcome to Your Professional Sentiment Analysis Dashboard

The Dual AI Sentiment Analysis System provides **institutional-grade market intelligence** through advanced AI sentiment comparison. Our system combines two powerful AI models to deliver transparent, actionable insights for informed decision-making.

### **What Makes Our System Different**

- **🤖 Dual AI Comparison**: GPT-OSS-120B + DistilBERT-SST-2 for comprehensive analysis
- **📊 4 Moment Analysis**: Complete daily workflow from pre-market to weekly review
- **🎯 High-Confidence Focus**: ≥70% threshold filtering for actionable signals
- **🏠 Professional Dashboard**: Modern interface accessible on all devices
- **📱 Mobile Optimized**: Touch-friendly design for on-the-go analysis

---

## 🚀 Getting Started

### **1. Access Your Dashboard**

**🌐 Live Dashboard**: [https://tft-trading-system.yanggf.workers.dev/](https://tft-trading-system.yanggf.workers.dev/)

The dashboard is your central hub for:
- **Real-time System Status**: AI model health and analysis availability
- **Quick Access Links**: Direct navigation to all 4 analysis moments
- **Mobile-Friendly Interface**: Works seamlessly on desktop and mobile devices

### **2. Set Your Timezone**

- Open **⚙️ Settings** in the left nav (`/settings.html`) to choose your preferred IANA timezone.
- The setting is stored in the Cache Durable Object and becomes the default “today” for all reports; `?tz=` still overrides, and ET is the fallback if no setting exists.
- Report schedules remain keyed to ET (e.g., pre-market at 8:30 AM ET) but the date being requested follows your saved timezone, so “today” aligns with your local day.

### **3. Understanding the 4 Moment Analysis System**

Our system delivers comprehensive sentiment insights through four specialized reports:

```
🌅 Morning (8:30 AM) → 📊 Midday (12:00 PM) → 🌆 Evening (4:05 PM) → 🔍 Weekly (Sunday 10:00 AM)
    ↓                        ↓                        ↓                         ↓
Pre-Market Briefing    Intraday Check        End-of-Day Summary      Weekly Review
```

#### **📊 Analysis Report Overview**

| Report | Time | Purpose | Key Insights |
|--------|------|---------|--------------|
| **Pre-Market Briefing** | 8:30 AM | Morning preparation | High-confidence signals (≥70%) |
| **Intraday Check** | 12:00 PM | Performance tracking | Real-time signal validation |
| **End-of-Day Summary** | 4:05 PM | Market close analysis | Daily performance + tomorrow outlook |
| **Weekly Review** | Sunday 10:00 AM | Pattern analysis | Comprehensive weekly trends |

---

## 🤖 Understanding Dual AI Sentiment Analysis

### **The Power of Two AI Models**

Our system uses **two complementary AI approaches** for comprehensive sentiment analysis:

#### **🧠 GPT-OSS-120B: Contextual Analysis**
- **Approach**: Natural language reasoning with market context
- **Strength**: Understands complex market narratives and news sentiment
- **Processing**: Analyzes 8 articles simultaneously for holistic insights
- **Output**: Contextual sentiment with detailed reasoning

#### **⚡ DistilBERT-SST-2: Precise Classification**
- **Approach**: Fast statistical sentiment classification
- **Strength**: High-accuracy sentiment scoring with confidence metrics
- **Processing**: Analyzes 10 articles individually for precise patterns
- **Output**: Statistical sentiment with confidence percentages

### **🎯 Agreement Logic: Transparent Decision Making**

Our system doesn't hide behind complex algorithms. We use **simple, transparent agreement logic**:

| Agreement Type | Signal | Confidence | Recommendation |
|----------------|--------|------------|----------------|
| **AGREE** | Both models same direction | HIGH | Strong conviction |
| **PARTIAL_AGREE** | Mixed signals | MEDIUM | Moderate confidence |
| **DISAGREE** | Opposite directions | LOW | Avoid or wait |

### **📊 Signal Strength Interpretation**

#### **🟢 Strong Positive Signals**
- **Agreement**: Both models indicate bullish sentiment
- **Confidence**: ≥70% threshold
- **Interpretation**: High-confidence positive sentiment
- **Action**: Consider positive sentiment insights

#### **🔴 Strong Negative Signals**
- **Agreement**: Both models indicate bearish sentiment
- **Confidence**: ≥70% threshold
- **Interpretation**: High-confidence negative sentiment
- **Action**: Consider negative sentiment insights

#### **🟡 Mixed Signals**
- **Agreement**: Partial agreement or disagreement
- **Confidence**: <70% threshold
- **Interpretation**: Conflicting sentiment indicators
- **Action**: Wait for clarity or additional confirmation

---

## 📋 Accessing Your Analysis Reports

### **🏠 From the Professional Dashboard**

1. **Visit**: [https://tft-trading-system.yanggf.workers.dev/](https://tft-trading-system.yanggf.workers.dev/)
2. **Navigate**: Click on any report card in the dashboard
3. **Explore**: Each report provides detailed analysis and insights

### **📊 Direct Report Access**

#### **🌅 Pre-Market Briefing**
**URL**: `/pre-market-briefing`
**Best Time**: After 8:30 AM on weekdays
**Content**: High-confidence sentiment signals for market preparation

**What You'll Find**:
- Top 3 high-confidence sentiment insights
- Symbol-specific analysis with confidence scores
- Bullish/bearish sentiment distribution
- Interactive confidence visualizations
- If a day's report isn't ready yet, you'll see a yellow stale warning showing the source date of the fallback data and the scheduled ET generation time.

#### **📈 Intraday Check**
**URL**: `/intraday-check`
**Best Time**: After 12:00 PM on weekdays
**Content**: Real-time performance tracking of morning predictions

**What You'll Find**:
- Morning signal performance validation
- Signal divergence analysis
- Model health monitoring
- Real-time accuracy tracking

#### **🌆 End-of-Day Summary**
**URL**: `/end-of-day-summary`
**Best Time**: After 4:05 PM on weekdays
**Content**: Market close analysis with tomorrow's outlook

**What You'll Find**:
- Daily sentiment performance summary
- Signal accuracy breakdown
- Top performing symbols
- Tomorrow's market outlook and bias

#### **🔍 Weekly Review**
**URLs**:
- `/weekly-review` (this week)
- `/weekly-review?week=last` (last week)
- `/weekly-review?week=YYYY-MM-DD` (specific week; any date within the week)
**Best Time**: After 10:00 AM on Sundays
**Content**: Comprehensive weekly pattern analysis

**What You'll Find**:
- Weekly sentiment accuracy trends
- Pattern recognition and insights
- Model performance metrics
- Optimization recommendations

---

## 🎨 Dashboard Features and Navigation

### **🏠 Main Dashboard Interface**

The professional dashboard provides an **elegant, intuitive interface** with:

#### **📊 System Status Cards**
- **AI Model Health**: Real-time status of GPT-OSS-120B and DistilBERT-SST-2
- **Last Analysis**: Timestamp of most recent sentiment analysis
- **System Performance**: Overall system health indicators

#### **🚀 Quick Navigation**
- **Report Cards**: Direct links to all 4 analysis reports
- **Mobile Touch-Friendly**: Optimized for both desktop and mobile devices
- **Real-time Updates**: Dynamic status indicators

#### **📱 Responsive Design**
- **Desktop**: Full-featured interface with detailed information
- **Tablet**: Optimized layout for medium screens
- **Mobile**: Touch-friendly interface with essential features

### **🔧 Interactive Features**

#### **📊 Chart Visualizations**
- **Chart.js Integration**: Interactive charts for data visualization
- **Confidence Metrics**: Visual representation of sentiment confidence
- **Performance Trends**: Historical accuracy and trend analysis

#### **🔄 Real-time Updates**
- **Live Status**: Real-time system health monitoring
- **Auto-refresh**: Automatic content updates
- **Performance Metrics**: Live system performance indicators

---

## 📖 Interpreting Your Sentiment Analysis

### **🎯 Understanding Confidence Scores**

Our system uses **confidence thresholds** to ensure actionable insights:

#### **🟢 High Confidence (≥70%)**
- **Interpretation**: Strong agreement between AI models
- **Reliability**: High confidence in sentiment direction
- **Actionability**: Most reliable signals for consideration

#### **🟡 Medium Confidence (50-69%)**
- **Interpretation**: Partial agreement or mixed signals
- **Reliability**: Moderate confidence with some uncertainty
- **Actionability**: Consider with additional confirmation

#### **🔴 Low Confidence (<50%)**
- **Interpretation**: Disagreement between models or weak signals
- **Reliability**: Low confidence with high uncertainty
- **Actionability**: Avoid or wait for additional clarity

### **📊 Sentiment Signal Types**

#### **📈 Positive Sentiment**
- **Indicators**: Bullish market sentiment, positive news coverage
- **AI Agreement**: Both models detect positive sentiment patterns
- **Market Context**: Favorable conditions and positive developments

#### **📉 Negative Sentiment**
- **Indicators**: Bearish market sentiment, negative news coverage
- **AI Agreement**: Both models detect negative sentiment patterns
- **Market Context**: Challenging conditions and negative developments

#### **➖ Neutral Sentiment**
- **Indicators**: Mixed or balanced sentiment, unclear direction
- **AI Agreement**: Models disagree or detect neutral patterns
- **Market Context**: Uncertain conditions or balanced factors

---

## ⏰ Analysis Schedule and Timing

### **📅 Daily Analysis Schedule**

| Time | Report | Purpose | Market Context |
|------|--------|---------|----------------|
| **8:30 AM ET** | Pre-Market Briefing | Market preparation | Before market open |
| **12:00 PM ET** | Intraday Check | Performance validation | Mid-day trading |
| **4:05 PM ET** | End-of-Day Summary | Market close analysis | After market close |
| **Sunday 10:00 AM ET** | Weekly Review | Pattern analysis | Weekend review |

### **🌍 Market Hours and Timing**

- **Eastern Time (ET)**: All schedules based on US Eastern Time
- **Market Hours**: 9:30 AM - 4:00 PM ET (Weekdays)
- **After-Hours**: Analysis continues for comprehensive coverage
- **Weekend**: Weekly review for pattern recognition

### **📊 Data Freshness**

- **Real-time Analysis**: AI models process latest market data
- **News Integration**: Current news articles and market developments
- **Historical Context**: Patterns compared to historical data
- **Cache Updates**: 5-minute TTL for optimal performance

---

## 🔧 Troubleshooting and Support

### **🔍 Common Questions**

#### **Q: How often is the analysis updated?**
**A**: Analysis runs on a fixed schedule:
- Pre-Market: 8:30 AM ET (weekdays)
- Intraday: 12:00 PM ET (weekdays)
- End-of-Day: 4:05 PM ET (weekdays)
- Weekly: Sunday 10:00 AM ET

#### **Q: What does "high confidence" mean?**
**A**: High confidence (≥70%) indicates strong agreement between both AI models, suggesting more reliable sentiment signals.

#### **Q: How should I interpret conflicting signals?**
**A**: Conflicting signals (DISAGREEMENT) suggest uncertainty in market sentiment. Consider waiting for additional clarity or using multiple data sources.

#### **Q: Is the system accessible on mobile devices?**
**A**: Yes! The professional dashboard is fully responsive and optimized for all devices, including smartphones and tablets.

### **🚨 System Status**

#### **✅ System Health Check**
- **URL**: `/health`
- **Purpose**: Verify system operational status
- **Information**: AI model health, last analysis time, system metrics

#### **🔧 Getting Help**

**System Status**: Check the dashboard for real-time system health
**Technical Issues**: System automatically logs and monitors performance
**Analysis Questions**: Refer to the interpretation guides in each report

---

## 📚 Advanced Features

### **🔍 Deep Analysis Capabilities**

#### **📊 Symbol-Specific Analysis**
- **Individual Symbols**: Detailed sentiment analysis per symbol
- **Comparative Analysis**: Relative sentiment strength comparison
- **Historical Trends**: Sentiment patterns over time

#### **🤖 AI Model Transparency**
- **Side-by-Side Comparison**: See both AI models' outputs
- **Confidence Metrics**: Detailed confidence scoring
- **Reasoning Explanations**: Natural language insights from GPT model

#### **📈 Performance Tracking**
- **Accuracy Metrics**: Historical accuracy tracking
- **Signal Performance**: How well predictions performed
- **Model Health**: AI model performance monitoring

### **🔮 Future Enhancements**

#### **🌐 Browser Push Notifications** (Next Priority)
- **Chrome Integration**: Native browser notifications
- **Instant Alerts**: Real-time sentiment insights
- **Background Delivery**: Service worker for offline capability

#### **📊 Advanced Analytics** (Future)
- **Sector Analysis**: Broader market sentiment patterns
- **Market Drivers**: Macro-level sentiment indicators
- **Temporal Analysis**: Multi-timeframe sentiment dynamics

---

## 🎯 Best Practices

### **📖 Getting the Most Value**

#### **🔄 Regular Review**
- **Daily Check**: Review all 4 reports for comprehensive insights
- **Pattern Recognition**: Identify trends over time
- **Context Understanding**: Consider broader market conditions

#### **🎯 Focus on High-Confidence Signals**
- **Priority**: ≥70% confidence signals are most reliable
- **Validation**: Use multiple timeframes for confirmation
- **Risk Management**: Consider confidence levels in decision-making

#### **📊 Holistic Analysis**
- **Multiple Reports**: Use all 4 analysis types for complete picture
- **Market Context**: Consider overall market conditions
- **Historical Patterns**: Compare to historical performance

### **⚠️ Important Considerations**

#### **🎯 Educational Purpose**
- **Analysis Tool**: System provides sentiment analysis and insights
- **Informational**: Content is for educational and informational purposes
- **Decision Support**: Use as one component of comprehensive analysis

#### **📊 Market Conditions**
- **Dynamic Markets**: Sentiment can change rapidly
- **External Factors**: Consider news, events, and market conditions
- **Multiple Sources**: Use various information sources for complete picture

#### **🔧 System Limitations**
- **AI Analysis**: Based on available data and algorithms
- **Historical Performance**: Past results don't indicate future performance
- **Market Volatility**: Unpredictable market movements may occur

---

## 📞 Quick Reference

### **🌐 Important Links**

- **🏠 Main Dashboard**: [https://tft-trading-system.yanggf.workers.dev/](https://tft-trading-system.yanggf.workers.dev/)
- **📊 Pre-Market Briefing**: `/pre-market-briefing`
- **📈 Intraday Check**: `/intraday-check`
- **🌆 End-of-Day Summary**: `/end-of-day-summary`
- **🔍 Weekly Review**: `/weekly-review`
- **🔧 System Health**: `/health`

### **⏰ Analysis Schedule**

- **🌅 Weekdays 8:30 AM ET**: Pre-Market Briefing
- **📊 Weekdays 12:00 PM ET**: Intraday Check
- **🌆 Weekdays 4:05 PM ET**: End-of-Day Summary
- **🔍 Sunday 10:00 AM ET**: Weekly Review

### **🎯 Key Concepts**

- **🤖 Dual AI**: GPT-OSS-120B + DistilBERT-SST-2
- **🎯 High Confidence**: ≥70% threshold for reliable signals
- **📊 4 Moment Analysis**: Complete daily sentiment workflow
- **🏠 Professional Dashboard**: Modern, mobile-friendly interface

---

## 🎉 Conclusion

The **Dual AI Sentiment Analysis System** provides **professional-grade market intelligence** through transparent AI comparison and comprehensive analysis workflows. With four detailed reports, high-confidence signal filtering, and a modern professional dashboard, you have access to sophisticated sentiment analysis tools.

### **Key Takeaways**

1. **🤖 Dual AI Approach**: Two complementary models provide comprehensive sentiment analysis
2. **🎯 High-Confidence Focus**: ≥70% threshold ensures actionable insights
3. **📊 4 Moment Workflow**: Complete daily analysis from pre-market to weekly review
4. **🏠 Professional Interface**: Modern, accessible dashboard for all devices
5. **🔍 Transparent Analysis**: Clear, understandable insights with confidence metrics

### **Next Steps**

- **📱 Bookmark the Dashboard**: Quick access to daily analysis
- **📊 Review All Reports**: Use the complete 4-tier analysis workflow
- **🎯 Focus on High Confidence**: Prioritize ≥70% confidence signals
- **📈 Track Performance**: Monitor accuracy and trends over time

---

**Last Updated**: 2025-10-03 | **System Version**: b0b04ca1-4f41-4c1a-9a98-1808e8ac7ff8

*For technical support or questions, refer to the system health endpoint or contact the development team.*
