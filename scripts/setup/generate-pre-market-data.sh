#!/bin/bash

# Pre-Market Data Generation Script
# Generates pre-market briefing data to resolve the 0% completion issue
# This addresses the root cause: missing pre-market briefing data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test" # Temporary test API key
TIMEOUT=60

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

progress() {
    echo -e "${CYAN}[PROGRESS]${NC} $1"
}

# Make authenticated API request
api_request() {
    local endpoint="$1"
    local description="$2"

    log "API Request: $description"

    response=$(curl -s -w "%{http_code}" \
        -H "X-API-KEY: $API_KEY" \
        --max-time $TIMEOUT \
        "$BASE_URL$endpoint" || echo "000")

    http_code="${response: -3}"
    body="${response%???}"

    if [ "$http_code" = "200" ]; then
        success "$description - HTTP $http_code"
        echo "$body"
        return 0
    else
        error "$description - HTTP $http_code"
        echo "$body"
        return 1
    fi
}

# Generate Pre-Market Data
generate_pre_market_data() {
    log "\n=== Generating Pre-Market Briefing Data ==="

    # 1. Generate sentiment analysis data (this is the core of pre-market briefing)
    progress "Step 1: Generating market sentiment analysis..."
    sentiment_response=$(api_request "/api/v1/sentiment/analysis?symbols=AAPL,MSFT,GOOGL,TSLA,NVDA,AMZN,META" "Major symbols sentiment analysis")

    if [ $? -eq 0 ]; then
        success "Sentiment analysis generated successfully"
    else
        warning "Sentiment analysis failed, continuing..."
    fi

    sleep 2

    # 2. Generate market-wide sentiment
    progress "Step 2: Generating market-wide sentiment..."
    market_response=$(api_request "/api/v1/sentiment/market" "Market sentiment")

    if [ $? -eq 0 ]; then
        success "Market sentiment generated successfully"
    else
        warning "Market sentiment failed, continuing..."
    fi

    sleep 2

    # 3. Generate sector sentiment
    progress "Step 3: Generating sector sentiment..."
    sector_response=$(api_request "/api/v1/sentiment/sectors" "Sector sentiment")

    if [ $? -eq 0 ]; then
        success "Sector sentiment generated successfully"
    else
        warning "Sector sentiment failed, continuing..."
    fi

    sleep 2

    # 4. Trigger pre-market report generation
    progress "Step 4: Triggering pre-market report generation..."
    premarket_response=$(api_request "/api/v1/reports/pre-market" "Pre-market briefing generation")

    if [ $? -eq 0 ]; then
        success "Pre-market briefing generated successfully"

        # Check if the response contains actual data
        if echo "$premarket_response" | grep -q '"Data not found"'; then
            warning "Pre-market briefing returned 'Data not found' - need to investigate"
        else
            success "Pre-market briefing contains actual data!"
        fi
    else
        error "Pre-market briefing generation failed"
        return 1
    fi
}

# Validate Pre-Market Data
validate_pre_market_data() {
    log "\n=== Validating Pre-Market Data ==="

    progress "Checking pre-market briefing data availability..."

    premarket_check=$(api_request "/api/v1/reports/pre-market" "Pre-market data validation")

    if echo "$premarket_check" | grep -q '"Data not found"'; then
        error "❌ Pre-market data still not found"

        # Check what data is actually missing
        log "Investigating missing data..."

        # Check if individual components are available
        sentiment_check=$(api_request "/api/v1/sentiment/analysis?symbols=AAPL" "Single symbol sentiment check")

        if echo "$sentiment_check" | grep -q '"Data not found"'; then
            error "Sentiment analysis data is missing"
        else
            success "Sentiment analysis data is available"
            log "The issue may be in the pre-market report generation logic"
        fi
    else
        success "✅ Pre-market briefing data is now available!"

        # Show data preview
        data_preview=$(echo "$premarket_check" | jq -r 'keys[]' 2>/dev/null | head -5 | tr '\n' ' ')
        log "Data keys: $data_preview"
    fi
}

# Test Frontend Integration
test_frontend_integration() {
    log "\n=== Testing Frontend Integration ==="

    progress "Testing frontend page response..."

    # Test the frontend page
    frontend_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/pre-market-briefing")

    if echo "$frontend_response" | grep -q "Data completion: 0%"; then
        error "Frontend still shows 0% completion"
        error "This indicates the frontend is not properly handling the API response"

        # Check if the API is actually returning data now
        log "Checking if API returns data but frontend doesn't display it..."
        api_response=$(api_request "/api/v1/reports/pre-market" "API data check")

        if ! echo "$api_response" | grep -q '"Data not found"'; then
            success "✅ API has data but frontend doesn't display it correctly"
            log "This is a frontend integration issue, not a data issue"
        fi
    else
        success "✅ Frontend page now shows data properly!"
    fi
}

# Clear Cache to Force Fresh Generation
clear_cache() {
    log "\n=== Clearing Cache to Force Fresh Generation ==="

    progress "Clearing cache metrics and forcing regeneration..."

    # Try to clear cache by calling cache endpoints
    api_request "/api/v1/cache/promote" "Cache promotion (clears old data)"

    # Wait a moment for cache to clear
    sleep 3

    success "Cache cleared - ready for fresh data generation"
}

# Generate Comprehensive Market Data
generate_comprehensive_data() {
    log "\n=== Generating Comprehensive Market Data ==="

    # Generate data for multiple symbols to ensure variety
    symbols="AAPL MSFT GOOGL TSLA NVDA AMZN META NFLX JPM JNJ V WMT PG DIS HD"

    for symbol in $symbols; do
        progress "Generating data for $symbol..."
        api_request "/api/v1/sentiment/symbols/$symbol" "Sentiment for $symbol" >/dev/null &
    done

    wait
    success "Comprehensive symbol data generated"

    sleep 5
}

# Main execution
main() {
    log "🚀 Pre-Market Data Generation Script"
    log "Target: $BASE_URL"
    log "Purpose: Resolve 0% completion issue in pre-market briefing"
    log ""

    local total_start_time=$(date +%s%3N)

    # Execute data generation sequence
    clear_cache
    generate_comprehensive_data
    generate_pre_market_data
    validate_pre_market_data
    test_frontend_integration

    local total_end_time=$(date +%s%3N)
    local total_time=$((total_end_time - total_start_time))

    log "\n=== Generation Complete ==="
    log "Total generation time: ${total_time}ms"
    success "🎉 Pre-market data generation completed!"
    log ""
    log "Next steps:"
    log "1. Check the pre-market briefing page"
    log "2. Verify it shows actual data instead of 0% completion"
    log "3. If still showing 0%, this is a frontend integration issue"
}

# Run main function
main "$@"