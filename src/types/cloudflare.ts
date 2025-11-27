/**
 * Enhanced Cloudflare Type Definitions
 *
 * Comprehensive type definitions for Cloudflare Workers, KV, Durable Objects, and R2.
 * Replaces generic 'any' types with specific, well-defined interfaces.
 */

// ============================================================================
// Type Definitions (not global)
// ============================================================================

// Service Binding Fetcher interface
export interface Fetcher {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

// Enhanced KV Namespace interface
export interface KVNamespace {
    // Basic operations
    get(key: string, type?: 'text'): Promise<string | null>;
    get(key: string, type: 'json'): Promise<any | null>;
    get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
    get(key: string, type: 'stream'): Promise<ReadableStream | null>;

    // Batch operations
    get(keys: string[], type?: 'text'): Promise<Array<string | null>>;
    get(keys: string[], type: 'json'): Promise<Array<any | null>>;

    // Write operations
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: KVPutOptions): Promise<void>;
    put(key: string, value: any, options?: KVPutOptions): Promise<void>;

    // Delete operations
    delete(key: string): Promise<void>;
    delete(keys: string[]): Promise<void>;

    // List operations
    list(options?: KVListOptions): Promise<KVListResult>;

    // Metadata operations
    getWithMetadata(key: string, type?: 'text'): Promise<KVEntryWithMetadata<string> | null>;
    getWithMetadata(key: string, type: 'json'): Promise<KVEntryWithMetadata<any> | null>;
  }

  // Durable Object interfaces
export interface DurableObjectNamespace {
  new (id: DurableObjectId): any;
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
}

export interface DurableObjectState {
  readonly id: DurableObjectId;
  readonly storage: DurableObjectStorage;
  waitUntil(promise: Promise<any>): void;
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

export interface DurableObjectStorage {
  // Basic operations
  get<T = unknown>(key: string): Promise<T | null>;
  get<T = unknown>(keys: string[]): Promise<Array<T | null>>;
  put<T = unknown>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<boolean>;

  // List operations
  list<T = unknown>(options?: DurableObjectListOptions): Promise<DurableObjectListResult<T>>;

  // Transaction operations
  transaction<T>(fn: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>;

  // Alarm operations
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm(): Promise<void>;

  // Sync operations
  sync(): Promise<void>;

  // Range operations
  deleteAll(): Promise<void>;
}

export interface DurableObjectTransaction {
  get<T = unknown>(key: string): Promise<T | null>;
  get<T = unknown>(keys: string[]): Promise<Array<T | null>>;
  put<T = unknown>(key: string, value: T): void;
  delete(key: string): void;
  delete(keys: string[]): void;
  rollback(): void;
}

// R2 Bucket interface
export interface R2Bucket {
  head(key: string): Promise<R2ObjectHead | null>;
  get(key: string): Promise<R2Object | R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: R2PutOptions): Promise<R2Object>;
  delete(key: string): Promise<void>;
  delete(keys: string[]): Promise<R2DeleteResult>;
  list(options?: R2ListOptions): Promise<R2ListResult>;
  createMultipartUpload(key: string, options?: R2CreateMultipartUploadOptions): Promise<R2MultipartUpload>;
}

// D1 Database interface
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1ExecResult>;
  dump(): Promise<ArrayBuffer>;
}

export interface D1PreparedStatement {
  bind(...bindings: any[]): D1PreparedStatement;
  first<T = any>(): Promise<T | undefined>;
  first<T = any>(colName: string): Promise<T | undefined>;
  run(): Promise<D1Result>;
  all<T = any>(): Promise<D1Result<T>>;
  raw<T = any>(): Promise<T[]>;
}

// Queue interface
export interface MessageBatch {
  messages: Message[];
  acknowledgeAll(): Promise<void>;
  retryAll(): Promise<void>;
}

export interface Message {
  id: string;
  body: ReadableStream;
  timestamp: number;
  attempt: number;
}

// Scheduled event interface
export interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

// Email interface
export interface Email {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: ArrayBuffer;
  contentType?: string;
}

// AI interface (enhanced)
export interface Ai {
  run(model: string, input: any): Promise<any>;
}

// ============================================================================
// KV Type Definitions
// ============================================================================

export interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, any>;
}

export interface KVListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  exclusive?: boolean;
}

export interface KVListResult {
  keys: KVKey[];
  list_complete: boolean;
  cursor: string;
}

export interface KVKey {
  name: string;
  expiration?: number;
  metadata?: Record<string, any>;
}

