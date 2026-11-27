CREATE TABLE IF NOT EXISTS credit_settings (
  setting_key VARCHAR(64) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_by INT UNSIGNED DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  KEY fk_credit_settings_actor (updated_by),
  CONSTRAINT fk_credit_settings_actor FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO credit_settings (setting_key, setting_value) VALUES
  ('INITIAL_CREDITS', '100'),
  ('AI_GENERATION_COST', '20'),
  ('REQUEST_MIN_AMOUNT', '1'),
  ('REQUEST_MAX_AMOUNT', '500'),
  ('REQUEST_DEFAULT_AMOUNT', '20'),
  ('PRICE_PER_CREDIT', '0.00'),
  ('RAZORPAY_ENABLED', '0');

CREATE TABLE IF NOT EXISTS credit_policies (
  policy_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_type ENUM('GLOBAL','DEPARTMENT','FACULTY') NOT NULL,
  scope_id INT UNSIGNED DEFAULT NULL,
  mode ENUM('REQUEST_ONLY','PAY_ONLY','REQUEST_OR_PAY','CONTACT_ONLY') NOT NULL,
  updated_by INT UNSIGNED DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (policy_id),
  UNIQUE KEY uq_credit_policy_scope (scope_type, scope_id),
  KEY fk_credit_policy_actor (updated_by),
  CONSTRAINT fk_credit_policy_actor FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO credit_policies (scope_type, scope_id, mode)
SELECT 'GLOBAL', NULL, 'REQUEST_ONLY'
WHERE NOT EXISTS (
  SELECT 1 FROM credit_policies WHERE scope_type = 'GLOBAL' AND scope_id IS NULL
);
UPDATE credit_policies
SET mode = 'REQUEST_ONLY', updated_by = NULL
WHERE scope_type = 'GLOBAL' AND scope_id IS NULL;

CREATE TABLE IF NOT EXISTS credit_wallets (
  wallet_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  faculty_id INT UNSIGNED NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT '0.00',
  held DECIMAL(12,2) NOT NULL DEFAULT '0.00',
  version INT UNSIGNED NOT NULL DEFAULT '1',
  last_activity_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (wallet_id),
  UNIQUE KEY uq_credit_wallet_user (user_id),
  UNIQUE KEY uq_credit_wallet_faculty (faculty_id),
  CONSTRAINT fk_credit_wallet_faculty FOREIGN KEY (faculty_id) REFERENCES faculty (faculty_id) ON DELETE CASCADE,
  CONSTRAINT fk_credit_wallet_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT ck_credit_balance CHECK (balance >= 0),
  CONSTRAINT ck_credit_held CHECK (held >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_requests (
  request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  faculty_id INT UNSIGNED NOT NULL,
  requested_amount DECIMAL(12,2) NOT NULL,
  approved_amount DECIMAL(12,2) DEFAULT NULL,
  reason VARCHAR(200) NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  approver_id INT UNSIGNED DEFAULT NULL,
  decided_at TIMESTAMP NULL DEFAULT NULL,
  note VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pending_key VARCHAR(191) GENERATED ALWAYS AS (
    CASE WHEN status = 'PENDING' THEN CAST(faculty_id AS CHAR) ELSE NULL END
  ) STORED,
  PRIMARY KEY (request_id),
  UNIQUE KEY uq_one_pending_request (pending_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_ledger (
  ledger_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wallet_id INT UNSIGNED NOT NULL,
  type ENUM('INITIAL_GRANT','HOLD','SPEND','RELEASE','ADMIN_TOPUP','BULK_TOPUP','REQUEST_APPROVED','PURCHASE','REFUND','ADJUSTMENT') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  held_after DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(64) DEFAULT NULL,
  reference_id VARCHAR(128) DEFAULT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  actor_id INT UNSIGNED DEFAULT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id),
  UNIQUE KEY uq_credit_ledger_idempotency (wallet_id, idempotency_key),
  KEY idx_credit_ledger_wallet_created (wallet_id, created_at),
  KEY fk_credit_ledger_actor (actor_id),
  CONSTRAINT fk_credit_ledger_actor FOREIGN KEY (actor_id) REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_credit_ledger_wallet FOREIGN KEY (wallet_id) REFERENCES credit_wallets (wallet_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO credit_wallets (user_id, faculty_id, balance, held, last_activity_at)
SELECT u.user_id, f.faculty_id,
       CAST(COALESCE((SELECT setting_value FROM credit_settings WHERE setting_key = 'INITIAL_CREDITS'), '100') AS DECIMAL(12,2)),
       0, NOW()
FROM faculty f
JOIN users u ON u.faculty_id = f.faculty_id AND u.role = 'FACULTY';

INSERT IGNORE INTO credit_ledger
  (wallet_id, type, amount, balance_after, held_after, reference_type,
   reference_id, idempotency_key, reason)
SELECT w.wallet_id, 'INITIAL_GRANT', w.balance, w.balance, w.held,
       'FACULTY_REGISTRATION', CAST(w.faculty_id AS CHAR),
       CONCAT('INITIAL_GRANT:MIGRATION:', w.wallet_id),
       'Initial faculty credit allocation'
FROM credit_wallets w
LEFT JOIN credit_ledger l
  ON l.wallet_id = w.wallet_id AND l.type = 'INITIAL_GRANT'
WHERE l.ledger_id IS NULL;
