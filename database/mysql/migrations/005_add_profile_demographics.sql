-- Migration: 005_add_profile_demographics.sql
-- Description: Adds demographic and profile identity fields (gender, date_of_birth, blood_group, joining_year, employee_id, in_charge_class, phone) to users, students, and faculty.

ALTER TABLE `users`
   COLUMN `gender` ENUM('male', 'female', 'other') NULL DEFAULT 'male' AFTER `full_name`,
  ADD COLUMN `date_of_birth` DATE NULL DEFAULT NULL AFTER `gender`,
  ADD COLUMN `blood_group` VARCHAR(10) NULL DEFAULT NULL AFTER `date_of_birth`,
  ADD COLUMN `joining_year` SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `blood_group`,
  ADD COLUMN `employee_id` VARCHAR(30) NULL DEFAULT NULL AFTER `joining_year`;

ALTER TABLE `students`
  ADD COLUMN `gender` ENUM('male', 'female', 'other') NULL DEFAULT 'male' AFTER `full_name`,
  ADD COLUMN `date_of_birth` DATE NULL DEFAULT NULL AFTER `gender`,
  ADD COLUMN `blood_group` VARCHAR(10) NULL DEFAULT 'O+' AFTER `date_of_birth`;

ALTER TABLE `faculty`
  ADD COLUMN `gender` ENUM('male', 'female', 'other') NULL DEFAULT 'male' AFTER `full_name`,
  ADD COLUMN `date_of_birth` DATE NULL DEFAULT NULL AFTER `gender`,
  ADD COLUMN `blood_group` VARCHAR(10) NULL DEFAULT 'B+' AFTER `date_of_birth`,
  ADD COLUMN `joining_year` SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `blood_group`,
  ADD COLUMN `in_charge_class` VARCHAR(60) NULL DEFAULT NULL AFTER `joining_year`,
  ADD COLUMN `phone` VARCHAR(20) NULL DEFAULT NULL AFTER `in_charge_class`;

