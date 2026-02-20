-- Migration: Add snooze_until to cashflow_items
-- Purpose: Support recurring confirmation snooze/postpone feature
-- Run: Execute against production DB before deploying

ALTER TABLE cashflow_items
ADD COLUMN IF NOT EXISTS snooze_until TEXT DEFAULT NULL;

COMMENT ON COLUMN cashflow_items.snooze_until IS 'ISO datetime until which this item''s confirmation popup is snoozed';
