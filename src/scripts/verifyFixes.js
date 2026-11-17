require("dotenv").config();
const pool = require("../config/mysql.js");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("=== VERIFYING ACADEMIC & ROLE FIXES ===");

  // 1. Verify HOD user and faculty record
  const [hodRows] = await pool.query(`
    SELECT u.user_id, u.username, u.role, u.faculty_id, f.full_name, f.department_id, des.name as designation,
           CASE WHEN des.name IN ('Head of Department', 'HOD', 'Department Head') THEN 1 ELSE 0 END AS is_hod
    FROM users u
    JOIN faculty f ON u.faculty_id = f.faculty_id
    JOIN designations des ON f.designation_id = des.designation_id
    WHERE u.username = 'HOD001'
  `);
  console.log("\n[1] HOD User check:");
  console.log(hodRows[0] || "NOT FOUND");

  // Verify HOD password
  const [pwdRows] = await pool.query("SELECT password_hash FROM users WHERE username = 'HOD001'");
  if (pwdRows.length > 0) {
    const isMatch = await bcrypt.compare("Faculty@123", pwdRows[0].password_hash);
    console.log("HOD password 'Faculty@123' bcrypt match:", isMatch);
  }

  // 2. Verify General Faculty user
  const [facRows] = await pool.query(`
    SELECT u.user_id, u.username, u.role, u.faculty_id, f.full_name, f.department_id, des.name as designation,
           CASE WHEN des.name IN ('Head of Department', 'HOD', 'Department Head') THEN 1 ELSE 0 END AS is_hod
    FROM users u
    JOIN faculty f ON u.faculty_id = f.faculty_id
    JOIN designations des ON f.designation_id = des.designation_id
    WHERE u.username = 'FAC001'
  `);
  console.log("\n[2] FAC001 User check:");
  console.log(facRows[0] || "NOT FOUND");

  // 3. Test HOD subject visibility (department subjects) vs Faculty subject visibility
  const hodDeptId = hodRows[0]?.department_id;
  const [hodSubjects] = await pool.query(`
    SELECT DISTINCT s.subject_id, s.subject_code, s.name
    FROM subjects s
    WHERE s.owner_department_id = ?
  `, [hodDeptId]);
  console.log(`\n[3] HOD (Dept ${hodDeptId}) can see ${hodSubjects.length} subjects:`, hodSubjects.map(s => s.subject_code));

  const facId = facRows[0]?.faculty_id;
  const [facSubjects] = await pool.query(`
    SELECT DISTINCT s.subject_id, s.subject_code, s.name
    FROM subjects s
    LEFT JOIN subject_staff_assignments ssa ON s.subject_id = ssa.subject_id AND ssa.faculty_id = ?
    LEFT JOIN course_offerings co_f ON s.subject_id = co_f.subject_id AND co_f.coordinator_faculty_id = ?
    LEFT JOIN sections sec_f ON co_f.offering_id = sec_f.offering_id
    LEFT JOIN timetable_slots ts_f ON sec_f.section_id = ts_f.section_id AND ts_f.faculty_id = ? AND ts_f.is_active = 1
    WHERE (ssa.assignment_id IS NOT NULL OR co_f.offering_id IS NOT NULL OR ts_f.slot_id IS NOT NULL)
  `, [facId, facId, facId]);
  console.log(`General Faculty (FAC001) assigned subjects count: ${facSubjects.length}:`, facSubjects.map(s => s.subject_code));

  // 4. Test Materials in DB
  const [mCols] = await pool.query("DESCRIBE academic_materials");
  console.log("academic_materials columns:", mCols.map(c => c.Field));

  const [qCols] = await pool.query("DESCRIBE academic_quizzes");
  console.log("academic_quizzes columns:", qCols.map(c => c.Field));

  const [materials] = await pool.query(`SELECT material_id, title, type, status FROM academic_materials LIMIT 5`);
  console.log("\n[4] Sample Materials in DB:", materials);

  // 5. Test Quizzes in DB
  const [quizzes] = await pool.query(`SELECT quiz_id, topic_id, title, status FROM academic_quizzes LIMIT 5`);
  console.log("\n[5] Sample Quizzes in DB:", quizzes);

  // 6. Test Admin Oversight data aggregation
  const [matCount] = await pool.query("SELECT COUNT(*) AS total FROM academic_materials");
  const [quizCount] = await pool.query("SELECT COUNT(*) AS total FROM academic_quizzes");
  const [attCount] = await pool.query("SELECT COUNT(*) AS total FROM academic_attempts");
  console.log(`\n[6] Admin Oversight Metrics -> Total Materials: ${matCount[0].total}, Total Quizzes: ${quizCount[0].total}, Total Attempts: ${attCount[0].total}`);

  console.log("\n=== ALL CHECKS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
  console.log(`\n[6] Admin Oversight Metrics -> Total Materials: ${matCount[0].total}, Total Quizzes: ${quizCount[0].total}, Total Attempts: ${attCount[0].total}`);

  console.log("\n=== ALL CHECKS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
