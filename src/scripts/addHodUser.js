const bcrypt = require("bcryptjs");
const pool = require("../config/mysql");

async function addHodUser() {
  const conn = await pool.getConnection();
  try {
    console.log("[ADD-HOD] Starting HOD user setup...");

    // 1. Ensure Designation exists
    const [desigRows] = await conn.query(
      "SELECT designation_id FROM designations WHERE name LIKE '%Head of Department%' OR name LIKE '%HOD%' LIMIT 1"
    );

    let designationId;
    if (desigRows.length > 0) {
      designationId = desigRows[0].designation_id;
      console.log(`[ADD-HOD] Using existing HOD designation ID: ${designationId}`);
    } else {
      const [insDesig] = await conn.query(
        "INSERT INTO designations (name) VALUES ('Professor & Head of Department')"
      );
      designationId = insDesig.insertId;
      console.log(`[ADD-HOD] Created new HOD designation ID: ${designationId}`);
    }

    // 2. Select Department (Department of Computing & Information Systems, ID: 5, School: 3)
    const departmentId = 5;
    const schoolId = 3;

    // 3. Create or update Faculty record
    const employeeCode = "HOD001";
    const email = "hod.cis@joyuniversity.edu.in";
    const fullName = "Dr. Vikram Sharma (HOD)";

    const [existingFac] = await conn.query(
      "SELECT faculty_id FROM faculty WHERE employee_code = ? OR email = ? LIMIT 1",
      [employeeCode, email]
    );

    let facultyId;
    if (existingFac.length > 0) {
      facultyId = existingFac[0].faculty_id;
      await conn.query(
        `UPDATE faculty SET
          full_name = ?,
          designation_id = ?,
          department_id = ?,
          school_id = ?,
          is_active = 1
         WHERE faculty_id = ?`,
        [fullName, designationId, departmentId, schoolId, facultyId]
      );
      console.log(`[ADD-HOD] Updated existing faculty record ID: ${facultyId}`);
    } else {
      const [insFac] = await conn.query(
        `INSERT INTO faculty
          (employee_code, full_name, gender, joining_year, phone, email, designation_id, school_id, department_id, is_active)
         VALUES
          (?, ?, 'male', 2021, '9876543210', ?, ?, ?, ?, 1)`,
        [employeeCode, fullName, email, designationId, schoolId, departmentId]
      );
      facultyId = insFac.insertId;
      console.log(`[ADD-HOD] Created new faculty record ID: ${facultyId}`);
    }

    // 4. Create or update User record
    const username = "HOD001";
    const defaultPassword = "Faculty@123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const [existingUser] = await conn.query(
      "SELECT user_id FROM users WHERE username = ? OR email = ? OR faculty_id = ? LIMIT 1",
      [username, email, facultyId]
    );

    let userId;
    if (existingUser.length > 0) {
      userId = existingUser[0].user_id;
      await conn.query(
        `UPDATE users SET
          username = ?,
          full_name = ?,
          email = ?,
          password_hash = ?,
          role = 'FACULTY',
          faculty_id = ?,
          is_active = 1
         WHERE user_id = ?`,
        [username, fullName, email, passwordHash, facultyId, userId]
      );
      console.log(`[ADD-HOD] Updated existing user record ID: ${userId}`);
    } else {
      const [insUser] = await conn.query(
        `INSERT INTO users
          (username, full_name, email, password_hash, role, faculty_id, is_active)
         VALUES
          (?, ?, ?, ?, 'FACULTY', ?, 1)`,
        [username, fullName, email, passwordHash, facultyId]
      );
      userId = insUser.insertId;
      console.log(`[ADD-HOD] Created new user record ID: ${userId}`);
    }

    console.log("[ADD-HOD] ✓ Successfully added HOD user to the database!");
    console.log("--------------------------------------------------");
    console.log(`Username:    ${username}`);
    console.log(`Password:    ${defaultPassword}`);
    console.log(`Role:        FACULTY (Head of Department)`);
    console.log(`Department:  Computing & Information Systems (ID: ${departmentId})`);
    console.log(`Designation: Professor & Head of Department`);
    console.log("--------------------------------------------------");

    process.exit(0);
  } catch (err) {
    console.error("[ADD-HOD] ✗ Error adding HOD user:", err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

addHodUser();
