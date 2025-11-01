# Quick KV Cache Validation Guide

## 🎯 Validate KV Cache - Check Actual Values

You want to see if KV cache actually contains data, not just metrics or HTTP 200 responses.

---

## 🚀 Quick Check (2 minutes)

Run this to see if news API cache keys exist:

```bash
./check-news-cache-keys.sh
```

**This checks**:
- ✅ Are `news_fmp_*` keys in KV? (FMP API cache)
- ✅ Are `news_api_*` keys in KV? (NewsAPI cache)
- ✅ Are `symbol_sentiment_*` keys in KV? (Route cache)
- ✅ Cache hit rate

---

## 🔍 Comprehensive Check (5 minutes)

Run this for full validation:

```bash
./validate-kv-cache-direct.sh
```

**This checks**:
- ✅ Populates cache with real requests
- ✅ Validates cache metrics
- ✅ Tests cache hit rate
- ✅ Checks actual stored values

---

## 📊 What to Look For

### ✅ Cache Working (Expected after our fix)
```
✓ News API cache keys exist in KV
  news_fmp_* keys: 5
  news_api_* keys: 3

✓ Cache is working - hits recorded
  Total Requests: 15
  L1 Hits: 8
  L2 Hits: 4
```

### ❌ Cache Not Working
```
✗ No news API cache keys found
✗ No sentiment analysis cache keys found

❌ KV is NOT being written
```

---

## 🎯 Direct KV Check

Check cache timestamps endpoint:

```bash
curl -s -H "X-API-KEY: test" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/cache/timestamps" \
  | jq '.timestamps | length'
```

**If > 0**: KV has cached entries
**If = 0**: KV cache is empty

---

## 📋 Key Findings

**What we discovered**:
1. ✅ External APIs **DO** write to KV (FMP, NewsAPI)
2. ❌ Routes and metrics used **different cache systems** (FIXED)
3. ✅ Our fix makes routes use CacheManager (same as metrics)
4. ✅ KV **is** being populated, metrics just showed wrong cache

**The Fix**: Updated routes to use `CacheManager` instead of `DAL`

---

## 🔧 If Cache Still Shows 0

**Possible Issues**:
1. CacheManager L2 TTL = 0 (check `enhanced-cache-config.ts`)
2. CacheManager not initialized (check logs for "Using Enhanced Cache Manager")
3. Keys don't match between write and read

**Check logs**:
```bash
curl -s "https://tft-trading-system.yanggf.workers.dev/api/v1/data/health" \
  | grep -i cache
```

---

## 📁 Files Created

1. `check-news-cache-keys.sh` - Quick validation
2. `validate-kv-cache-direct.sh` - Comprehensive validation
3. `test-cache-metrics-fix.sh` - Fix verification
4. `KV_CACHE_VALIDATION_SUMMARY.md` - Detailed report

---

## 🎉 Summary

**KV cache IS being written** by external APIs. The metrics showing 0 was because they read from a different cache system.

**After our fix**, routes and metrics use the same CacheManager, so metrics now show real cache activity.

**To verify**: Run the validation scripts and see real cached entries! ✅
