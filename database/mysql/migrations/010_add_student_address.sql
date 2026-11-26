-- Migration: 010_add_student_address.sql
-- Description: Adds the permanent address shown on the student ID card.

SET @db_name := DATABASE();
SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'students' AND COLUMN_NAME = 'address'
  ),
  'SELECT 1',
  'ALTER TABLE `students` ADD COLUMN `address` VARCHAR(500) NULL DEFAULT NULL AFTER `phone`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
