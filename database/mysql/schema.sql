-- ==============================================================================
-- Joy University Smart Campus ERP - Complete Relational MySQL Schema
-- Generated from Authoritative Database Structure
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci | Engine: InnoDB
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- Table: schools
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `schools` (
  `school_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`school_id`),
  UNIQUE KEY `uq_schools_code` (`code`),
  UNIQUE KEY `uq_schools_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: degrees
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `degrees` (
  `degree_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` enum('UG','PG','DOCTORAL','DIPLOMA') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`degree_id`),
  UNIQUE KEY `uq_degrees_code` (`code`),
  UNIQUE KEY `uq_degrees_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: course_categories
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_categories` (
  `category_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` tinyint unsigned NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `uq_cat_code` (`code`),
  UNIQUE KEY `uq_cat_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: designations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `designations` (
  `designation_id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`designation_id`),
  UNIQUE KEY `uq_designation_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_years
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_years` (
  `academic_year_id` int unsigned NOT NULL AUTO_INCREMENT,
  `label` varchar(9) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`academic_year_id`),
  UNIQUE KEY `uq_ay_label` (`label`),
  CONSTRAINT `ck_ay_dates` CHECK ((`end_date` > `start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: blocks
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `blocks` (
  `block_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`block_id`),
  UNIQUE KEY `uq_building_name` (`name`),
  UNIQUE KEY `uq_building_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: departments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `departments` (
  `department_id` int unsigned NOT NULL AUTO_INCREMENT,
  `school_id` int unsigned NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`department_id`),
  UNIQUE KEY `uq_dept_school_name` (`school_id`,`name`),
  UNIQUE KEY `uq_dept_id_school` (`department_id`,`school_id`),
  CONSTRAINT `fk_dept_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_terms
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_terms` (
  `term_id` int unsigned NOT NULL AUTO_INCREMENT,
  `academic_year_id` int unsigned NOT NULL,
  `term_type` enum('ODD','EVEN','SUMMER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`term_id`),
  UNIQUE KEY `uq_term` (`academic_year_id`,`term_type`),
  CONSTRAINT `fk_term_ay` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`academic_year_id`),
  CONSTRAINT `ck_term_dates` CHECK ((`end_date` > `start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: faculty
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `faculty` (
  `faculty_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `blood_group` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `joining_year` smallint unsigned DEFAULT NULL,
  `in_charge_class` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation_id` int unsigned DEFAULT NULL,
  `school_id` int unsigned NOT NULL,
  `department_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`faculty_id`),
  UNIQUE KEY `uq_faculty_code` (`employee_code`),
  UNIQUE KEY `uq_faculty_email` (`email`),
  KEY `ix_faculty_school_dept` (`school_id`,`department_id`),
  KEY `fk_fac_desig` (`designation_id`),
  KEY `fk_fac_dept` (`department_id`,`school_id`),
  CONSTRAINT `fk_fac_dept` FOREIGN KEY (`department_id`, `school_id`) REFERENCES `departments` (`department_id`, `school_id`),
  CONSTRAINT `fk_fac_desig` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`designation_id`),
  CONSTRAINT `fk_fac_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: programmes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `programmes` (
  `programme_id` int unsigned NOT NULL AUTO_INCREMENT,
  `school_id` int unsigned NOT NULL,
  `department_id` int unsigned DEFAULT NULL,
  `degree_id` int unsigned NOT NULL,
  `programme_code` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `partner_track` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'STANDARD',
  `duration_years` decimal(3,1) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`programme_id`),
  UNIQUE KEY `uq_prog_identity` (`school_id`,`degree_id`,`name`,`partner_track`),
  UNIQUE KEY `uq_prog_code` (`programme_code`),
  KEY `fk_prog_degree` (`degree_id`),
  KEY `fk_prog_dept` (`department_id`,`school_id`),
  CONSTRAINT `fk_prog_degree` FOREIGN KEY (`degree_id`) REFERENCES `degrees` (`degree_id`),
  CONSTRAINT `fk_prog_dept` FOREIGN KEY (`department_id`, `school_id`) REFERENCES `departments` (`department_id`, `school_id`),
  CONSTRAINT `fk_prog_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`school_id`),
  CONSTRAINT `ck_prog_duration` CHECK (((`duration_years` > 0) and (`duration_years` <= 8)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: classrooms
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `classrooms` (
  `classroom_id` int unsigned NOT NULL AUTO_INCREMENT,
  `block_id` int unsigned NOT NULL,
  `department_id` int unsigned DEFAULT NULL,
  `room_no` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `room_type` enum('CLASSROOM','SMART_CLASSROOM','LAB','SEMINAR_HALL','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CLASSROOM',
  `capacity` smallint unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`classroom_id`),
  UNIQUE KEY `uq_room` (`block_id`,`room_no`),
  KEY `fk_room_department` (`department_id`),
  CONSTRAINT `fk_room_block` FOREIGN KEY (`block_id`) REFERENCES `blocks` (`block_id`),
  CONSTRAINT `fk_room_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: subjects
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subjects` (
  `subject_id` int unsigned NOT NULL AUTO_INCREMENT,
  `subject_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `credits` decimal(3,1) DEFAULT NULL,
  `delivery_type` enum('THEORY','LAB','PROJECT','INTERNSHIP','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'THEORY',
  `category_id` int unsigned DEFAULT NULL,
  `owner_school_id` int unsigned DEFAULT NULL,
  `owner_department_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `ml_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`subject_id`),
  UNIQUE KEY `uq_subject_code` (`subject_code`),
  KEY `fk_subj_cat` (`category_id`),
  KEY `fk_subj_school` (`owner_school_id`),
  KEY `fk_subj_dept` (`owner_department_id`,`owner_school_id`),
  CONSTRAINT `fk_subj_cat` FOREIGN KEY (`category_id`) REFERENCES `course_categories` (`category_id`),
  CONSTRAINT `fk_subj_dept` FOREIGN KEY (`owner_department_id`, `owner_school_id`) REFERENCES `departments` (`department_id`, `school_id`),
  CONSTRAINT `fk_subj_school` FOREIGN KEY (`owner_school_id`) REFERENCES `schools` (`school_id`),
  CONSTRAINT `ck_subject_owner` CHECK (((`owner_department_id` is null) or (`owner_school_id` is not null)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: programme_subjects
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `programme_subjects` (
  `programme_id` int unsigned NOT NULL,
  `subject_id` int unsigned NOT NULL,
  `year_no` tinyint unsigned DEFAULT NULL,
  `semester_no` tinyint unsigned NOT NULL,
  `nature` enum('MANDATORY','ELECTIVE','OPTIONAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`programme_id`,`subject_id`),
  KEY `ix_ps_prog_sem` (`programme_id`,`semester_no`),
  KEY `ix_ps_subject` (`subject_id`),
  CONSTRAINT `fk_ps_prog` FOREIGN KEY (`programme_id`) REFERENCES `programmes` (`programme_id`),
  CONSTRAINT `fk_ps_subj` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`subject_id`),
  CONSTRAINT `ck_ps_sem` CHECK ((`semester_no` between 1 and 10)),
  CONSTRAINT `ck_ps_year` CHECK ((`year_no` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: batches
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `batches` (
  `batch_id` int unsigned NOT NULL AUTO_INCREMENT,
  `programme_id` int unsigned NOT NULL,
  `start_year_id` int unsigned NOT NULL,
  `label` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`),
  UNIQUE KEY `uq_batch` (`programme_id`,`start_year_id`),
  KEY `fk_batch_year` (`start_year_id`),
  CONSTRAINT `fk_batch_prog` FOREIGN KEY (`programme_id`) REFERENCES `programmes` (`programme_id`),
  CONSTRAINT `fk_batch_year` FOREIGN KEY (`start_year_id`) REFERENCES `academic_years` (`academic_year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: devices
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devices` (
  `device_id` int unsigned NOT NULL AUTO_INCREMENT,
  `device_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_type` enum('RFID_READER','FINGERPRINT_SCANNER','RFID_FP_TERMINAL','CAMERA') COLLATE utf8mb4_unicode_ci NOT NULL,
  `classroom_id` int unsigned NOT NULL,
  `serial_no` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firmware_version` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_key_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','MAINTENANCE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `last_seen_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`device_id`),
  UNIQUE KEY `uq_device_code` (`device_code`),
  UNIQUE KEY `uq_device_serial` (`serial_no`),
  KEY `ix_device_room` (`classroom_id`,`device_type`),
  CONSTRAINT `fk_dev_room` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`classroom_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: course_offerings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_offerings` (
  `offering_id` int unsigned NOT NULL AUTO_INCREMENT,
  `term_id` int unsigned NOT NULL,
  `subject_id` int unsigned NOT NULL,
  `coordinator_faculty_id` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`offering_id`),
  UNIQUE KEY `uq_offering` (`term_id`,`subject_id`),
  KEY `ix_offering_subject` (`subject_id`),
  KEY `fk_off_coord` (`coordinator_faculty_id`),
  CONSTRAINT `fk_off_coord` FOREIGN KEY (`coordinator_faculty_id`) REFERENCES `faculty` (`faculty_id`),
  CONSTRAINT `fk_off_subj` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`subject_id`),
  CONSTRAINT `fk_off_term` FOREIGN KEY (`term_id`) REFERENCES `academic_terms` (`term_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: students
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `students` (
  `student_id` int unsigned NOT NULL AUTO_INCREMENT,
  `register_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `blood_group` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_id` int unsigned NOT NULL,
  `status` enum('ACTIVE','SEMESTER_WITHDRAWAL','INTERNSHIP_BREAK','DISCIPLINARY_WITHDRAWAL','TERMINATED','GRADUATED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `uq_students_regno` (`register_no`),
  UNIQUE KEY `uq_students_email` (`email`),
  KEY `ix_students_batch` (`batch_id`),
  CONSTRAINT `fk_students_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: sections
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sections` (
  `section_id` int unsigned NOT NULL AUTO_INCREMENT,
  `offering_id` int unsigned NOT NULL,
  `batch_id` int unsigned DEFAULT NULL,
  `section_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_strength` smallint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`section_id`),
  UNIQUE KEY `uq_section` (`offering_id`,`section_code`),
  KEY `idx_sections_batch_id` (`batch_id`),
  CONSTRAINT `fk_sec_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sec_off` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `blood_group` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `joining_year` smallint unsigned DEFAULT NULL,
  `employee_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('ADMIN','FACULTY','STUDENT','OPERATOR','VIEWER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `faculty_id` int unsigned DEFAULT NULL,
  `student_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `failed_login_count` smallint unsigned NOT NULL DEFAULT '0',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_faculty` (`faculty_id`),
  UNIQUE KEY `uq_users_student_id` (`student_id`),
  CONSTRAINT `fk_users_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty` (`faculty_id`),
  CONSTRAINT `fk_users_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: rfid_cards
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rfid_cards` (
  `card_id` int unsigned NOT NULL AUTO_INCREMENT,
  `card_uid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` int unsigned NOT NULL,
  `status` enum('ACTIVE','LOST','BLOCKED','RETIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `issued_on` date NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `active_student_key` int unsigned GENERATED ALWAYS AS (if((`status` = _utf8mb4'ACTIVE'),`student_id`,NULL)) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`card_id`),
  UNIQUE KEY `uq_card_uid` (`card_uid`),
  UNIQUE KEY `uq_one_active_card` (`active_student_key`),
  KEY `ix_card_student` (`student_id`),
  CONSTRAINT `fk_card_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: fingerprint_templates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fingerprint_templates` (
  `template_id` int unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int unsigned NOT NULL,
  `finger_index` tinyint unsigned NOT NULL,
  `template_data` varbinary(8192) NOT NULL,
  `template_format` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_version` smallint unsigned NOT NULL DEFAULT '1',
  `quality_score` tinyint unsigned DEFAULT NULL,
  `enrolled_device_id` int unsigned DEFAULT NULL,
  `enrolled_by` int unsigned DEFAULT NULL,
  `enrolled_at` datetime NOT NULL,
  `status` enum('ACTIVE','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `revoked_at` datetime DEFAULT NULL,
  `active_slot` bigint unsigned GENERATED ALWAYS AS (if((`status` = _utf8mb4'ACTIVE'),((`student_id` * 10) + `finger_index`),NULL)) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`),
  UNIQUE KEY `uq_one_active_per_finger` (`active_slot`),
  KEY `ix_fp_student` (`student_id`,`status`),
  KEY `fk_fp_device` (`enrolled_device_id`),
  KEY `fk_fp_user` (`enrolled_by`),
  CONSTRAINT `fk_fp_device` FOREIGN KEY (`enrolled_device_id`) REFERENCES `devices` (`device_id`),
  CONSTRAINT `fk_fp_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `fk_fp_user` FOREIGN KEY (`enrolled_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `ck_fp_finger` CHECK ((`finger_index` between 0 and 9))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: enrollments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enrollments` (
  `enrollment_id` int unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int unsigned NOT NULL,
  `section_id` int unsigned NOT NULL,
  `registration_type` enum('REGULAR','BACKLOG','IMPROVEMENT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'REGULAR',
  `status` enum('REGISTERED','DROPPED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'REGISTERED',
  `registered_on` date NOT NULL,
  `dropped_on` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `uq_enrollment` (`student_id`,`section_id`),
  KEY `ix_enr_section_status` (`section_id`,`status`),
  CONSTRAINT `fk_enr_section` FOREIGN KEY (`section_id`) REFERENCES `sections` (`section_id`),
  CONSTRAINT `fk_enr_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `ck_enr_drop` CHECK (((`dropped_on` is null) or (`dropped_on` >= `registered_on`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: timetable_slots
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `timetable_slots` (
  `slot_id` int unsigned NOT NULL AUTO_INCREMENT,
  `section_id` int unsigned NOT NULL,
  `faculty_id` int unsigned NOT NULL,
  `classroom_id` int unsigned NOT NULL,
  `day_of_week` tinyint unsigned NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`slot_id`),
  UNIQUE KEY `uq_slot` (`section_id`,`day_of_week`,`start_time`,`effective_from`),
  KEY `ix_slot_room` (`classroom_id`,`day_of_week`,`start_time`),
  KEY `ix_slot_faculty` (`faculty_id`,`day_of_week`,`start_time`),
  CONSTRAINT `fk_slot_fac` FOREIGN KEY (`faculty_id`) REFERENCES `faculty` (`faculty_id`),
  CONSTRAINT `fk_slot_room` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`classroom_id`),
  CONSTRAINT `fk_slot_sec` FOREIGN KEY (`section_id`) REFERENCES `sections` (`section_id`),
  CONSTRAINT `ck_slot_dow` CHECK ((`day_of_week` between 1 and 7)),
  CONSTRAINT `ck_slot_eff` CHECK (((`effective_to` is null) or (`effective_to` >= `effective_from`))),
  CONSTRAINT `ck_slot_time` CHECK ((`end_time` > `start_time`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: device_template_sync
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `device_template_sync` (
  `device_id` int unsigned NOT NULL,
  `template_id` int unsigned NOT NULL,
  `sync_status` enum('PENDING','SYNCED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `synced_at` datetime DEFAULT NULL,
  PRIMARY KEY (`device_id`,`template_id`),
  KEY `ix_dts_template` (`template_id`),
  CONSTRAINT `fk_dts_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`),
  CONSTRAINT `fk_dts_template` FOREIGN KEY (`template_id`) REFERENCES `fingerprint_templates` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: revoked_tokens
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `revoked_tokens` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `jti` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jti` (`jti`),
  KEY `idx_revoked_tokens_jti` (`jti`),
  KEY `idx_revoked_tokens_expires_at` (`expires_at`),
  KEY `idx_revoked_tokens_user_id` (`user_id`),
  CONSTRAINT `fk_revoked_tokens_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: system_settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_type` enum('INT','DECIMAL','BOOL','STRING','JSON') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`),
  KEY `fk_settings_user` (`updated_by`),
  CONSTRAINT `fk_settings_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_holidays
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_holidays` (
  `holiday_id` int unsigned NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`holiday_id`),
  UNIQUE KEY `uq_holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: class_sessions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `class_sessions` (
  `session_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slot_id` int unsigned NOT NULL,
  `session_date` date NOT NULL,
  `faculty_id` int unsigned NOT NULL,
  `classroom_id` int unsigned NOT NULL,
  `scheduled_start` datetime NOT NULL,
  `scheduled_end` datetime NOT NULL,
  `present_until` datetime NOT NULL,
  `late_until` datetime NOT NULL,
  `status` enum('SCHEDULED','OPEN','CLOSED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SCHEDULED',
  `opened_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `closed_by_user` int unsigned DEFAULT NULL,
  `cancel_reason` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `uq_session_slot_start` (`slot_id`,`scheduled_start`),
  KEY `ix_session_slot_date` (`slot_id`,`session_date`),
  KEY `ix_session_room_window` (`classroom_id`,`status`,`scheduled_start`,`scheduled_end`),
  KEY `ix_session_faculty_date` (`faculty_id`,`session_date`),
  KEY `ix_session_date_status` (`session_date`,`status`),
  KEY `fk_sess_user` (`closed_by_user`),
  CONSTRAINT `fk_sess_fac` FOREIGN KEY (`faculty_id`) REFERENCES `faculty` (`faculty_id`),
  CONSTRAINT `fk_sess_room` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`classroom_id`),
  CONSTRAINT `fk_sess_slot` FOREIGN KEY (`slot_id`) REFERENCES `timetable_slots` (`slot_id`),
  CONSTRAINT `fk_sess_user` FOREIGN KEY (`closed_by_user`) REFERENCES `users` (`user_id`),
  CONSTRAINT `ck_session_times` CHECK (((`scheduled_end` > `scheduled_start`) and (`late_until` >= `present_until`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: attendance_records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance_records` (
  `attendance_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint unsigned NOT NULL,
  `enrollment_id` int unsigned NOT NULL,
  `status` enum('PRESENT','LATE','ABSENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` enum('DEVICE','SYSTEM_CLOSE','CORRECTION','MANUAL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `rfid_card_id` int unsigned DEFAULT NULL,
  `fingerprint_template_id` int unsigned DEFAULT NULL,
  `device_id` int unsigned DEFAULT NULL,
  `rfid_scanned_at` datetime(3) DEFAULT NULL,
  `fingerprint_verified_at` datetime(3) DEFAULT NULL,
  `scan_event_ref` char(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `marked_at` datetime(3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_id`),
  UNIQUE KEY `uq_att_session_enrollment` (`session_id`,`enrollment_id`),
  KEY `ix_att_enrollment_status` (`enrollment_id`,`status`),
  KEY `ix_att_session_status` (`session_id`,`status`),
  KEY `fk_att_card` (`rfid_card_id`),
  KEY `fk_att_fp` (`fingerprint_template_id`),
  KEY `fk_att_device` (`device_id`),
  CONSTRAINT `fk_att_card` FOREIGN KEY (`rfid_card_id`) REFERENCES `rfid_cards` (`card_id`),
  CONSTRAINT `fk_att_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`),
  CONSTRAINT `fk_att_enroll` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`enrollment_id`),
  CONSTRAINT `fk_att_fp` FOREIGN KEY (`fingerprint_template_id`) REFERENCES `fingerprint_templates` (`template_id`),
  CONSTRAINT `fk_att_session` FOREIGN KEY (`session_id`) REFERENCES `class_sessions` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: session_reconciliation
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `session_reconciliation` (
  `reconciliation_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint unsigned NOT NULL,
  `enrolled_count` smallint unsigned NOT NULL,
  `attended_count` smallint unsigned NOT NULL,
  `headcount` smallint unsigned DEFAULT NULL,
  `snapshots_used` smallint unsigned NOT NULL DEFAULT '0',
  `variance` smallint DEFAULT NULL,
  `variance_pct` decimal(5,2) DEFAULT NULL,
  `tolerance_pct` decimal(5,2) NOT NULL,
  `result` enum('MATCH','MISMATCH','NO_HEADCOUNT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `review_status` enum('NOT_REQUIRED','PENDING_REVIEW','REVIEWED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_REQUIRED',
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `computed_at` datetime NOT NULL,
  PRIMARY KEY (`reconciliation_id`),
  UNIQUE KEY `uq_recon_session` (`session_id`),
  KEY `ix_recon_review` (`review_status`,`result`),
  KEY `fk_recon_user` (`reviewed_by`),
  CONSTRAINT `fk_recon_session` FOREIGN KEY (`session_id`) REFERENCES `class_sessions` (`session_id`),
  CONSTRAINT `fk_recon_user` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: attendance_corrections
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance_corrections` (
  `correction_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `attendance_id` bigint unsigned NOT NULL,
  `previous_status` enum('PRESENT','LATE','ABSENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `new_status` enum('PRESENT','LATE','ABSENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason_code` enum('MEDICAL_LEAVE','ON_DUTY_LEAVE','DEVICE_FAILURE','FACULTY_OVERRIDE','DATA_ENTRY_ERROR','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supporting_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requested_by` int unsigned NOT NULL,
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approval_status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `decided_by` int unsigned DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  PRIMARY KEY (`correction_id`),
  KEY `ix_corr_attendance` (`attendance_id`),
  KEY `ix_corr_status` (`approval_status`,`requested_at`),
  KEY `fk_corr_req` (`requested_by`),
  KEY `fk_corr_dec` (`decided_by`),
  CONSTRAINT `fk_corr_att` FOREIGN KEY (`attendance_id`) REFERENCES `attendance_records` (`attendance_id`),
  CONSTRAINT `fk_corr_dec` FOREIGN KEY (`decided_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_corr_req` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `ck_corr_change` CHECK ((`previous_status` <> `new_status`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- Academic Module Tables (Migration 007)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: subject_staff_assignments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subject_staff_assignments` (
  `assignment_id` int unsigned NOT NULL AUTO_INCREMENT,
  `subject_id` int unsigned NOT NULL,
  `faculty_id` int unsigned NOT NULL,
  `role` enum('Subject Staff','Co-Teacher','Lab Assistant') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Subject Staff',
  `assigned_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`assignment_id`),
  UNIQUE KEY `uq_subject_faculty_role` (`subject_id`,`faculty_id`,`role`),
  KEY `fk_ssa_faculty` (`faculty_id`),
  KEY `fk_ssa_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_ssa_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ssa_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty` (`faculty_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ssa_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`subject_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_topics
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_topics` (
  `topic_id` int unsigned NOT NULL AUTO_INCREMENT,
  `subject_id` int unsigned NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `position` int unsigned NOT NULL DEFAULT '1',
  `quiz_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`topic_id`),
  KEY `idx_topics_subject_pos` (`subject_id`,`position`),
  KEY `fk_topic_creator` (`created_by`),
  CONSTRAINT `fk_topic_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_topic_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`subject_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_materials
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_materials` (
  `material_id` int unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` int unsigned NOT NULL,
  `type` enum('PDF','Video','Slide','Link','Notes') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `file_ref` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` int unsigned NOT NULL DEFAULT '1',
  `status` enum('Draft','Published') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `required_flag` tinyint(1) NOT NULL DEFAULT '0',
  `position` int unsigned NOT NULL DEFAULT '1',
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint unsigned DEFAULT NULL,
  `virus_scan_status` enum('PENDING','CLEAN','INFECTED','SKIPPED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CLEAN',
  `extracted_text_ref` longtext COLLATE utf8mb4_unicode_ci,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`material_id`),
  KEY `idx_materials_topic_status` (`topic_id`,`status`),
  KEY `fk_material_creator` (`created_by`),
  CONSTRAINT `fk_material_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_material_topic` FOREIGN KEY (`topic_id`) REFERENCES `academic_topics` (`topic_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_material_versions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_material_versions` (
  `version_id` int unsigned NOT NULL AUTO_INCREMENT,
  `material_id` int unsigned NOT NULL,
  `version` int unsigned NOT NULL,
  `file_ref` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint unsigned DEFAULT NULL,
  `change_summary` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version_id`),
  UNIQUE KEY `uq_mat_version` (`material_id`,`version`),
  KEY `fk_matver_creator` (`created_by`),
  CONSTRAINT `fk_matver_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_matver_material` FOREIGN KEY (`material_id`) REFERENCES `academic_materials` (`material_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_material_progress
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_material_progress` (
  `progress_id` int unsigned NOT NULL AUTO_INCREMENT,
  `person_id` int unsigned NOT NULL,
  `material_id` int unsigned NOT NULL,
  `percent` int unsigned NOT NULL DEFAULT '0',
  `status` enum('NOT_STARTED','IN_PROGRESS','COMPLETED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NOT_STARTED',
  `completed_at` datetime DEFAULT NULL,
  `last_accessed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`progress_id`),
  UNIQUE KEY `uq_progress_person_mat` (`person_id`,`material_id`),
  KEY `idx_progress_mat` (`material_id`),
  CONSTRAINT `fk_progress_material` FOREIGN KEY (`material_id`) REFERENCES `academic_materials` (`material_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_progress_person` FOREIGN KEY (`person_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_questions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_questions` (
  `question_id` int unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` int unsigned NOT NULL,
  `type` enum('MCQ','TrueFalse','ShortAnswer') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MCQ',
  `text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` json DEFAULT NULL,
  `answer` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `explanation` text COLLATE utf8mb4_unicode_ci,
  `marks` decimal(5,2) NOT NULL DEFAULT '1.00',
  `difficulty` enum('Easy','Medium','Hard') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Medium',
  `source_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origin` enum('Manual','ML') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Manual',
  `approved_by` int unsigned DEFAULT NULL,
  `status` enum('Draft','Approved','Archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Approved',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`question_id`),
  KEY `idx_questions_topic_status` (`topic_id`,`status`),
  KEY `fk_quest_approver` (`approved_by`),
  KEY `fk_quest_creator` (`created_by`),
  CONSTRAINT `fk_quest_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quest_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quest_topic` FOREIGN KEY (`topic_id`) REFERENCES `academic_topics` (`topic_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_quizzes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_quizzes` (
  `quiz_id` int unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` int unsigned NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `version` int unsigned NOT NULL DEFAULT '1',
  `time_limit` int unsigned NOT NULL DEFAULT '30',
  `pass_mark` decimal(5,2) NOT NULL DEFAULT '50.00',
  `max_attempts` int unsigned NOT NULL DEFAULT '3',
  `open_at` datetime DEFAULT NULL,
  `close_at` datetime DEFAULT NULL,
  `status` enum('Draft','Published','Archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `questions_to_draw` int unsigned DEFAULT NULL,
  `shuffle_questions` tinyint(1) NOT NULL DEFAULT '1',
  `shuffle_options` tinyint(1) NOT NULL DEFAULT '1',
  `show_explanation` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`quiz_id`),
  UNIQUE KEY `topic_id` (`topic_id`),
  KEY `fk_quiz_creator` (`created_by`),
  CONSTRAINT `fk_quiz_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quiz_topic` FOREIGN KEY (`topic_id`) REFERENCES `academic_topics` (`topic_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_attempts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_attempts` (
  `attempt_id` int unsigned NOT NULL AUTO_INCREMENT,
  `quiz_id` int unsigned NOT NULL,
  `person_id` int unsigned NOT NULL,
  `attempt_number` int unsigned NOT NULL DEFAULT '1',
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `max_score` decimal(5,2) DEFAULT NULL,
  `percentage` decimal(5,2) DEFAULT NULL,
  `result` enum('PASSED','FAILED','PENDING') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `status` enum('IN_PROGRESS','SUBMITTED','TIMED_OUT','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_PROGRESS',
  `question_set` json NOT NULL,
  `idempotency_key` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`attempt_id`),
  UNIQUE KEY `idempotency_key` (`idempotency_key`),
  KEY `idx_attempt_quiz_person` (`quiz_id`,`person_id`,`attempt_number`),
  KEY `fk_attempt_person` (`person_id`),
  CONSTRAINT `fk_attempt_person` FOREIGN KEY (`person_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attempt_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `academic_quizzes` (`quiz_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_attempt_answers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_attempt_answers` (
  `answer_id` int unsigned NOT NULL AUTO_INCREMENT,
  `attempt_id` int unsigned NOT NULL,
  `question_id` int unsigned NOT NULL,
  `answer` text COLLATE utf8mb4_unicode_ci,
  `is_correct` tinyint(1) DEFAULT NULL,
  `marks_awarded` decimal(5,2) NOT NULL DEFAULT '0.00',
  `answered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`answer_id`),
  UNIQUE KEY `uq_attempt_question` (`attempt_id`,`question_id`),
  KEY `fk_ans_question` (`question_id`),
  CONSTRAINT `fk_ans_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `academic_attempts` (`attempt_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ans_question` FOREIGN KEY (`question_id`) REFERENCES `academic_questions` (`question_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_score_corrections
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_score_corrections` (
  `correction_id` int unsigned NOT NULL AUTO_INCREMENT,
  `attempt_id` int unsigned NOT NULL,
  `previous_score` decimal(5,2) NOT NULL,
  `new_score` decimal(5,2) NOT NULL,
  `reason_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `justification` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `corrected_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`correction_id`),
  KEY `fk_scorecorr_attempt` (`attempt_id`),
  KEY `fk_scorecorr_user` (`corrected_by`),
  CONSTRAINT `fk_scorecorr_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `academic_attempts` (`attempt_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scorecorr_user` FOREIGN KEY (`corrected_by`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_permission_matrix
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_permission_matrix` (
  `policy_id` int unsigned NOT NULL AUTO_INCREMENT,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `allowed_roles` json NOT NULL,
  `requires_subject_staff` tinyint(1) NOT NULL DEFAULT '1',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`policy_id`),
  UNIQUE KEY `action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_audit_ledger
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_audit_ledger` (
  `ledger_id` int unsigned NOT NULL AUTO_INCREMENT,
  `person_id` int unsigned NOT NULL,
  `actor_role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `reason_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`ledger_id`),
  KEY `idx_ledger_person` (`person_id`),
  KEY `idx_ledger_event` (`event_type`),
  KEY `idx_ledger_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table: academic_ml_jobs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_ml_jobs` (
  `job_id` int unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` int unsigned NOT NULL,
  `material_id` int unsigned DEFAULT NULL,
  `job_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'QUESTION_GENERATION',
  `status` enum('PENDING','PROCESSING','COMPLETED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `requested_by` int unsigned NOT NULL,
  `result_summary` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`job_id`),
  KEY `fk_mljob_topic` (`topic_id`),
  KEY `fk_mljob_material` (`material_id`),
  KEY `fk_mljob_user` (`requested_by`),
  CONSTRAINT `fk_mljob_material` FOREIGN KEY (`material_id`) REFERENCES `academic_materials` (`material_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mljob_topic` FOREIGN KEY (`topic_id`) REFERENCES `academic_topics` (`topic_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mljob_user` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
