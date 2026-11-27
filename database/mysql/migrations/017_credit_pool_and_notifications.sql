CREATE TABLE IF NOT EXISTS credit_pool (
  pool_id TINYINT UNSIGNED NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (pool_id),
  CONSTRAINT ck_credit_pool_balance CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO credit_pool (pool_id, balance) VALUES (1, 0.00);

CREATE TABLE IF NOT EXISTS credit_pool_ledger (
  entry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('PURCHASE','ALLOCATION') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(64) DEFAULT NULL,
  reference_id VARCHAR(128) DEFAULT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  actor_id INT UNSIGNED DEFAULT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entry_id),
  UNIQUE KEY uq_credit_pool_ledger_idempotency (idempotency_key),
  KEY idx_credit_pool_ledger_created (created_at),
  CONSTRAINT fk_credit_pool_ledger_actor FOREIGN KEY (actor_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_pool_payments (
  payment_id VARCHAR(128) NOT NULL,
  admin_id INT UNSIGNED NOT NULL,
  credits DECIMAL(12,2) NOT NULL,
  amount_paise INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  provider_order_id VARCHAR(128) DEFAULT NULL,
  provider_payment_id VARCHAR(64) DEFAULT NULL,
  status ENUM('PENDING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_credit_pool_payment_order (provider_order_id),
  UNIQUE KEY uq_credit_pool_provider_payment (provider_payment_id),
  KEY idx_credit_pool_payment_admin_status (admin_id, status),
  CONSTRAINT fk_credit_pool_payment_admin FOREIGN KEY (admin_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @faculty_credit_notified_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'credit_ledger'
    AND column_name = 'faculty_notified_at'
);
SET @faculty_credit_notified_column_sql = IF(
  @faculty_credit_notified_column_exists = 0,
  'ALTER TABLE credit_ledger ADD COLUMN faculty_notified_at TIMESTAMP NULL DEFAULT NULL AFTER reason',
  'SELECT 1'
);
PREPARE faculty_credit_notified_column_stmt FROM @faculty_credit_notified_column_sql;
EXECUTE faculty_credit_notified_column_stmt;
DEALLOCATE PREPARE faculty_credit_notified_column_stmt;

UPDATE credit_ledger
SET faculty_notified_at = NOW()
WHERE faculty_notified_at IS NULL;
