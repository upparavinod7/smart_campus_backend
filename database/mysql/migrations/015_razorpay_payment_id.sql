SET @provider_payment_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'credit_payments'
    AND column_name = 'provider_payment_id'
);
SET @provider_payment_column_sql = IF(
  @provider_payment_column_exists = 0,
  'ALTER TABLE credit_payments ADD COLUMN provider_payment_id VARCHAR(64) NULL AFTER provider_order_id',
  'SELECT 1'
);
PREPARE provider_payment_column_stmt FROM @provider_payment_column_sql;
EXECUTE provider_payment_column_stmt;
DEALLOCATE PREPARE provider_payment_column_stmt;

SET @provider_payment_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'credit_payments'
    AND index_name = 'uq_credit_payment_provider_payment'
);
SET @provider_payment_index_sql = IF(
  @provider_payment_index_exists = 0,
  'CREATE UNIQUE INDEX uq_credit_payment_provider_payment ON credit_payments (provider_payment_id)',
  'SELECT 1'
);
PREPARE provider_payment_index_stmt FROM @provider_payment_index_sql;
EXECUTE provider_payment_index_stmt;
DEALLOCATE PREPARE provider_payment_index_stmt;
