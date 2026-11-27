SET @payment_user_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'credit_payments'
    AND column_name = 'user_id'
);
SET @payment_user_column_sql = IF(
  @payment_user_column_exists = 0,
  'ALTER TABLE credit_payments ADD COLUMN user_id INT UNSIGNED NULL AFTER payment_id',
  'SELECT 1'
);
PREPARE payment_user_column_stmt FROM @payment_user_column_sql;
EXECUTE payment_user_column_stmt;
DEALLOCATE PREPARE payment_user_column_stmt;

SET @payment_user_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'credit_payments'
    AND index_name = 'idx_credit_payment_user_status'
);
SET @payment_user_index_sql = IF(
  @payment_user_index_exists = 0,
  'CREATE INDEX idx_credit_payment_user_status ON credit_payments (user_id, status)',
  'SELECT 1'
);
PREPARE payment_user_index_stmt FROM @payment_user_index_sql;
EXECUTE payment_user_index_stmt;
DEALLOCATE PREPARE payment_user_index_stmt;

SET @payment_user_foreign_key_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'credit_payments'
    AND constraint_name = 'fk_credit_payment_user_owner'
    AND constraint_type = 'FOREIGN KEY'
);
SET @payment_user_foreign_key_sql = IF(
  @payment_user_foreign_key_exists = 0,
  'ALTER TABLE credit_payments ADD CONSTRAINT fk_credit_payment_user_owner FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE payment_user_foreign_key_stmt FROM @payment_user_foreign_key_sql;
EXECUTE payment_user_foreign_key_stmt;
DEALLOCATE PREPARE payment_user_foreign_key_stmt;
