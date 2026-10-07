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

// =========================================================================
// FEAT-011: Faculty Portal Workflows Test Suite
// =========================================================================

const facultyToken1 = jwt.sign(
  { user_id: 4, username: "FAC001", role: "FACULTY", faculty_id: 1 },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

const facultyToken2 = jwt.sign(
  { user_id: 99, username: "FAC002", role: "FACULTY", faculty_id: 2 },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

const viewerToken = jwt.sign(
  { user_id: 88, username: "viewer_user", role: "VIEWER" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

const operatorToken = jwt.sign(
  { user_id: 87, username: "operator_user", role: "OPERATOR" },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

// 1-4: Authentication Requirements (401 without token)
test("FEAT-011 Faculty Auth: GET /api/v1/faculty/dashboard without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/faculty/dashboard`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty Auth: GET /api/v1/faculty/timetable without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/faculty/timetable`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty Auth: GET /api/v1/faculty/attendance/sessions without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty Auth: GET /api/v1/faculty/me without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/faculty/me`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

// 5-10: Faculty RBAC Isolation (403 for unauthorized roles)
test("FEAT-011 Faculty RBAC: STUDENT cannot access faculty dashboard (returns 403)", async () => {
  const res = await fetch(`${baseUrl}/faculty/dashboard`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty RBAC: STUDENT cannot access faculty timetable (returns 403)", async () => {
  const res = await fetch(`${baseUrl}/faculty/timetable`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty RBAC: STUDENT cannot manage faculty attendance sessions (returns 403)", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty RBAC: STUDENT cannot modify faculty attendance records (returns 403)", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session_id: 1, student_id: 1, status: "PRESENT" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty RBAC: VIEWER cannot perform faculty mutations (returns 403)", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions/1/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${viewerToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty RBAC: OPERATOR cannot access faculty portal (returns 403)", async () => {
  const res = await fetch(`${baseUrl}/faculty/dashboard`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

// 11-17: Faculty Ownership & Cross-Faculty Isolation
test("FEAT-011 Faculty Ownership: Faculty A and Faculty B receive distinct timetable slots", async () => {
  const resA = await fetch(`${baseUrl}/faculty/timetable`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const bodyA = await resA.json();
  assert.equal(resA.status, 200);
  assert.equal(bodyA.success, true);
  for (const slot of bodyA.data) {
    assert.equal(slot.faculty_id, 1);
  }

  const resB = await fetch(`${baseUrl}/faculty/timetable`, {
    headers: { Authorization: `Bearer ${facultyToken2}` },
  });
  const bodyB = await resB.json();
  assert.equal(resB.status, 200);
  assert.equal(bodyB.success, true);
  for (const slot of bodyB.data) {
    assert.equal(slot.faculty_id, 2);
  }
});

test("FEAT-011 Faculty Ownership: Faculty A cannot access Faculty B's attendance session (returns 403)", async () => {
  // Session 1 belongs to Faculty 1. Faculty 2 accessing it must receive 403.
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions/1`, {
    headers: { Authorization: `Bearer ${facultyToken2}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission to access another faculty/i);
});

test("FEAT-011 Faculty Ownership: Faculty A cannot start Faculty B's session (returns 403)", async () => {
  // Session 1 belongs to Faculty 1. Faculty 2 starting it must receive 403.
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions/1/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken2}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission to start another faculty/i);
});

test("FEAT-011 Faculty Ownership: Faculty A cannot view roster for Faculty B's session (returns 403)", async () => {
  // Session 1 belongs to Faculty 1. Faculty 2 querying roster must receive 403.
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions/1/roster`, {
    headers: { Authorization: `Bearer ${facultyToken2}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission to view roster for another faculty/i);
});

test("FEAT-011 Faculty Ownership: Faculty A cannot mark attendance in Faculty B's session (returns 403)", async () => {
  // Session 1 belongs to Faculty 1. Faculty 2 marking must receive 403.
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions/1/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken2}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ student_id: 1, status: "PRESENT" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission to mark attendance for another faculty/i);
});

test("FEAT-011 Faculty Ownership: Faculty A cannot override Faculty B's attendance record (returns 403)", async () => {
  // Query existing attendance record for Faculty 1
  const [f1Records] = await pool.query(
    `SELECT ar.attendance_id, ar.status FROM attendance_records ar
     JOIN class_sessions cs ON ar.session_id = cs.session_id
     WHERE cs.faculty_id = 1 LIMIT 1`,
  );
  let testRecordId;
  let shouldCleanup = null;
  let originalStatus = "PRESENT";

  if (f1Records.length > 0) {
    testRecordId = f1Records[0].attendance_id;
    originalStatus = f1Records[0].status;
  } else {
    // Create dedicated test session and record
    const [sess] = await pool.query(
      `INSERT INTO class_sessions (slot_id, session_date, faculty_id, classroom_id, scheduled_start, scheduled_end, present_until, late_until, status)
       VALUES (1, CURDATE(), 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'OPEN')`,
    );
    const [rec] = await pool.query(
      "INSERT INTO attendance_records (session_id, enrollment_id, status, source, marked_at) VALUES (?, 1, 'PRESENT', 'MANUAL', NOW())",
      [sess.insertId],
    );
    testRecordId = rec.insertId;
    shouldCleanup = sess.insertId;
  }

  const newStatus = originalStatus === "PRESENT" ? "LATE" : "PRESENT";

  // Faculty 2 attempting override on Faculty 1's attendance record
  const res = await fetch(`${baseUrl}/faculty/attendance/records/${testRecordId}/override`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken2}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      new_status: newStatus,
      reason_code: "FACULTY_OVERRIDE",
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /cannot override attendance for another faculty/i);

  if (shouldCleanup) {
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [shouldCleanup]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [shouldCleanup]);
  }
});

test("FEAT-011 Faculty Ownership: Client-supplied faculty_id in body/query cannot bypass server ownership", async () => {
  // Token is for Faculty 1. Request supplies faculty_id: 2 in body/query. Server must ignore client faculty_id.
  const res = await fetch(`${baseUrl}/faculty/me?faculty_id=2`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.faculty_id, 1);
  assert.equal(body.data.employee_code, "FAC001");
});

// 18-20: Faculty Profile, Dashboard, Timetable, Courses, Sections
test("FEAT-011 Faculty Profile & Dashboard: Profile and dashboard return authentic details and metrics", async () => {
  // 1. Profile
  const profRes = await fetch(`${baseUrl}/faculty/me`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const profBody = await profRes.json();
  assert.equal(profRes.status, 200);
  assert.equal(profBody.success, true);
  assert.equal(profBody.data.faculty_id, 1);
  assert.ok(profBody.data.department_name);
  assert.ok(profBody.data.school_name);
  assert.ok(profBody.data.designation);

  // 2. Dashboard
  const dashRes = await fetch(`${baseUrl}/faculty/dashboard`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const dashBody = await dashRes.json();
  assert.equal(dashRes.status, 200);
  assert.equal(dashBody.success, true);
  assert.equal(dashBody.data.faculty.faculty_id, 1);
  assert.ok(Array.isArray(dashBody.data.today_timetable));
  assert.ok(Array.isArray(dashBody.data.active_sessions));
  assert.ok(Array.isArray(dashBody.data.upcoming_sessions));
  assert.ok(Array.isArray(dashBody.data.recent_sessions));
  assert.ok(dashBody.data.metrics);
});

test("FEAT-011 Faculty Timetable: Retrieves assigned slots with filter support (day_of_week)", async () => {
  // Unfiltered
  const allRes = await fetch(`${baseUrl}/faculty/timetable`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const allBody = await allRes.json();
  assert.equal(allRes.status, 200);
  assert.ok(allBody.data.length >= 1);

  // Filter by day_of_week=1
  const filterRes = await fetch(`${baseUrl}/faculty/timetable?day_of_week=1`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const filterBody = await filterRes.json();
  assert.equal(filterRes.status, 200);
  for (const slot of filterBody.data) {
    assert.equal(slot.day_of_week, 1);
    assert.equal(slot.faculty_id, 1);
  }
});

test("FEAT-011 Faculty Offerings & Sections: Retrieves assigned courses and sections", async () => {
  // Courses
  const coursesRes = await fetch(`${baseUrl}/faculty/courses`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const coursesBody = await coursesRes.json();
  assert.equal(coursesRes.status, 200);
  assert.ok(coursesBody.data.length >= 1);
  assert.ok(coursesBody.data[0].subject_code);

  // Sections
  const sectionsRes = await fetch(`${baseUrl}/faculty/sections`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const sectionsBody = await sectionsRes.json();
  assert.equal(sectionsRes.status, 200);
  assert.ok(sectionsBody.data.length >= 1);
  assert.ok(sectionsBody.data[0].section_code);
});

// 21-25: Attendance Sessions, Marking, Override, Finalization Workflow Lifecycle
test("FEAT-011 Full Attendance Workflow Lifecycle: Start, Roster, Mark, Duplicate Rejection, Override Audit, Finalize", async () => {
  // 1. Setup a test SCHEDULED class session for Faculty 1 on slot 1
  const [sessionInsert] = await pool.query(
    `INSERT INTO class_sessions (slot_id, session_date, faculty_id, classroom_id, scheduled_start, scheduled_end, present_until, late_until, status)
     VALUES (1, CURDATE(), 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'SCHEDULED')`,
  );
  const testSessionId = sessionInsert.insertId;

  try {
    // 2. Start the session (SCHEDULED -> OPEN)
    const startRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    const startBody = await startRes.json();
    assert.equal(startRes.status, 200);
    assert.equal(startBody.success, true);
    assert.equal(startBody.data.status, "OPEN");
    assert.ok(startBody.data.opened_at);

    // 3. Repeated start rejected (400)
    const repeatStartRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    const repeatStartBody = await repeatStartRes.json();
    assert.equal(repeatStartRes.status, 400);
    assert.equal(repeatStartBody.success, false);
    assert.match(repeatStartBody.message, /already OPEN/i);

    // 4. Inspect session roster
    const rosterRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/roster`, {
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    const rosterBody = await rosterRes.json();
    assert.equal(rosterRes.status, 200);
    assert.equal(rosterBody.success, true);
    assert.ok(rosterBody.data.total_enrolled >= 1);
    const targetStudent = rosterBody.data.roster.find((r) => r.student_id === 1);
    assert.ok(targetStudent, "Student 1 must be present in roster");

    // 5. Mark attendance for Student 1 (status: PRESENT)
    const markRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ student_id: 1, status: "PRESENT" }),
    });
    const markBody = await markRes.json();
    assert.equal(markRes.status, 201);
    assert.equal(markBody.success, true);
    assert.equal(markBody.data.status, "PRESENT");
    assert.equal(markBody.data.source, "MANUAL");
    const createdAttendanceId = markBody.data.attendance_id;

    // 6. Duplicate marking rejected (409 Conflict)
    const dupMarkRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ student_id: 1, status: "PRESENT" }),
    });
    const dupMarkBody = await dupMarkRes.json();
    assert.equal(dupMarkRes.status, 409);
    assert.equal(dupMarkBody.success, false);
    assert.match(dupMarkBody.message, /already exists/i);

    // 7. Attendance Override with audit trail in attendance_corrections
    const overrideRes = await fetch(`${baseUrl}/faculty/attendance/records/${createdAttendanceId}/override`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        new_status: "LATE",
        reason_code: "FACULTY_OVERRIDE",
        reason_note: "Student arrived 8 minutes after scheduled start",
      }),
    });
    const overrideBody = await overrideRes.json();
    assert.equal(overrideRes.status, 200);
    assert.equal(overrideBody.success, true);
    assert.equal(overrideBody.data.previous_status, "PRESENT");
    assert.equal(overrideBody.data.new_status, "LATE");
    assert.equal(overrideBody.data.reason_code, "FACULTY_OVERRIDE");

    // Verify audit entry in attendance_corrections table
    const [auditRows] = await pool.query(
      "SELECT * FROM attendance_corrections WHERE attendance_id = ? ORDER BY correction_id DESC LIMIT 1",
      [createdAttendanceId],
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].previous_status, "PRESENT");
    assert.equal(auditRows[0].new_status, "LATE");
    assert.equal(auditRows[0].reason_code, "FACULTY_OVERRIDE");
    assert.equal(auditRows[0].approval_status, "APPROVED");

    // 8. Finalize session (OPEN -> CLOSED)
    const finalizeRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    const finalizeBody = await finalizeRes.json();
    assert.equal(finalizeRes.status, 200);
    assert.equal(finalizeBody.success, true);
    assert.equal(finalizeBody.data.status, "CLOSED");
    assert.ok(finalizeBody.data.closed_at);

    // 9. Repeated finalization rejected (400)
    const repeatFinalizeRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    const repeatFinalizeBody = await repeatFinalizeRes.json();
    assert.equal(repeatFinalizeRes.status, 400);
    assert.equal(repeatFinalizeBody.success, false);
    assert.match(repeatFinalizeBody.message, /already CLOSED/i);

    // 10. Marking attendance on CLOSED session rejected (400)
    const closedMarkRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ student_id: 2, status: "PRESENT" }),
    });
    const closedMarkBody = await closedMarkRes.json();
    assert.equal(closedMarkRes.status, 400);
    assert.equal(closedMarkBody.success, false);
    assert.match(closedMarkBody.message, /must be OPEN/i);

    // Clean up created records
    await pool.query("DELETE FROM attendance_corrections WHERE attendance_id = ?", [createdAttendanceId]);
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [testSessionId]);
  } finally {
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [testSessionId]);
  }
});

// 26: Faculty Attendance Summary
test("FEAT-011 Faculty Attendance Summary: Returns aggregated metrics restricted to faculty sessions", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/summary`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.faculty_id, 1);
  assert.equal(body.data.employee_code, "FAC001");
  assert.ok(typeof body.data.summary.total_sessions === "number");
  assert.ok(typeof body.data.summary.completed_sessions === "number");
  assert.ok(typeof body.data.summary.overall_attendance_percentage === "number");
});

test("FEAT-011 Faculty Sessions: Non-existent session ID returns 404", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions/999999`, {
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.success, false);
});

test("FEAT-011 Faculty Sessions: Start on non-existent session returns 404", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/sessions/999999/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken1}` },
  });
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.success, false);
});

test("FEAT-011 Attendance Validation: Missing or invalid status in attendance marking returns 400", async () => {
  // 1. Missing fields
  const missingRes = await fetch(`${baseUrl}/faculty/attendance/sessions/1/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(missingRes.status, 400);

  // 2. Invalid status
  const invalidRes = await fetch(`${baseUrl}/faculty/attendance/sessions/1/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ student_id: 1, status: "INVALID_STATUS" }),
  });
  assert.equal(invalidRes.status, 400);
});

test("FEAT-011 Attendance Override Validation: Invalid reason_code returns 400", async () => {
  const res = await fetch(`${baseUrl}/faculty/attendance/records/1/override`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ new_status: "LATE", reason_code: "INVALID_REASON" }),
  });
  assert.equal(res.status, 400);
});

test("FEAT-011 Faculty Profile: Unlinked faculty identity returns 404", async () => {
  const unlinkedToken = jwt.sign(
    { user_id: 9999, username: "phantom_fac", role: "FACULTY", faculty_id: 99999 },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  const res = await fetch(`${baseUrl}/faculty/me`, {
    headers: { Authorization: `Bearer ${unlinkedToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.success, false);
});




