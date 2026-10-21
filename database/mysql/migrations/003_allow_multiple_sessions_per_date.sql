-- Migration 003: Allow multiple class sessions per date with distinct scheduled start times
-- Replaces uq_session_slot_date (slot_id, session_date) with uq_session_slot_start (slot_id, scheduled_start)

SET @dbname = DATABASE();
SET @tablename = 'class_sessions';

-- 1. First add unique index uq_session_slot_start so foreign key fk_sess_slot has an index on slot_id
SET @addUniqueStmt = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND INDEX_NAME = 'uq_session_slot_start'
  ) > 0,
  'SELECT 1',
  'CREATE UNIQUE INDEX uq_session_slot_start ON class_sessions (slot_id, scheduled_start)'
));
PREPARE addSlotStartUnique FROM @addUniqueStmt;
EXECUTE addSlotStartUnique;
DEALLOCATE PREPARE addSlotStartUnique;

-- 2. Add normal index ix_session_slot_date if not present (for performant slot_id + session_date queries)
SET @addIdxStmt = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND INDEX_NAME = 'ix_session_slot_date'
  ) > 0,
  'SELECT 1',
  'CREATE INDEX ix_session_slot_date ON class_sessions (slot_id, session_date)'
));
PREPARE addSlotDateIndex FROM @addIdxStmt;
EXECUTE addSlotDateIndex;
DEALLOCATE PREPARE addSlotDateIndex;

-- 3. Now drop old unique key uq_session_slot_date if present (now safe because slot_id indexes exist)
SET @dropKeyStmt = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND INDEX_NAME = 'uq_session_slot_date'
  ) > 0,
  'ALTER TABLE class_sessions DROP INDEX uq_session_slot_date',
  'SELECT 1'
));
PREPARE dropIndexIfPresent FROM @dropKeyStmt;
EXECUTE dropIndexIfPresent;
DEALLOCATE PREPARE dropIndexIfPresent;

