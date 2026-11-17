-- Migration: 008_fix_academic_fk_and_settings.sql
-- Description: Protect historical quiz answers with ON DELETE RESTRICT, decouple audit ledger from user cascade deletion with actor snapshot columns, add questions_to_draw to quizzes, and add ml_enabled flag to subjects.

-- 1. Protect historical attempt answers: replace ON DELETE CASCADE with ON DELETE RESTRICT
ALTER TABLE academic_attempt_answers DROP FOREIGN KEY fk_ans_question;
ALTER TABLE academic_attempt_answers ADD CONSTRAINT fk_ans_question FOREIGN KEY (question_id) REFERENCES academic_questions (question_id) ON DELETE RESTRICT;

-- 2. Protect audit ledger from user cascade deletion and add actor identity snapshot columns
ALTER TABLE academic_audit_ledger DROP FOREIGN KEY fk_ledger_person;
ALTER TABLE academic_audit_ledger ADD COLUMN actor_role VARCHAR(50) NULL AFTER person_id;
ALTER TABLE academic_audit_ledger ADD COLUMN actor_username VARCHAR(100) NULL AFTER actor_role;

-- 3. Add questions_to_draw setting to academic_quizzes for random subset selection (AC-QZ-05)
ALTER TABLE academic_quizzes ADD COLUMN questions_to_draw INT UNSIGNED NULL DEFAULT NULL AFTER max_attempts;

-- 4. Add ml_enabled toggle to subjects table for per-subject ML feature control (AC-ROL-02)
ALTER TABLE subjects ADD COLUMN ml_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active;
