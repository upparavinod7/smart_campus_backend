const mysql = require("mysql2/promise");
require("dotenv").config({ path: __dirname + "/../.env" });

async function inspect() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "smartcampus",
    password: process.env.DB_PASSWORD || "azentra@smartcampus",
    database: process.env.DB_NAME || "smart_campus",
  });

  console.log("=== CONNECTED TO MYSQL ===");

  // 1. SOCI School
  const [schools] = await connection.query("SELECT * FROM schools WHERE school_id = 3 OR code = 'SOCI'");
  console.log("\n--- SOCI SCHOOL ---");
  console.table(schools);

  // 2. Departments under SOCI
  const [depts] = await connection.query("SELECT * FROM departments WHERE school_id = 3");
  console.log("\n--- DEPARTMENTS IN SOCI ---");
  console.table(depts);

  // 3. Degrees (B.Tech)
  const [degrees] = await connection.query("SELECT * FROM degrees WHERE code LIKE '%TECH%' OR name LIKE '%Bachelor of Technology%'");
  console.log("\n--- B.TECH DEGREES ---");
  console.table(degrees);

  // 4. Programmes in SOCI with B.Tech
  const [programmes] = await connection.query(`
    SELECT p.programme_id, p.programme_code, p.name, p.partner_track, p.duration_years, p.school_id, p.department_id, p.degree_id,
           d.code AS degree_code, dept.name AS dept_name
    FROM programmes p
    JOIN degrees d ON p.degree_id = d.degree_id
    LEFT JOIN departments dept ON p.department_id = dept.department_id
    WHERE p.school_id = 3
  `);
  console.log("\n--- PROGRAMMES IN SOCI ---");
  console.table(programmes);

  // 5. Academic Years & Terms
  const [ay] = await connection.query("SELECT * FROM academic_years");
  console.log("\n--- ACADEMIC YEARS ---");
  console.table(ay);

  const [terms] = await connection.query(`
    SELECT t.*, ay.label AS ay_label 
    FROM academic_terms t 
    JOIN academic_years ay ON t.academic_year_id = ay.academic_year_id
  `);
  console.log("\n--- ACADEMIC TERMS ---");
  console.table(terms);

  // 6. Batches for SOCI programmes
  const [batches] = await connection.query(`
    SELECT b.batch_id, b.label, b.programme_id, b.start_year_id, p.name AS prog_name, ay.label AS start_year_label
    FROM batches b
    JOIN programmes p ON b.programme_id = p.programme_id
    JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
    WHERE p.school_id = 3
  `);
  console.log("\n--- BATCHES IN SOCI ---");
  console.table(batches);

  // 7. Sections under SOCI batches or offerings
  const [sections] = await connection.query(`
    SELECT sec.section_id, sec.section_code, sec.offering_id, sec.batch_id, sec.max_strength,
           co.term_id, co.subject_id, sub.subject_code, sub.name AS subject_name, b.label AS batch_label
    FROM sections sec
    JOIN course_offerings co ON sec.offering_id = co.offering_id
    JOIN subjects sub ON co.subject_id = sub.subject_id
    LEFT JOIN batches b ON sec.batch_id = b.batch_id
    WHERE sub.owner_school_id = 3 OR b.programme_id IN (SELECT programme_id FROM programmes WHERE school_id = 3)
  `);
  console.log("\n--- EXISTING SECTIONS IN SOCI ---");
  console.table(sections);

  // 8. Existing Subjects in SOCI
  const [subjects] = await connection.query(`
    SELECT s.subject_id, s.subject_code, s.name, s.delivery_type, s.credits, s.owner_school_id, s.owner_department_id, dept.name AS dept_name
    FROM subjects s
    LEFT JOIN departments dept ON s.owner_department_id = dept.department_id
    WHERE s.owner_school_id = 3
    ORDER BY s.subject_code
  `);
  console.log("\n--- EXISTING SUBJECTS IN SOCI ---");
  console.table(subjects);

  // 9. Programme Subjects for SOCI programmes
  const [progSubjs] = await connection.query(`
    SELECT ps.programme_id, p.name AS prog_name, ps.subject_id, s.subject_code, s.name AS subject_name, ps.year_no, ps.semester_no, ps.nature
    FROM programme_subjects ps
    JOIN programmes p ON ps.programme_id = p.programme_id
    JOIN subjects s ON ps.subject_id = s.subject_id
    WHERE p.school_id = 3
    ORDER BY ps.semester_no, s.subject_code
  `);
  console.log("\n--- PROGRAMME SUBJECTS IN SOCI ---");
  console.table(progSubjs);

  // 10. Faculty in SOCI
  const [faculty] = await connection.query(`
    SELECT f.faculty_id, f.employee_code, f.full_name, f.email, f.designation_id, des.name AS designation, dept.name AS dept_name, u.role, u.username
    FROM faculty f
    LEFT JOIN departments dept ON f.department_id = dept.department_id
    LEFT JOIN designations des ON f.designation_id = des.designation_id
    LEFT JOIN users u ON u.faculty_id = f.faculty_id
    WHERE f.school_id = 3 OR f.department_id IN (SELECT department_id FROM departments WHERE school_id = 3)
  `);
  console.log("\n--- FACULTY IN SOCI DEPARTMENTS ---");
  console.table(faculty);

  // All faculty count & sample
  const [allFac] = await connection.query("SELECT COUNT(*) AS total_faculty FROM faculty");
  console.log("Total faculty in university:", allFac[0].total_faculty);

  // 11. Classrooms and Labs
  const [classrooms] = await connection.query(`
    SELECT c.classroom_id, b.code AS block_code, c.room_no, c.room_type, c.capacity, c.department_id
    FROM classrooms c
    JOIN blocks b ON c.block_id = b.block_id
    ORDER BY b.code, c.room_no
  `);
  console.log("\n--- ALL CLASSROOMS & LABS ---");
  console.table(classrooms);

  // 12. Existing Timetable Slots
  const [slots] = await connection.query(`
    SELECT ts.slot_id, ts.section_id, ts.day_of_week, ts.start_time, ts.end_time, ts.effective_from,
           f.employee_code, f.full_name, cr.room_no, sub.subject_code, sub.name AS subject_name, sec.section_code
    FROM timetable_slots ts
    JOIN faculty f ON ts.faculty_id = f.faculty_id
    JOIN classrooms cr ON ts.classroom_id = cr.classroom_id
    JOIN sections sec ON ts.section_id = sec.section_id
    JOIN course_offerings co ON sec.offering_id = co.offering_id
    JOIN subjects sub ON co.subject_id = sub.subject_id
  `);
  console.log("\n--- ALL EXISTING TIMETABLE SLOTS ---");
  console.table(slots);

  // 13. Existing Students in SOCI batches
  const [students] = await connection.query(`
    SELECT stu.student_id, stu.register_no, stu.full_name, stu.batch_id, b.label AS batch_label, p.name AS prog_name, u.username
    FROM students stu
    JOIN batches b ON stu.batch_id = b.batch_id
    JOIN programmes p ON b.programme_id = p.programme_id
    LEFT JOIN users u ON u.student_id = stu.student_id
    WHERE p.school_id = 3
  `);
  console.log("\n--- STUDENTS IN SOCI BATCHES ---");
  console.table(students);

  await connection.end();
}

inspect().catch(err => {
  console.error("Inspection error:", err);
  process.exit(1);
});