export interface KVEntryWithMetadata<T> {
  value: T;
  metadata: Record<string, any>;
  expiration?: number;
}

// ============================================================================
// Durable Object Type Definitions
// ============================================================================

export interface DurableObjectId {
  toString(): string;
}

export interface DurableObjectPutOptions {
  noCache?: boolean;
}

export interface DurableObjectListOptions {
  start?: string;
  startAfter?: string;
  end?: string;
  prefix?: string;
  reverse?: boolean;
  limit?: number;
  allowConcurrency?: boolean;
  allowUnconfirmed?: boolean;
}

export interface DurableObjectListResult<T = unknown> {
  keys: DurableObjectKey<T>[];
  cursor: string;
  complete: boolean;
}

export interface DurableObjectKey<T = unknown> {
  name: string;
  value?: T;
  expiration?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// R2 Type Definitions
// ============================================================================

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  crc32: string;
  md5: string;
  lastModified: Date;
  uploaded: Date;
  customMetadata?: Record<string, string>;
  httpEtag: string;
  httpMetadata: R2HTTPMetadata;
}

export interface R2ObjectHead {
  key: string;
  size: number;
  etag: string;
  crc32: string;
  md5: string;
  lastModified: Date;
  uploaded: Date;
  customMetadata?: Record<string, string>;
  httpEtag: string;
  httpMetadata: R2HTTPMetadata;
  range?: R2Range;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
}

export interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

export interface R2Range {
  offset?: number;
  length?: number;
}

export interface R2PutOptions {
  customMetadata?: Record<string, string>;
  httpMetadata?: R2HTTPMetadata;
  md5?: string;
  sha1?: string;
  sha256?: string;
  sha384?: string;
  sha512?: string;
}

export interface R2DeleteResult {
  deleted: string[];
  errors: R2DeleteError[];
}

export interface R2DeleteError {
  key: string;
  cause: Error;
}

export interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  start?: string;
  end?: string;
  include?: Array<'httpMetadata' | 'customMetadata'>;
}

export interface R2ListResult {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

export interface R2CreateMultipartUploadOptions {
  customMetadata?: Record<string, string>;
  httpMetadata?: R2HTTPMetadata;
}

export interface R2MultipartUpload {
  key: string;
  uploadId: string;
  abort(): Promise<void>;
  completePart(partNumber: number, etag: string): Promise<void>;
  uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | string): Promise<R2UploadedPart>;
}

export interface R2UploadedPart {
  partNumber: number;
  etag: string;
}

// ============================================================================
// D1 Type Definitions
// ============================================================================

export interface D1Result<T = any> {
  success: boolean;
  meta: D1ResultMeta;
  results?: T[];
  error?: D1Error;
}

export interface D1ResultMeta {
  duration: number;
  changes: number | null;
  last_row_id: number | null;
  served_by: string;
  internal_stats: D1InternalStats;
}

export interface D1InternalStats {
  read_bytes: number;
  rows_read: number;
  rows_written: number;
}

export interface D1Error {
  message: string;
  code: string;
  info?: string;
}

export interface D1ExecResult {
  count: number;
  duration: number;
  lastRowId: number;
  changes: number;
}

// ============================================================================
// Environment Types
// ============================================================================

export interface CloudflareEnvironment {
  // KV Namespaces
  TRADING_RESULTS: KVNamespace;
  CACHE_DO_KV?: KVNamespace;
  ANALYSIS_CACHE?: KVNamespace;
  USER_SESSIONS?: KVNamespace;
  RATE_LIMIT?: KVNamespace;
  SYSTEM_CONFIG?: KVNamespace;

  // R2 Buckets
  TRADING_MODELS?: R2Bucket;
  TRAINED_MODELS?: R2Bucket;
  DATA_EXPORTS?: R2Bucket;
  USER_FILES?: R2Bucket;

  // D1 Databases
  DATABASE?: D1Database;
  ANALYTICS_DB?: D1Database;
  USER_DB?: D1Database;

  // Durable Objects
  CACHE_DO?: DurableObjectNamespace;
  USER_SESSIONS_DO?: DurableObjectNamespace;
  RATE_LIMIT_DO?: DurableObjectNamespace;
  ANALYTICS_DO?: DurableObjectNamespace;

  // AI Binding
  AI: Ai;

  // Service Bindings
  DAC_BACKEND?: Fetcher; // DAC backend service binding for direct Worker-to-Worker communication

  // Queue Producers
  ANALYSIS_QUEUE?: MessageBatch;
  NOTIFICATION_QUEUE?: MessageBatch;
  REPORT_QUEUE?: MessageBatch;

