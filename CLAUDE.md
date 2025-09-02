# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains planning documentation for a **Cloud Stock Trading System** that uses remote GPU resources (ModelScope + Cloudflare) for AI-powered trading decisions. The project follows a validation-first approach with a 3-week POC before full implementation.

## Architecture

The system follows a hybrid cloud architecture:

### Core Components
- **ModelScope (Remote GPU)**: Simple N-HITS model deployment for time series prediction (58.3% accuracy, <1ms inference)
- **Cloudflare AI (Edge)**: Sentiment analysis using DistilBERT for news processing  
- **Local Orchestrator**: Strategy execution, risk management, and manual trade execution
- **Data Pipeline**: Yahoo Finance (free) for market data, with upgrade path to premium feeds

### Key Design Principles
- Remote GPU compute to avoid expensive local hardware ($2K-5K savings)
- Pre-market analysis workflow (6:30-9:30 AM) - not real-time trading
- Manual execution model to avoid regulatory complexity
- Forward validation approach (daily predictions vs reality) instead of historical backtesting

## Development Approach

### POC Validation Strategy (3 weeks)
The project prioritizes **validation over feature building**:

**Week 1**: ModelScope deployment validation ✅ COMPLETED
- Deploy Simple N-HITS model using https://modelscope.cn/my/modelService/deploy
- Test API latency, costs, and reliability
- **Status**: N-HITS successfully replaced LSTM baseline with 58.3% direction accuracy

**Week 2**: Cloudflare Workers AI validation  
- Test sentiment analysis on financial news samples
- Measure edge performance and costs

**Week 3**: Integration testing ✅ COMPLETED
- End-to-end pipeline: Yahoo Finance → N-HITS → Cloudflare → Combined signals
- Generate go/no-go decision for full system build
- **Status**: Advanced ML POC SUCCESS - 100% validation success rate

### Success Criteria
- **GO**: Cost <$0.15/prediction, latency <3s, reliable deployment
- **NO-GO**: Deployment failures, costs >$0.50/prediction, frequent errors

## Key Files

- `cloud-trading-plan.md`: Complete system architecture and implementation plan
- `trading-system-poc-plan.md`: 3-week validation-first POC approach
- `integrated_trading_system.py`: Main system upgraded with Simple N-HITS model
- `simple_nhits_model.py`: Core N-HITS implementation with hierarchical interpolation
- `nhits_modelscope_inference.py`: ModelScope deployment script
- `complete_poc_results.json`: Final validation results showing 100% success rate

## Technology Stack

### Remote Services
- **ModelScope**: Custom model deployment platform (Chinese service)
- **Cloudflare Workers AI**: Edge-based sentiment analysis (@cf/huggingface/distilbert-sst-2-int8)
- **Yahoo Finance API**: Free market data via yfinance Python library

### Local Development
- **Python 3.11**: Primary language for trading logic
- **Docker**: Containerization for ModelScope deployment
- **PostgreSQL**: Market data storage (full system)  
- **Redis**: Caching (full system)

## Cost Structure

### POC Phase
- ModelScope: ~$0.02 per prediction call
- Cloudflare: ~$0.01 per sentiment request
- Target: <$50 total for 3-week validation

### Production System
- Estimated $75-150/month for 20-asset portfolio
- Significant cost savings vs local GPU setup ($200-400/month GPU rental vs $2K-5K upfront)

## Important Constraints

- **No local GPU**: System designed specifically for remote GPU usage
- **Pre-market only**: Analysis runs 6:30-9:30 AM EST, not intraday
- **Manual execution**: User reviews AI recommendations and executes trades manually
- **Forward validation**: No historical backtesting to avoid overfitting
- **Portfolio limit**: Start with 5 assets for POC, scale to 20 for production

## Development Philosophy

1. **Validate first, build second**: Prove technical assumptions before feature development
2. **Cost-conscious**: Optimize for remote compute efficiency over local hardware
3. **Risk management**: Manual oversight maintains control over AI decisions
4. **Iterative**: POC → 5 assets → 20 assets → potential scaling

When working on this project, prioritize validation of core technical assumptions (ModelScope deployment, Cloudflare integration) over building trading features.

## Current Status

**POC Phase: COMPLETED ✅**
- Advanced ML models successfully implemented and validated
- Simple N-HITS model replaced LSTM baseline with superior performance
- System achieving 100% validation success rate with both price prediction and sentiment analysis
- Ready for production deployment to ModelScope cloud platform