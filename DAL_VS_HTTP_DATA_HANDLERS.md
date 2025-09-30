# DAL vs HTTP Data-Handlers: Key Differences

**Created**: 2025-09-30

## Overview

This document explains the fundamental differences between the Data Access Layer (DAL) and Data Handlers in our architecture.

## Quick Summary

| Aspect | DAL (`dal.ts`) | HTTP Data-Handlers (`http-data-handlers.js`) |
|--------|----------------|-------------------------------------|
| **Layer** | Data/Storage Layer | HTTP/Presentation Layer |
| **Purpose** | Low-level KV operations | HTTP request handling |
| **Returns** | Data objects | HTTP Response objects |
| **Type** | TypeScript (type-safe) | JavaScript |
| **Responsibility** | Database access | Request/response logic |
| **Usage** | Used BY handlers | Uses DAL internally |

## Detailed Comparison

### 1. DAL (Data Access Layer) - `src/modules/dal.ts`

**Purpose**: Low-level data storage abstraction

**Responsibilities**:
- ✅ Direct KV storage operations (read, write, delete, list)
- ✅ Automatic retry logic (3 attempts, exponential backoff)
- ✅ JSON parsing/stringifying automation
- ✅ Type-safe data operations (TypeScript interfaces)
- ✅ Consistent error handling
- ✅ KV Key Factory integration
- ✅ Logging and monitoring

**What it does**:
```typescript
// DAL provides low-level data access
const dal = createDAL(env);

// Read data from KV
const result = await dal.read('analysis_2025-09-30');
// Returns: { success: true, data: {...}, key: '...', source: 'kv' }

// Write data to KV
const writeResult = await dal.write('analysis_2025-09-30', analysisData);
// Returns: { success: true, key: '...' }
```

**Key Features**:
- **Retry Logic**: Automatic retry with exponential backoff (1s, 3s, 10s)
- **Type Safety**: Full TypeScript interfaces for all data structures
- **Consistent API**: Same interface for all KV operations
- **Error Handling**: Structured error responses with `success` flag
- **Automatic Parsing**: JSON handled automatically

**Does NOT**:
- ❌ Handle HTTP requests
- ❌ Return HTTP responses
- ❌ Validate request parameters
- ❌ Format responses for clients
- ❌ Handle authentication/authorization

---

### 2. HTTP Data-Handlers - `src/modules/handlers/http-data-handlers.js`

**Purpose**: HTTP request handlers for data-related endpoints

**Responsibilities**:
- ✅ Handle HTTP requests from clients
- ✅ Extract request parameters (query params, body)
- ✅ Call business logic (uses DAL, data.js, etc.)
- ✅ Format responses for HTTP clients
- ✅ Set HTTP status codes (200, 404, 500)
- ✅ Add HTTP headers
- ✅ Request logging and error handling
- ✅ Request ID generation and tracking

**What it does**:
```javascript
// Data-handler handles HTTP requests
export async function handleGetResults(request, env) {
  const requestId = crypto.randomUUID();

  try {
    // Uses DAL internally
    const dal = createDAL(env);
    const result = await dal.read(analysisKey);

    // Returns HTTP Response object
    return new Response(JSON.stringify(result.data, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Key Features**:
- **HTTP Aware**: Works with Request and Response objects
- **Business Logic**: Orchestrates multiple operations
- **Client Focused**: Formats data for API consumers
- **Error Translation**: Converts internal errors to HTTP status codes
- **Request Tracking**: Generates and tracks request IDs

**Does NOT**:
- ❌ Directly access KV storage (uses DAL instead)
- ❌ Implement retry logic (DAL handles that)
- ❌ Handle low-level data operations
- ❌ Manage storage keys or TTLs

---

## Architecture Layers

```
┌─────────────────────────────────────────┐
│         HTTP Client (Browser/API)        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   HTTP/Presentation Layer                │
│   (http-data-handlers.js)                     │
│   - Handle HTTP requests                 │
│   - Validate parameters                  │
│   - Format responses                     │
│   - Return HTTP Response objects         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Business Logic Layer                   │
│   (data.js, analysis.js, etc.)           │
│   - Application logic                    │
│   - Data processing                      │
│   - Orchestration                        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Data Access Layer (DAL)                │
│   (dal.ts)                               │
│   - KV read/write operations             │
│   - Retry logic                          │
│   - Type-safe data access                │
│   - Return data objects                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Storage (Cloudflare KV)                │
└─────────────────────────────────────────┘
```

## Usage Examples

### Example 1: Reading Analysis Data

**Using DAL (internal code)**:
```javascript
import { createDAL } from './dal.js';

const dal = createDAL(env);
const result = await dal.read('analysis_2025-09-30');

