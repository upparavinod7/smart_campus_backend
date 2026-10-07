const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../app");
const pool = require("../config/mysql");
const crypto = require("node:crypto");
const { cleanupExpiredTokens } = require("../utils/tokenCleanup");

let server;
let baseUrl;

test.before((t, done) => {
  server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/v1`;
    done();
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test("API Health Check: GET /api/v1/test returns 200", async () => {
  const res = await fetch(`${baseUrl}/test`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "API is working");
});

test("Auth Login: POST /api/v1/auth/login requires username and password", async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Username and password are required");
});

test("Protected Route: GET /api/v1/auth/me without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/auth/me`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Admin Route: GET /api/v1/admin/dashboard-stats without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/admin/dashboard-stats`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Student Route: GET /api/v1/student/me without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/student/me`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

// FEAT-005: Student Management (CRUD) & Authorization Tests
const jwt = require("jsonwebtoken");

const adminToken = jwt.sign(
  { user_id: 1, username: "admin", role: "ADMIN" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

const studentToken = jwt.sign(
  { user_id: 3, username: "student", role: "STUDENT" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

test("Student CRUD RBAC: GET /api/v1/students without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/students`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("Student CRUD RBAC: GET /api/v1/students with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/students`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("Student CRUD RBAC: POST /api/v1/students with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ register_no: "TEST01", full_name: "Test", batch_id: 1 }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("Student CRUD Validation: POST /api/v1/students requires register_no, full_name, batch_id", async () => {
  const res = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ register_no: "MISSING_FIELDS" }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /required/i);
});

test("Student CRUD Validation: POST /api/v1/students rejects invalid batch_id", async () => {
  const res = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: `TEST_INV_BATCH_${Date.now()}`,
      full_name: "Invalid Batch Student",
      batch_id: 999999,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Invalid batch_id");
});

test("Student CRUD Validation: POST /api/v1/students rejects invalid status", async () => {
  const res = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: `TEST_INV_STAT_${Date.now()}`,
      full_name: "Invalid Status Student",
      batch_id: 1,
      status: "NON_EXISTENT_STATUS",
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Invalid student status");
});

test("Student CRUD Full Lifecycle: List, Create, GetById, Update, Duplicate Check, Delete", async () => {
  // 1. List students as ADMIN
  const listRes = await fetch(`${baseUrl}/students`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.equal(listBody.success, true);
  assert.ok(Array.isArray(listBody.data));

  // 2. Create a new student
  const uniqueReg = `TEST_REG_${Date.now()}`;
  const createRes = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: uniqueReg,
      full_name: "Automated Test Student",
      email: `test_${Date.now()}@joyuniversity.edu.in`,
      phone: "9988776655",
      batch_id: 1,
      status: "ACTIVE",
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const createdId = createBody.data.student_id;
  assert.ok(createdId);

  // 3. Duplicate register_no should return 409
  const dupRes = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: uniqueReg,
      full_name: "Duplicate Register Student",
      batch_id: 1,
    }),
  });
  const dupBody = await dupRes.json();
  assert.equal(dupRes.status, 409);
  assert.equal(dupBody.success, false);

  // 4. Retrieve student by ID (should include batch_label)
  const getRes = await fetch(`${baseUrl}/students/${createdId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.success, true);
  assert.equal(getBody.data.register_no, uniqueReg);
  assert.equal(getBody.data.full_name, "Automated Test Student");
  assert.ok(getBody.data.batch_label);

  // 5. Update student record
  const updateRes = await fetch(`${baseUrl}/students/${createdId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      full_name: "Automated Test Student Updated",
      status: "INTERNSHIP_BREAK",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.success, true);
  assert.equal(updateBody.data.full_name, "Automated Test Student Updated");
  assert.equal(updateBody.data.status, "INTERNSHIP_BREAK");

  // 6. Delete student
  const deleteRes = await fetch(`${baseUrl}/students/${createdId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteBody = await deleteRes.json();
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteBody.success, true);

  // 7. Verify student no longer exists (404)
  const verifyRes = await fetch(`${baseUrl}/students/${createdId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const verifyBody = await verifyRes.json();
  assert.equal(verifyRes.status, 404);
  assert.equal(verifyBody.success, false);
});

// Authentication Persistence & Session Restoration Tests (fix/auth-refresh-persistence)
test("Session Restoration: GET /api/v1/auth/me with valid token returns user identity and role", async () => {
  const res = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.username, "admin");
  assert.equal(body.data.role, "ADMIN");
  assert.equal(body.data.password, undefined);
  assert.equal(body.data.password_hash, undefined);
});

test("Session Restoration: GET /api/v1/auth/me with expired token returns 401", async () => {
  const expiredToken = jwt.sign(
    { user_id: 1, username: "admin", role: "ADMIN" },
    process.env.JWT_SECRET,
    { expiresIn: "-10s" },
  );
  const res = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Invalid or expired token");
});

test("Session Restoration: GET /api/v1/auth/me with malformed token returns 401", async () => {
  const res = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: "Bearer this.is.an.invalid.token" },
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("Session Restoration: GET /api/v1/auth/me rejects non-existent or deactivated user", async () => {
  const ghostToken = jwt.sign(
    { user_id: 999999, username: "ghost", role: "ADMIN" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  const res = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${ghostToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /invalid or inactive/i);
});

// --- Role-Aware Token Revocation & Server-Side Logout Tests ---

test("Token Revocation (General): POST /api/v1/auth/logout without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Token Revocation (Admin): POST /api/v1/auth/logout revokes admin token across protected endpoints", async () => {
  // 1. Admin login
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  const token = loginBody.token;
  assert.ok(token);

  // 2. Validate token works before logout
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.status, 200);

  // 3. Logout
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const logoutBody = await logoutRes.json();
  assert.equal(logoutRes.status, 200);
  assert.equal(logoutBody.success, true);
  assert.equal(logoutBody.message, "Logout successful and token revoked");

  // 4. Token replay attacks should fail across endpoints
  const replayMe = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const replayMeBody = await replayMe.json();
  assert.equal(replayMe.status, 401);
  assert.equal(replayMeBody.success, false);
  assert.equal(replayMeBody.message, "Token has been revoked");

  const replayAdmin = await fetch(`${baseUrl}/admin/dashboard-stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(replayAdmin.status, 401);

  const replayStudents = await fetch(`${baseUrl}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(replayStudents.status, 401);
});

test("Token Revocation (Faculty): POST /api/v1/auth/logout revokes faculty token and denies access to faculty endpoints", async () => {
  // 1. Faculty login
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "FAC001", password: "Faculty@123" }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.equal(loginBody.data.role, "FACULTY");
  assert.equal(loginBody.data.faculty_id, 1);
  const facultyToken = loginBody.token;
  assert.ok(facultyToken);

  // 2. Verify faculty can access protected /auth/me and /staff/t
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(meRes.status, 200);

  const staffRes = await fetch(`${baseUrl}/staff/t`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(staffRes.status, 200);

  // 3. Faculty logs out
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const logoutBody = await logoutRes.json();
  assert.equal(logoutRes.status, 200);
  assert.equal(logoutBody.success, true);
  assert.equal(logoutBody.message, "Logout successful and token revoked");

  // 4. Token replay attacks should fail with 401 "Token has been revoked"
  const replayMe = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const replayMeBody = await replayMe.json();
  assert.equal(replayMe.status, 401);
  assert.equal(replayMeBody.message, "Token has been revoked");

  const replayStaff = await fetch(`${baseUrl}/staff/t`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const replayStaffBody = await replayStaff.json();
  assert.equal(replayStaff.status, 401);
  assert.equal(replayStaffBody.message, "Token has been revoked");
});

test("Token Revocation (Student): POST /api/v1/auth/logout revokes student token and denies access to student portal", async () => {
  // 1. Student login
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "J26AIM001", password: "Student@123" }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.equal(loginBody.data.role, "STUDENT");
  assert.equal(loginBody.data.student_id, 1);
  const studentToken = loginBody.token;
  assert.ok(studentToken);

  // 2. Verify student can access protected /auth/me and /student/me
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(meRes.status, 200);

  const portalRes = await fetch(`${baseUrl}/student/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(portalRes.status, 200);

  // 3. Student logs out
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const logoutBody = await logoutRes.json();
  assert.equal(logoutRes.status, 200);
  assert.equal(logoutBody.success, true);
  assert.equal(logoutBody.message, "Logout successful and token revoked");

  // 4. Token replay attacks should fail with 401 "Token has been revoked"
  const replayMe = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const replayMeBody = await replayMe.json();
  assert.equal(replayMe.status, 401);
  assert.equal(replayMeBody.message, "Token has been revoked");

  const replayPortal = await fetch(`${baseUrl}/student/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const replayPortalBody = await replayPortal.json();
  assert.equal(replayPortal.status, 401);
  assert.equal(replayPortalBody.message, "Token has been revoked");

  const replayAttendance = await fetch(`${baseUrl}/student/me/attendance`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const replayAttendanceBody = await replayAttendance.json();
  assert.equal(replayAttendance.status, 401);
  assert.equal(replayAttendanceBody.message, "Token has been revoked");
});

test("Token Revocation: Concurrent session isolation across roles (Faculty and Student)", async () => {
  // Session A: Student login
  const studentLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "J26AIM001", password: "Student@123" }),
  });
  const studentTokenA = (await studentLoginRes.json()).token;

  // Session B: Faculty login
  const facultyLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "FAC001", password: "Faculty@123" }),
  });
  const facultyTokenB = (await facultyLoginRes.json()).token;

  // Revoke Student Session A
  const logoutStudent = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentTokenA}` },
  });
  assert.equal(logoutStudent.status, 200);

  // Student Session A should be revoked
  const checkA = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${studentTokenA}` },
  });
  assert.equal(checkA.status, 401);

  // Faculty Session B MUST remain valid
  const checkB = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${facultyTokenB}` },
  });
  assert.equal(checkB.status, 200);

  // Revoke Faculty Session B
  const logoutFaculty = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyTokenB}` },
  });
  assert.equal(logoutFaculty.status, 200);

  const checkBAfter = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${facultyTokenB}` },
  });
  assert.equal(checkBAfter.status, 401);
});

