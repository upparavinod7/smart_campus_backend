-- Migration: 008_add_hod_designation_and_user.sql
-- Description: Adds HOD designation, adds an HOD faculty user for department-level academic oversight,
-- and adds HOD-related fields to the designations lookup for automatic HOD detection.

-- Add HOD designation if not exists
INSERT IGNORE INTO designations (name) VALUES ('Head of Department');

-- NOTE: The HOD user and faculty records should be added via the demo seed script
-- as they depend on department data. This migration only ensures the designation exists.

-- Add index on designations name for fast HOD lookup
ALTER TABLE designations ADD INDEX IF NOT EXISTS idx_des_name (name(50));
