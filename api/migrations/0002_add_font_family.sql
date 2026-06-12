-- Migration: Add font_family column to surveys table
ALTER TABLE surveys ADD COLUMN font_family TEXT DEFAULT 'Manrope';