if (result.success) {
  console.log('Data:', result.data);
  // Process data...
}
```

**Using Data-Handler (HTTP endpoint)**:
```javascript
// Client makes HTTP request to /results
// GET https://tft-trading-system.yanggf.workers.dev/results

// http-data-handlers.js receives request
export async function handleGetResults(request, env) {
  const dal = createDAL(env);
  const result = await dal.read(analysisKey);

  // Returns HTTP Response
  return new Response(JSON.stringify(result.data), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Example 2: Storing Data

**DAL (low-level storage)**:
```javascript
const dal = createDAL(env);
const result = await dal.write('test_key', { foo: 'bar' }, { expirationTtl: 3600 });
// Returns: { success: true, key: 'test_key' }
```

**Data-Handler (HTTP endpoint with validation)**:
```javascript
export async function handleKVWriteTest(request, env) {
  const requestId = crypto.randomUUID();

  try {
    // Generate test data
    const testData = {
      test_type: 'write_operation',
      timestamp: new Date().toISOString()
    };

    // Use DAL for storage
    const dal = createDAL(env);
    const result = await dal.write(testKey, testData);

    if (!result.success) {
      throw new Error(`Write failed: ${result.error}`);
    }

    // Return HTTP response
    return new Response(JSON.stringify({
      success: true,
      test_key: testKey,
      request_id: requestId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## When to Use Each

### Use DAL When:
- ✅ You need to read/write data to KV storage
- ✅ You're writing internal business logic
- ✅ You need automatic retry logic
- ✅ You want type-safe data operations
- ✅ You're in data.js, scheduler.js, backfill.js, etc.

### Use HTTP Data-Handlers When:
- ✅ You're creating an HTTP endpoint
- ✅ You need to handle web requests
- ✅ You need to validate request parameters
- ✅ You need to format responses for clients
- ✅ You're adding routes to the API

### Don't Mix Concerns:
- ❌ Don't put HTTP logic in DAL
- ❌ Don't put KV operations in http-data-handlers (use DAL)
- ❌ Don't return HTTP responses from DAL
- ❌ Don't access KV directly in handlers (use DAL)

## File Locations

```
src/modules/
├── dal.ts                          # Data Access Layer (TypeScript)
├── dal.js                          # Compiled JavaScript (auto-generated)
├── dal-example.js                  # Usage examples
├── handlers/
│   ├── http-data-handlers.js            # HTTP handlers for data endpoints
│   ├── analysis-handlers.js        # HTTP handlers for analysis endpoints
│   ├── health-handlers.js          # HTTP handlers for health endpoints
│   └── ...                         # Other HTTP handlers
└── data.js                         # Business logic (uses DAL)
```

## Benefits of Separation

### 1. Single Responsibility Principle
- **DAL**: Only handles data storage
- **HTTP Data-Handlers**: Only handles HTTP requests
- Each has one clear purpose

### 2. Testability
- **DAL**: Can test data operations independently
- **HTTP Data-Handlers**: Can test HTTP logic independently
- Mock DAL in handler tests

### 3. Reusability
- **DAL**: Used by handlers, schedulers, background jobs
- **HTTP Data-Handlers**: Only used by HTTP routes
- DAL can be shared across different contexts

### 4. Maintainability
- Changes to storage logic → Only update DAL
- Changes to HTTP API → Only update handlers
- Clear boundaries make updates safer

### 5. Type Safety
- **DAL**: Full TypeScript with compile-time checks
- **HTTP Data-Handlers**: JavaScript but uses typed DAL
- Best of both worlds

## Real-World Example Flow

**User Request**: `GET /results`

1. **Router** receives HTTP request
2. **Data-Handler** (`handleGetResults`) is called
3. Handler creates **DAL** instance: `createDAL(env)`
4. Handler calls **DAL**: `await dal.read(analysisKey)`
5. **DAL** reads from KV with retry logic
6. **DAL** returns: `{ success: true, data: {...} }`
7. Handler formats as **HTTP Response**
8. Response sent to client

## Summary

| Component | Layer | Responsibility | Returns |
|-----------|-------|----------------|---------|
| **DAL** | Data | Storage operations | Data objects |
| **HTTP Data-Handlers** | HTTP | Request handling | HTTP Response objects |

**Key Takeaway**: DAL is the "how to store" layer, HTTP Data-Handlers is the "how to serve" layer. They work together but have completely different purposes.

---

**Related Documentation**:
- [Data Access Layer Documentation](./docs/current/DATA_ACCESS_LAYER.md)
- [DAL Migration Guide](./DAL_MIGRATION_GUIDE.md)
- [Handler Architecture](./docs/README.md#comprehensive-handler-architecture)