test("Token Revocation: POST /api/v1/auth/logout with token missing jti still revokes via SHA-256 fingerprint", async () => {
  const legacyToken = jwt.sign(
    { user_id: 3, username: "J26AIM001", role: "STUDENT", student_id: 1 },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  const preRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${legacyToken}` },
  });
  assert.equal(preRes.status, 200);

  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${legacyToken}` },
  });
  assert.equal(logoutRes.status, 200);

  const postRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${legacyToken}` },
  });
  assert.equal(postRes.status, 401);
  const postBody = await postRes.json();
  assert.equal(postBody.message, "Token has been revoked");
});

test("Token Revocation: Cleanup routine purges naturally expired revoked tokens", async () => {
  const expiredJti = `test-purge-${Date.now()}`;
  await pool.query(
    "INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES (?, 1, DATE_SUB(NOW(), INTERVAL 1 HOUR))",
    [expiredJti],
  );

  const deleted = await cleanupExpiredTokens();
  assert.ok(deleted >= 1);

  const [rows] = await pool.query(
    "SELECT 1 FROM revoked_tokens WHERE jti = ?",
    [expiredJti],
  );
  assert.equal(rows.length, 0);
});

// =============================================================================
// FEAT-009: Attendance Session & Record Management Tests
// =============================================================================

const facultyToken = jwt.sign(
  { user_id: 4, username: "FAC001", role: "FACULTY", faculty_id: 1 },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

const otherFacultyToken = jwt.sign(
  { user_id: 99, username: "FAC002", role: "FACULTY", faculty_id: 2 },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

const otherStudentToken = jwt.sign(
  { user_id: 98, username: "otherStudent", role: "STUDENT", student_id: 2 },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

// --- Authentication and RBAC ---
test("Attendance Sessions: GET /api/v1/attendance/sessions without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Attendance Records: GET /api/v1/attendance without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/attendance`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Attendance Sessions RBAC: POST /api/v1/attendance/sessions with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ slot_id: 1 }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Attendance Sessions RBAC: PUT /api/v1/attendance/sessions/:id with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions/1`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ cancel_reason: "Unauthorized" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Attendance Sessions RBAC: POST /api/v1/attendance/sessions/:id/start with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions/1/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Attendance Sessions RBAC: POST /api/v1/attendance/sessions/:id/finalize with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions/1/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Attendance Records RBAC: POST /api/v1/attendance with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ session_id: 1, enrollment_id: 1, status: "PRESENT" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Attendance Records RBAC: POST /api/v1/attendance/:id/override with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/attendance/1/override`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ new_status: "PRESENT", reason_code: "OTHER" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Attendance Sessions RBAC: Faculty cannot create session assigned to another faculty member (403)", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`, // faculty_id: 1
    },
    body: JSON.stringify({
      slot_id: 1,
      session_date: "2027-01-10",
      faculty_id: 2, // Trying to assign to faculty 2
      classroom_id: 1,
      scheduled_start: "2027-01-10 09:00:00",
      scheduled_end: "2027-01-10 10:00:00",
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /another faculty member/i);
});

