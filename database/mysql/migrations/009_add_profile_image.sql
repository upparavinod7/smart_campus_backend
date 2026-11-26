-- Migration: 009_add_profile_image.sql
-- Description: Add profile_image column to users, students, and faculty tables for profile photos
-- Idempotent because these databases may have been initialized before migration tracking was added.

SET @db_name := DATABASE();

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_image'
  ),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN profile_image MEDIUMTEXT NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'students' AND COLUMN_NAME = 'profile_image'
  ),
  'SELECT 1',
  'ALTER TABLE students ADD COLUMN profile_image MEDIUMTEXT NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'faculty' AND COLUMN_NAME = 'profile_image'
  ),
  'SELECT 1',
  'ALTER TABLE faculty ADD COLUMN profile_image MEDIUMTEXT NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
