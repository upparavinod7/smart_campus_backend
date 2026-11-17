require('dotenv').config();
const pool = require('../config/mysql');

async function run() {
  try {
    const [desigs] = await pool.query('SELECT * FROM designations');
    console.log('DESIGNATIONS:', desigs);

    const [facs] = await pool.query('SELECT * FROM faculty');
    console.log('FACULTY:', facs);

    const [users] = await pool.query('SELECT user_id, username, role, faculty_id, student_id FROM users');
    console.log('USERS:', users);

    const [depts] = await pool.query('SELECT * FROM departments');
    console.log('DEPARTMENTS:', depts);

    const [staffAssn] = await pool.query('SELECT * FROM subject_staff_assignments');
    console.log('STAFF ASSIGNMENTS:', staffAssn);

    const [subjs] = await pool.query('SELECT subject_id, subject_code, name, owner_department_id FROM subjects LIMIT 10');
    console.log('SUBJECTS:', subjs);

    const [attempts] = await pool.query('DESCRIBE academic_attempts');
    console.log('ATTEMPTS COLS:', attempts.map(c => c.Field));
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

run();
