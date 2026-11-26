-- ==============================================================================
-- Joy University Smart Campus ERP - Development & Staging Demo Seeds
-- CAUTION: FOR LOCAL DEVELOPMENT AND QA VERIFICATION ONLY.
-- DO NOT EXECUTE AUTOMATICALLY IN PRODUCTION ENVIRONMENTS.
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Campus Infrastructure: Blocks
INSERT IGNORE INTO blocks (block_id, code, name, is_active) VALUES
  (1, 'A-BLOCK', 'Academic Block A', 1),
  (2, 'B-BLOCK', 'Academic Block B', 1);

-- 2. Classrooms & Labs
INSERT IGNORE INTO classrooms (classroom_id, block_id, department_id, room_no, room_type, capacity, is_active) VALUES
  (1, 1, 5, 'A101', 'CLASSROOM', 60, 1),
  (2, 1, 5, 'A102', 'SMART_CLASSROOM', 60, 1),
  (3, 1, 5, 'A103', 'CLASSROOM', 50, 1),
  (4, 1, 5, 'A104', 'LAB', 40, 1),
  (5, 2, 5, 'B101', 'SMART_CLASSROOM', 60, 1);

-- 3. Academic Programme
INSERT IGNORE INTO programmes (programme_id, school_id, department_id, degree_id, programme_code, name, partner_track, duration_years, is_active) VALUES
  (97, 3, 5, 1, 'BTAIML', 'B.Tech Artificial Intelligence and Machine Learning', 'STANDARD', 4.0, 1);

-- 4. Faculty Profiles
INSERT IGNORE INTO faculty (faculty_id, employee_code, full_name, email, designation_id, school_id, department_id, is_active) VALUES
  (1, 'FAC001', 'Dr. Rajesh Kumar', 'srajesh.kumar@joyuniversity.edu.in', 1, 3, 5, 1),
  (2, 'FAC002', 'Dr. Anita Sharma', 'anita.sharma@joyuniversity.edu.in', 2, 3, 5, 1);

-- 5. Academic Batches
INSERT IGNORE INTO batches (batch_id, programme_id, start_year_id, label) VALUES
  (1, 97, 1, '2023-27'),
  (4, 97, 4, '2026-30');

-- 6. Academic Subjects
INSERT IGNORE INTO subjects (subject_id, subject_code, name, credits, delivery_type, category_id, owner_school_id, owner_department_id, is_active) VALUES
  (1, 'AIML101', 'Programming for Problem Solving', 4.0, 'THEORY', 2, 3, 5, 1),
  (2, 'AIML102', 'Mathematics for Artificial Intelligence', 4.0, 'THEORY', 2, 3, 5, 1),
  (4, 'AIML104', 'Database Management Systems', 4.0, 'THEORY', 2, 3, 5, 1),
  (6, 'AIML106', 'Programming Laboratory', 1.0, 'LAB', 5, 3, 5, 1);

-- 7. Course Offerings
INSERT IGNORE INTO course_offerings (offering_id, term_id, subject_id, coordinator_faculty_id) VALUES
  (1, 7, 1, 1),
  (2, 7, 2, 2),
  (3, 7, 6, 1),
  (30, 1, 4, 1);

-- 8. Course Sections
INSERT IGNORE INTO sections (section_id, offering_id, batch_id, section_code, max_strength) VALUES
  (1, 30, 4, 'A', 60),
  (2, 2, 4, 'A', 60),
  (3, 3, 4, 'A', 40);

-- 9. Student Profiles
INSERT INTO students (student_id, register_no, full_name, email, batch_id, status) VALUES
  (1, 'J26AIM001', 'Arun Kumar', 'student1@joyuniversity.edu.in', 4, 'ACTIVE'),
  (2, 'JU26AIML002', 'Student Two', 'student2@joyuniversity.edu.in', 4, 'ACTIVE'),
  (3, 'JU26AIML003', 'Student Three', 'student3@joyuniversity.edu.in', 4, 'ACTIVE')
ON DUPLICATE KEY UPDATE register_no = VALUES(register_no), full_name = VALUES(full_name), email = VALUES(email), status = VALUES(status);

-- 10. Student Enrollments
INSERT IGNORE INTO enrollments (enrollment_id, student_id, section_id, registration_type, status, registered_on) VALUES
  (1, 1, 1, 'REGULAR', 'REGISTERED', '2026-06-01'),
  (11, 1, 2, 'REGULAR', 'REGISTERED', '2026-06-01'),
  (21, 1, 3, 'REGULAR', 'REGISTERED', '2026-06-01');

-- 11. Authentication User Accounts (Passwords match .env.example demo credentials)
-- Admin: admin / Admin@123
-- Faculty: FAC001 / Faculty@123
-- Student: J26AIM001 / Student@123
INSERT INTO users (user_id, username, email, password_hash, role, faculty_id, student_id, is_active) VALUES
  (1, 'admin', 'admin@joyuniversity.edu.in', '$2b$10$S815ejeq69wCY3jPdUkuYOLN43GhaIRZoXLVoHBCVojIwY2ny9Nw6', 'ADMIN', NULL, NULL, 1),
  (3, 'J26AIM001', 'student1@joyuniversity.edu.in', '$2b$10$f7GOX3vL0z63ukqt.HmsReuz/Y/O6l.0aqVwqZYU070zEIuHqC6Gq', 'STUDENT', NULL, 1, 1),
  (4, 'FAC001', 'srajesh.kumar@joyuniversity.edu.in', '$2b$10$UfMVaEoXVlZC.cjgS5xeNO1gpRGCdB6Uwc7/gMnseiAxuHsO4Rxre', 'FACULTY', 1, NULL, 1)
ON DUPLICATE KEY UPDATE username = VALUES(username), password_hash = VALUES(password_hash), role = VALUES(role), student_id = VALUES(student_id), faculty_id = VALUES(faculty_id), is_active = VALUES(is_active);

-- 12. Semester Timetable Slots
INSERT IGNORE INTO timetable_slots (slot_id, section_id, faculty_id, classroom_id, day_of_week, start_time, end_time, effective_from, is_active) VALUES
  (1, 1, 1, 1, 1, '09:00:00', '10:00:00', '2026-06-01', 1),
  (2, 2, 1, 2, 2, '10:00:00', '11:00:00', '2026-06-01', 1),
  (3, 3, 1, 4, 3, '14:00:00', '16:00:00', '2026-06-01', 1);

SET FOREIGN_KEY_CHECKS = 1;
