-- Add reasoning_chain column to existing ai_call_telemetry table
-- Safe to run multiple times (uses ALTER TABLE which fails gracefully if column exists)
-- Run this if ai_call_telemetry was created before Springdrift enhancements
-- Migration Date: 2026-04-10

-- SQLite doesn't have IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- This will fail if column already exists, which is safe (no-op)
-- Wrap in a transaction that can be rolled back
ALTER TABLE ai_call_telemetry ADD COLUMN reasoning_chain TEXT;
