-- Migration 004: Add full_name column to users table
ALTER TABLE `users` ADD COLUMN `full_name` VARCHAR(150) NULL DEFAULT NULL AFTER `username`;

