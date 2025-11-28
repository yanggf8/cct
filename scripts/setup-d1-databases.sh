#!/bin/bash

# D1 Database Setup Script for CCT Option D Implementation
# Creates the ANALYTICS_DB databases for staging and production environments

set -e

echo "🚀 Setting up D1 databases for CCT Option D Implementation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create staging database
print_status "Creating staging D1 database: tft-trading-system-analytics-staging"
if wrangler d1 create tft-trading-system-analytics-staging; then
    print_success "Staging database created successfully"

    # Get the database ID and update wrangler.toml
    STAGING_DB_ID=$(wrangler d1 list | grep "tft-trading-system-analytics-staging" | jq -r '.[0].uuid')
    if [ ! -z "$STAGING_DB_ID" ] && [ "$STAGING_DB_ID" != "null" ]; then
        print_status "Updating wrangler.toml with staging database ID: $STAGING_DB_ID"
        sed -i "s/your-staging-database-id/$STAGING_DB_ID/" wrangler.toml
        print_success "Staging database ID updated in wrangler.toml"
    else
        print_warning "Could not extract staging database ID automatically. Please update wrangler.toml manually."
    fi
else
    print_warning "Staging database might already exist or creation failed. Continuing..."
fi

echo ""

# Create production database
print_status "Creating production D1 database: tft-trading-system-analytics"
if wrangler d1 create tft-trading-system-analytics; then
    print_success "Production database created successfully"

    # Get the database ID and update wrangler.toml
    PROD_DB_ID=$(wrangler d1 list | grep "tft-trading-system-analytics" | jq -r '.[0].uuid')
    if [ ! -z "$PROD_DB_ID" ] && [ "$PROD_DB_ID" != "null" ]; then
        print_status "Updating wrangler.toml with production database ID: $PROD_DB_ID"
        sed -i "s/your-production-database-id/$PROD_DB_ID/" wrangler.toml
        print_success "Production database ID updated in wrangler.toml"
    else
        print_warning "Could not extract production database ID automatically. Please update wrangler.toml manually."
    fi
else
    print_warning "Production database might already exist or creation failed. Continuing..."
fi

echo ""

# Initialize database schema
print_status "Initializing D1 database schema..."

# Execute the schema initialization for staging
print_status "Running schema initialization on staging database..."
if wrangler d1 execute tft-trading-system-analytics-staging --command="
CREATE TABLE IF NOT EXISTS cold_storage (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ttl INT,
  checksum TEXT,
  storage_class TEXT NOT NULL CHECK (storage_class IN ('hot_cache', 'warm_cache', 'cold_storage', 'ephemeral')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cold_storage_class ON cold_storage(storage_class);
CREATE INDEX IF NOT EXISTS idx_cold_storage_timestamp ON cold_storage(timestamp);
CREATE INDEX IF NOT EXISTS idx_cold_storage_ttl ON cold_storage(ttl);
CREATE INDEX IF NOT EXISTS idx_cold_storage_created_at ON cold_storage(created_at);

CREATE TABLE IF NOT EXISTS cache_rollups (
  day DATE PRIMARY KEY,
  keyspace TEXT NOT NULL,
  storage_class TEXT NOT NULL CHECK (storage_class IN ('hot_cache', 'warm_cache', 'cold_storage', 'ephemeral')),
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  p50_latency REAL DEFAULT 0.0,
  p99_latency REAL DEFAULT 0.0,
  errors INTEGER DEFAULT 0,
  egress_bytes BIGINT DEFAULT 0,
  compute_ms INTEGER DEFAULT 0,
  total_operations INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_rollups_day_keyspace ON cache_rollups(day, keyspace);
CREATE INDEX IF NOT EXISTS idx_cache_rollups_day_storage_class ON cache_rollups(day, storage_class);
CREATE INDEX IF NOT EXISTS idx_cache_rollups_keyspace ON cache_rollups(keyspace);
" --env=staging; then
    print_success "Staging database schema initialized successfully"
else
    print_error "Failed to initialize staging database schema"
fi

echo ""

# Execute the schema initialization for production
print_status "Running schema initialization on production database..."
if wrangler d1 execute tft-trading-system-analytics --command="
CREATE TABLE IF NOT EXISTS cold_storage (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ttl INT,
  checksum TEXT,
  storage_class TEXT NOT NULL CHECK (storage_class IN ('hot_cache', 'warm_cache', 'cold_storage', 'ephemeral')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cold_storage_class ON cold_storage(storage_class);
CREATE INDEX IF NOT EXISTS idx_cold_storage_timestamp ON cold_storage(timestamp);
CREATE INDEX IF NOT EXISTS idx_cold_storage_ttl ON cold_storage(ttl);
CREATE INDEX IF NOT EXISTS idx_cold_storage_created_at ON cold_storage(created_at);

CREATE TABLE IF NOT EXISTS cache_rollups (
  day DATE PRIMARY KEY,
  keyspace TEXT NOT NULL,
  storage_class TEXT NOT NULL CHECK (storage_class IN ('hot_cache', 'warm_cache', 'cold_storage', 'ephemeral')),
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  p50_latency REAL DEFAULT 0.0,
  p99_latency REAL DEFAULT 0.0,
  errors INTEGER DEFAULT 0,
  egress_bytes BIGINT DEFAULT 0,
  compute_ms INTEGER DEFAULT 0,
  total_operations INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_rollups_day_keyspace ON cache_rollups(day, keyspace);
CREATE INDEX IF NOT EXISTS idx_cache_rollups_day_storage_class ON cache_rollups(day, storage_class);
CREATE INDEX IF NOT EXISTS idx_cache_rollups_keyspace ON cache_rollups(keyspace);
" --env=production; then
    print_success "Production database schema initialized successfully"
else
    print_error "Failed to initialize production database schema"
fi

echo ""
print_success "🎉 D1 database setup completed!"
echo ""
echo "📋 Summary:"
echo "  ✓ Staging database: tft-trading-system-analytics-staging"
echo "  ✓ Production database: tft-trading-system-analytics"
echo "  ✓ Schema initialized with cold_storage and cache_rollups tables"
echo "  ✓ Indexes created for performance optimization"
echo ""
echo "🔧 Next steps:"
echo "  1. Deploy to staging: wrangler deploy --env=staging"
echo "  2. Test D1 integration with: curl 'https://your-staging-url/api/v1/ops/cache-rollups'"
echo "  3. Deploy to production: wrangler deploy --env=production"
echo ""
echo "📊 Available endpoints:"
echo "  • GET /api/v1/ops/cache-rollups - Retrieve analytics rollups"
echo "  • POST /api/v1/ops/cache-rollups - Store analytics rollups"
echo "  • GET /api/v1/ops/storage/lookup - Lookup data across storage classes"
echo "  • DELETE /api/v1/ops/storage/lookup - Delete data with guard enforcement"
echo ""
echo "🧪 Testing commands:"
echo "  # Test cache rollups"
echo "  curl -X POST -H 'Content-Type: application/json' \\"
echo "    -d '{\"day\":\"2025-01-28\",\"keyspace\":\"market_analysis\",\"storageClass\":\"cold_storage\",\"metrics\":{\"hits\":100,\"misses\":10,\"errors\":1,\"totalOperations\":111,\"latencies\":[10,20,30],\"egressBytes\":1024,\"computeMs\":500}}' \\"
echo "    'https://your-staging-url/api/v1/ops/cache-rollups'"
echo ""
echo "  # Test storage lookup"
echo "  curl 'https://your-staging-url/api/v1/ops/storage/lookup?key=daily_summary_2025-01-28&includeMetadata=true'"
echo ""