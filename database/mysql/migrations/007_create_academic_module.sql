-- Migration: 007_create_academic_module.sql
-- Description: Create complete academic module schema for study materials, question bank, quizzes, attempts, and audit ledger.

CREATE TABLE IF NOT EXISTS subject_staff_assignments (
  assignment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id INT UNSIGNED NOT NULL,
  faculty_id INT UNSIGNED NOT NULL,
  role ENUM('Subject Staff', 'Co-Teacher', 'Lab Assistant') NOT NULL DEFAULT 'Subject Staff',
  assigned_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subject_faculty_role (subject_id, faculty_id, role),
  CONSTRAINT fk_ssa_subject FOREIGN KEY (subject_id) REFERENCES subjects (subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_ssa_faculty FOREIGN KEY (faculty_id) REFERENCES faculty (faculty_id) ON DELETE CASCADE,
  CONSTRAINT fk_ssa_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_topics (
  topic_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 1,
  quiz_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_topics_subject_pos (subject_id, position),
  CONSTRAINT fk_topic_subject FOREIGN KEY (subject_id) REFERENCES subjects (subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_topic_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_materials (
  material_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  type ENUM('PDF', 'Video', 'Slide', 'Link', 'Notes') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  file_ref VARCHAR(512) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('Draft', 'Published') NOT NULL DEFAULT 'Draft',
  required_flag TINYINT(1) NOT NULL DEFAULT 0,
  position INT UNSIGNED NOT NULL DEFAULT 1,
  mime_type VARCHAR(100) NULL,
  file_size BIGINT UNSIGNED NULL,
  virus_scan_status ENUM('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED') NOT NULL DEFAULT 'CLEAN',
  extracted_text_ref LONGTEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_materials_topic_status (topic_id, status),
  CONSTRAINT fk_material_topic FOREIGN KEY (topic_id) REFERENCES academic_topics (topic_id) ON DELETE CASCADE,
  CONSTRAINT fk_material_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_material_versions (
  version_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_id INT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  file_ref VARCHAR(512) NULL,
  mime_type VARCHAR(100) NULL,
  file_size BIGINT UNSIGNED NULL,
  change_summary VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mat_version (material_id, version),
  CONSTRAINT fk_matver_material FOREIGN KEY (material_id) REFERENCES academic_materials (material_id) ON DELETE CASCADE,
  CONSTRAINT fk_matver_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_material_progress (
  progress_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  person_id INT UNSIGNED NOT NULL,
  material_id INT UNSIGNED NOT NULL,
  percent INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
  completed_at DATETIME NULL,
  last_accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress_person_mat (person_id, material_id),
  KEY idx_progress_mat (material_id),
  CONSTRAINT fk_progress_person FOREIGN KEY (person_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_material FOREIGN KEY (material_id) REFERENCES academic_materials (material_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_questions (
  question_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  type ENUM('MCQ', 'TrueFalse', 'ShortAnswer') NOT NULL DEFAULT 'MCQ',
  text TEXT NOT NULL,
  options JSON NULL,
  answer TEXT NOT NULL,
  explanation TEXT NULL,
  marks DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  difficulty ENUM('Easy', 'Medium', 'Hard') NOT NULL DEFAULT 'Medium',
  source_ref VARCHAR(255) NULL,
  origin ENUM('Manual', 'ML') NOT NULL DEFAULT 'Manual',
  approved_by INT UNSIGNED NULL,
  status ENUM('Draft', 'Approved', 'Archived') NOT NULL DEFAULT 'Approved',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_questions_topic_status (topic_id, status),
  CONSTRAINT fk_quest_topic FOREIGN KEY (topic_id) REFERENCES academic_topics (topic_id) ON DELETE CASCADE,
  CONSTRAINT fk_quest_approver FOREIGN KEY (approved_by) REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_quest_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_quizzes (
  quiz_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  time_limit INT UNSIGNED NOT NULL DEFAULT 30,
  pass_mark DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 3,
  open_at DATETIME NULL,
  close_at DATETIME NULL,
  status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
  shuffle_questions TINYINT(1) NOT NULL DEFAULT 1,
  shuffle_options TINYINT(1) NOT NULL DEFAULT 1,
  show_explanation TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_quiz_topic FOREIGN KEY (topic_id) REFERENCES academic_topics (topic_id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_creator FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_attempts (
  attempt_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT UNSIGNED NOT NULL,
  person_id INT UNSIGNED NOT NULL,
  attempt_number INT UNSIGNED NOT NULL DEFAULT 1,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  submitted_at DATETIME NULL,
  score DECIMAL(5,2) NULL,
  max_score DECIMAL(5,2) NULL,
  percentage DECIMAL(5,2) NULL,
  result ENUM('PASSED', 'FAILED', 'PENDING') NOT NULL DEFAULT 'PENDING',
  status ENUM('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT', 'CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
  question_set JSON NOT NULL,
  idempotency_key VARCHAR(128) NULL UNIQUE,
  KEY idx_attempt_quiz_person (quiz_id, person_id, attempt_number),
  CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES academic_quizzes (quiz_id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_person FOREIGN KEY (person_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_attempt_answers (
  answer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  answer TEXT NULL,
  is_correct TINYINT(1) NULL,
  marks_awarded DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attempt_question (attempt_id, question_id),
  CONSTRAINT fk_ans_attempt FOREIGN KEY (attempt_id) REFERENCES academic_attempts (attempt_id) ON DELETE CASCADE,
  CONSTRAINT fk_ans_question FOREIGN KEY (question_id) REFERENCES academic_questions (question_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_score_corrections (
  correction_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT UNSIGNED NOT NULL,
  previous_score DECIMAL(5,2) NOT NULL,
  new_score DECIMAL(5,2) NOT NULL,
  reason_code VARCHAR(100) NOT NULL,
  justification TEXT NOT NULL,
  corrected_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_scorecorr_attempt FOREIGN KEY (attempt_id) REFERENCES academic_attempts (attempt_id) ON DELETE CASCADE,
  CONSTRAINT fk_scorecorr_user FOREIGN KEY (corrected_by) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_permission_matrix (
  policy_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(100) NOT NULL UNIQUE,
  allowed_roles JSON NOT NULL,
  requires_subject_staff TINYINT(1) NOT NULL DEFAULT 1,
  description VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_audit_ledger (
  ledger_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  person_id INT UNSIGNED NOT NULL,
  location_id VARCHAR(100) NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type VARCHAR(100) NOT NULL,
  payload JSON NULL,
  reason_code VARCHAR(100) NULL,
  KEY idx_ledger_person (person_id),
  KEY idx_ledger_event (event_type),
  KEY idx_ledger_timestamp (timestamp),
  CONSTRAINT fk_ledger_person FOREIGN KEY (person_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_ml_jobs (
  job_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  material_id INT UNSIGNED NULL,
  job_type VARCHAR(50) NOT NULL DEFAULT 'QUESTION_GENERATION',
  status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  requested_by INT UNSIGNED NOT NULL,
  result_summary JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_mljob_topic FOREIGN KEY (topic_id) REFERENCES academic_topics (topic_id) ON DELETE CASCADE,
  CONSTRAINT fk_mljob_material FOREIGN KEY (material_id) REFERENCES academic_materials (material_id) ON DELETE SET NULL,
  CONSTRAINT fk_mljob_user FOREIGN KEY (requested_by) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO academic_permission_matrix (action, allowed_roles, requires_subject_staff, description)
VALUES 
  ('MANAGE_TOPICS', '["ADMIN", "FACULTY"]', 1, 'Create, edit, reorder topics for a subject'),
  ('UPLOAD_MATERIALS', '["ADMIN", "FACULTY"]', 1, 'Upload or create study materials'),
  ('PUBLISH_MATERIALS', '["ADMIN", "FACULTY"]', 1, 'Publish or unpublish materials'),
  ('AUTHOR_QUESTIONS', '["ADMIN", "FACULTY"]', 1, 'Manage question bank items'),
  ('CONFIGURE_QUIZ', '["ADMIN", "FACULTY"]', 1, 'Create and configure topic quizzes'),
  ('PREVIEW_QUIZ', '["ADMIN", "FACULTY"]', 1, 'Preview quiz questions and layout'),
  ('ATTEMPT_QUIZ', '["STUDENT"]', 0, 'Start and submit quiz attempts'),
  ('VIEW_ANALYTICS', '["ADMIN", "FACULTY"]', 1, 'View student progress and quiz performance metrics'),
  ('CORRECT_SCORE', '["ADMIN", "FACULTY"]', 1, 'Manually correct or override attempt scores'),
  ('MANAGE_STAFF', '["ADMIN", "FACULTY"]', 0, 'Assign faculty to subjects')
ON DUPLICATE KEY UPDATE description=VALUES(description);

