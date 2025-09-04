# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains planning documentation for a **Cloud Stock Trading System** that uses remote GPU resources (ModelScope + Cloudflare) for AI-powered trading decisions. The project follows a validation-first approach with a 3-week POC before full implementation.

## Architecture

The system follows a hybrid cloud architecture:

### Core Components
- **ModelScope (Remote GPU)**: TFT (Primary) + N-HITS (Backup) deployment for time series prediction (15-25% better than LSTM)
- **Cloudflare AI (Edge)**: Sentiment analysis using Llama-2 for news processing  
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
- Deploy TFT + N-HITS models using https://modelscope.cn/my/modelService/deploy
- Test API latency, costs, and reliability
- **Status**: LIVE DEPLOYMENT SUCCESS - https://www.modelscope.cn/models/yanggf2/tft-primary-nhits-backup-predictor

**Week 2**: Cloudflare Workers AI validation  
- Test sentiment analysis on financial news samples
- Measure edge performance and costs

**Week 3**: Integration testing ✅ COMPLETED
- End-to-end pipeline: Yahoo Finance → TFT/N-HITS → Cloudflare → Combined signals
- Generate go/no-go decision for full system build
- **Status**: PRODUCTION READY - Live ModelScope deployment with 100% validation success rate

### Success Criteria
- **GO**: Cost <$0.15/prediction, latency <3s, reliable deployment
- **NO-GO**: Deployment failures, costs >$0.50/prediction, frequent errors

## Key Files

### Core Trading System
- `integrated_trading_system.py`: Main system upgraded to TFT Primary with N-HITS backup
- `lightweight_tft.py`: TFT implementation with Neural/Statistical modes
- `simple_nhits_model.py`: N-HITS backup model with hierarchical interpolation
- `paper_trading_tracker.py`: Complete paper trading simulation and performance tracking
- `system_monitor.py`: Production system health monitoring and alerting

### Cloudflare Worker Automation
- `cloudflare-worker-standalone.js`: **LIVE** standalone worker (https://tft-trading-system.yanggf.workers.dev)
- `cloudflare-worker-scheduler.js`: Modular version with external imports (future enhancement)
- `messenger-alerts.js`: Facebook Messenger and LINE integration functions
- `wrangler.toml`: Production deployment configuration (5 cron triggers for free plan)
- `cloudflare-worker-local-client.py`: Python client for result synchronization
- `monitoring_config.json`: Production monitoring and alert configuration

### Documentation and Guides
- `CLOUDFLARE_WORKER_DEPLOYMENT.md`: Complete Cloudflare Worker deployment guide
- `MESSENGER_SETUP_GUIDE.md`: Facebook Messenger and LINE Taiwan setup instructions
- `modelscope_integration_complete.md`: ModelScope cloud integration documentation
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

**CLOUD-NATIVE ARCHITECTURE: COMPLETED ✅**
- **Pure Cloud Deployment**: 100% cloud-native with zero local dependencies
- **Dual ModelScope Models**: TFT Primary + Dedicated N-HITS Backup (both cloud GPU)
- **Enhanced N-HITS**: Real hierarchical trend analysis replacing fake simple averaging
- **Cloudflare Edge**: Global workers with AI sentiment analysis and KV storage

**MODELSCOPE CLOUD DEPLOYMENT ✅**
- **TFT Primary**: https://www.modelscope.cn/models/yanggf2/tft-primary-nhits-backup-predictor (enhanced)
- **N-HITS Backup**: `yanggf2/nhits-hierarchical-backup` (standalone cloud model ready)
- **Enhanced Hierarchical Analysis**: Multi-scale trend decomposition (5d + 10d + 15d)
- **Honest AI Labeling**: Clear statistical vs neural network identification
- **API Ready**: ModelScope inference endpoints for both models

**CLOUDFLARE WORKERS CLOUD-NATIVE ✅**
- **Architecture**: Cloudflare Workers + ModelScope Cloud + Cloudflare AI
- **Deployment Files**: `cloudflare-worker-cloud-native.js` + `wrangler-cloud-native.toml`
- **Automated Pre-Market**: 5 cron triggers (6:30-9:00 AM EST)
- **Intelligent Fallback**: TFT → N-HITS → Statistical Edge (all cloud-based)
- **Zero Local Dependencies**: No Python, PyTorch, or neural networks needed locally
- **Global Scalability**: Cloudflare's 320+ edge locations + ModelScope auto-scaling
- **Cost Optimization**: ~$0.05/analysis vs $200-400/month local GPU
- **Security**: Environment variables, no hardcoded credentials

**DEPLOYMENT READY**
- **N-HITS Model Package**: `cloud_nhits_model/` ready for ModelScope upload
- **Enhanced TFT Model**: `enhanced_nhits_model/` ready for ModelScope update
- **Cloud Worker**: Ready for `wrangler deploy --config wrangler-cloud-native.toml`
- **Complete Documentation**: `CLOUD_NATIVE_DEPLOYMENT_GUIDE.md` with full instructions