test("Attendance Records Privacy: STUDENT cannot access another student's attendance records (403)", async () => {
  // studentToken has student_id: 1. Trying to access student 2
  const res = await fetch(`${baseUrl}/attendance/student/2`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /another student/i);
});

// --- Session Validation and Error Handling ---
test("Attendance Sessions Validation: POST /api/v1/attendance/sessions requires all core fields (400)", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /required/i);
});

test("Attendance Sessions Validation: POST /api/v1/attendance/sessions rejects invalid foreign keys (400)", async () => {
  const invalidSlotRes = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      slot_id: 999999,
      session_date: "2027-02-01",
      faculty_id: 1,
      classroom_id: 1,
      scheduled_start: "2027-02-01 09:00:00",
      scheduled_end: "2027-02-01 10:00:00",
    }),
  });
  assert.equal(invalidSlotRes.status, 400);
  assert.match((await invalidSlotRes.json()).message, /invalid slot_id/i);

  const invalidFacRes = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      slot_id: 1,
      session_date: "2027-02-01",
      faculty_id: 999999,
      classroom_id: 1,
      scheduled_start: "2027-02-01 09:00:00",
      scheduled_end: "2027-02-01 10:00:00",
    }),
  });
  assert.equal(invalidFacRes.status, 400);
  assert.match((await invalidFacRes.json()).message, /invalid faculty_id/i);
});

