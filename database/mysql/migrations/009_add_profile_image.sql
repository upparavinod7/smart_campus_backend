-- Migration: 009_add_profile_image.sql
-- Description: Add profile_image column to users, students, and faculty tables for profile photos

ALTER TABLE users ADD COLUMN profile_image MEDIUMTEXT NULL;
ALTER TABLE students ADD COLUMN profile_image MEDIUMTEXT NULL;
ALTER TABLE faculty ADD COLUMN profile_image MEDIUMTEXT NULL;
