const bcrypt = require("bcryptjs");
const pool = require("../config/mysql");

async function seedHod() {
  try {
    console.log("[SEED-HOD] Setting up HOD designation and user...");

    // 1. Ensure designation "Head of Department" exists
    const [existingDes] = await pool.query(
      "SELECT designation_id FROM designations WHERE name = 'Head of Department' LIMIT 1"
    );

    let designationId;
    if (existingDes.length > 0) {
      designationId = existingDes[0].designation_id;
    } else {
      const [desRes] = await pool.query(
        "INSERT INTO designations (name) VALUES ('Head of Department')"
      );
      designationId = desRes.insertId;
      console.log(`[SEED-HOD] Created designation 'Head of Department' with id ${designationId}`);
    }

    // 2. Department 5 is CIS (Computing & Information Systems)
    const departmentId = 5;
    const schoolId = 3;

    // 3. Create or update HOD faculty record
    const [existingFac] = await pool.query(
      "SELECT faculty_id FROM faculty WHERE employee_code = 'HOD001' LIMIT 1"
    );

    let facultyId;
    if (existingFac.length > 0) {
      facultyId = existingFac[0].faculty_id;
      await pool.query(
        `UPDATE faculty SET 
          full_name = 'Dr. K. S. Ramanathan',
          email = 'hod.cis@joyuniversity.edu.in',
          designation_id = ?,
          department_id = ?,
          school_id = ?,
          is_active = 1
        WHERE faculty_id = ?`,
        [designationId, departmentId, schoolId, facultyId]
      );
      console.log(`[SEED-HOD] Updated existing HOD faculty id ${facultyId}`);
    } else {
      const [facRes] = await pool.query(
        `INSERT INTO faculty (employee_code, full_name, email, designation_id, department_id, school_id, is_active)
         VALUES ('HOD001', 'Dr. K. S. Ramanathan', 'hod.cis@joyuniversity.edu.in', ?, ?, ?, 1)`,
        [designationId, departmentId, schoolId]
      );
      facultyId = facRes.insertId;
      console.log(`[SEED-HOD] Created HOD faculty id ${facultyId}`);
    }

    // 4. Hash password 'Faculty@123'
    const passwordHash = await bcrypt.hash("Faculty@123", 10);

    // 5. Create or update user HOD001
    const [existingUser] = await pool.query(
      "SELECT user_id FROM users WHERE username = 'HOD001' LIMIT 1"
    );

    if (existingUser.length > 0) {
      await pool.query(
        `UPDATE users SET 
          full_name = 'Dr. K. S. Ramanathan',
          email = 'hod.cis@joyuniversity.edu.in',
          password_hash = ?,
          role = 'FACULTY',
          faculty_id = ?,
          is_active = 1
        WHERE user_id = ?`,
        [passwordHash, facultyId, existingUser[0].user_id]
      );
      console.log(`[SEED-HOD] Updated user HOD001`);
    } else {
      await pool.query(
        `INSERT INTO users (username, full_name, email, password_hash, role, faculty_id, is_active)
         VALUES ('HOD001', 'Dr. K. S. Ramanathan', 'hod.cis@joyuniversity.edu.in', ?, 'FACULTY', ?, 1)`,
        [passwordHash, facultyId]
      );
      console.log(`[SEED-HOD] Created user HOD001`);
    }

    console.log("[SEED-HOD] SUCCESS!");
    console.log("HOD Credentials (Role: FACULTY):");
    console.log("  Username: HOD001");
    console.log("  Password: Faculty@123");
    console.log("  Department: Department of Computing & Information Systems (CIS)");
    process.exit(0);
  } catch (err) {
    console.error("[SEED-HOD] Error:", err);
    process.exit(1);
  }
}

seedHod();