  // Email
  EMAIL?: Email;

  // API Keys and Secrets
  FMP_API_KEY?: string;
  NEWSAPI_KEY?: string;
  WORKER_API_KEY?: string;
  FRED_API_KEY?: string;
  FRED_API_KEYS?: string;
  OPENAI_API_KEY?: string;
  HUGGINGFACE_API_KEY?: string;
  DAC_ARTICLES_POOL_API_KEY?: string;

  // Social Media Integration
  FACEBOOK_PAGE_TOKEN?: string;
  FACEBOOK_RECIPIENT_ID?: string;
  TWITTER_API_KEY?: string;
  TWITTER_API_SECRET?: string;
  SLACK_WEBHOOK_URL?: string;
  DISCORD_WEBHOOK_URL?: string;

  // Configuration
  YAHOO_FINANCE_RATE_LIMIT?: string;
  RATE_LIMIT_WINDOW?: string;
  MARKET_DATA_CACHE_TTL?: string;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  STRUCTURED_LOGGING?: string;

  // AI Configuration
  GPT_MAX_TOKENS?: string;
  GPT_TEMPERATURE?: string;
  ANALYSIS_CONFIDENCE_THRESHOLD?: string;

  // Trading Configuration
  TRADING_SYMBOLS?: string;
  SIGNAL_CONFIDENCE_THRESHOLD?: string;
  MAX_POSITION_SIZE?: string;
  RISK_LEVEL?: string;

  // Feature Flags
  FEATURE_FLAG_DO_CACHE?: string;
  FEATURE_FLAG_AI_ENHANCEMENT?: string;
  FEATURE_FLAG_REAL_TIME_ANALYSIS?: string;
  FEATURE_FLAG_SECTOR_ROTATION?: string;

  // Dynamic environment access
  [key: string]: any;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface EnvRequestInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  cf: RequestCfProperties;
}

export interface RequestCfProperties {
  colo?: string;
  country?: string;
  city?: string;
  timezone?: string;
  asn?: number;
  clientTcpRtt?: number;
  httpProtocol?: string;
  requestPriority?: string;
  tlsCipher?: string;
  tlsVersion?: string;
  tlsClientAuth?: {
    certPresented: boolean;
    certVerified: boolean;
    certSerial?: string;
    certFingerprintSHA1?: string;
    certFingerprintSHA256?: string;
    certIssuerDN?: string;
    certSubjectDN?: string;
  };
}

export interface WorkerContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
  scheduledTime?: number;
  cron?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type KVValue = string | ArrayBuffer | ReadableStream | any;
export type R2Value = ReadableStream | ArrayBuffer | ArrayBufferView | string;
export type D1Value = string | number | boolean | null | Date | ArrayBuffer;

export interface TypedKVNamespace<T = any> {
  get(key: string): Promise<T | null>;
  get(keys: string[]): Promise<Array<T | null>>;
  put(key: string, value: T, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
  list(options?: KVListOptions): Promise<KVListResult>;
  getWithMetadata(key: string): Promise<KVEntryWithMetadata<T> | null>;
}

export interface TypedDurableObjectStorage<T = any> {
  get(key: string): Promise<T | null>;
  get(keys: string[]): Promise<Array<T | null>>;
  put(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<boolean>;
  list(options?: DurableObjectListOptions): Promise<DurableObjectListResult<T>>;
  transaction<R>(fn: (txn: DurableObjectTransaction) => Promise<R>): Promise<R>;
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm(): Promise<void>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isKVNamespace(value: any): value is KVNamespace {
  return value && typeof value === 'object' &&
         typeof value.get === 'function' &&
         typeof value.put === 'function' &&
         typeof value.delete === 'function';
}

export function isR2Bucket(value: any): value is R2Bucket {
  return value && typeof value === 'object' &&
         typeof value.head === 'function' &&
         typeof value.get === 'function' &&
         typeof value.put === 'function' &&
         typeof value.delete === 'function';
}

export function isD1Database(value: any): value is D1Database {
  return value && typeof value === 'object' &&
         typeof value.prepare === 'function' &&
         typeof value.batch === 'function' &&
         typeof value.exec === 'function';
}

export function isDurableObjectNamespace(value: any): value is DurableObjectNamespace {
  return value && typeof value === 'object' &&
         typeof value.idFromName === 'function' &&
         typeof value.idFromString === 'function';
}

export function isAi(value: any): value is Ai {
  return value && typeof value === 'object' &&
         typeof value.run === 'function';
}