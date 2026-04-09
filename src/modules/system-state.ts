/**
 * System State (Sensorium) - Phase 1 & 5
 * Computes a compact batch-level context block injected into AI prompts.
 * Computed once per batch, not per symbol.
 */

export interface SystemState {
  report_type: string;
  scheduled_date: string;
  run_id: string;
  current_stage: string;
  symbols_total: number;
  news_cache_mode: string;
  recent_failure_summary?: string;
  // Phase 5: calibration fields (optional, populated when available)
  symbol_sample_size?: number;
  symbol_hit_rate_30d?: number;
  model_hit_rate_30d?: number;
}

/**
 * Render system_state as a compact prompt block.
 * Returns empty string if state is null/undefined.
 */
export function renderSystemStateBlock(state: SystemState | null | undefined): string {
  if (!state) return '';
  const lines: string[] = [
    `[system_state]`,
    `report_type=${state.report_type} scheduled_date=${state.scheduled_date} run_id=${state.run_id}`,
    `stage=${state.current_stage} symbols_total=${state.symbols_total} news_cache_mode=${state.news_cache_mode}`,
  ];
  if (state.recent_failure_summary) {
    lines.push(`recent_failures=${state.recent_failure_summary}`);
  }
  if (state.symbol_sample_size !== undefined) {
    lines.push(`symbol_sample_size=${state.symbol_sample_size} symbol_hit_rate_30d=${(state.symbol_hit_rate_30d ?? 0).toFixed(2)} model_hit_rate_30d=${(state.model_hit_rate_30d ?? 0).toFixed(2)}`);
  }
  lines.push(`[/system_state]`);
  return lines.join('\n');
}
