-- ==============================================================================
-- Joy University Smart Campus ERP - Official Reference Data Seeds
-- Catalogs: Degrees, Course Categories, Designations, Schools, Departments,
-- Academic Years, Academic Terms, and System Configuration Parameters.
-- Note: All statements use INSERT IGNORE for idempotency and safe re-runs.
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. Academic Degrees
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (1, 'BTECH', 'Bachelor of Technology', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (2, 'BDES', 'Bachelor of Design', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (3, 'BSC', 'Bachelor of Science', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (4, 'BSCH', 'Bachelor of Science (Honours)', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (5, 'BCA', 'Bachelor of Computer Applications', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (6, 'BPT', 'Bachelor of Physiotherapy', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (7, 'BBA', 'Bachelor of Business Administration', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (8, 'BCOM', 'Bachelor of Commerce', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (9, 'BA', 'Bachelor of Arts', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (10, 'BALLB', 'Bachelor of Arts & Legislative Law (Honours)', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (11, 'BBALLB', 'Bachelor of Business Administration & Legislative Law (Honours)', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (12, 'LLB', 'Bachelor of Legislative Law (Honours)', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (13, 'BPHARM', 'Bachelor of Pharmacy', 'UG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (14, 'DPHARM', 'Diploma in Pharmacy', 'DIPLOMA');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (15, 'MTECH', 'Master of Technology', 'PG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (16, 'MSC', 'Master of Science', 'PG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (17, 'MBA', 'Master of Business Administration', 'PG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (18, 'LLM', 'Master of Laws', 'PG');
INSERT IGNORE INTO degrees (degree_id, code, name, level) VALUES (19, 'BLIB', 'Bachelor of Library & Information Science', 'UG');

-- ------------------------------------------------------------------------------
-- 2. Course Categories
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO course_categories (category_id, code, name) VALUES (1, 1, 'Foundation');
INSERT IGNORE INTO course_categories (category_id, code, name) VALUES (2, 2, 'Core');
INSERT IGNORE INTO course_categories (category_id, code, name) VALUES (3, 3, 'Professional Elective');
INSERT IGNORE INTO course_categories (category_id, code, name) VALUES (4, 4, 'Open Elective');
INSERT IGNORE INTO course_categories (category_id, code, name) VALUES (5, 5, 'Laboratory');
INSERT IGNORE INTO course_categories (category_id, code, name) VALUES (6, 6, 'Project');
INSERT IGNORE INTO course_categories (category_id, code, name) VALUES (7, 7, 'Internship');

-- ------------------------------------------------------------------------------
-- 3. Faculty & Staff Designations
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO designations (designation_id, name) VALUES (1, 'Professor');
INSERT IGNORE INTO designations (designation_id, name) VALUES (2, 'Associate Professor');
INSERT IGNORE INTO designations (designation_id, name) VALUES (3, 'Assistant Professor');
INSERT IGNORE INTO designations (designation_id, name) VALUES (4, 'Senior Professor');
INSERT IGNORE INTO designations (designation_id, name) VALUES (5, 'Lecturer');
INSERT IGNORE INTO designations (designation_id, name) VALUES (6, 'Teaching Assistant');
INSERT IGNORE INTO designations (designation_id, name) VALUES (7, 'Lab Instructor');

-- ------------------------------------------------------------------------------
-- 4. Constituent Schools (Joy University)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (1, 'SOAGS', 'School of Agricultural Sciences', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (2, 'SOANS', 'School of Arts & Natural Sciences', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (3, 'SOCI', 'School of Computational Intelligence', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (4, 'SOET', 'School of Engineering and Technology', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (5, 'SOEM', 'School of Entrepreneurship and Management', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (6, 'SOL', 'School of Law', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (7, 'SOLHS', 'School of Life & Health Sciences', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (8, 'SON', 'School of Nursing', 1);
INSERT IGNORE INTO schools (school_id, code, name, is_active) VALUES (9, 'SOP', 'School of Pharmacy', 1);

-- ------------------------------------------------------------------------------
-- 5. Academic Departments
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (1, 1, 'AGRI', 'Department of Agricultural Sciences', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (2, 2, 'HSS', 'Department of Humanities & Social Sciences', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (3, 2, 'SCI', 'Department of Sciences', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (4, 2, 'LIS', 'Department of Library & Information Science', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (5, 3, 'CIS', 'Department of Computing & Information Systems', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (6, 4, 'ET', 'Department of Engineering & Technology', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (7, 4, 'DES', 'Department of Design', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (8, 5, 'MGT', 'Department of Management', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (9, 5, 'COM', 'Department of Commerce', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (10, 6, 'LAW', 'Department of Law', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (11, 7, 'AHS', 'Department of Allied Health Sciences', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (12, 7, 'BIO', 'Department of Biotechnology', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (13, 7, 'PHY', 'Department of Physiotherapy', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (14, 8, 'NUR', 'Department of Nursing', 1);
INSERT IGNORE INTO departments (department_id, school_id, code, name, is_active) VALUES (15, 9, 'PHAR', 'Department of Pharmacy', 1);

-- ------------------------------------------------------------------------------
-- 6. Academic Years
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO academic_years (academic_year_id, label, start_date, end_date) VALUES (1, '2023-24', '2023-06-01', '2024-05-31');
INSERT IGNORE INTO academic_years (academic_year_id, label, start_date, end_date) VALUES (2, '2024-25', '2024-06-01', '2025-05-31');
INSERT IGNORE INTO academic_years (academic_year_id, label, start_date, end_date) VALUES (3, '2025-26', '2025-06-01', '2026-05-31');
INSERT IGNORE INTO academic_years (academic_year_id, label, start_date, end_date) VALUES (4, '2026-27', '2026-06-01', '2027-05-31');

-- ------------------------------------------------------------------------------
-- 7. Academic Terms / Semesters
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (1, 1, 'ODD', '2023-06-01', '2023-12-31');
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (2, 1, 'EVEN', '2024-01-01', '2024-05-31');
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (3, 2, 'ODD', '2024-06-01', '2024-12-31');
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (4, 2, 'EVEN', '2025-01-01', '2025-05-31');
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (5, 3, 'ODD', '2025-06-01', '2025-12-31');
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (6, 3, 'EVEN', '2026-01-01', '2026-05-31');
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (7, 4, 'ODD', '2026-06-01', '2026-12-31');
INSERT IGNORE INTO academic_terms (term_id, academic_year_id, term_type, start_date, end_date) VALUES (8, 4, 'EVEN', '2027-01-01', '2027-05-31');

-- ------------------------------------------------------------------------------
-- 8. System Settings
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO system_settings (setting_key, setting_value, value_type, description) VALUES
  ('ATTENDANCE_TOLERANCE_PCT', '5.0', 'DECIMAL', 'Tolerance percentage threshold for biometric vs roster count reconciliation'),
  ('SESSION_GRACE_PERIOD_MINS', '10', 'INT', 'Grace period in minutes before marking late or absent'),
  ('MIN_ATTENDANCE_PERCENTAGE', '75.0', 'DECIMAL', 'Minimum required attendance percentage for examination eligibility');

SET FOREIGN_KEY_CHECKS = 1;
