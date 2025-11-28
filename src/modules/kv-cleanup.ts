import { type CloudflareEnvironment } from '../types.js';
import { createLogger } from './logging.js';

export interface KVCleanupRequest {
  prefixes?: string[]; // e.g., ["analysis_", "news_fmp_"]
  retentionDays?: number; // default 14
  dryRun?: boolean; // default true
  limitPerPrefix?: number; // optional safety cap per prefix in one run
}

export interface KVCleanupResult {
  success: boolean;
  dryRun: boolean;
  retentionDays: number;
  examined: number;
  toDelete: number;
  deleted: number;
  errors: Array<{ key: string; error: string }>;
  samples: {
    examined: string[];
    toDelete: string[];
    deleted: string[];
  };
  details: Record<string, { examined: number; toDelete: number; deleted: number }>;
}

const DEFAULT_PREFIXES = [
  'analysis_',
  'news_fmp_',
  'granular_',
];

function parseDateFromKey(key: string): Date | null {
  // Accept patterns like: analysis_YYYY-MM-DD or news_fmp_SYMBOL_YYYY-MM-DD or analysis_YYYY-MM-DD_SYMBOL
  const dateRegexes = [
    /(\d{4}-\d{2}-\d{2})$/, // ends with date
    /_(\d{4}-\d{2}-\d{2})_/, // _YYYY-MM-DD_
  ];
  for (const re of dateRegexes) {
    const m = key.match(re);
    if (m && m[1]) {
      const d = new Date(m[1]);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export async function cleanupKVCache(env: CloudflareEnvironment, req: KVCleanupRequest = {}): Promise<KVCleanupResult> {
  const logger = createLogger('kv-cleanup');
  const prefixes = (req.prefixes && req.prefixes.length > 0) ? req.prefixes : DEFAULT_PREFIXES;
  const retentionDays = req.retentionDays ?? 14;
  const dryRun = req.dryRun ?? true;
  const limitPerPrefix = req.limitPerPrefix && req.limitPerPrefix > 0 ? req.limitPerPrefix : undefined;

  const now = new Date();
  const result: KVCleanupResult = {
    success: true,
    dryRun,
    retentionDays,
    examined: 0,
    toDelete: 0,
    deleted: 0,
    errors: [],
    samples: { examined: [], toDelete: [], deleted: [] },
    details: {},
  };

  for (const prefix of prefixes) {
    let cursor: string | undefined = undefined;
    let examinedThisPrefix = 0;
    let toDeleteThisPrefix = 0;
    let deletedThisPrefix = 0;

    try {
      do {
        const list = await env.MARKET_ANALYSIS_CACHE.list({ prefix, cursor });
        cursor = list.list_complete ? undefined : list.cursor;
        for (const entry of list.keys) {
          if (limitPerPrefix && examinedThisPrefix >= limitPerPrefix) {
            cursor = undefined; // stop listing this prefix
            break;
          }
          examinedThisPrefix++;
          result.examined++;
          if (result.samples.examined.length < 20) result.samples.examined.push(entry.name);

          const d = parseDateFromKey(entry.name);
          if (!d) {
            continue; // keep non-dated keys unless explicit prefix matches future criteria
          }
          const ageDays = daysBetween(now, d);
          if (ageDays > retentionDays) {
            toDeleteThisPrefix++;
            result.toDelete++;
            if (result.samples.toDelete.length < 20) result.samples.toDelete.push(entry.name);
            if (!dryRun) {
              try {
                await env.MARKET_ANALYSIS_CACHE.delete(entry.name);
                deletedThisPrefix++;
                result.deleted++;
                if (result.samples.deleted.length < 20) result.samples.deleted.push(entry.name);
              } catch (err) {
                logger.error('Failed to delete KV key', { key: entry.name, err: err instanceof Error ? err.message : String(err) });
                result.errors.push({ key: entry.name, error: err instanceof Error ? err.message : String(err) });
              }
            }
          }
        }
      } while (cursor);

      result.details[prefix] = {
        examined: examinedThisPrefix,
        toDelete: toDeleteThisPrefix,
        deleted: deletedThisPrefix,
      };
    } catch (err) {
      logger.error('KV list failed for prefix', { prefix, err: err instanceof Error ? err.message : String(err) });
      result.errors.push({ key: `${prefix}*`, error: err instanceof Error ? err.message : String(err) });
      result.success = false;
    }
  }

  return result;
}
