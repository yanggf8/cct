-- ============================================
-- D1 Migration: Add trigger_source to scheduled_job_results
-- NON-DESTRUCTIVE, IDEMPOTENT
-- Run: npx wrangler d1 execute cct-predict-jobs --remote --file=schema/migrations/add-trigger-source.sql
-- ============================================

-- Add trigger_source column to track who/what triggered the job
-- Values: 'github-actions', 'manual-api', 'cron', 'unknown'
ALTER TABLE scheduled_job_results ADD COLUMN trigger_source TEXT DEFAULT 'unknown';

-- Create index for filtering by trigger source
CREATE INDEX IF NOT EXISTS idx_scheduled_results_trigger ON scheduled_job_results(trigger_source);
