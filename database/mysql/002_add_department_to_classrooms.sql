-- Migration 002: Add department_id to classrooms table and link to departments
ALTER TABLE classrooms
  ADD COLUMN department_id INT UNSIGNED NULL AFTER block_id,
  ADD CONSTRAINT fk_room_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill existing sample classrooms to associate with department 1
UPDATE classrooms SET department_id = 1 WHERE department_id IS NULL;
