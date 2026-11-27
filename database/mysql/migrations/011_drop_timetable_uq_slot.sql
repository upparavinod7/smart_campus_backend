SET @add_timetable_section_index = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'timetable_slots'
     AND index_name = 'ix_slot_section') = 0,
  'ALTER TABLE timetable_slots ADD INDEX ix_slot_section (section_id)',
  'SELECT 1'
);
PREPARE add_timetable_section_index_stmt FROM @add_timetable_section_index;
EXECUTE add_timetable_section_index_stmt;
DEALLOCATE PREPARE add_timetable_section_index_stmt;

SET @drop_timetable_unique_index = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'timetable_slots'
     AND index_name = 'uq_slot') > 0,
  'ALTER TABLE timetable_slots DROP INDEX uq_slot',
  'SELECT 1'
);
PREPARE drop_timetable_unique_index_stmt FROM @drop_timetable_unique_index;
EXECUTE drop_timetable_unique_index_stmt;
DEALLOCATE PREPARE drop_timetable_unique_index_stmt;
