-- Add dual-model logging columns to symbol_predictions
-- This enables tracking of both Gemma and DistilBERT results for diagnostics

-- Gemma Sea Lion (primary model) status tracking
ALTER TABLE symbol_predictions ADD COLUMN gemma_status TEXT;           -- 'success'/'failed'/'timeout'/'skipped'
ALTER TABLE symbol_predictions ADD COLUMN gemma_error TEXT;            -- Error message if failed
ALTER TABLE symbol_predictions ADD COLUMN gemma_confidence REAL;       -- Confidence score from Gemma
ALTER TABLE symbol_predictions ADD COLUMN gemma_response_time_ms INTEGER; -- Response time in milliseconds

-- DistilBERT (secondary model) status tracking
ALTER TABLE symbol_predictions ADD COLUMN distilbert_status TEXT;      -- 'success'/'failed'/'timeout'/'skipped'
ALTER TABLE symbol_predictions ADD COLUMN distilbert_error TEXT;       -- Error message if failed
ALTER TABLE symbol_predictions ADD COLUMN distilbert_confidence REAL;  -- Confidence score from DistilBERT
ALTER TABLE symbol_predictions ADD COLUMN distilbert_response_time_ms INTEGER; -- Response time in milliseconds

-- Model selection tracking
ALTER TABLE symbol_predictions ADD COLUMN model_selection_reason TEXT; -- 'gemma_success'/'gemma_failed_fallback'/'circuit_breaker'/'timeout_fallback'

-- Create index for efficient querying of model status
CREATE INDEX IF NOT EXISTS idx_symbol_predictions_gemma_status ON symbol_predictions(gemma_status);
CREATE INDEX IF NOT EXISTS idx_symbol_predictions_distilbert_status ON symbol_predictions(distilbert_status);
