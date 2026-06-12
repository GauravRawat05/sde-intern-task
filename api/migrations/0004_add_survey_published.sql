-- Migration: Add publishing status to surveys table
ALTER TABLE surveys ADD COLUMN is_published INTEGER DEFAULT 1; -- 0 = unpublished, 1 = published
