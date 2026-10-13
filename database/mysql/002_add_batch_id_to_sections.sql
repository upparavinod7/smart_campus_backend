-- Migration 002: Add batch_id to sections table for hierarchical academic structure
-- School -> Department -> Program -> Batch -> Section -> Timetable -> Class Session -> Attendance Records

SET @dbname = DATABASE();
SET @tablename = 'sections';
SET @columnname = 'batch_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE sections ADD COLUMN batch_id INT UNSIGNED NULL AFTER offering_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index on batch_id if not present
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND INDEX_NAME = 'idx_sections_batch_id'
  ) > 0,
  'SELECT 1',
  'CREATE INDEX idx_sections_batch_id ON sections (batch_id)'
));
PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

-- Add foreign key constraint if not present
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND CONSTRAINT_NAME = 'fk_sec_batch'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE sections ADD CONSTRAINT fk_sec_batch FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE RESTRICT'
));
PREPARE addFkIfNotExists FROM @preparedStatement;
EXECUTE addFkIfNotExists;
DEALLOCATE PREPARE addFkIfNotExists;

-- Backfill existing seed sections (section_id 1, 2, 3) to batch_id = 4 (active 2026-30 batch)
UPDATE sections SET batch_id = 4 WHERE batch_id IS NULL AND section_id IN (1, 2, 3);
