-- Add articles content column to symbol_predictions for displaying in reports
-- Stores JSON array of article headlines/summaries used for sentiment analysis
ALTER TABLE symbol_predictions ADD COLUMN articles_content TEXT;
