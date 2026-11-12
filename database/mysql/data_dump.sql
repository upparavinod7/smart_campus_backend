-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: localhost    Database: smart_campus
-- ------------------------------------------------------
-- Server version	8.4.11-0ubuntu0.26.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `academic_attempt_answers`
--

DROP TABLE IF EXISTS `academic_attempt_answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_attempt_answers` (
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
  CONSTRAINT `fk_ans_question` FOREIGN KEY (`question_id`) REFERENCES `academic_questions` (`question_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_attempt_answers`
--

LOCK TABLES `academic_attempt_answers` WRITE;
/*!40000 ALTER TABLE `academic_attempt_answers` DISABLE KEYS */;
INSERT INTO `academic_attempt_answers` (`answer_id`, `attempt_id`, `question_id`, `answer`, `is_correct`, `marks_awarded`, `answered_at`) VALUES (46,18,32,'Big-O Notation',1,2.00,'2026-11-12 10:54:57'),(47,18,33,'Loop Invariant & Variant',1,2.00,'2026-11-12 10:54:57'),(48,18,34,'True',1,1.00,'2026-11-12 10:54:57'),(49,18,35,'O(n)',0,0.00,'2026-11-12 10:54:57');
/*!40000 ALTER TABLE `academic_attempt_answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_attempts`
--

DROP TABLE IF EXISTS `academic_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_attempts` (
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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_attempts`
--

LOCK TABLES `academic_attempts` WRITE;
/*!40000 ALTER TABLE `academic_attempts` DISABLE KEYS */;
INSERT INTO `academic_attempts` (`attempt_id`, `quiz_id`, `person_id`, `attempt_number`, `started_at`, `expires_at`, `submitted_at`, `score`, `max_score`, `percentage`, `result`, `status`, `question_set`, `idempotency_key`) VALUES (18,16,3,1,'2026-11-11 10:54:57','2026-11-11 11:54:57','2026-11-11 11:09:57',6.00,7.00,85.71,'PASSED','SUBMITTED','[{\"text\": \"Which metric best characterizes worst-case algorithmic scalability as input size n grows?\", \"type\": \"MCQ\", \"marks\": 2, \"options\": [\"Big-O Notation\", \"Constant Offset\", \"Clock Frequency\", \"Memory Address\"], \"difficulty\": \"Easy\", \"question_id\": 32}, {\"text\": \"Which property ensures an iterative algorithm terminates cleanly across all valid inputs?\", \"type\": \"MCQ\", \"marks\": 2, \"options\": [\"Loop Invariant & Variant\", \"Global Variables\", \"Dynamic Casting\", \"Static Linking\"], \"difficulty\": \"Medium\", \"question_id\": 33}, {\"text\": \"An O(n log n) algorithm scales strictly better than an O(n^2) algorithm for sufficiently large n.\", \"type\": \"TrueFalse\", \"marks\": 1, \"options\": [\"True\", \"False\"], \"difficulty\": \"Easy\", \"question_id\": 34}, {\"text\": \"What is the space complexity of an in-place iterative reversal using only constant pointers?\", \"type\": \"MCQ\", \"marks\": 2, \"options\": [\"O(1)\", \"O(log n)\", \"O(n)\", \"O(n^2)\"], \"difficulty\": \"Medium\", \"question_id\": 35}]','seed_attempt_16_3_1');
/*!40000 ALTER TABLE `academic_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_audit_ledger`
--

DROP TABLE IF EXISTS `academic_audit_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_audit_ledger` (
  `ledger_id` int unsigned NOT NULL AUTO_INCREMENT,
  `person_id` int unsigned NOT NULL,
  `location_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `reason_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`ledger_id`),
  KEY `idx_ledger_person` (`person_id`),
  KEY `idx_ledger_event` (`event_type`),
  KEY `idx_ledger_timestamp` (`timestamp`),
  CONSTRAINT `fk_ledger_person` FOREIGN KEY (`person_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=165 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_audit_ledger`
--

LOCK TABLES `academic_audit_ledger` WRITE;
/*!40000 ALTER TABLE `academic_audit_ledger` DISABLE KEYS */;
INSERT INTO `academic_audit_ledger` (`ledger_id`, `person_id`, `location_id`, `timestamp`, `event_type`, `payload`, `reason_code`) VALUES (160,4,'ACAD-TOPIC-16','2026-11-12 10:54:57','MATERIAL_UPLOAD','{\"title\": \"Unit 1 Comprehensive Lecture Notes (v2)\", \"materialId\": 19}',NULL),(161,3,'ACAD-MAT-19','2026-11-12 10:54:57','MATERIAL_COMPLETED','{\"percent\": 100, \"materialId\": 19}',NULL),(162,3,'ACAD-QUIZ-16','2026-11-12 10:54:57','QUIZ_ATTEMPT_START','{\"attemptId\": 18, \"attemptNumber\": 1}',NULL),(163,3,'ACAD-QUIZ-16','2026-11-12 10:54:57','QUIZ_SUBMIT','{\"score\": 6, \"result\": \"PASSED\", \"maxScore\": 7, \"attemptId\": 18}',NULL),(164,4,'ACAD-QUIZ-16','2026-11-12 10:54:57','SCORE_CORRECTION','{\"newScore\": 6, \"attemptId\": 18, \"previousScore\": 5}','PARTIAL_STEP_CREDIT');
/*!40000 ALTER TABLE `academic_audit_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_holidays`
--

DROP TABLE IF EXISTS `academic_holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_holidays` (
  `holiday_id` int unsigned NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`holiday_id`),
  UNIQUE KEY `uq_holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_holidays`
--

LOCK TABLES `academic_holidays` WRITE;
/*!40000 ALTER TABLE `academic_holidays` DISABLE KEYS */;
/*!40000 ALTER TABLE `academic_holidays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_material_progress`
--

DROP TABLE IF EXISTS `academic_material_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_material_progress` (
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
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_material_progress`
--

LOCK TABLES `academic_material_progress` WRITE;
/*!40000 ALTER TABLE `academic_material_progress` DISABLE KEYS */;
INSERT INTO `academic_material_progress` (`progress_id`, `person_id`, `material_id`, `percent`, `status`, `completed_at`, `last_accessed_at`) VALUES (15,3,19,100,'COMPLETED','2026-11-10 10:54:57','2026-11-12 10:54:57'),(16,3,20,100,'COMPLETED','2026-11-10 10:54:57','2026-11-12 10:54:57'),(17,203,19,60,'IN_PROGRESS',NULL,'2026-11-12 10:54:57'),(18,3,23,50,'IN_PROGRESS',NULL,'2026-11-12 10:54:57'),(19,3,25,100,'COMPLETED','2026-11-12 10:54:57','2026-11-12 10:54:57');
/*!40000 ALTER TABLE `academic_material_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_material_versions`
--

DROP TABLE IF EXISTS `academic_material_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_material_versions` (
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
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_material_versions`
--

LOCK TABLES `academic_material_versions` WRITE;
/*!40000 ALTER TABLE `academic_material_versions` DISABLE KEYS */;
INSERT INTO `academic_material_versions` (`version_id`, `material_id`, `version`, `file_ref`, `mime_type`, `file_size`, `change_summary`, `created_by`, `created_at`) VALUES (20,19,1,'/home/upparavinod7/Desktop/smart campus/smart_campus_backend/storage/materials/demo_AIML102_foundations_v2.pdf','application/pdf',831,'Initial publication',4,'2026-11-12 05:24:57'),(21,19,2,'/home/upparavinod7/Desktop/smart campus/smart_campus_backend/storage/materials/demo_AIML102_foundations_v2.pdf','application/pdf',831,'Updated examples and typo fixes',4,'2026-11-12 05:24:57'),(22,20,1,'https://visualgo.net/en','text/uri-list',NULL,'Initial publication',4,'2026-11-12 05:24:57'),(23,21,1,NULL,'text/plain',NULL,'Initial publication',4,'2026-11-12 05:24:57'),(24,22,1,'/home/upparavinod7/Desktop/smart campus/smart_campus_backend/storage/materials/demo_AIML102_draft_slides.txt','text/plain',93,'Initial publication',4,'2026-11-12 05:24:57'),(25,23,1,'/home/upparavinod7/Desktop/smart campus/smart_campus_backend/storage/materials/demo_AIML102_topic2_guide.pdf','application/pdf',771,'Initial publication',4,'2026-11-12 05:24:57'),(26,24,1,NULL,'text/plain',NULL,'Initial publication',4,'2026-11-12 05:24:57'),(27,25,1,NULL,'text/plain',NULL,'Initial publication',4,'2026-11-12 05:24:57'),(28,26,1,NULL,'text/plain',NULL,'Initial publication',4,'2026-11-12 05:24:57');
/*!40000 ALTER TABLE `academic_material_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_materials`
--

DROP TABLE IF EXISTS `academic_materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_materials` (
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
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_materials`
--

LOCK TABLES `academic_materials` WRITE;
/*!40000 ALTER TABLE `academic_materials` DISABLE KEYS */;
INSERT INTO `academic_materials` (`material_id`, `topic_id`, `type`, `title`, `description`, `file_ref`, `version`, `status`, `required_flag`, `position`, `mime_type`, `file_size`, `virus_scan_status`, `extracted_text_ref`, `created_by`, `created_at`, `updated_at`) VALUES (19,16,'PDF','Unit 1 Comprehensive Lecture Notes (v2)','Mandatory reading covering foundational definitions and worked proofs.','/home/upparavinod7/Desktop/smart campus/smart_campus_backend/storage/materials/demo_AIML102_foundations_v2.pdf',2,'Published',1,1,'application/pdf',831,'CLEAN','Overview of core principles and analytical bounds. Worked examples covering worst-case and average-case analysis.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(20,16,'Link','Interactive Concept Visualizer Reference','External interactive visualization lab tool.','https://visualgo.net/en',1,'Published',1,2,'text/uri-list',NULL,'CLEAN','External interactive visualization lab tool.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(21,16,'Notes','Optional Supplemental Practice Sheet','Extra ungraded practice problems with step-by-step hints.',NULL,1,'Published',0,3,'text/plain',NULL,'CLEAN','Extra ungraded practice problems with step-by-step hints.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(22,16,'Slide','Instructor Draft: Advanced Extensions Slides','Unpublished draft visible only to faculty and admins.','/home/upparavinod7/Desktop/smart campus/smart_campus_backend/storage/materials/demo_AIML102_draft_slides.txt',1,'Draft',0,4,'text/plain',93,'CLEAN','Unpublished draft visible only to faculty and admins.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(23,17,'PDF','Required Reading: Core Algorithms & Workflows','Currently in-progress (50%) for demo student J26AIM001.','/home/upparavinod7/Desktop/smart campus/smart_campus_backend/storage/materials/demo_AIML102_topic2_guide.pdf',1,'Published',1,1,'application/pdf',771,'CLEAN','Currently in-progress (50%) for demo student J26AIM001.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(24,17,'Notes','Required Checklist: Common Edge Cases & Proofs','Not yet started by J26AIM001 — blocks Topic 2 quiz until marked 100%.',NULL,1,'Published',1,2,'text/plain',NULL,'CLEAN','Not yet started by J26AIM001 — blocks Topic 2 quiz until marked 100%.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(25,18,'Notes','AIML103 Quick Reference Summary','Essential concepts summary marked complete for J26AIM001.',NULL,1,'Published',1,1,'text/plain',NULL,'CLEAN','Essential concepts summary marked complete for J26AIM001.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(26,19,'Notes','Lab Instructions & Rubric','Step-by-step instructions for laboratory evaluation.',NULL,1,'Published',1,1,'text/plain',NULL,'CLEAN','Step-by-step instructions for laboratory evaluation.',4,'2026-11-12 05:24:57','2026-11-12 05:24:57');
/*!40000 ALTER TABLE `academic_materials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_ml_jobs`
--

DROP TABLE IF EXISTS `academic_ml_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_ml_jobs` (
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_ml_jobs`
--

LOCK TABLES `academic_ml_jobs` WRITE;
/*!40000 ALTER TABLE `academic_ml_jobs` DISABLE KEYS */;
INSERT INTO `academic_ml_jobs` (`job_id`, `topic_id`, `material_id`, `job_type`, `status`, `requested_by`, `result_summary`, `created_at`, `updated_at`) VALUES (2,16,19,'QUESTION_GENERATION','COMPLETED',4,'{\"note\": \"ML schema compatibility placeholder\", \"generated_drafts\": 1}','2026-11-12 05:24:57','2026-11-12 05:24:57');
/*!40000 ALTER TABLE `academic_ml_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_permission_matrix`
--

DROP TABLE IF EXISTS `academic_permission_matrix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_permission_matrix` (
  `policy_id` int unsigned NOT NULL AUTO_INCREMENT,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `allowed_roles` json NOT NULL,
  `requires_subject_staff` tinyint(1) NOT NULL DEFAULT '1',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`policy_id`),
  UNIQUE KEY `action` (`action`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_permission_matrix`
--

LOCK TABLES `academic_permission_matrix` WRITE;
/*!40000 ALTER TABLE `academic_permission_matrix` DISABLE KEYS */;
INSERT INTO `academic_permission_matrix` (`policy_id`, `action`, `allowed_roles`, `requires_subject_staff`, `description`, `updated_at`) VALUES (1,'MANAGE_TOPICS','[\"ADMIN\", \"FACULTY\"]',1,'Create, edit, and manage topics for assigned subjects','2026-11-12 05:07:38'),(2,'UPLOAD_MATERIALS','[\"ADMIN\", \"FACULTY\"]',1,'Upload or create study materials','2026-11-05 04:17:53'),(3,'PUBLISH_MATERIALS','[\"ADMIN\", \"FACULTY\"]',1,'Publish or unpublish materials','2026-11-05 04:17:53'),(4,'AUTHOR_QUESTIONS','[\"ADMIN\", \"FACULTY\"]',1,'Manage question bank items','2026-11-05 04:17:53'),(5,'CONFIGURE_QUIZ','[\"ADMIN\", \"FACULTY\"]',1,'Create and configure topic quizzes','2026-11-05 04:17:53'),(6,'PREVIEW_QUIZ','[\"ADMIN\", \"FACULTY\"]',1,'Preview quiz questions and layout','2026-11-05 04:17:53'),(7,'ATTEMPT_QUIZ','[\"STUDENT\"]',0,'Start and submit quiz attempts','2026-11-05 04:17:53'),(8,'VIEW_ANALYTICS','[\"ADMIN\", \"FACULTY\"]',1,'View student progress and quiz performance metrics','2026-11-05 04:17:53'),(9,'CORRECT_SCORE','[\"ADMIN\", \"FACULTY\"]',1,'Manually correct or override attempt scores','2026-11-05 04:17:53'),(10,'MANAGE_STAFF','[\"ADMIN\", \"FACULTY\"]',0,'Assign faculty to subjects','2026-11-05 04:17:53');
/*!40000 ALTER TABLE `academic_permission_matrix` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_questions`
--

DROP TABLE IF EXISTS `academic_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_questions` (
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
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_questions`
--

LOCK TABLES `academic_questions` WRITE;
/*!40000 ALTER TABLE `academic_questions` DISABLE KEYS */;
INSERT INTO `academic_questions` (`question_id`, `topic_id`, `type`, `text`, `options`, `answer`, `explanation`, `marks`, `difficulty`, `source_ref`, `origin`, `approved_by`, `status`, `created_by`, `created_at`, `updated_at`) VALUES (32,16,'MCQ','Which metric best characterizes worst-case algorithmic scalability as input size n grows?','[\"Big-O Notation\", \"Constant Offset\", \"Clock Frequency\", \"Memory Address\"]','Big-O Notation','Big-O describes the upper bound growth rate as input size approaches infinity.',2.00,'Easy','material:19','Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(33,16,'MCQ','Which property ensures an iterative algorithm terminates cleanly across all valid inputs?','[\"Loop Invariant & Variant\", \"Global Variables\", \"Dynamic Casting\", \"Static Linking\"]','Loop Invariant & Variant','A decreasing variant bounded below guarantees loop termination.',2.00,'Medium',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(34,16,'TrueFalse','An O(n log n) algorithm scales strictly better than an O(n^2) algorithm for sufficiently large n.','[\"True\", \"False\"]','True','Linearithmic growth is asymptotically slower than quadratic growth.',1.00,'Easy',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(35,16,'MCQ','What is the space complexity of an in-place iterative reversal using only constant pointers?','[\"O(1)\", \"O(log n)\", \"O(n)\", \"O(n^2)\"]','O(1)','Only a fixed number of pointer variables are allocated regardless of input length.',2.00,'Medium',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(36,16,'MCQ','[ML Suggested Draft] Which technique trades extra memory space for faster lookup performance?','[\"Hashing / Memoization\", \"Bubble Sort\", \"Linear Scan\", \"Recursion Unrolling\"]','Hashing / Memoization','Caching computed results or using hash tables improves lookup speed.',1.00,'Easy','material:19','ML',NULL,'Draft',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(37,17,'MCQ','Which traversal order uses a FIFO Queue to explore nodes level-by-level?','[\"Breadth-First Search (BFS)\", \"Depth-First Search (DFS)\", \"Postorder\", \"Topological Backtrack\"]','Breadth-First Search (BFS)','BFS uses a Queue (FIFO) to explore all neighbors at the current depth first.',2.00,'Easy',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(38,17,'TrueFalse','A Stack follows the Last-In, First-Out (LIFO) ordering principle.','[\"True\", \"False\"]','True','Push and pop always operate on the top element of the stack.',1.00,'Easy',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(39,18,'MCQ','When starting a timed quiz attempt in Smart Campus, which server rule enforces fairness?','[\"Frozen sanitized question snapshot + server expires_at\", \"Client-side timer only\", \"Sending correct answers inside initial quiz payload\", \"Unlimited unauthenticated retries\"]','Frozen sanitized question snapshot + server expires_at','Answer keys are stripped from student payloads and expiry is checked on the server.',2.00,'Medium',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(40,18,'TrueFalse','Submitting the same quiz attempt twice with an idempotency key prevents duplicate grade rows.','[\"True\", \"False\"]','True','Duplicate submit requests return the existing evaluated score record.',1.00,'Easy',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(41,19,'TrueFalse','Unit tests and boundary checks must pass before lab submission.','[\"True\", \"False\"]','True','Automated grading validates edge cases alongside nominal behavior.',1.00,'Easy',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(42,20,'TrueFalse','Enrolled students only may access this quiz.','[\"True\", \"False\"]','True',NULL,1.00,'Medium',NULL,'Manual',4,'Approved',4,'2026-11-12 05:24:57','2026-11-12 05:24:57');
/*!40000 ALTER TABLE `academic_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_quizzes`
--

DROP TABLE IF EXISTS `academic_quizzes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_quizzes` (
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_quizzes`
--

LOCK TABLES `academic_quizzes` WRITE;
/*!40000 ALTER TABLE `academic_quizzes` DISABLE KEYS */;
INSERT INTO `academic_quizzes` (`quiz_id`, `topic_id`, `title`, `description`, `version`, `time_limit`, `pass_mark`, `max_attempts`, `open_at`, `close_at`, `status`, `shuffle_questions`, `shuffle_options`, `show_explanation`, `created_by`, `created_at`, `updated_at`) VALUES (16,16,'Topic 1 Assessment: AIML102','Covers foundational notes and interactive reference concepts.',1,20,60.00,3,'2026-11-05 10:54:57','2027-02-10 10:54:57','Published',1,1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(17,17,'Topic 2 Unlock Verification Quiz','Locked until all required Topic 2 materials reach 100% completion.',1,15,50.00,2,'2026-11-10 10:54:57','2027-02-10 10:54:57','Published',1,1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(18,18,'AIML103 Ready Quiz','Unlocked & ready for immediate student attempt.',1,15,50.00,3,'2026-11-11 10:54:57','2027-02-10 10:54:57','Published',1,1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(19,19,'AIML106 Scheduled Upcoming Quiz','Scheduled to open in the future (tests open_at window rule).',1,10,50.00,2,'2026-11-19 10:54:57','2026-12-12 10:54:57','Published',1,1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(20,20,'AIML101 Restricted Quiz','Restricted to students registered in this subject.',1,10,50.00,1,NULL,NULL,'Published',1,1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57');
/*!40000 ALTER TABLE `academic_quizzes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_score_corrections`
--

DROP TABLE IF EXISTS `academic_score_corrections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_score_corrections` (
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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_score_corrections`
--

LOCK TABLES `academic_score_corrections` WRITE;
/*!40000 ALTER TABLE `academic_score_corrections` DISABLE KEYS */;
INSERT INTO `academic_score_corrections` (`correction_id`, `attempt_id`, `previous_score`, `new_score`, `reason_code`, `justification`, `corrected_by`, `created_at`) VALUES (11,18,5.00,6.00,'PARTIAL_STEP_CREDIT','Granted 1 additional point after manual review of working step submission.',4,'2026-11-12 05:24:57');
/*!40000 ALTER TABLE `academic_score_corrections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_terms`
--

DROP TABLE IF EXISTS `academic_terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_terms` (
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
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_terms`
--

LOCK TABLES `academic_terms` WRITE;
/*!40000 ALTER TABLE `academic_terms` DISABLE KEYS */;
INSERT INTO `academic_terms` (`term_id`, `academic_year_id`, `term_type`, `start_date`, `end_date`, `created_at`, `updated_at`) VALUES (1,1,'ODD','2023-06-01','2023-12-31','2026-09-24 09:38:26','2026-09-24 09:38:26'),(2,1,'EVEN','2024-01-01','2024-05-31','2026-09-24 09:38:26','2026-09-24 09:38:26'),(3,2,'ODD','2024-06-01','2024-12-31','2026-09-24 09:38:26','2026-09-24 09:38:26'),(4,2,'EVEN','2025-01-01','2025-05-31','2026-09-24 09:38:26','2026-09-24 09:38:26'),(5,3,'ODD','2025-06-01','2025-12-31','2026-09-24 09:38:26','2026-09-24 09:38:26'),(6,3,'EVEN','2026-01-01','2026-05-31','2026-09-24 09:38:26','2026-09-24 09:38:26'),(7,4,'ODD','2026-06-01','2026-12-31','2026-09-24 09:38:26','2026-09-24 09:38:26'),(8,4,'EVEN','2027-01-01','2027-05-31','2026-09-24 09:38:26','2026-09-24 09:38:26');
/*!40000 ALTER TABLE `academic_terms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_topics`
--

DROP TABLE IF EXISTS `academic_topics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_topics` (
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_topics`
--

LOCK TABLES `academic_topics` WRITE;
/*!40000 ALTER TABLE `academic_topics` DISABLE KEYS */;
INSERT INTO `academic_topics` (`topic_id`, `subject_id`, `title`, `description`, `position`, `quiz_enabled`, `created_by`, `created_at`, `updated_at`) VALUES (16,2,'Foundations & Core Principles (AIML102)','Core concepts, complexity foundations, and mathematical intuition.',1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(17,2,'Structured Problem Solving & Applied Models','Complete both required materials below to unlock the Topic 2 Quiz (AC-STU-03).',2,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(18,3,'Ready-to-Take Module (AIML103)','Required materials already completed by J26AIM001; quiz is unlocked with 0 attempts so far.',1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(19,6,'Practical Drill & Upcoming Quiz (AIML106)','Contains a lab manual and an upcoming scheduled quiz window.',1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(20,1,'Restricted Subject Topic (AIML101)','Student J26AIM001 is NOT enrolled in this subject (verifies 403 enrollment guard).',1,1,4,'2026-11-12 05:24:57','2026-11-12 05:24:57');
/*!40000 ALTER TABLE `academic_topics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_years`
--

DROP TABLE IF EXISTS `academic_years`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_years` (
  `academic_year_id` int unsigned NOT NULL AUTO_INCREMENT,
  `label` varchar(9) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`academic_year_id`),
  UNIQUE KEY `uq_ay_label` (`label`),
  CONSTRAINT `ck_ay_dates` CHECK ((`end_date` > `start_date`))
) ENGINE=InnoDB AUTO_INCREMENT=165 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_years`
--

LOCK TABLES `academic_years` WRITE;
/*!40000 ALTER TABLE `academic_years` DISABLE KEYS */;
INSERT INTO `academic_years` (`academic_year_id`, `label`, `start_date`, `end_date`, `created_at`, `updated_at`) VALUES (1,'2023-24','2023-06-01','2024-05-31','2026-09-24 09:36:32','2026-09-24 09:36:32'),(2,'2024-25','2024-06-01','2025-05-31','2026-09-24 09:36:32','2026-09-24 09:36:32'),(3,'2025-26','2025-06-01','2026-05-31','2026-09-24 09:36:32','2026-09-24 09:36:32'),(4,'2026-27','2026-06-01','2027-05-31','2026-09-24 09:36:32','2026-09-24 09:36:32');
/*!40000 ALTER TABLE `academic_years` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_corrections`
--

DROP TABLE IF EXISTS `attendance_corrections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_corrections` (
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
) ENGINE=InnoDB AUTO_INCREMENT=246 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_corrections`
--

LOCK TABLES `attendance_corrections` WRITE;
/*!40000 ALTER TABLE `attendance_corrections` DISABLE KEYS */;
INSERT INTO `attendance_corrections` (`correction_id`, `attendance_id`, `previous_status`, `new_status`, `reason_code`, `reason_note`, `supporting_ref`, `requested_by`, `requested_at`, `approval_status`, `decided_by`, `decided_at`) VALUES (54,539,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 10:39:47','APPROVED',1,'2026-10-23 10:39:47'),(55,543,'ABSENT','PRESENT','FACULTY_OVERRIDE','permission',NULL,1,'2026-10-23 10:40:07','APPROVED',1,'2026-10-23 10:40:07'),(61,540,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 10:48:59','APPROVED',1,'2026-10-23 10:48:59'),(79,957,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:58:54','APPROVED',1,'2026-10-23 13:58:54'),(80,958,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:59:04','APPROVED',1,'2026-10-23 13:59:04'),(81,959,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:59:11','APPROVED',1,'2026-10-23 13:59:11'),(82,960,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:59:14','APPROVED',1,'2026-10-23 13:59:14'),(83,961,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:59:19','APPROVED',1,'2026-10-23 13:59:19'),(84,962,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:59:21','APPROVED',1,'2026-10-23 13:59:21'),(85,963,'PRESENT','ABSENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:59:26','APPROVED',1,'2026-10-23 13:59:26'),(86,964,'PRESENT','LATE','ON_DUTY_LEAVE',NULL,NULL,1,'2026-10-23 13:59:35','APPROVED',1,'2026-10-23 13:59:35'),(87,965,'PRESENT','LATE','MEDICAL_LEAVE',NULL,NULL,1,'2026-10-23 13:59:47','APPROVED',1,'2026-10-23 13:59:47'),(88,966,'PRESENT','LATE','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 13:59:55','APPROVED',1,'2026-10-23 13:59:55'),(92,1020,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:13','APPROVED',1,'2026-10-23 14:00:13'),(93,1021,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:18','APPROVED',1,'2026-10-23 14:00:18'),(94,1022,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:21','APPROVED',1,'2026-10-23 14:00:21'),(95,1023,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:24','APPROVED',1,'2026-10-23 14:00:24'),(96,1024,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:26','APPROVED',1,'2026-10-23 14:00:26'),(97,1025,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:30','APPROVED',1,'2026-10-23 14:00:30'),(98,1026,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:33','APPROVED',1,'2026-10-23 14:00:33'),(99,1027,'PRESENT','ABSENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:00:40','APPROVED',1,'2026-10-23 14:00:40'),(100,1028,'PRESENT','LATE','DATA_ENTRY_ERROR',NULL,NULL,1,'2026-10-23 14:00:53','APPROVED',1,'2026-10-23 14:00:53'),(101,1029,'PRESENT','ABSENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:01','APPROVED',1,'2026-10-23 14:01:01'),(102,1030,'PRESENT','LATE','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:17','APPROVED',1,'2026-10-23 14:01:17'),(103,1031,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:21','APPROVED',1,'2026-10-23 14:01:21'),(104,1032,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:23','APPROVED',1,'2026-10-23 14:01:23'),(105,1033,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:25','APPROVED',1,'2026-10-23 14:01:25'),(106,1034,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:30','APPROVED',1,'2026-10-23 14:01:30'),(107,1035,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:34','APPROVED',1,'2026-10-23 14:01:34'),(108,1036,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:50','APPROVED',1,'2026-10-23 14:01:50'),(109,1037,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:52','APPROVED',1,'2026-10-23 14:01:52'),(110,1038,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:01:55','APPROVED',1,'2026-10-23 14:01:55'),(111,1039,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:02:05','APPROVED',1,'2026-10-23 14:02:05'),(112,1040,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:02:08','APPROVED',1,'2026-10-23 14:02:08'),(113,1041,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:02:10','APPROVED',1,'2026-10-23 14:02:10'),(114,1042,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:02:12','APPROVED',1,'2026-10-23 14:02:12'),(115,1043,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:02:14','APPROVED',1,'2026-10-23 14:02:14'),(116,1044,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:02:18','APPROVED',1,'2026-10-23 14:02:18'),(117,1045,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-23 14:02:22','APPROVED',1,'2026-10-23 14:02:22'),(136,1396,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-26 14:28:14','APPROVED',1,'2026-10-26 14:28:14'),(137,1397,'ABSENT','PRESENT','FACULTY_OVERRIDE',NULL,NULL,1,'2026-10-26 14:29:00','APPROVED',1,'2026-10-26 14:29:00');
/*!40000 ALTER TABLE `attendance_corrections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_records`
--

DROP TABLE IF EXISTS `attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_records` (
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
) ENGINE=InnoDB AUTO_INCREMENT=3320 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_records`
--

LOCK TABLES `attendance_records` WRITE;
/*!40000 ALTER TABLE `attendance_records` DISABLE KEYS */;
INSERT INTO `attendance_records` (`attendance_id`, `session_id`, `enrollment_id`, `status`, `source`, `rfid_card_id`, `fingerprint_template_id`, `device_id`, `rfid_scanned_at`, `fingerprint_verified_at`, `scan_event_ref`, `marked_at`, `created_at`, `updated_at`) VALUES (1,3,1,'PRESENT','DEVICE',1,1,2,'2026-06-01 08:55:10.000','2026-06-01 08:55:15.000','SCAN202606010001','2026-06-01 08:55:15.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(2,3,2,'PRESENT','DEVICE',2,2,2,'2026-06-01 08:56:10.000','2026-06-01 08:56:15.000','SCAN202606010002','2026-06-01 08:56:15.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(3,3,3,'LATE','DEVICE',3,3,2,'2026-06-01 09:05:10.000','2026-06-01 09:05:15.000','SCAN202606010003','2026-06-01 09:05:15.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(4,3,4,'PRESENT','DEVICE',4,4,2,'2026-06-01 08:57:10.000','2026-06-01 08:57:15.000','SCAN202606010004','2026-06-01 08:57:15.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(5,3,5,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-01 10:15:00.000','2026-09-24 15:29:51','2026-09-24 15:39:15'),(6,3,6,'PRESENT','DEVICE',6,6,2,'2026-06-01 08:58:10.000','2026-06-01 08:58:15.000','SCAN202606010006','2026-06-01 08:58:15.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(7,3,7,'LATE','DEVICE',7,7,2,'2026-06-01 09:08:10.000','2026-06-01 09:08:15.000','SCAN202606010007','2026-06-01 09:08:15.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(8,3,8,'PRESENT','DEVICE',8,8,2,'2026-06-01 08:59:10.000','2026-06-01 08:59:15.000','SCAN202606010008','2026-06-01 08:59:15.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(9,3,9,'PRESENT','DEVICE',9,9,2,'2026-06-01 08:59:30.000','2026-06-01 08:59:35.000','SCAN202606010009','2026-06-01 08:59:35.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(10,3,10,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-01 10:00:00.000','2026-09-24 15:29:51','2026-09-24 15:29:51'),(11,5,1,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-25 14:49:57.000','2026-09-25 09:19:57','2026-09-25 09:19:57'),(12,5,2,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-25 14:51:28.000','2026-09-25 09:21:28','2026-09-25 09:21:28'),(13,5,3,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-25 15:38:39.000','2026-09-25 09:21:42','2026-09-25 10:08:39'),(14,5,4,'ABSENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-09-25 14:52:33.000','2026-09-25 09:22:33','2026-09-25 09:22:33'),(246,186,5,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 10:53:59.000','2026-10-21 05:23:59','2026-10-21 05:23:59'),(247,186,6,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 10:54:00.000','2026-10-21 05:24:00','2026-10-21 05:24:00'),(248,186,7,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 10:54:03.000','2026-10-21 05:24:03','2026-10-21 05:24:03'),(249,186,8,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 10:54:04.000','2026-10-21 05:24:04','2026-10-21 05:24:04'),(250,186,9,'ABSENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 10:54:09.000','2026-10-21 05:24:05','2026-10-21 05:24:09'),(251,186,10,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 10:54:07.000','2026-10-21 05:24:07','2026-10-21 05:24:07'),(310,186,1,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:56:01.175','2026-10-21 06:26:01','2026-10-21 06:26:01'),(311,186,2,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:56:01.175','2026-10-21 06:26:01','2026-10-21 06:26:01'),(312,186,3,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:56:01.175','2026-10-21 06:26:01','2026-10-21 06:26:01'),(313,186,4,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:56:01.175','2026-10-21 06:26:01','2026-10-21 06:26:01'),(317,240,21,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:17.000','2026-10-21 06:29:17','2026-10-21 06:29:17'),(318,240,22,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:18.000','2026-10-21 06:29:18','2026-10-21 06:29:18'),(319,240,23,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:19.000','2026-10-21 06:29:19','2026-10-21 06:29:19'),(320,240,24,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:20.000','2026-10-21 06:29:20','2026-10-21 06:29:20'),(321,240,25,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:22.000','2026-10-21 06:29:22','2026-10-21 06:29:22'),(322,240,26,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:23.000','2026-10-21 06:29:23','2026-10-21 06:29:23'),(323,240,27,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:25.000','2026-10-21 06:29:25','2026-10-21 06:29:25'),(324,240,28,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:55.000','2026-10-21 06:29:26','2026-10-21 06:29:55'),(325,240,29,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 11:59:56.000','2026-10-21 06:29:53','2026-10-21 06:29:56'),(326,240,30,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-21 12:00:02.836','2026-10-21 06:30:02','2026-10-21 06:30:02'),(534,274,11,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 09:19:23.000','2026-10-23 03:49:23','2026-10-23 03:49:23'),(535,274,12,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 09:19:25.000','2026-10-23 03:49:25','2026-10-23 03:49:25'),(536,274,13,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 09:19:28.000','2026-10-23 03:49:28','2026-10-23 03:49:28'),(537,274,14,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 09:19:30.000','2026-10-23 03:49:30','2026-10-23 03:49:30'),(538,274,15,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 09:19:35.000','2026-10-23 03:49:35','2026-10-23 03:49:35'),(539,274,16,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 10:39:47.000','2026-10-23 03:49:48','2026-10-23 05:09:47'),(540,274,17,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 10:48:59.000','2026-10-23 03:49:48','2026-10-23 05:18:59'),(541,274,18,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 09:19:48.368','2026-10-23 03:49:48','2026-10-23 03:49:48'),(542,274,19,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 09:19:48.368','2026-10-23 03:49:48','2026-10-23 03:49:48'),(543,274,20,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 10:40:07.000','2026-10-23 03:49:48','2026-10-23 05:10:07'),(957,1,21,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:58:54.000','2026-10-23 08:28:54','2026-10-23 08:28:54'),(958,1,22,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:04.000','2026-10-23 08:29:04','2026-10-23 08:29:04'),(959,1,23,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:11.000','2026-10-23 08:29:11','2026-10-23 08:29:11'),(960,1,24,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:14.000','2026-10-23 08:29:14','2026-10-23 08:29:14'),(961,1,25,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:19.000','2026-10-23 08:29:19','2026-10-23 08:29:19'),(962,1,27,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:21.000','2026-10-23 08:29:21','2026-10-23 08:29:21'),(963,1,28,'ABSENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:26.000','2026-10-23 08:29:26','2026-10-23 08:29:26'),(964,1,26,'LATE','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:35.000','2026-10-23 08:29:35','2026-10-23 08:29:35'),(965,1,29,'LATE','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:47.000','2026-10-23 08:29:47','2026-10-23 08:29:47'),(966,1,30,'LATE','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 13:59:55.000','2026-10-23 08:29:55','2026-10-23 08:29:55'),(1020,2,11,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:13.000','2026-10-23 08:30:13','2026-10-23 08:30:13'),(1021,2,12,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:18.000','2026-10-23 08:30:18','2026-10-23 08:30:18'),(1022,2,13,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:21.000','2026-10-23 08:30:21','2026-10-23 08:30:21'),(1023,2,14,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:24.000','2026-10-23 08:30:24','2026-10-23 08:30:24'),(1024,2,15,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:26.000','2026-10-23 08:30:26','2026-10-23 08:30:26'),(1025,2,16,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:30.000','2026-10-23 08:30:30','2026-10-23 08:30:30'),(1026,2,17,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:33.000','2026-10-23 08:30:33','2026-10-23 08:30:33'),(1027,2,18,'ABSENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:40.000','2026-10-23 08:30:40','2026-10-23 08:30:40'),(1028,2,19,'LATE','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:00:53.000','2026-10-23 08:30:53','2026-10-23 08:30:53'),(1029,2,20,'ABSENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:01.000','2026-10-23 08:31:01','2026-10-23 08:31:01'),(1030,5,5,'LATE','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:17.000','2026-10-23 08:31:17','2026-10-23 08:31:17'),(1031,5,6,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:21.000','2026-10-23 08:31:21','2026-10-23 08:31:21'),(1032,5,7,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:23.000','2026-10-23 08:31:23','2026-10-23 08:31:23'),(1033,5,8,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:25.000','2026-10-23 08:31:25','2026-10-23 08:31:25'),(1034,5,9,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:30.000','2026-10-23 08:31:30','2026-10-23 08:31:30'),(1035,5,10,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:34.000','2026-10-23 08:31:34','2026-10-23 08:31:34'),(1036,4,1,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:50.000','2026-10-23 08:31:50','2026-10-23 08:31:50'),(1037,4,2,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:52.000','2026-10-23 08:31:52','2026-10-23 08:31:52'),(1038,4,3,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:01:55.000','2026-10-23 08:31:55','2026-10-23 08:31:55'),(1039,4,4,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:02:05.000','2026-10-23 08:32:05','2026-10-23 08:32:05'),(1040,4,5,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:02:08.000','2026-10-23 08:32:07','2026-10-23 08:32:08'),(1041,4,6,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:02:10.000','2026-10-23 08:32:10','2026-10-23 08:32:10'),(1042,4,7,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:02:12.000','2026-10-23 08:32:12','2026-10-23 08:32:12'),(1043,4,8,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:02:14.000','2026-10-23 08:32:14','2026-10-23 08:32:14'),(1044,4,9,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:02:18.000','2026-10-23 08:32:18','2026-10-23 08:32:18'),(1045,4,10,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:02:22.000','2026-10-23 08:32:22','2026-10-23 08:32:22'),(1046,356,11,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:13.000','2026-10-23 08:38:13','2026-10-23 08:38:13'),(1047,356,12,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:14.000','2026-10-23 08:38:14','2026-10-23 08:38:14'),(1048,356,13,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:14.000','2026-10-23 08:38:14','2026-10-23 08:38:14'),(1049,356,14,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:15.000','2026-10-23 08:38:15','2026-10-23 08:38:15'),(1050,356,15,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:18.000','2026-10-23 08:38:18','2026-10-23 08:38:18'),(1051,356,16,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:20.000','2026-10-23 08:38:20','2026-10-23 08:38:20'),(1052,356,17,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:21.000','2026-10-23 08:38:21','2026-10-23 08:38:21'),(1053,356,19,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:23.000','2026-10-23 08:38:23','2026-10-23 08:38:23'),(1054,356,18,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:24.000','2026-10-23 08:38:24','2026-10-23 08:38:24'),(1055,356,20,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-23 14:08:27.000','2026-10-23 08:38:27','2026-10-23 08:38:27'),(1385,412,21,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:04.000','2026-10-26 08:45:04','2026-10-26 08:45:04'),(1386,412,22,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:05.000','2026-10-26 08:45:05','2026-10-26 08:45:05'),(1387,412,23,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:07.000','2026-10-26 08:45:07','2026-10-26 08:45:07'),(1388,412,24,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:09.000','2026-10-26 08:45:09','2026-10-26 08:45:09'),(1389,412,25,'PRESENT','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:10.000','2026-10-26 08:45:10','2026-10-26 08:45:10'),(1390,412,26,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:12.000','2026-10-26 08:45:12','2026-10-26 08:45:12'),(1391,412,27,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:13.000','2026-10-26 08:45:13','2026-10-26 08:45:13'),(1392,412,28,'LATE','MANUAL',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:13.000','2026-10-26 08:45:13','2026-10-26 08:45:13'),(1393,412,29,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:21.633','2026-10-26 08:45:21','2026-10-26 08:45:21'),(1394,412,30,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:15:21.633','2026-10-26 08:45:21','2026-10-26 08:45:21'),(1396,413,11,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:14.000','2026-10-26 08:58:14','2026-10-26 08:58:14'),(1397,413,12,'PRESENT','CORRECTION',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:29:00.000','2026-10-26 08:58:20','2026-10-26 08:59:00'),(1398,413,13,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20'),(1399,413,14,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20'),(1400,413,15,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20'),(1401,413,16,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20'),(1402,413,17,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20'),(1403,413,18,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20'),(1404,413,19,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20'),(1405,413,20,'ABSENT','SYSTEM_CLOSE',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-26 14:28:20.180','2026-10-26 08:58:20','2026-10-26 08:58:20');
/*!40000 ALTER TABLE `attendance_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batches`
--

DROP TABLE IF EXISTS `batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `batches` (
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
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batches`
--

LOCK TABLES `batches` WRITE;
/*!40000 ALTER TABLE `batches` DISABLE KEYS */;
INSERT INTO `batches` (`batch_id`, `programme_id`, `start_year_id`, `label`, `created_at`, `updated_at`) VALUES (1,97,1,'2023-27','2026-10-21 04:37:11','2026-10-21 04:37:11'),(4,97,4,'2026-30','2026-09-24 09:43:11','2026-09-24 09:43:11'),(68,137,2,'2024 - 28','2026-10-28 06:33:38','2026-10-28 06:34:00'),(69,137,1,'2023 - 27','2026-10-28 06:35:01','2026-10-28 06:35:01');
/*!40000 ALTER TABLE `batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blocks`
--

DROP TABLE IF EXISTS `blocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocks` (
  `block_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`block_id`),
  UNIQUE KEY `uq_building_name` (`name`),
  UNIQUE KEY `uq_building_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blocks`
--

LOCK TABLES `blocks` WRITE;
/*!40000 ALTER TABLE `blocks` DISABLE KEYS */;
INSERT INTO `blocks` (`block_id`, `code`, `name`, `is_active`, `created_at`, `updated_at`) VALUES (1,'A-BLOCK','Academic Block A',0,'2026-09-24 10:21:08','2026-10-15 16:48:27'),(2,'B-BLOCK','Academic Block B',0,'2026-09-24 10:21:08','2026-10-15 16:48:32'),(3,'C-BLOCK. updated','Academic Block C. updated',0,'2026-09-25 06:11:20','2026-09-25 06:12:26'),(4,'B309931','Block_Test_1790761309931_Updated',0,'2026-09-30 09:41:49','2026-09-30 09:41:49'),(7,'B586587','Block_Test_1790761586587_Updated test',1,'2026-09-30 09:46:26','2026-11-02 05:28:47'),(36,'joveena','Joveena',1,'2026-10-09 05:03:46','2026-10-09 05:03:46'),(37,'joshua','Joshua',1,'2026-10-09 05:04:14','2026-10-09 05:04:14'),(38,'juliana','Juliana',1,'2026-10-09 05:04:39','2026-10-09 05:04:39'),(39,'admin','Administrative',1,'2026-10-09 05:05:04','2026-10-09 05:05:04'),(40,'francis','Francis',1,'2026-10-09 05:05:38','2026-10-09 05:05:38'),(41,'adhiharam','Adhiharam',1,'2026-10-09 05:06:03','2026-10-09 05:06:03'),(42,'arul','Arul',1,'2026-10-09 05:06:43','2026-10-09 05:06:43'),(43,'joe','Joe',1,'2026-10-09 05:07:26','2026-10-09 05:07:26'),(44,'gino','Gino',1,'2026-10-09 05:09:13','2026-10-09 05:09:13'),(45,'sosai','Sosai',1,'2026-10-09 05:09:27','2026-10-09 05:09:27');
/*!40000 ALTER TABLE `blocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `class_sessions`
--

DROP TABLE IF EXISTS `class_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `class_sessions` (
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
  KEY `ix_session_room_window` (`classroom_id`,`status`,`scheduled_start`,`scheduled_end`),
  KEY `ix_session_faculty_date` (`faculty_id`,`session_date`),
  KEY `ix_session_date_status` (`session_date`,`status`),
  KEY `fk_sess_user` (`closed_by_user`),
  KEY `ix_session_slot_date` (`slot_id`,`session_date`),
  CONSTRAINT `fk_sess_fac` FOREIGN KEY (`faculty_id`) REFERENCES `faculty` (`faculty_id`),
  CONSTRAINT `fk_sess_room` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`classroom_id`),
  CONSTRAINT `fk_sess_slot` FOREIGN KEY (`slot_id`) REFERENCES `timetable_slots` (`slot_id`),
  CONSTRAINT `fk_sess_user` FOREIGN KEY (`closed_by_user`) REFERENCES `users` (`user_id`),
  CONSTRAINT `ck_session_times` CHECK (((`scheduled_end` > `scheduled_start`) and (`late_until` >= `present_until`)))
) ENGINE=InnoDB AUTO_INCREMENT=738 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `class_sessions`
--

LOCK TABLES `class_sessions` WRITE;
/*!40000 ALTER TABLE `class_sessions` DISABLE KEYS */;
INSERT INTO `class_sessions` (`session_id`, `slot_id`, `session_date`, `faculty_id`, `classroom_id`, `scheduled_start`, `scheduled_end`, `present_until`, `late_until`, `status`, `opened_at`, `closed_at`, `closed_by_user`, `cancel_reason`, `created_at`, `updated_at`) VALUES (1,3,'2026-06-03',1,4,'2026-06-03 14:00:00','2026-06-03 16:00:00','2026-06-03 14:10:00','2026-06-03 14:20:00','CLOSED','2026-06-03 14:00:00','2026-09-28 20:13:43',1,NULL,'2026-09-24 15:20:43','2026-09-28 14:43:43'),(2,2,'2026-06-02',2,2,'2026-06-02 10:00:00','2026-06-02 11:00:00','2026-06-02 10:10:00','2026-06-02 10:20:00','CLOSED','2026-06-02 10:00:00','2026-09-28 20:13:42',1,NULL,'2026-09-24 15:24:06','2026-09-28 14:43:42'),(3,1,'2026-06-01',1,1,'2026-06-01 09:00:00','2026-06-01 10:00:00','2026-06-01 09:10:00','2026-06-01 09:20:00','CLOSED','2026-06-01 09:00:00','2026-06-01 10:00:00',1,NULL,'2026-09-24 15:25:51','2026-09-24 15:32:52'),(4,1,'2026-06-10',1,1,'2026-06-10 09:00:00','2026-06-10 10:00:00','2026-06-10 09:10:00','2026-06-10 09:20:00','CLOSED','2026-09-25 13:52:33','2026-09-25 13:57:39',1,NULL,'2026-09-25 06:58:38','2026-09-25 08:27:39'),(5,1,'2026-06-11',1,1,'2026-06-11 09:00:00','2026-06-11 10:00:00','2026-06-11 09:10:00','2026-06-11 09:20:00','CLOSED','2026-09-25 14:49:41','2026-09-28 20:13:40',1,NULL,'2026-09-25 09:19:08','2026-09-28 14:43:40'),(6,1,'2026-09-28',1,7,'2026-09-28 09:00:00','2026-09-28 10:00:00','2026-09-28 09:15:00','2026-09-28 09:30:00','CLOSED','2026-09-28 20:13:33','2026-09-28 20:13:36',1,NULL,'2026-09-28 14:43:30','2026-09-28 14:43:36'),(186,1,'2026-10-22',1,1,'2026-10-22 09:00:00','2026-10-22 10:00:00','2026-10-22 09:00:00','2026-10-22 10:00:00','CLOSED','2026-10-21 10:53:54','2026-10-21 10:54:26',4,NULL,'2026-10-21 05:23:51','2026-10-21 05:24:26'),(240,3,'2026-10-21',1,4,'2026-10-21 14:00:00','2026-10-21 16:00:00','2026-10-21 14:00:00','2026-10-21 16:00:00','CLOSED','2026-10-21 11:59:14','2026-10-21 12:00:02',4,NULL,'2026-10-21 06:29:12','2026-10-21 06:30:02'),(274,112,'2026-10-23',1,5,'2026-10-23 11:00:00','2026-10-23 12:00:00','2026-10-23 11:00:00','2026-10-23 12:00:00','CLOSED','2026-10-23 09:19:15','2026-10-23 09:19:48',4,NULL,'2026-10-23 03:49:13','2026-10-23 03:49:48'),(356,2,'2026-10-23',1,1,'2026-10-23 09:00:00','2026-10-23 10:00:00','2026-10-23 09:15:00','2026-10-23 09:30:00','CLOSED','2026-10-23 14:08:09','2026-10-23 14:08:35',4,NULL,'2026-10-23 08:37:44','2026-10-23 08:38:35'),(412,3,'2026-10-26',1,4,'2026-10-26 14:00:00','2026-10-26 16:00:00','2026-10-26 14:00:00','2026-10-26 16:00:00','CLOSED','2026-10-26 14:14:55','2026-10-26 14:15:21',4,NULL,'2026-10-26 08:44:50','2026-10-26 08:45:21'),(413,2,'2026-10-26',2,2,'2026-10-26 09:00:00','2026-10-26 10:00:00','2026-10-26 09:15:00','2026-10-26 09:30:00','CLOSED','2026-10-26 14:28:03','2026-10-26 14:28:20',1,NULL,'2026-10-26 08:57:51','2026-10-26 08:58:20');
/*!40000 ALTER TABLE `class_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `classrooms`
--

DROP TABLE IF EXISTS `classrooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classrooms` (
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
) ENGINE=InnoDB AUTO_INCREMENT=142 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `classrooms`
--

LOCK TABLES `classrooms` WRITE;
/*!40000 ALTER TABLE `classrooms` DISABLE KEYS */;
INSERT INTO `classrooms` (`classroom_id`, `block_id`, `department_id`, `room_no`, `room_type`, `capacity`, `is_active`, `created_at`, `updated_at`) VALUES (1,1,1,'A101','CLASSROOM',60,1,'2026-09-24 10:26:00','2026-10-07 09:06:37'),(2,1,1,'A102','SMART_CLASSROOM',60,1,'2026-09-24 10:26:00','2026-09-30 09:37:38'),(3,1,1,'A103','CLASSROOM',50,1,'2026-09-24 10:26:00','2026-09-30 09:37:38'),(4,1,1,'A104','LAB',40,1,'2026-09-24 10:26:00','2026-09-30 09:37:38'),(5,2,1,'B101','SMART_CLASSROOM',60,1,'2026-09-24 10:26:00','2026-09-30 09:37:38'),(6,2,1,'B102','CLASSROOM',50,1,'2026-09-24 10:26:00','2026-09-30 09:37:38'),(7,2,1,'B103.updated','CLASSROOM',60,0,'2026-09-25 06:24:14','2026-09-30 09:37:38'),(8,1,1,'R10069_U','LAB',80,0,'2026-09-30 09:41:50','2026-09-30 09:41:50'),(10,1,1,'R86723_U test','LAB',80,0,'2026-09-30 09:46:26','2026-11-02 05:28:31'),(92,38,NULL,'101','SMART_CLASSROOM',60,1,'2026-10-28 06:39:45','2026-10-28 06:39:45');
/*!40000 ALTER TABLE `classrooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_categories`
--

DROP TABLE IF EXISTS `course_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_categories` (
  `category_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` tinyint unsigned NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `uq_cat_code` (`code`),
  UNIQUE KEY `uq_cat_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_categories`
--

LOCK TABLES `course_categories` WRITE;
/*!40000 ALTER TABLE `course_categories` DISABLE KEYS */;
INSERT INTO `course_categories` (`category_id`, `code`, `name`) VALUES (1,1,'Foundation'),(2,2,'Core'),(3,3,'Professional Elective'),(4,4,'Open Elective'),(5,5,'Laboratory'),(6,6,'Project'),(7,7,'Internship');
/*!40000 ALTER TABLE `course_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_offerings`
--

DROP TABLE IF EXISTS `course_offerings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_offerings` (
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
) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_offerings`
--

LOCK TABLES `course_offerings` WRITE;
/*!40000 ALTER TABLE `course_offerings` DISABLE KEYS */;
INSERT INTO `course_offerings` (`offering_id`, `term_id`, `subject_id`, `coordinator_faculty_id`, `created_at`, `updated_at`) VALUES (1,7,1,1,'2026-09-24 15:03:06','2026-09-24 15:03:06'),(2,7,2,2,'2026-09-24 15:03:06','2026-09-24 15:03:06'),(3,7,6,1,'2026-09-24 15:03:06','2026-09-24 15:03:06'),(30,1,3,1,'2026-10-09 06:19:47','2026-10-23 09:22:42'),(84,1,93,4,'2026-10-28 06:37:55','2026-10-28 06:38:13');
/*!40000 ALTER TABLE `course_offerings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `degrees`
--

DROP TABLE IF EXISTS `degrees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `degrees` (
  `degree_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` enum('UG','PG','DOCTORAL','DIPLOMA') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`degree_id`),
  UNIQUE KEY `uq_degrees_code` (`code`),
  UNIQUE KEY `uq_degrees_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `degrees`
--

LOCK TABLES `degrees` WRITE;
/*!40000 ALTER TABLE `degrees` DISABLE KEYS */;
INSERT INTO `degrees` (`degree_id`, `code`, `name`, `level`, `created_at`, `updated_at`) VALUES (1,'BTECH','Bachelor of Technology','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(2,'BDES','Bachelor of Design','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(3,'BSC','Bachelor of Science','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(4,'BSCH','Bachelor of Science (Honours)','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(5,'BCA','Bachelor of Computer Applications','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(6,'BPT','Bachelor of Physiotherapy','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(7,'BBA','Bachelor of Business Administration','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(8,'BCOM','Bachelor of Commerce','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(9,'BA','Bachelor of Arts','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(10,'BALLB','Bachelor of Arts & Legislative Law (Honours)','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(11,'BBALLB','Bachelor of Business Administration & Legislative Law (Honours)','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(12,'LLB','Bachelor of Legislative Law (Honours)','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(13,'BPHARM','Bachelor of Pharmacy','UG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(14,'DPHARM','Diploma in Pharmacy','DIPLOMA','2026-09-24 09:04:10','2026-09-24 09:04:10'),(15,'MTECH','Master of Technology','PG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(16,'MSC','Master of Science','PG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(17,'MBA','Master of Business Administration','PG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(18,'LLM','Master of Laws','PG','2026-09-24 09:04:10','2026-09-24 09:04:10'),(19,'BLIB','Bachelor of Library & Information Science','UG','2026-09-24 09:10:27','2026-09-24 09:13:08');
/*!40000 ALTER TABLE `degrees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
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
) ENGINE=InnoDB AUTO_INCREMENT=138 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` (`department_id`, `school_id`, `name`, `code`, `is_active`, `created_at`, `updated_at`) VALUES (1,1,'Department of Agricultural Sciences','AGRI',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(2,2,'Department of Humanities & Social Sciences','HSS',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(3,2,'Department of Sciences','SCI',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(4,2,'Department of Library & Information Science','LIS',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(5,3,'Department of Computing & Information Systems','CIS',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(6,4,'Department of Engineering & Technology','ET',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(7,4,'Department of Design','DES',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(8,5,'Department of Management','MGT',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(9,5,'Department of Commerce','COM',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(10,6,'Department of Law','LAW',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(11,7,'Department of Allied Health Sciences','AHS',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(12,7,'Department of Biotechnology','BIO',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(13,7,'Department of Physiotherapy','PHY',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(14,8,'Department of Nursing','NUR',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(15,9,'Department of Pharmacy','PHAR',1,'2026-09-24 08:57:37','2026-09-24 08:57:37'),(116,8,'test department 12','cse test',1,'2026-10-28 09:20:03','2026-11-02 05:28:04');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `designations`
--

DROP TABLE IF EXISTS `designations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `designations` (
  `designation_id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`designation_id`),
  UNIQUE KEY `uq_designation_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `designations`
--

LOCK TABLES `designations` WRITE;
/*!40000 ALTER TABLE `designations` DISABLE KEYS */;
INSERT INTO `designations` (`designation_id`, `name`) VALUES (3,'Assistant Professor'),(2,'Associate Professor'),(7,'Lab Instructor'),(5,'Lecturer'),(1,'Professor'),(4,'Senior Professor'),(6,'Teaching Assistant');
/*!40000 ALTER TABLE `designations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_template_sync`
--

DROP TABLE IF EXISTS `device_template_sync`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_template_sync` (
  `device_id` int unsigned NOT NULL,
  `template_id` int unsigned NOT NULL,
  `sync_status` enum('PENDING','SYNCED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `synced_at` datetime DEFAULT NULL,
  PRIMARY KEY (`device_id`,`template_id`),
  KEY `ix_dts_template` (`template_id`),
  CONSTRAINT `fk_dts_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`),
  CONSTRAINT `fk_dts_template` FOREIGN KEY (`template_id`) REFERENCES `fingerprint_templates` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_template_sync`
--

LOCK TABLES `device_template_sync` WRITE;
/*!40000 ALTER TABLE `device_template_sync` DISABLE KEYS */;
INSERT INTO `device_template_sync` (`device_id`, `template_id`, `sync_status`, `synced_at`) VALUES (2,1,'SYNCED','2026-06-01 09:10:00'),(2,2,'SYNCED','2026-06-01 09:10:00'),(2,3,'SYNCED','2026-06-01 09:10:00'),(2,4,'SYNCED','2026-06-01 09:10:00'),(2,5,'SYNCED','2026-06-01 09:10:00'),(2,6,'SYNCED','2026-06-01 09:10:00'),(2,7,'SYNCED','2026-06-01 09:10:00'),(2,8,'SYNCED','2026-06-01 09:10:00'),(2,9,'SYNCED','2026-06-01 09:10:00'),(2,10,'SYNCED','2026-06-01 09:10:00');
/*!40000 ALTER TABLE `device_template_sync` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `devices`
--

DROP TABLE IF EXISTS `devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `devices` (
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `devices`
--

LOCK TABLES `devices` WRITE;
/*!40000 ALTER TABLE `devices` DISABLE KEYS */;
INSERT INTO `devices` (`device_id`, `device_code`, `device_type`, `classroom_id`, `serial_no`, `ip_address`, `firmware_version`, `api_key_hash`, `status`, `last_seen_at`, `created_at`, `updated_at`) VALUES (1,'RFID-A101-01','RFID_READER',1,'RFID-A101-SN01','192.168.10.101','1.0.0',NULL,'ACTIVE',NULL,'2026-09-24 15:12:40','2026-09-24 15:12:40'),(2,'FP-A102-01','FINGERPRINT_SCANNER',2,'FP-A102-SN01','192.168.10.102','1.0.0',NULL,'ACTIVE',NULL,'2026-09-24 15:12:40','2026-09-24 15:12:40'),(3,'RFIDFP-A104-01','RFID_FP_TERMINAL',4,'RFIDFP-A104-SN01','192.168.10.104','1.0.0',NULL,'ACTIVE',NULL,'2026-09-24 15:12:40','2026-09-24 15:12:40');
/*!40000 ALTER TABLE `devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enrollments`
--

DROP TABLE IF EXISTS `enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enrollments` (
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
) ENGINE=InnoDB AUTO_INCREMENT=216 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enrollments`
--

LOCK TABLES `enrollments` WRITE;
/*!40000 ALTER TABLE `enrollments` DISABLE KEYS */;
INSERT INTO `enrollments` (`enrollment_id`, `student_id`, `section_id`, `registration_type`, `status`, `registered_on`, `dropped_on`, `created_at`, `updated_at`) VALUES (1,1,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(2,2,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(3,3,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(4,4,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(5,5,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(6,6,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(7,7,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(8,8,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(9,9,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(10,10,1,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(11,1,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(12,2,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(13,3,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(14,4,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(15,5,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(16,6,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(17,7,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(18,8,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(19,9,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(20,10,2,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(21,1,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(22,2,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(23,3,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(24,4,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(25,5,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(26,6,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(27,7,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(28,8,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(29,9,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(30,10,3,'REGULAR','REGISTERED','2026-06-01',NULL,'2026-09-24 15:07:03','2026-09-24 15:07:03'),(143,154,1,'REGULAR','REGISTERED','2026-10-28',NULL,'2026-10-28 09:05:51','2026-10-28 09:05:51'),(146,156,1,'REGULAR','REGISTERED','2026-10-28',NULL,'2026-10-28 09:05:55','2026-10-28 09:05:55');
/*!40000 ALTER TABLE `enrollments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `faculty`
--

DROP TABLE IF EXISTS `faculty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faculty` (
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
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faculty`
--

LOCK TABLES `faculty` WRITE;
/*!40000 ALTER TABLE `faculty` DISABLE KEYS */;
INSERT INTO `faculty` (`faculty_id`, `employee_code`, `full_name`, `gender`, `date_of_birth`, `blood_group`, `joining_year`, `in_charge_class`, `phone`, `email`, `designation_id`, `school_id`, `department_id`, `is_active`, `created_at`, `updated_at`) VALUES (1,'FAC001','Dr. Rajesh Kumar','male','1980-08-22','B+',2021,'CSE-AIML Sec A','9000000002','rajesh.kumar@joyuniversity.edu.in',4,3,5,1,'2026-09-24 09:51:58','2026-10-27 05:01:14'),(2,'FAC002','Dr. Priya Sharma','male','1980-08-22','B+',2021,'CSE-AIML Sec A','9000000002','priya.sharma@joyuniversity.edu.in',2,3,5,1,'2026-09-24 09:51:58','2026-09-24 09:51:58'),(3,'FAC003','Dr. Arun Kumar','male','1980-08-22','B+',2021,'CSE-AIML Sec A','9000000002','arun.kumar@joyuniversity.edu.in',3,3,5,1,'2026-09-24 09:51:58','2026-09-24 09:51:58'),(4,'FAC004','Dr. Sneha Reddy','male','1980-08-22','B+',2021,'CSE-AIML Sec A','9000000002','sneha.reddy@joyuniversity.edu.in',3,3,5,1,'2026-09-24 09:51:58','2026-10-23 08:22:45'),(105,'FAC_QA_1793183158776','Dr. QA Automated Faculty Updated test',NULL,NULL,'A-',NULL,'ABC Test',NULL,'qa_1793183158776@joyuniversity.edu.in',1,3,5,1,'2026-10-28 10:25:58','2026-11-02 05:38:27'),(111,'FAC0001','Dr. Narasimha Uppara','male','1980-07-30','A+',2023,'CSE AI ML SEC A','9393027759','narasimha@joyuniversity.edu.in',1,3,5,1,'2026-10-29 04:03:42','2026-10-29 04:07:01');
/*!40000 ALTER TABLE `faculty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fingerprint_templates`
--

DROP TABLE IF EXISTS `fingerprint_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fingerprint_templates` (
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
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fingerprint_templates`
--

LOCK TABLES `fingerprint_templates` WRITE;
/*!40000 ALTER TABLE `fingerprint_templates` DISABLE KEYS */;
INSERT INTO `fingerprint_templates` (`template_id`, `student_id`, `finger_index`, `template_data`, `template_format`, `template_version`, `quality_score`, `enrolled_device_id`, `enrolled_by`, `enrolled_at`, `status`, `revoked_at`, `created_at`, `updated_at`) VALUES (1,1,0,_binary '','TEST',1,85,2,1,'2026-06-01 09:00:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(2,2,0,_binary '','TEST',1,86,2,1,'2026-06-01 09:01:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(3,3,0,_binary '','TEST',1,87,2,1,'2026-06-01 09:02:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(4,4,0,_binary '','TEST',1,88,2,1,'2026-06-01 09:03:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(5,5,0,_binary '	','TEST',1,89,2,1,'2026-06-01 09:04:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(6,6,0,_binary '	\n','TEST',1,90,2,1,'2026-06-01 09:05:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(7,7,0,_binary '	\n','TEST',1,91,2,1,'2026-06-01 09:06:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(8,8,0,_binary '	\n','TEST',1,92,2,1,'2026-06-01 09:07:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(9,9,0,_binary '	\n\r','TEST',1,93,2,1,'2026-06-01 09:08:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49'),(10,10,0,_binary '\n\r','TEST',1,94,2,1,'2026-06-01 09:09:00','ACTIVE',NULL,'2026-09-24 15:15:49','2026-09-24 15:15:49');
/*!40000 ALTER TABLE `fingerprint_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `programme_subjects`
--

DROP TABLE IF EXISTS `programme_subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `programme_subjects` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `programme_subjects`
--

LOCK TABLES `programme_subjects` WRITE;
/*!40000 ALTER TABLE `programme_subjects` DISABLE KEYS */;
INSERT INTO `programme_subjects` (`programme_id`, `subject_id`, `year_no`, `semester_no`, `nature`, `created_at`) VALUES (97,1,1,1,'MANDATORY','2026-09-24 10:14:31'),(97,2,1,1,'MANDATORY','2026-09-24 10:14:31'),(97,3,1,2,'MANDATORY','2026-09-24 10:14:31'),(97,4,2,3,'MANDATORY','2026-09-24 10:14:31'),(97,5,1,2,'MANDATORY','2026-09-24 10:20:08'),(97,6,1,1,'MANDATORY','2026-09-24 10:20:08'),(97,7,2,4,'MANDATORY','2026-09-24 10:14:31'),(97,8,3,5,'MANDATORY','2026-09-24 10:14:31'),(97,9,3,5,'MANDATORY','2026-09-24 10:20:08'),(97,10,2,3,'MANDATORY','2026-09-24 10:20:08'),(97,11,2,4,'MANDATORY','2026-09-24 10:20:08'),(97,12,3,6,'MANDATORY','2026-09-24 10:20:08');
/*!40000 ALTER TABLE `programme_subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `programmes`
--

DROP TABLE IF EXISTS `programmes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `programmes` (
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
) ENGINE=InnoDB AUTO_INCREMENT=245 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `programmes`
--

LOCK TABLES `programmes` WRITE;
/*!40000 ALTER TABLE `programmes` DISABLE KEYS */;
INSERT INTO `programmes` (`programme_id`, `school_id`, `department_id`, `degree_id`, `programme_code`, `name`, `partner_track`, `duration_years`, `is_active`, `created_at`, `updated_at`) VALUES (77,1,1,1,NULL,'Agricultural Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(78,1,1,1,NULL,'Dairy Technology','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(79,1,1,4,NULL,'Agriculture','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(80,1,1,4,NULL,'Horticulture','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(81,1,1,16,NULL,'Agronomy','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(82,1,1,16,NULL,'Agricultural Entomology','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(83,1,1,16,NULL,'Agricultural Extension Education','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(84,1,1,16,NULL,'Floriculture and Landscaping','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(85,1,1,16,NULL,'Vegetable Science','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(86,2,2,9,NULL,'English','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(87,2,2,9,NULL,'Tamil','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(88,2,2,9,NULL,'Criminology & Police Administration','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(89,2,3,3,NULL,'Forensic Science','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(90,2,3,3,NULL,'Psychology','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(91,2,3,3,NULL,'Renewable Energy','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(92,2,3,3,NULL,'Film & TV Production','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(93,2,4,19,NULL,'Library & Information Science','STANDARD',1.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(94,2,3,16,NULL,'Psychology','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(95,3,5,1,NULL,'CSE (Artificial Intelligence & Data Science)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(96,3,5,1,NULL,'CSE (Artificial Intelligence & IoT)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(97,3,5,1,NULL,'CSE (Artificial Intelligence & Machine Learning)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(98,3,5,1,NULL,'CSE (Artificial Intelligence & Robotics)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(99,3,5,1,NULL,'CSE (Cyber Security)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(100,3,5,1,NULL,'Computer Science & Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(101,3,5,1,NULL,'Information & Communication Technology','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(102,3,5,4,NULL,'CSE (Artificial Intelligence & Machine Learning)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(103,3,5,4,NULL,'CSE (Artificial Intelligence & Data Science)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(104,3,5,5,NULL,'Artificial Intelligence','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(105,3,5,5,NULL,'Cyber Security','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(106,3,5,15,NULL,'CSE (Artificial Intelligence & Machine Learning)','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(107,4,6,1,NULL,'Aeronautical Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(108,4,6,1,NULL,'Biomedical Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(109,4,6,1,NULL,'Biotechnology','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(110,4,6,1,NULL,'Civil Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(111,4,6,1,NULL,'Electronics & Communication Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(112,4,6,1,NULL,'ECE (Artificial Intelligence & IoT)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(113,4,6,1,NULL,'ECE (VLSI)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(114,4,6,1,NULL,'ECE (Artificial Intelligence & Machine Learning)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(115,4,6,1,NULL,'Mechanical Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(116,4,6,1,NULL,'Mech (Artificial Intelligence & Machine Learning)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(117,4,6,1,NULL,'Mech (Robotics & Automation)','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(118,4,6,1,NULL,'Mechatronics','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(119,4,6,1,NULL,'Petrochemical Engineering','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(120,4,7,2,NULL,'Fashion Design','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(121,5,8,7,NULL,'Logistics & Supply Chain Management','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(122,5,8,7,NULL,'Business Analytics','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(123,5,8,7,NULL,'Digital Marketing','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(124,5,8,7,NULL,'Financial Management','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(125,5,8,7,NULL,'Entrepreneurial Management','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(126,5,8,17,NULL,'Human Resource Management','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(127,5,8,17,NULL,'Marketing Management','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(128,5,8,17,NULL,'Business Analytics','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(129,5,8,17,NULL,'Entrepreneurial Management','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(130,5,8,17,NULL,'International Business','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(131,5,9,8,NULL,'Accounting & Finance','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(132,5,9,8,NULL,'Computer Application','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(133,5,9,8,NULL,'General','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(134,5,9,8,NULL,'FinTech & AI','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(135,6,10,10,NULL,'Arts & Legislative Law','STANDARD',5.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(136,6,10,11,NULL,'Business Administration & Legislative Law','STANDARD',5.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(137,6,10,12,'BLLB','Legislative Law','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-10-28 06:36:10'),(138,6,10,18,NULL,'Taxation Law','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(139,6,10,18,NULL,'Cybercrime','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(140,7,11,3,NULL,'Operation Theatre & Anaesthesia Technology','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(141,7,11,3,NULL,'Medical Radiology & Imaging Technology','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(142,7,11,3,NULL,'Cardiac Perfusion Technology','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(143,7,11,3,NULL,'Medical Laboratory Technology','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(144,7,11,3,NULL,'Physician Assistant','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(145,7,11,16,NULL,'Operation Theatre & Anaesthesia Technology','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(146,7,11,16,NULL,'Cardiac Perfusion Technology','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(147,7,12,3,NULL,'Biotechnology','STANDARD',3.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(148,7,12,16,NULL,'Biotechnology','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(149,7,13,6,NULL,'Bachelor of Physiotherapy','STANDARD',5.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(150,8,14,3,NULL,'Nursing','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(151,9,15,13,NULL,'Pharmacy','STANDARD',4.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(152,9,15,14,NULL,'Pharmacy','STANDARD',2.0,1,'2026-09-24 09:13:22','2026-09-24 09:13:22'),(244,3,5,1,'A0061380','Aerospace Informatics 1794460061380 Updated','STANDARD',4.0,0,'2026-11-12 05:07:41','2026-11-12 05:07:41');
/*!40000 ALTER TABLE `programmes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `revoked_tokens`
--

DROP TABLE IF EXISTS `revoked_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `revoked_tokens` (
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
) ENGINE=InnoDB AUTO_INCREMENT=1139 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `revoked_tokens`
--

LOCK TABLES `revoked_tokens` WRITE;
/*!40000 ALTER TABLE `revoked_tokens` DISABLE KEYS */;
INSERT INTO `revoked_tokens` (`id`, `jti`, `user_id`, `expires_at`, `revoked_at`, `created_at`) VALUES (1131,'e824a079-f380-4ae4-a874-64ced288f5f9',3,'2026-11-13 09:22:12','2026-11-12 10:32:02','2026-11-12 05:02:02'),(1132,'eb04c2d1-d1f7-47ff-a6da-ab8147fed434',1,'2026-11-13 10:37:39','2026-11-12 10:37:39','2026-11-12 05:07:39'),(1133,'93002319-160a-4d03-a115-1fd436c6b9d0',4,'2026-11-13 10:37:39','2026-11-12 10:37:39','2026-11-12 05:07:39'),(1134,'b1c9a69e-6c53-4540-80f7-11a6caec95f1',3,'2026-11-13 10:37:39','2026-11-12 10:37:39','2026-11-12 05:07:39'),(1135,'4192a423-890f-46d4-9767-81b8b38ab2da',3,'2026-11-13 10:37:39','2026-11-12 10:37:39','2026-11-12 05:07:39'),(1136,'71d13aae-eb32-4133-983e-28a1eadb46f1',4,'2026-11-13 10:37:39','2026-11-12 10:37:39','2026-11-12 05:07:39'),(1137,'9df6d7081ffa8a9925507dfb312c2f6d0ad1a2db130e2fbfd2135f53eb802a22',3,'2026-11-12 11:37:39','2026-11-12 10:37:39','2026-11-12 05:07:39');
/*!40000 ALTER TABLE `revoked_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rfid_cards`
--

DROP TABLE IF EXISTS `rfid_cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rfid_cards` (
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
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rfid_cards`
--

LOCK TABLES `rfid_cards` WRITE;
/*!40000 ALTER TABLE `rfid_cards` DISABLE KEYS */;
INSERT INTO `rfid_cards` (`card_id`, `card_uid`, `student_id`, `status`, `issued_on`, `revoked_at`, `created_at`, `updated_at`) VALUES (1,'RFID20260001',1,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(2,'RFID20260002',2,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(3,'RFID20260003',3,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(4,'RFID20260004',4,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(5,'RFID20260005',5,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(6,'RFID20260006',6,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(7,'RFID20260007',7,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(8,'RFID20260008',8,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(9,'RFID20260009',9,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38'),(10,'RFID20260010',10,'ACTIVE','2026-06-01',NULL,'2026-09-24 15:13:38','2026-09-24 15:13:38');
/*!40000 ALTER TABLE `rfid_cards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `version` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `version` (`version`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` (`id`, `version`, `executed_at`) VALUES (1,'001_create_revoked_tokens.sql','2026-10-13 17:54:59'),(2,'002_add_batch_id_to_sections.sql','2026-10-13 17:54:59'),(3,'003_allow_multiple_sessions_per_date.sql','2026-10-21 06:03:00'),(4,'005_add_profile_demographics.sql','2026-10-27 05:03:27'),(5,'004_add_full_name_to_users.sql','2026-10-28 08:23:19'),(6,'006_remove_demographic_defaults.sql','2026-10-28 08:23:20'),(7,'007_create_academic_module.sql','2026-11-05 04:17:53');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schools`
--

DROP TABLE IF EXISTS `schools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schools` (
  `school_id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`school_id`),
  UNIQUE KEY `uq_schools_code` (`code`),
  UNIQUE KEY `uq_schools_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schools`
--

LOCK TABLES `schools` WRITE;
/*!40000 ALTER TABLE `schools` DISABLE KEYS */;
INSERT INTO `schools` (`school_id`, `code`, `name`, `is_active`, `created_at`, `updated_at`) VALUES (1,'SOAGS','School of Agricultural Sciences',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(2,'SOANS','School of Arts & Natural Sciences',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(3,'SOCI','School of Computational Intelligence',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(4,'SOET','School of Engineering and Technology',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(5,'SOEM','School of Entrepreneurship and Management',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(6,'SOL','School of Law',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(7,'SOLHS','School of Life & Health Sciences',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(8,'SON','School of Nursing',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(9,'SOP','School of Pharmacy',1,'2026-09-24 08:49:32','2026-09-24 08:49:32'),(102,'ST1286','Updated Test School ST1286',0,'2026-11-12 05:07:41','2026-11-12 05:07:41');
/*!40000 ALTER TABLE `schools` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sections`
--

DROP TABLE IF EXISTS `sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sections` (
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
) ENGINE=InnoDB AUTO_INCREMENT=287 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sections`
--

LOCK TABLES `sections` WRITE;
/*!40000 ALTER TABLE `sections` DISABLE KEYS */;
INSERT INTO `sections` (`section_id`, `offering_id`, `batch_id`, `section_code`, `max_strength`, `created_at`, `updated_at`) VALUES (1,30,4,'A',60,'2026-09-24 15:05:04','2026-10-09 06:20:21'),(2,2,4,'A',60,'2026-09-24 15:05:04','2026-10-09 04:18:23'),(3,3,4,'A',40,'2026-09-24 15:05:04','2026-10-09 04:18:23'),(193,84,69,'A',60,'2026-10-28 06:38:35','2026-10-28 06:38:35');
/*!40000 ALTER TABLE `sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_reconciliation`
--

DROP TABLE IF EXISTS `session_reconciliation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_reconciliation` (
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_reconciliation`
--

LOCK TABLES `session_reconciliation` WRITE;
/*!40000 ALTER TABLE `session_reconciliation` DISABLE KEYS */;
INSERT INTO `session_reconciliation` (`reconciliation_id`, `session_id`, `enrolled_count`, `attended_count`, `headcount`, `snapshots_used`, `variance`, `variance_pct`, `tolerance_pct`, `result`, `review_status`, `reviewed_by`, `reviewed_at`, `review_note`, `computed_at`) VALUES (1,3,10,8,NULL,0,NULL,NULL,10.00,'NO_HEADCOUNT','NOT_REQUIRED',NULL,NULL,NULL,'2026-06-01 10:01:00');
/*!40000 ALTER TABLE `session_reconciliation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
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
) ENGINE=InnoDB AUTO_INCREMENT=203 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` (`student_id`, `register_no`, `full_name`, `gender`, `date_of_birth`, `blood_group`, `email`, `phone`, `batch_id`, `status`, `created_at`, `updated_at`) VALUES (1,'2026BTAM014','UPPARA VINOD','male','2004-05-10','A+','btam26014@joyuniversity.edu.in','9000000001',4,'ACTIVE','2026-09-24 09:45:33','2026-10-28 06:23:39'),(2,'JU26AIML002','Student Two','male','2004-05-10','A+','student2@joyuniversity.edu.in','9000000002',4,'SEMESTER_WITHDRAWAL','2026-09-24 09:45:33','2026-10-28 06:23:39'),(3,'JU26AIML003','Student Three','male','2004-05-10','O+','student3@joyuniversity.edu.in','9000000003',4,'ACTIVE','2026-09-24 09:45:33','2026-10-21 06:43:13'),(4,'JU26AIML004','Student Four','male','2004-05-10','O+','student4@joyuniversity.edu.in','9000000004',4,'TERMINATED','2026-09-24 09:45:33','2026-09-29 03:38:46'),(5,'JU26AIML005','Student Five','male','2004-05-10','O+','student5@joyuniversity.edu.in','9000000005',4,'GRADUATED','2026-09-24 09:45:33','2026-09-29 03:38:53'),(6,'JU26AIML006','Student Six','male','2004-05-10','O+','student6@joyuniversity.edu.in','9000000006',4,'ACTIVE','2026-09-24 09:45:33','2026-09-24 09:45:33'),(7,'JU26AIML007','Student Seven','male','2004-05-10','O+','student7@joyuniversity.edu.in','9000000007',4,'ACTIVE','2026-09-24 09:45:33','2026-09-24 09:45:33'),(8,'JU26AIML008','Student Eight','male','2004-05-10','O+','student8@joyuniversity.edu.in','9000000008',4,'ACTIVE','2026-09-24 09:45:33','2026-09-24 09:45:33'),(9,'JU26AIML009','Student Nine. tests','male','2004-05-09','O+','student9@joyuniversity.edu.in','9000000009',4,'ACTIVE','2026-09-24 09:45:33','2026-11-02 05:37:45'),(10,'JU26AIML010','Student Ten','male','2004-05-10','O+','student10@joyuniversity.edu.in','9000000010',4,'INTERNSHIP_BREAK','2026-09-24 09:45:33','2026-09-29 03:38:18'),(142,'2023BTAM014','UPPARA VINOD','male','2005-07-03','A+','btam23014@joyuniversity.edu.in','+917680841759',1,'ACTIVE','2026-10-27 06:16:31','2026-10-28 04:27:23'),(150,'2023BLLB001','Law Student',NULL,NULL,NULL,'bbllb23001@joyuniveristy.edu.in','9000000055',69,'ACTIVE','2026-10-28 09:01:59','2026-10-28 09:01:59'),(154,'ACAD_REG_1793178351851','Full Academic Student Renamed','male','2005-04-12','O+','acad_test_1793178351851@joyuniversity.edu.in','+91 9123456789',4,'INTERNSHIP_BREAK','2026-10-28 09:05:51','2026-10-28 09:05:52'),(156,'ACAD_REG_1793178355800','Full Academic Student Renamed','male','2005-04-12','O+','acad_test_1793178355800@joyuniversity.edu.in','+91 9123456789',4,'INTERNSHIP_BREAK','2026-10-28 09:05:55','2026-10-28 09:05:56');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subject_staff_assignments`
--

DROP TABLE IF EXISTS `subject_staff_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subject_staff_assignments` (
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subject_staff_assignments`
--

LOCK TABLES `subject_staff_assignments` WRITE;
/*!40000 ALTER TABLE `subject_staff_assignments` DISABLE KEYS */;
INSERT INTO `subject_staff_assignments` (`assignment_id`, `subject_id`, `faculty_id`, `role`, `assigned_by`, `created_at`, `updated_at`) VALUES (16,2,1,'Subject Staff',1,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(17,3,1,'Subject Staff',1,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(18,6,1,'Subject Staff',1,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(19,2,2,'Co-Teacher',1,'2026-11-12 05:24:57','2026-11-12 05:24:57'),(20,1,1,'Subject Staff',1,'2026-11-12 05:24:57','2026-11-12 05:24:57');
/*!40000 ALTER TABLE `subject_staff_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subjects`
--

DROP TABLE IF EXISTS `subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subjects` (
  `subject_id` int unsigned NOT NULL AUTO_INCREMENT,
  `subject_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `credits` decimal(3,1) DEFAULT NULL,
  `delivery_type` enum('THEORY','LAB','PROJECT','INTERNSHIP','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'THEORY',
  `category_id` int unsigned DEFAULT NULL,
  `owner_school_id` int unsigned DEFAULT NULL,
  `owner_department_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
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
) ENGINE=InnoDB AUTO_INCREMENT=125 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subjects`
--

LOCK TABLES `subjects` WRITE;
/*!40000 ALTER TABLE `subjects` DISABLE KEYS */;
INSERT INTO `subjects` (`subject_id`, `subject_code`, `name`, `credits`, `delivery_type`, `category_id`, `owner_school_id`, `owner_department_id`, `is_active`, `created_at`, `updated_at`) VALUES (1,'AIML101','Programming for Problem Solving',4.0,'THEORY',1,3,5,1,'2026-09-24 09:55:27','2026-09-24 09:55:27'),(2,'AIML102','Mathematics for Artificial Intelligence',4.0,'THEORY',1,3,5,1,'2026-09-24 09:55:27','2026-09-24 09:55:27'),(3,'AIML103','Data Structures and Algorithms',4.0,'THEORY',2,3,5,1,'2026-09-24 09:55:27','2026-09-24 09:55:27'),(4,'AIML104','Database Management Systems',4.0,'THEORY',2,3,5,1,'2026-09-24 09:55:27','2026-10-23 09:20:22'),(5,'AIML105','Object Oriented Programming',4.0,'THEORY',2,3,5,1,'2026-09-24 09:55:27','2026-09-24 09:55:27'),(6,'AIML106','Programming Laboratory',1.0,'LAB',5,3,5,1,'2026-09-24 09:55:27','2026-10-07 08:37:57'),(7,'AIML201','Probability and Statistics',4.0,'THEORY',2,3,5,1,'2026-09-24 09:55:27','2026-09-24 09:55:27'),(8,'AIML202','Machine Learning',4.0,'THEORY',2,3,5,1,'2026-09-24 09:55:27','2026-09-24 09:55:27'),(9,'AIML203','Artificial Intelligence',4.0,'THEORY',2,3,5,0,'2026-09-24 09:55:27','2026-11-10 04:26:20'),(10,'AIML204','Operating Systems',4.0,'THEORY',2,3,5,0,'2026-09-24 09:55:27','2026-10-09 06:10:10'),(11,'AIML205','Computer Networks',4.0,'THEORY',2,3,5,1,'2026-09-24 09:55:27','2026-09-24 09:55:27'),(12,'AIML206','Machine Learning Laboratory',1.0,'LAB',5,3,5,1,'2026-09-24 09:55:27','2026-10-09 04:39:22'),(71,'23BTAM111','Fundamentals of computing',3.0,'THEORY',NULL,3,5,1,'2026-10-23 04:59:16','2026-10-23 06:22:04'),(93,'BLLB2112','Indian Constitution',3.0,'THEORY',NULL,6,10,1,'2026-10-28 06:37:20','2026-10-28 06:37:20');
/*!40000 ALTER TABLE `subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `value_type`, `description`, `updated_by`, `updated_at`) VALUES ('ATTENDANCE_TOLERANCE_PCT','5.0','DECIMAL','Tolerance percentage threshold for biometric vs roster count reconciliation',NULL,'2026-10-13 17:55:24'),('MIN_ATTENDANCE_PERCENTAGE','75.0','DECIMAL','Minimum required attendance percentage for examination eligibility',NULL,'2026-10-13 17:55:24'),('SESSION_GRACE_PERIOD_MINS','10','INT','Grace period in minutes before marking late or absent',NULL,'2026-10-13 17:55:24');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `timetable_slots`
--

DROP TABLE IF EXISTS `timetable_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `timetable_slots` (
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
) ENGINE=InnoDB AUTO_INCREMENT=220 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `timetable_slots`
--

LOCK TABLES `timetable_slots` WRITE;
/*!40000 ALTER TABLE `timetable_slots` DISABLE KEYS */;
INSERT INTO `timetable_slots` (`slot_id`, `section_id`, `faculty_id`, `classroom_id`, `day_of_week`, `start_time`, `end_time`, `effective_from`, `effective_to`, `is_active`, `created_at`, `updated_at`) VALUES (1,1,1,1,1,'09:00:00','10:00:00','2026-06-01',NULL,0,'2026-09-24 15:10:52','2026-10-23 08:20:47'),(2,2,2,2,2,'10:00:00','11:00:00','2026-06-01',NULL,1,'2026-09-24 15:10:52','2026-10-21 04:38:41'),(3,3,1,4,3,'14:00:00','16:00:00','2026-06-01',NULL,1,'2026-09-24 15:10:52','2026-10-21 04:38:41'),(112,2,1,5,3,'11:00:00','12:00:00','2026-10-21',NULL,1,'2026-10-21 06:32:30','2026-10-21 06:32:30'),(159,193,111,1,6,'09:00:00','10:00:00','2026-05-04','2026-11-20',0,'2026-10-28 06:40:18','2026-11-02 05:36:47');
/*!40000 ALTER TABLE `timetable_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
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
) ENGINE=InnoDB AUTO_INCREMENT=211 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`user_id`, `username`, `full_name`, `gender`, `date_of_birth`, `blood_group`, `joining_year`, `employee_id`, `email`, `password_hash`, `role`, `faculty_id`, `student_id`, `is_active`, `failed_login_count`, `last_login_at`, `created_at`, `updated_at`) VALUES (1,'admin','System Administrator','male','1980-07-30','A-',2020,'ADM001','admin@joyuniversity.edu.in','$2b$10$S815ejeq69wCY3jPdUkuYOLN43GhaIRZoXLVoHBCVojIwY2ny9Nw6','ADMIN',NULL,NULL,1,0,NULL,'2026-09-24 10:27:54','2026-11-12 05:07:42'),(3,'J26AIM001','Uppara Vinod','male','2004-05-10','O+',2023,NULL,'btam26014@joyuniversity.edu.in','$2b$10$f7GOX3vL0z63ukqt.HmsReuz/Y/O6l.0aqVwqZYU070zEIuHqC6Gq','STUDENT',NULL,1,1,0,NULL,'2026-09-28 04:23:38','2026-10-27 06:16:00'),(4,'FAC001','Rajesh Kumar','male','1980-08-22','B+',2021,'FAC001','rajesh.kumar@joyuniversity.edu.in','$2b$10$UfMVaEoXVlZC.cjgS5xeNO1gpRGCdB6Uwc7/gMnseiAxuHsO4Rxre','FACULTY',1,NULL,1,0,NULL,'2026-09-29 03:53:57','2026-10-27 05:03:06'),(5,'2023BTAM014','UPPARA VINOD','male','2005-07-03','A+',2023,NULL,'btam23014@joyuniversity.edu.in','$2b$10$FtjTMiwBq8IByIGXuNxGVukKZrOJABaSaGxdrmyD.rlWNc1JnTzke','STUDENT',NULL,142,1,0,NULL,'2026-10-28 04:05:35','2026-10-29 04:07:38'),(93,'ACAD_REG_1793178351851','Full Academic Student Renamed','male','2005-04-12','O+',NULL,NULL,'acad_test_1793178351851@joyuniversity.edu.in','$2b$10$WYytn1lPKXXL3IV3C63/M.eZKNBXgKrWrd2G2yqkQZ5M9fzHkpm0i','STUDENT',NULL,154,0,0,NULL,'2026-10-28 09:05:51','2026-10-28 09:05:52'),(96,'ACAD_REG_1793178355800','Full Academic Student Renamed','male','2005-04-12','O+',NULL,NULL,'acad_test_1793178355800@joyuniversity.edu.in','$2b$10$X41XTNZQ1qE4VEs6PSI2B.GGqFkrFPPlULdy2e.9HJaF.D0o6m53K','STUDENT',NULL,156,0,0,NULL,'2026-10-28 09:05:55','2026-10-28 09:05:56'),(105,'FAC_QA_1793183158776','Dr. QA Automated Faculty Updated test',NULL,NULL,'A-',NULL,'FAC_QA_1793183158776','qa_1793183158776@joyuniversity.edu.in','$2b$10$tus09h/DBYD8a02bRPdXt.yZybaK8qUUq876UTlTiVYXHWh4EQNi.','FACULTY',105,NULL,1,0,NULL,'2026-10-28 10:25:58','2026-11-02 05:27:49'),(121,'FAC0001','Dr. Narasimha Uppara','male','1980-07-30','A+',2023,'FAC0001','narasimha@joyuniversity.edu.in','$2b$10$Fw3gIYePS9CSoskpCdCRnultUWodcL7drvb0imGo2eBwA2NLuu5jm','FACULTY',111,NULL,1,0,NULL,'2026-10-29 04:03:42','2026-10-29 04:07:01'),(203,'JU26AIML002','Student Two',NULL,NULL,NULL,NULL,NULL,'student2@joyuniversity.edu.in','$2b$10$3Ivm2jkQU8wuFpZ5EUC7/.XbZ.1m.soG8qXcsVj9aqupzqOsB2.FO','STUDENT',NULL,2,1,0,NULL,'2026-11-12 05:06:08','2026-11-12 05:06:08'),(204,'JU26AIML003','Student Three',NULL,NULL,NULL,NULL,NULL,'student3@joyuniversity.edu.in','$2b$10$3Ivm2jkQU8wuFpZ5EUC7/.XbZ.1m.soG8qXcsVj9aqupzqOsB2.FO','STUDENT',NULL,3,1,0,NULL,'2026-11-12 05:06:08','2026-11-12 05:06:08'),(205,'FAC002','Dr. Priya Sharma',NULL,NULL,NULL,NULL,NULL,'priya.sharma@joyuniversity.edu.in','$2b$10$WWfIGUQUFwEAsSiJPxbHA.LMWEFLjvvTf0zB7HordEibaQqoqSjvC','FACULTY',2,NULL,1,0,NULL,'2026-11-12 05:06:08','2026-11-12 05:06:08');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'smart_campus'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-12 10:54:58