test("Attendance Sessions Validation: POST /api/v1/attendance/sessions rejects scheduled_end <= scheduled_start (400)", async () => {
  const res = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      slot_id: 1,
      session_date: "2027-02-02",
      faculty_id: 1,
      classroom_id: 1,
      scheduled_start: "2027-02-02 10:00:00",
      scheduled_end: "2027-02-02 09:00:00", // Earlier than start
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /greater than/i);
});

test("Attendance Sessions Not Found: GET, PUT, start, finalize on non-existent session return 404", async () => {
  const nonExistentId = 999999;

  const getRes = await fetch(`${baseUrl}/attendance/sessions/${nonExistentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getRes.status, 404);
  assert.equal((await getRes.json()).success, false);

  const putRes = await fetch(`${baseUrl}/attendance/sessions/${nonExistentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ cancel_reason: "Test" }),
  });
  assert.equal(putRes.status, 404);
  assert.equal((await putRes.json()).success, false);

  const startRes = await fetch(`${baseUrl}/attendance/sessions/${nonExistentId}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(startRes.status, 404);
  assert.equal((await startRes.json()).success, false);

  const finRes = await fetch(`${baseUrl}/attendance/sessions/${nonExistentId}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(finRes.status, 404);
  assert.equal((await finRes.json()).success, false);
});

