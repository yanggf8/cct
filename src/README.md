# TFT Trading System - Source Code Organization

This directory contains all source code for the 95+/100 optimized Cloudflare Worker-based trading system.

## Directory Structure

### Core Application (`modules/`)
Contains the main application logic modules:
- **Worker Entry**: `index.js` - Main Cloudflare Worker entry point
- **Routing**: `routes.js` - HTTP request routing and endpoint definitions
- **Modular Handlers**: `handlers/` directory with 5 domain-specific handler modules
- **Analysis**: Core trading analysis modules (`analysis.js`, `enhanced_analysis.js`, `per_symbol_analysis.js`)
- **Data Management**: `data.js` - KV storage operations and data access
- **Scheduling**: `scheduler.js` - Cron job handling and orchestration
- **Messaging**: `facebook.js` - Optimized Facebook Messenger integration
- **Web Interfaces**: `weekly-analysis.js`, `daily-summary.js`, `daily-summary-page.js`
- **Utilities**: `timezone-utils.js`, `backfill.js`, `logging.js`, `sentiment_utils.js`

### Advanced Optimization Modules (`modules/`)
Enterprise-grade optimization modules (95+/100 quality):
- **Configuration**: `config.js` - Centralized configuration management, eliminates magic numbers
- **Handler Factory**: `handler-factory.js` - Standardized handler creation with automatic monitoring
- **Response Factory**: `response-factory.js` - Consistent API response formatting with metadata
- **Enhanced Monitoring**: `monitoring.js` - Business KPI tracking with real-time dashboard generation
- **Testing**: `test-optimization-endpoint.js` - Comprehensive verification endpoints

### Static Assets (`static/`)
HTML templates for web dashboards:
- `daily-summary.html` - Daily analysis dashboard template
- `weekly-analysis.html` - Weekly analysis dashboard template


### Data (`data/`)
Data storage and tracking files:
- `prediction_tracking.json` - Historical prediction tracking


### Utilities (`utils/`)
Standalone utility scripts:
- Facebook webhook utilities
- Error handling utilities
- Messaging utilities

## Deployment

The system deploys as a Cloudflare Worker with entry point `src/index.js` as configured in `wrangler.toml`.

## Development

All Cloudflare Worker source code is contained within this `src/` directory, providing clear separation between:
- Production application code (`modules/`)
- Static assets (`static/`)
- Historical data (`data/`)
- Development utilities (`utils/`)

The system uses Cloudflare AI models (GPT-OSS-120B, DistilBERT) eliminating the need for custom model training or configuration files.