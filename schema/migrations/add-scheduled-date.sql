-- Add scheduled_date to report snapshots and job executions
-- scheduled_date: the market date the job is intended to cover (set at submission)
-- This is distinct from generated_at (when job actually finished)

-- Add to scheduled_job_results (main reports table)
ALTER TABLE scheduled_job_results ADD COLUMN scheduled_date TEXT;

-- Add to job_executions (job tracking table)
ALTER TABLE job_executions ADD COLUMN scheduled_date TEXT;

-- Create index on scheduled_date + report_type for fast lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_report_date ON scheduled_job_results(report_type, scheduled_date);

-- Create index on job executions for scheduled_date + job_type
CREATE INDEX IF NOT EXISTS idx_job_executions_scheduled_date ON job_executions(job_type, scheduled_date);