// --- Session Lifecycle, State Machine, Marking, and Reconciliation Full Lifecycle ---
test("Attendance Lifecycle: Create, List/Filter, Start, Mark, Reject Duplicates, Finalize, Reconcile, and Override", async () => {
  const randomOffsetDays = 300 + Math.floor(Math.random() * 20000);
  const uniqueDate = new Date(Date.now() + 86400000 * randomOffsetDays).toISOString().slice(0, 10);

  // 1. Create session as assigned Faculty 1
  const createRes = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      slot_id: 1,
      session_date: uniqueDate,
      faculty_id: 1,
      classroom_id: 1,
      scheduled_start: `${uniqueDate} 10:00:00`,
      scheduled_end: `${uniqueDate} 11:00:00`,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const sessionId = createBody.data.session_id;
  assert.ok(sessionId);
  assert.equal(createBody.data.status, "SCHEDULED");
  assert.equal(createBody.data.faculty_id, 1);

  // 2. Duplicate session for same slot/date returns 409
  const dupRes = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      slot_id: 1,
      session_date: uniqueDate,
      faculty_id: 1,
      classroom_id: 1,
      scheduled_start: `${uniqueDate} 10:00:00`,
      scheduled_end: `${uniqueDate} 11:00:00`,
    }),
  });
  assert.equal(dupRes.status, 409);
  assert.equal((await dupRes.json()).success, false);

  // 3. List sessions with filters and relational metadata joins
  const listRes = await fetch(`${baseUrl}/attendance/sessions?session_date=${uniqueDate}&faculty_id=1`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.ok(listBody.data.some((s) => s.session_id === sessionId));
  const foundSession = listBody.data.find((s) => s.session_id === sessionId);
  assert.ok(foundSession.faculty_name);
  assert.ok(foundSession.room_no);

  // 4. Other faculty cannot start Faculty 1's session (403)
  const unauthStartRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${otherFacultyToken}` },
  });
  assert.equal(unauthStartRes.status, 403);
  assert.match((await unauthStartRes.json()).message, /permission/i);

  // 5. Cannot mark attendance while session is SCHEDULED (400)
  const earlyMarkRes = await fetch(`${baseUrl}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      student_id: 1,
      status: "PRESENT",
    }),
  });
  assert.equal(earlyMarkRes.status, 400);
  assert.match((await earlyMarkRes.json()).message, /SCHEDULED/i);

  // 6. Faculty 1 starts session (SCHEDULED -> OPEN)
  const startRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const startBody = await startRes.json();
  assert.equal(startRes.status, 200);
  assert.equal(startBody.data.status, "OPEN");
  assert.ok(startBody.data.opened_at);

  // 7. Repeated start on OPEN session returns 400
  const repeatStartRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(repeatStartRes.status, 400);
  assert.match((await repeatStartRes.json()).message, /OPEN/i);

  // 8. Other faculty cannot mark attendance for Faculty 1's session (403)
  const unauthMarkRes = await fetch(`${baseUrl}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${otherFacultyToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      student_id: 1,
      status: "PRESENT",
    }),
  });
  assert.equal(unauthMarkRes.status, 403);

  // 9. Faculty 1 marks attendance for student 1 in open session
  const markRes = await fetch(`${baseUrl}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      student_id: 1,
      status: "PRESENT",
    }),
  });
  const markBody = await markRes.json();
  assert.equal(markRes.status, 201);
  assert.equal(markBody.success, true);
  const attendanceId = markBody.data.attendance_id;
  assert.ok(attendanceId);
  assert.equal(markBody.data.status, "PRESENT");
  assert.equal(markBody.data.source, "MANUAL");

  // 10. Duplicate attendance for same student and session returns 409
  const dupMarkRes = await fetch(`${baseUrl}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      student_id: 1,
      status: "PRESENT",
    }),
  });
  assert.equal(dupMarkRes.status, 409);
  assert.equal((await dupMarkRes.json()).success, false);

  // 11. Retrieve session roster records
  const sessionRecordsRes = await fetch(`${baseUrl}/attendance/session/${sessionId}`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const sessionRecordsBody = await sessionRecordsRes.json();
  assert.equal(sessionRecordsRes.status, 200);
  assert.equal(sessionRecordsBody.data.total_records, 1);
  assert.equal(sessionRecordsBody.data.records[0].attendance_id, attendanceId);

  // 12. Finalize session (OPEN -> CLOSED)
  const finalizeRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const finalizeBody = await finalizeRes.json();
  assert.equal(finalizeRes.status, 200);
  assert.equal(finalizeBody.data.status, "CLOSED");
  assert.ok(finalizeBody.data.closed_at);

  // 13. Repeated finalize on CLOSED session returns 400
  const repeatFinalizeRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(repeatFinalizeRes.status, 400);
  assert.match((await repeatFinalizeRes.json()).message, /CLOSED/i);

  // 14. Cannot mark normal attendance on CLOSED session (400)
  const closedMarkRes = await fetch(`${baseUrl}/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      student_id: 2,
      status: "PRESENT",
    }),
  });
  assert.equal(closedMarkRes.status, 400);
  assert.match((await closedMarkRes.json()).message, /CLOSED/i);

  // 15. Closed session rejects modifications via PUT (400)
  const putClosedRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({ cancel_reason: "Closed update attempt" }),
  });
  assert.equal(putClosedRes.status, 400);

  // 16. Reconcile attendance session
  const reconcileRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/reconcile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({
      headcount: 1,
      tolerance_pct: 10,
    }),
  });
  const reconcileBody = await reconcileRes.json();
  assert.equal(reconcileRes.status, 200);
  assert.equal(reconcileBody.success, true);
  assert.equal(reconcileBody.data.session_id, sessionId);
  assert.equal(reconcileBody.data.attended_count, 1);
  assert.ok(reconcileBody.data.result);

  // 17. Repeated reconciliation is safe and idempotent (200)
  const repeatReconcileRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/reconcile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({ headcount: 1 }),
  });
  assert.equal(repeatReconcileRes.status, 200);

  // 18. Administrative override updates record and creates audit trail in attendance_corrections
  const overrideRes = await fetch(`${baseUrl}/attendance/${attendanceId}/override`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      new_status: "LATE",
      reason_code: "FACULTY_OVERRIDE",
      reason_note: "Student was late due to university bus delay",
    }),
  });
  const overrideBody = await overrideRes.json();
  assert.equal(overrideRes.status, 200);
  assert.equal(overrideBody.success, true);
  assert.equal(overrideBody.data.new_status, "LATE");
  assert.equal(overrideBody.data.previous_status, "PRESENT");
  assert.equal(overrideBody.data.source, "CORRECTION");

  // 19. Retrieve record by ID verifies overridden state
  const getRecordRes = await fetch(`${baseUrl}/attendance/${attendanceId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getRecordBody = await getRecordRes.json();
  assert.equal(getRecordRes.status, 200);
  assert.equal(getRecordBody.data.status, "LATE");
  assert.equal(getRecordBody.data.source, "CORRECTION");

  // 20. Student attendance summary returns valid statistics
  const summaryRes = await fetch(`${baseUrl}/attendance/student/1/summary`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const summaryBody = await summaryRes.json();
  assert.equal(summaryRes.status, 200);
  assert.equal(summaryBody.success, true);
  assert.ok(summaryBody.data.summary.total_classes >= 1);
  assert.ok(typeof summaryBody.data.summary.attendance_percentage === "number");

  // Cleanup test data created during this lifecycle test
  if (sessionId) {
    await pool.query("DELETE FROM session_reconciliation WHERE session_id = ?", [sessionId]);
    await pool.query("DELETE FROM attendance_corrections WHERE attendance_id = ?", [attendanceId]);
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [sessionId]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [sessionId]);
  }
});



