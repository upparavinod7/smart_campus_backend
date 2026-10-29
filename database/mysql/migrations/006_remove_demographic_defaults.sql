-- Migration: 006_remove_demographic_defaults.sql
-- Description: Removes hardcoded demo default values from demographic fields across users, students, and faculty tables, setting defaults to NULL.

ALTER TABLE `users`
  ALTER COLUMN `gender` SET DEFAULT NULL;

ALTER TABLE `students`
  ALTER COLUMN `gender` SET DEFAULT NULL,
  ALTER COLUMN `date_of_birth` SET DEFAULT NULL,
  ALTER COLUMN `blood_group` SET DEFAULT NULL;

ALTER TABLE `faculty`
  ALTER COLUMN `gender` SET DEFAULT NULL,
  ALTER COLUMN `date_of_birth` SET DEFAULT NULL,
  ALTER COLUMN `blood_group` SET DEFAULT NULL,
  ALTER COLUMN `joining_year` SET DEFAULT NULL,
  ALTER COLUMN `in_charge_class` SET DEFAULT NULL,
  ALTER COLUMN `phone` SET DEFAULT NULL;

