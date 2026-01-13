-- Add status and error fields to symbol_predictions for troubleshooting
ALTER TABLE symbol_predictions ADD COLUMN status TEXT DEFAULT 'success';
ALTER TABLE symbol_predictions ADD COLUMN error_message TEXT;
ALTER TABLE symbol_predictions ADD COLUMN news_source TEXT;
ALTER TABLE symbol_predictions ADD COLUMN articles_count INTEGER DEFAULT 0;
ALTER TABLE symbol_predictions ADD COLUMN raw_response TEXT;
