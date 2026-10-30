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

test("Dedicated Admin Auth: POST /api/v1/auth/admin/login requires credentials", async () => {
  const res = await fetch(`${baseUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Username and password are required");
});

test("Dedicated Admin Auth: POST /api/v1/auth/admin/login rejects invalid credentials", async () => {
  const res = await fetch(`${baseUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "unknown_admin", password: "WrongPassword" }),
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("Dedicated Admin Auth: POST /api/v1/auth/admin/login rejects non-admin accounts (Student/Faculty)", async () => {
  // Attempt with student credentials
  const studentRes = await fetch(`${baseUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "J26AIM001", password: "Student@123" }),
  });
  const studentBody = await studentRes.json();
  assert.equal(studentRes.status, 403);
  assert.equal(studentBody.success, false);
  assert.match(studentBody.message, /only administrators/i);

  // Attempt with faculty credentials
  const facultyRes = await fetch(`${baseUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "FAC001", password: "Faculty@123" }),
  });
  const facultyBody = await facultyRes.json();
  assert.equal(facultyRes.status, 403);
  assert.equal(facultyBody.success, false);
  assert.match(facultyBody.message, /only administrators/i);
});

test("Dedicated Admin Auth: POST /api/v1/auth/admin/login succeeds for ADMIN user", async () => {
  const res = await fetch(`${baseUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.role, "ADMIN");
  assert.ok(body.token);

  // Also verify alias /auth/admin-login
  const aliasRes = await fetch(`${baseUrl}/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  const aliasBody = await aliasRes.json();
  assert.equal(aliasRes.status, 200);
  assert.equal(aliasBody.success, true);
  assert.equal(aliasBody.data.role, "ADMIN");
  assert.ok(aliasBody.token);
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
// FEAT-012: Automated Test Suite & Quality Verification Layer
// =========================================================================

const facultyToken = jwt.sign(
  { user_id: 4, username: "FAC001", role: "FACULTY", faculty_id: 1 },
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

// -------------------------------------------------------------------------
// Category 1: Extended Authentication & JWT Security Tests
// -------------------------------------------------------------------------

test("Auth Security: POST /api/v1/auth/login rejects invalid password (returns 401)", async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "WrongPassword@999" }),
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /(invalid credentials|invalid username or password)/i);
});

test("Auth Security: POST /api/v1/auth/login rejects non-existent username (returns 401)", async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "non_existent_user_999", password: "Password@123" }),
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /(invalid credentials|invalid username or password)/i);
});

test("JWT Security: GET /api/v1/auth/me rejects tampered signature (returns 401)", async () => {
  const tamperedToken = jwt.sign(
    { user_id: 1, username: "admin", role: "ADMIN" },
    "wrong_secret_key_tampered_signature",
    { expiresIn: "1h" },
  );
  const res = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("JWT Security: GET /api/v1/auth/me rejects deactivated user account (returns 401)", async () => {
  // Create a temporary inactive user
  const tempUser = `deact_${Date.now()}`;
  const [insertRes] = await pool.query(
    "INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, 'dummy_hash', 'STUDENT', 0)",
    [tempUser, `${tempUser}@test.joy.edu`],
  );
  const inactiveUserId = insertRes.insertId;

  try {
    const deactToken = jwt.sign(
      { user_id: inactiveUserId, username: tempUser, role: "STUDENT" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${deactToken}` },
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.match(body.message, /inactive/i);
  } finally {
    await pool.query("DELETE FROM users WHERE user_id = ?", [inactiveUserId]);
  }
});

// -------------------------------------------------------------------------
// Category 2: Comprehensive RBAC Security Matrix
// -------------------------------------------------------------------------

test("RBAC Security: STUDENT role cannot access departments, blocks, or classrooms (returns 403)", async () => {
  const endpoints = ["/departments", "/blocks", "/classrooms"];
  for (const ep of endpoints) {
    const res = await fetch(`${baseUrl}${ep}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Unauthorized Resource" }),
    });
    const body = await res.json();
    assert.equal(res.status, 403, `Endpoint ${ep} must reject STUDENT mutations`);
    assert.equal(body.success, false);
  }
});

test("RBAC Security: VIEWER role cannot perform administrative mutations (returns 403)", async () => {
  const mutationTests = [
    { method: "POST", ep: "/students", body: { register_no: "V01", full_name: "Viewer", batch_id: 1 } },
    { method: "POST", ep: "/departments", body: { name: "V Dept", school_id: 1 } },
    { method: "POST", ep: "/blocks", body: { code: "VB", name: "V Block" } },
    { method: "POST", ep: "/classrooms", body: { block_id: 1, room_no: "VR01", room_type: "CLASSROOM" } },
    { method: "POST", ep: "/staff/t", body: { employee_code: "VF01", full_name: "Viewer Fac", school_id: 1 } },
  ];

  for (const m of mutationTests) {
    const res = await fetch(`${baseUrl}${m.ep}`, {
      method: m.method,
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(m.body),
    });
    const body = await res.json();
    assert.equal(res.status, 403, `Mutation on ${m.ep} must reject VIEWER role`);
    assert.equal(body.success, false);
  }
});

test("RBAC Security: OPERATOR role cannot perform administrative CRUD mutations (returns 403)", async () => {
  const res = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${operatorToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ register_no: "OP01", full_name: "Op Student", batch_id: 1 }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("RBAC Security: Non-ADMIN role cannot access /admin/dashboard-stats (returns 403)", async () => {
  const nonAdminTokens = [studentToken, facultyToken, viewerToken, operatorToken];
  for (const tok of nonAdminTokens) {
    const res = await fetch(`${baseUrl}/admin/dashboard-stats`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.success, false);
  }
});

test("RBAC Security: Non-STUDENT role cannot access /student/me (returns 403)", async () => {
  const nonStudentTokens = [adminToken, facultyToken, viewerToken];
  for (const tok of nonStudentTokens) {
    const res = await fetch(`${baseUrl}/student/me`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.success, false);
  }
});

// -------------------------------------------------------------------------
// Category 3: FEAT-006 Faculty & Staff Management Regression Tests
// -------------------------------------------------------------------------

test("FEAT-006 Faculty Management: Full CRUD Lifecycle, Duplicate Detection, and Soft Delete", async () => {
  // 1. List faculty
  const listRes = await fetch(`${baseUrl}/staff/t`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.equal(listBody.success, true);
  assert.ok(Array.isArray(listBody.data));

  // 2. Validation: Missing required fields
  const missingRes = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ full_name: "Incomplete Faculty" }),
  });
  assert.equal(missingRes.status, 400);

  // 3. Validation: Invalid school_id
  const invSchoolRes = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ employee_code: `INV_S_${Date.now()}`, full_name: "Inv School", school_id: 999999 }),
  });
  assert.equal(invSchoolRes.status, 400);

  // 4. Create new faculty member
  const uniqueEmpCode = `FAC_QA_${Date.now()}`;
  const uniqueEmail = `qa_${Date.now()}@joyuniversity.edu.in`;
  const createRes = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      employee_code: uniqueEmpCode,
      full_name: "Dr. QA Automated Faculty",
      email: uniqueEmail,
      school_id: 3,
      department_id: 5,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const createdFacultyId = createBody.data?.faculty_id;
  assert.ok(createdFacultyId);

  try {
    // 5. Duplicate employee_code detection (409)
    const dupCodeRes = await fetch(`${baseUrl}/staff/t`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        employee_code: uniqueEmpCode,
        full_name: "Duplicate Employee Code",
        school_id: 3,
      }),
    });
    assert.equal(dupCodeRes.status, 409);

    // 6. Duplicate email detection (409)
    const dupEmailRes = await fetch(`${baseUrl}/staff/t`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        employee_code: `DIFF_CODE_${Date.now()}`,
        full_name: "Duplicate Email Faculty",
        email: uniqueEmail,
        school_id: 3,
      }),
    });
    assert.equal(dupEmailRes.status, 409);

    // 7. Retrieve faculty member by ID
    const getRes = await fetch(`${baseUrl}/staff/t/${createdFacultyId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(getBody.data.employee_code, uniqueEmpCode);

    // 8. Update faculty profile
    const updateRes = await fetch(`${baseUrl}/staff/t/${createdFacultyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ full_name: "Dr. QA Automated Faculty Updated" }),
    });
    assert.equal(updateRes.status, 200);

    // 9. Soft deactivation
    const deleteRes = await fetch(`${baseUrl}/staff/t/${createdFacultyId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteRes.status, 200);

    // Verify soft deactivation reflects is_active = 0
    const verifyGet = await fetch(`${baseUrl}/staff/t/${createdFacultyId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const verifyBody = await verifyGet.json();
    assert.equal(verifyBody.data.is_active, 0);
  } finally {
    // Clean up created record and linked user
    await pool.query("DELETE FROM users WHERE faculty_id = ?", [createdFacultyId]);
    await pool.query("DELETE FROM faculty WHERE faculty_id = ?", [createdFacultyId]);
  }
});

// -------------------------------------------------------------------------
// Category 4: FEAT-007 Department Management Regression Tests
// -------------------------------------------------------------------------

test("FEAT-007 Department Management: Full CRUD Lifecycle, School Validation, and Duplicate Handling", async () => {
  // 1. List departments
  const listRes = await fetch(`${baseUrl}/departments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listBody.data));

  // 2. Validation: Missing required fields
  const missingRes = await fetch(`${baseUrl}/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ code: "NO_NAME" }),
  });
  assert.equal(missingRes.status, 400);

  // 3. Validation: Invalid school_id
  const invSchoolRes = await fetch(`${baseUrl}/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "Invalid School Dept", school_id: 999999 }),
  });
  assert.equal(invSchoolRes.status, 400);

  // 4. Create department
  const uniqueDeptCode = "D" + (Date.now() % 10000000);
  const createRes = await fetch(`${baseUrl}/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      school_id: 3,
      name: "QA Automated Department",
      code: uniqueDeptCode,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  const createdDeptId = createBody.data?.department_id;
  assert.ok(createdDeptId);

  try {
    // 5. Duplicate code conflict (409)
    const dupRes = await fetch(`${baseUrl}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        school_id: 3,
        name: "Second Department",
        code: uniqueDeptCode,
      }),
    });
    assert.equal(dupRes.status, 409);

    // 6. Retrieve department by ID
    const getRes = await fetch(`${baseUrl}/departments/${createdDeptId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(getBody.data.code, uniqueDeptCode);

    // 7. Update department
    const updateRes = await fetch(`${baseUrl}/departments/${createdDeptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "QA Department Renamed" }),
    });
    assert.equal(updateRes.status, 200);

    // 8. Soft deactivation
    const deleteRes = await fetch(`${baseUrl}/departments/${createdDeptId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteRes.status, 200);

    // Verify is_active = 0
    const verifyGet = await fetch(`${baseUrl}/departments/${createdDeptId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const verifyBody = await verifyGet.json();
    assert.equal(verifyBody.data.is_active, 0);
  } finally {
    await pool.query("DELETE FROM departments WHERE department_id = ?", [createdDeptId]);
  }
});

// -------------------------------------------------------------------------
// Category 5: FEAT-008 Campus Block & Classroom Management Regression Tests
// -------------------------------------------------------------------------

test("FEAT-008 Block & Classroom Management: Block Lifecycle, Room Constraint, and Foreign Key Integrity", async () => {
  // 1. Create block
  const uniqueBlockCode = "B" + (Date.now() % 10000000);
  const blockRes = await fetch(`${baseUrl}/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ code: uniqueBlockCode, name: "QA Test Science Block" }),
  });
  const blockBody = await blockRes.json();
  assert.equal(blockRes.status, 201);
  const createdBlockId = blockBody.data?.block_id;
  assert.ok(createdBlockId);

  let createdClassroomId = null;

  try {
    // 2. Duplicate block code rejected (409)
    const dupBlockRes = await fetch(`${baseUrl}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ code: uniqueBlockCode, name: "Duplicate Block" }),
    });
    assert.equal(dupBlockRes.status, 409);

    // 3. Validation: Classroom with invalid block_id rejected (400)
    const invBlockCr = await fetch(`${baseUrl}/classrooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ block_id: 999999, room_no: "INV_R", room_type: "CLASSROOM" }),
    });
    assert.equal(invBlockCr.status, 400);

    // 4. Create classroom in valid block
    const uniqueRoomNo = "R" + (Date.now() % 10000000);
    const crRes = await fetch(`${baseUrl}/classrooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        block_id: createdBlockId,
        room_no: uniqueRoomNo,
        room_type: "CLASSROOM",
        capacity: 45,
      }),
    });
    const crBody = await crRes.json();
    assert.equal(crRes.status, 201);
    createdClassroomId = crBody.data?.classroom_id;
    assert.ok(createdClassroomId);

    // 5. Duplicate room in same block rejected (409)
    const dupCrRes = await fetch(`${baseUrl}/classrooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        block_id: createdBlockId,
        room_no: uniqueRoomNo,
        room_type: "LAB",
      }),
    });
    assert.equal(dupCrRes.status, 409);

    // 6. Get classroom by ID
    const getCrRes = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getCrBody = await getCrRes.json();
    assert.equal(getCrRes.status, 200);
    assert.equal(getCrBody.data.room_no, uniqueRoomNo);

    // 7. Update and deactivate classroom
    const updateCr = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ capacity: 50 }),
    });
    assert.equal(updateCr.status, 200);

    const deleteCr = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteCr.status, 200);
  } finally {
    if (createdClassroomId) {
      await pool.query("DELETE FROM classrooms WHERE classroom_id = ?", [createdClassroomId]);
    }
    await pool.query("DELETE FROM blocks WHERE block_id = ?", [createdBlockId]);
  }
});

// -------------------------------------------------------------------------
// Category 6: FEAT-009 Attendance Session & Record Management Regression Tests
// -------------------------------------------------------------------------

test("FEAT-009 Attendance Management: State Machine, Session Lifecycle, Manual Marking, and Overrides", async () => {
  // Setup isolated future date for session
  const testDate = "2029-01-15";
  const sessionRes = await fetch(`${baseUrl}/attendance/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      slot_id: 1,
      session_date: testDate,
      faculty_id: 1,
      classroom_id: 1,
      scheduled_start: `${testDate} 09:00:00`,
      scheduled_end: `${testDate} 10:00:00`,
    }),
  });
  const sessionBody = await sessionRes.json();
  assert.equal(sessionRes.status, 201);
  const sessionId = sessionBody.data?.session_id;
  assert.ok(sessionId);
  assert.equal(sessionBody.data.status, "SCHEDULED");

  let attendanceId = null;

  try {
    // 1. Duplicate session on same slot and date rejected (409)
    const dupSession = await fetch(`${baseUrl}/attendance/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        slot_id: 1,
        session_date: testDate,
        faculty_id: 1,
        classroom_id: 1,
        scheduled_start: `${testDate} 09:00:00`,
        scheduled_end: `${testDate} 10:00:00`,
      }),
    });
    assert.equal(dupSession.status, 409);

    // 2. Marking attendance on SCHEDULED session rejected (400)
    const earlyMark = await fetch(`${baseUrl}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ session_id: sessionId, enrollment_id: 1, status: "PRESENT" }),
    });
    assert.equal(earlyMark.status, 400);

    // 3. Start session: SCHEDULED -> OPEN
    const startRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(startRes.status, 200);

    // 4. Repeated start rejected (400)
    const repeatStart = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repeatStart.status, 400);

    // 5. Mark manual attendance in OPEN session
    const markRes = await fetch(`${baseUrl}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ session_id: sessionId, enrollment_id: 1, status: "PRESENT" }),
    });
    const markBody = await markRes.json();
    assert.equal(markRes.status, 201);
    attendanceId = markBody.data?.attendance_id;
    assert.ok(attendanceId);

    // 6. Duplicate attendance marking rejected (409)
    const dupMark = await fetch(`${baseUrl}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ session_id: sessionId, enrollment_id: 1, status: "PRESENT" }),
    });
    assert.equal(dupMark.status, 409);

    // 7. Override attendance record with audit trail
    const overrideRes = await fetch(`${baseUrl}/attendance/${attendanceId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        new_status: "LATE",
        reason_code: "FACULTY_OVERRIDE",
        reason_note: "Student reported transit delay",
      }),
    });
    assert.equal(overrideRes.status, 200);

    // 8. Finalize session: OPEN -> CLOSED
    const finRes = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(finRes.status, 200);

    // 9. Repeated finalization rejected (400)
    const repeatFin = await fetch(`${baseUrl}/attendance/sessions/${sessionId}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repeatFin.status, 400);

    // 10. Marking attendance on CLOSED session rejected (400)
    const closedMark = await fetch(`${baseUrl}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ session_id: sessionId, enrollment_id: 2, status: "PRESENT" }),
    });
    assert.equal(closedMark.status, 400);
  } finally {
    if (attendanceId) {
      await pool.query("DELETE FROM attendance_corrections WHERE attendance_id = ?", [attendanceId]);
      await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [sessionId]);
    }
    await pool.query("DELETE FROM session_reconciliation WHERE session_id = ?", [sessionId]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [sessionId]);
  }
});

// -------------------------------------------------------------------------
// Category 7: Student Portal Workflows Regression Tests
// -------------------------------------------------------------------------

test("Student Portal Workflows: Verified profile, dashboard, timetable, courses, and attendance logs", async () => {
  const routes = [
    "/student/me",
    "/student/me/attendance",
    "/student/me/attendance/summary",
    "/student/me/dashboard",
    "/student/me/timetable",
    "/student/me/courses",
  ];

  for (const route of routes) {
    const res = await fetch(`${baseUrl}${route}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200, `Student portal endpoint ${route} must return 200 for STUDENT`);
    assert.equal(body.success, true);
    assert.ok(body.data !== undefined);
  }
});

// -------------------------------------------------------------------------
// Category 8: Security Regression & SQL Injection Resilience
// -------------------------------------------------------------------------

test("Security Regression: Search and query parameters safely parameterize SQL injection strings", async () => {
  const injectionPayloads = ["' OR '1'='1", "'; DROP TABLE students; --", "' UNION SELECT * FROM users --"];

  for (const sqli of injectionPayloads) {
    // Search students
    const res1 = await fetch(`${baseUrl}/students?search=${encodeURIComponent(sqli)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.success, true);

    // Search departments
    const res2 = await fetch(`${baseUrl}/departments?name=${encodeURIComponent(sqli)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.success, true);
  }
});

// -------------------------------------------------------------------------
// Category 9: Concurrency & Database Relational Integrity Tests
// -------------------------------------------------------------------------

test("Concurrency & Isolation: Concurrent duplicate attendance marking guarantees race condition protection", async () => {
  const futureDate = "2029-02-20";
  const [sess] = await pool.query(
    `INSERT INTO class_sessions (slot_id, session_date, faculty_id, classroom_id, scheduled_start, scheduled_end, present_until, late_until, status)
     VALUES (1, ?, 1, 1, '${futureDate} 10:00:00', '${futureDate} 11:00:00', '${futureDate} 10:10:00', '${futureDate} 10:20:00', 'OPEN')`,
    [futureDate],
  );
  const testSessionId = sess.insertId;

  try {
    // Execute concurrent duplicate attendance submissions
    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ session_id: testSessionId, enrollment_id: 1, status: "PRESENT" }),
      }),
      fetch(`${baseUrl}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ session_id: testSessionId, enrollment_id: 1, status: "PRESENT" }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // One must succeed (201) and one must be rejected (409)
    assert.deepEqual(statuses, [201, 409]);

    // Verify exactly one record exists in database
    const [records] = await pool.query("SELECT COUNT(*) AS count FROM attendance_records WHERE session_id = ?", [
      testSessionId,
    ]);
    assert.equal(Number(records[0].count), 1);
  } finally {
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [testSessionId]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [testSessionId]);
  }
});

test("Database Relational Integrity: Creating attendance for non-existent session returns 404", async () => {
  const res = await fetch(`${baseUrl}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ session_id: 999999, enrollment_id: 1, status: "PRESENT" }),
  });
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.success, false);
});




// ============================================================================
// FEAT-010: Academic Offerings, Subjects & Timetable Overview Integration Tests
// ============================================================================

// --- Subjects Tests ---
test("Subjects: GET /api/v1/subjects without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/subjects`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("Subjects: GET /api/v1/subjects/:id for non-existent subject returns 404", async () => {
  const res = await fetch(`${baseUrl}/subjects/999999`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.success, false);
});

test("Subjects RBAC: POST /api/v1/subjects with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ subject_code: "SUB001", name: "Test Subject" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("Subjects Validation: POST /api/v1/subjects requires subject_code and name (400)", async () => {
  const res = await fetch(`${baseUrl}/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ subject_code: "" }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test("Subjects Validation: POST /api/v1/subjects rejects invalid department_id (400)", async () => {
  const res = await fetch(`${baseUrl}/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      subject_code: "INVAL001",
      name: "Invalid Dept Subject",
      owner_department_id: 999999,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /department/i);
});

test("Subjects Validation: POST /api/v1/subjects rejects duplicate subject_code (409)", async () => {
  const res = await fetch(`${baseUrl}/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      subject_code: "AIML101",
      name: "Duplicate Code Attempt",
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.success, false);
  assert.match(body.message, /already exists/i);
});

test("Subjects Full Lifecycle: Create, List/Filter, GetById, Update, Duplicate on Update, Soft Deactivate", async () => {
  const uniqueCode = `TS_${Date.now().toString().slice(-6)}`;
  let createdId;

  try {
    // 1. Create subject
    const createRes = await fetch(`${baseUrl}/subjects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        subject_code: uniqueCode,
        name: "Lifecycle Test Subject",
        credits: 4,
        delivery_type: "THEORY",
        owner_department_id: 5,
      }),
    });
    const createBody = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.equal(createBody.success, true);
    createdId = createBody.data.subject_id;
    assert.ok(createdId);
    assert.equal(createBody.data.subject_code, uniqueCode);
    assert.equal(createBody.data.is_active, 1);
    assert.ok(createBody.data.department_name);

    // 2. List subjects with search filter
    const listRes = await fetch(`${baseUrl}/subjects?search=${uniqueCode}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listBody = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.ok(listBody.data.some((s) => s.subject_id === createdId));

    // 3. Get subject by ID
    const getRes = await fetch(`${baseUrl}/subjects/${createdId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(getBody.data.subject_id, createdId);
    assert.equal(getBody.data.name, "Lifecycle Test Subject");

    // 4. Update subject
    const updateRes = await fetch(`${baseUrl}/subjects/${createdId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Updated Test Subject Name",
        credits: 3.5,
      }),
    });
    const updateBody = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateBody.data.name, "Updated Test Subject Name");
    assert.equal(updateBody.data.credits, "3.5");

    // 5. Update subject with existing code returns 409
    const dupRes = await fetch(`${baseUrl}/subjects/${createdId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ subject_code: "AIML101" }),
    });
    assert.equal(dupRes.status, 409);

    // 6. Soft deactivate
    const deleteRes = await fetch(`${baseUrl}/subjects/${createdId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteBody = await deleteRes.json();
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteBody.data.is_active, 0);

    // 7. Repeat soft deactivate returns 400
    const repeatDeleteRes = await fetch(`${baseUrl}/subjects/${createdId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repeatDeleteRes.status, 400);
  } finally {
    if (createdId) {
      await pool.query("DELETE FROM subjects WHERE subject_id = ?", [createdId]);
    }
  }
});

// --- Course Offerings Tests ---
test("Course Offerings: GET /api/v1/course-offerings without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/course-offerings`);
  assert.equal(res.status, 401);
});

test("Course Offerings RBAC: POST /api/v1/course-offerings with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/course-offerings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ term_id: 7, subject_id: 1 }),
  });
  assert.equal(res.status, 403);
});

test("Course Offerings Validation: POST requires term_id and subject_id (400)", async () => {
  const res = await fetch(`${baseUrl}/course-offerings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ term_id: 7 }),
  });
  assert.equal(res.status, 400);
});

test("Course Offerings Validation: POST rejects invalid term_id or subject_id (400)", async () => {
  const res = await fetch(`${baseUrl}/course-offerings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ term_id: 999999, subject_id: 1 }),
  });
  assert.equal(res.status, 400);
});

test("Course Offerings Not Found: GET /api/v1/course-offerings/:id returns 404", async () => {
  const res = await fetch(`${baseUrl}/course-offerings/999999`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 404);
});

test("Course Offerings Full Lifecycle: Create, Duplicate Conflict 409, List, GetById, Update, Delete", async () => {
  let createdOfferingId;

  try {
    // 1. Create offering for subject 5 (AIML105) in term 7
    const createRes = await fetch(`${baseUrl}/course-offerings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        term_id: 7,
        subject_id: 5,
        coordinator_faculty_id: 1,
      }),
    });
    const createBody = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.equal(createBody.success, true);
    createdOfferingId = createBody.data.offering_id;
    assert.ok(createdOfferingId);
    assert.equal(createBody.data.subject_id, 5);
    assert.ok(createBody.data.subject_code);
    assert.ok(createBody.data.coordinator_faculty_name);

    // 2. Duplicate offering for same term and subject returns 409
    const dupRes = await fetch(`${baseUrl}/course-offerings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        term_id: 7,
        subject_id: 5,
      }),
    });
    assert.equal(dupRes.status, 409);

    // 3. List offerings with filter
    const listRes = await fetch(`${baseUrl}/course-offerings?subject_id=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listBody = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.ok(listBody.data.some((o) => o.offering_id === createdOfferingId));

    // 4. Get by ID
    const getRes = await fetch(`${baseUrl}/course-offerings/${createdOfferingId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(getBody.data.offering_id, createdOfferingId);

    // 5. Update coordinator faculty
    const updateRes = await fetch(`${baseUrl}/course-offerings/${createdOfferingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ coordinator_faculty_id: 2 }),
    });
    const updateBody = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateBody.data.coordinator_faculty_id, 2);

    // 6. Delete offering
    const deleteRes = await fetch(`${baseUrl}/course-offerings/${createdOfferingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteRes.status, 200);
    createdOfferingId = null;
  } finally {
    if (createdOfferingId) {
      await pool.query("DELETE FROM course_offerings WHERE offering_id = ?", [createdOfferingId]);
    }
  }
});

// --- Section Tests ---
test("Sections: GET /api/v1/sections without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/sections`);
  assert.equal(res.status, 401);
});

test("Sections RBAC: POST /api/v1/sections with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/sections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ offering_id: 1, section_code: "B" }),
  });
  assert.equal(res.status, 403);
});

test("Sections Validation: POST /api/v1/sections requires offering_id and section_code (400)", async () => {
  const res = await fetch(`${baseUrl}/sections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ offering_id: 1 }),
  });
  assert.equal(res.status, 400);
});

test("Sections Validation: POST /api/v1/sections rejects invalid offering_id (400)", async () => {
  const res = await fetch(`${baseUrl}/sections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ offering_id: 999999, section_code: "B" }),
  });
  assert.equal(res.status, 400);
});

test("Sections Not Found: GET /api/v1/sections/:id returns 404", async () => {
  const res = await fetch(`${baseUrl}/sections/999999`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 404);
});

test("Sections Full Lifecycle: Create, Duplicate Conflict 409, List, GetById, Update, Delete", async () => {
  const uniqueSecCode = `Z${Date.now().toString().slice(-4)}`;
  let createdSecId;

  try {
    // 1. Create section
    const createRes = await fetch(`${baseUrl}/sections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        offering_id: 1,
        section_code: uniqueSecCode,
        max_strength: 55,
      }),
    });
    const createBody = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.equal(createBody.success, true);
    createdSecId = createBody.data.section_id;
    assert.ok(createdSecId);
    assert.equal(createBody.data.section_code, uniqueSecCode);
    assert.ok(createBody.data.subject_code);

    // 2. Duplicate section for same offering returns 409
    const dupRes = await fetch(`${baseUrl}/sections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        offering_id: 1,
        section_code: uniqueSecCode,
      }),
    });
    assert.equal(dupRes.status, 409);

    // 3. List sections
    const listRes = await fetch(`${baseUrl}/sections?offering_id=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listBody = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.ok(listBody.data.some((s) => s.section_id === createdSecId));

    // 4. Get by ID
    const getRes = await fetch(`${baseUrl}/sections/${createdSecId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(getBody.data.section_id, createdSecId);

    // 5. Update section max_strength
    const updateRes = await fetch(`${baseUrl}/sections/${createdSecId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ max_strength: 65 }),
    });
    const updateBody = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateBody.data.max_strength, 65);

    // 6. Delete section
    const deleteRes = await fetch(`${baseUrl}/sections/${createdSecId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteRes.status, 200);
    createdSecId = null;
  } finally {
    if (createdSecId) {
      await pool.query("DELETE FROM sections WHERE section_id = ?", [createdSecId]);
    }
  }
});

// --- Timetable & Conflict Detection Tests ---
test("Timetable: GET /api/v1/timetable without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/timetable`);
  assert.equal(res.status, 401);
});

test("Timetable RBAC: POST /api/v1/timetable with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/timetable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 403);
});

test("Timetable Validation: POST requires core fields (400)", async () => {
  const res = await fetch(`${baseUrl}/timetable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ section_id: 1, faculty_id: 1 }),
  });
  assert.equal(res.status, 400);
});

test("Timetable Validation: POST rejects invalid day_of_week and end_time <= start_time (400)", async () => {
  // Invalid day of week (8)
  const res1 = await fetch(`${baseUrl}/timetable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      section_id: 1,
      faculty_id: 1,
      classroom_id: 1,
      day_of_week: 8,
      start_time: "09:00:00",
      end_time: "10:00:00",
      effective_from: "2026-06-01",
    }),
  });
  assert.equal(res1.status, 400);

  // end_time <= start_time
  const res2 = await fetch(`${baseUrl}/timetable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      section_id: 1,
      faculty_id: 1,
      classroom_id: 1,
      day_of_week: 1,
      start_time: "11:00:00",
      end_time: "10:00:00",
      effective_from: "2026-06-01",
    }),
  });
  assert.equal(res2.status, 400);
  assert.match((await res2.json()).message, /greater than/i);
});

test("Timetable Validation: POST validates effective_from and effective_to dates (400)", async () => {
  // Invalid date format for effective_from
  const res1 = await fetch(`${baseUrl}/timetable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      section_id: 1,
      faculty_id: 1,
      classroom_id: 1,
      day_of_week: 1,
      start_time: "09:00:00",
      end_time: "10:00:00",
      effective_from: "invalid-date",
    }),
  });
  assert.equal(res1.status, 400);
  assert.match((await res1.json()).message, /effective_from/i);

  // effective_to < effective_from
  const res2 = await fetch(`${baseUrl}/timetable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      section_id: 1,
      faculty_id: 1,
      classroom_id: 1,
      day_of_week: 1,
      start_time: "09:00:00",
      end_time: "10:00:00",
      effective_from: "2026-06-01",
      effective_to: "2026-05-01",
    }),
  });
  assert.equal(res2.status, 400);
  assert.match((await res2.json()).message, /effective_to must be on or after/i);
});

test("Timetable Validation: POST rejects invalid foreign keys (400)", async () => {
  const res = await fetch(`${baseUrl}/timetable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      section_id: 999999,
      faculty_id: 1,
      classroom_id: 1,
      day_of_week: 1,
      start_time: "09:00:00",
      end_time: "10:00:00",
      effective_from: "2026-06-01",
    }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /section/i);
});

test("Timetable Not Found: GET /api/v1/timetable/:id returns 404", async () => {
  const res = await fetch(`${baseUrl}/timetable/999999`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 404);
});

test("Timetable Conflict Detection: Faculty, Classroom, Section conflicts (409) and Boundary Abutting Slots (201)", async () => {
  let slotAId;
  let slotBId;

  try {
    // 1. Create Base Slot A on day 5 (Friday) from 14:00 to 15:30
    const slotARes = await fetch(`${baseUrl}/timetable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        section_id: 1,
        faculty_id: 1,
        classroom_id: 1,
        day_of_week: 5,
        start_time: "14:00:00",
        end_time: "15:30:00",
        effective_from: "2027-01-01",
      }),
    });
    const slotABody = await slotARes.json();
    assert.equal(slotARes.status, 201);
    assert.equal(slotABody.success, true);
    slotAId = slotABody.data.slot_id;
    assert.ok(slotAId);

    // 2. Faculty Conflict: faculty 1 booked on day 5 overlapping (14:30 - 16:00) with different room & section
    const facConflictRes = await fetch(`${baseUrl}/timetable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        section_id: 2,
        faculty_id: 1,
        classroom_id: 2,
        day_of_week: 5,
        start_time: "14:30:00",
        end_time: "16:00:00",
        effective_from: "2027-01-01",
      }),
    });
    const facConflictBody = await facConflictRes.json();
    assert.equal(facConflictRes.status, 409);
    assert.equal(facConflictBody.code, "FACULTY_CONFLICT");
    assert.match(facConflictBody.message, /Faculty schedule conflict/i);

    // 3. Classroom Conflict: room 1 booked on day 5 overlapping (15:00 - 16:00) with different faculty & section
    const roomConflictRes = await fetch(`${baseUrl}/timetable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        section_id: 2,
        faculty_id: 2,
        classroom_id: 1,
        day_of_week: 5,
        start_time: "15:00:00",
        end_time: "16:00:00",
        effective_from: "2027-01-01",
      }),
    });
    const roomConflictBody = await roomConflictRes.json();
    assert.equal(roomConflictRes.status, 409);
    assert.equal(roomConflictBody.code, "CLASSROOM_CONFLICT");
    assert.match(roomConflictBody.message, /Classroom schedule conflict/i);

    // 4. Section Conflict: section 1 booked on day 5 overlapping (13:30 - 14:30) with different faculty & room
    const secConflictRes = await fetch(`${baseUrl}/timetable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        section_id: 1,
        faculty_id: 2,
        classroom_id: 2,
        day_of_week: 5,
        start_time: "13:30:00",
        end_time: "14:30:00",
        effective_from: "2027-01-01",
      }),
    });
    const secConflictBody = await secConflictRes.json();
    assert.equal(secConflictRes.status, 409);
    assert.equal(secConflictBody.code, "SECTION_CONFLICT");
    assert.match(secConflictBody.message, /Section schedule conflict/i);

    // 5. Boundary Condition: Abutting slot (15:30:00 - 16:30:00) starts exactly when Slot A ends (15:30:00)
    // Same faculty, room, and section - should NOT conflict!
    const abuttingRes = await fetch(`${baseUrl}/timetable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        section_id: 1,
        faculty_id: 1,
        classroom_id: 1,
        day_of_week: 5,
        start_time: "15:30:00",
        end_time: "16:30:00",
        effective_from: "2027-01-01",
      }),
    });
    const abuttingBody = await abuttingRes.json();
    assert.equal(abuttingRes.status, 201);
    slotBId = abuttingBody.data.slot_id;
    assert.ok(slotBId);

    // 6. Update Slot A excluding itself does NOT flag self-conflict
    const updateRes = await fetch(`${baseUrl}/timetable/${slotAId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        start_time: "14:00:00",
        end_time: "15:15:00",
      }),
    });
    assert.equal(updateRes.status, 200);

    // 7. Soft deactivation sets is_active = 0
    const deactRes = await fetch(`${baseUrl}/timetable/${slotAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deactBody = await deactRes.json();
    assert.equal(deactRes.status, 200);
    assert.equal(deactBody.data.is_active, 0);

    // 8. Repeat deactivation returns 400
    const repeatDeact = await fetch(`${baseUrl}/timetable/${slotAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repeatDeact.status, 400);
  } finally {
    if (slotAId) {
      await pool.query("DELETE FROM timetable_slots WHERE slot_id = ?", [slotAId]);
    }
    if (slotBId) {
      await pool.query("DELETE FROM timetable_slots WHERE slot_id = ?", [slotBId]);
    }
  }
});

test("Academics Aliases: GET /api/v1/academics/subjects and /api/v1/academics/courses return 200", async () => {
  const subjRes = await fetch(`${baseUrl}/academics/subjects`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const subjBody = await subjRes.json();
  assert.equal(subjRes.status, 200);
  assert.equal(subjBody.success, true);
  assert.ok(Array.isArray(subjBody.data));

  const courseRes = await fetch(`${baseUrl}/academics/courses`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const courseBody = await courseRes.json();
  assert.equal(courseRes.status, 200);
  assert.equal(courseBody.success, true);
  assert.ok(Array.isArray(courseBody.data));
});




// =========================================================================
// FEAT-011: Faculty Portal Workflows Test Suite
// =========================================================================

const facultyToken1 = facultyToken;

const facultyToken2 = jwt.sign(
  { user_id: 99, username: "FAC002", role: "FACULTY", faculty_id: 2 },
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

  // Faculty 2 attempting override on Faculty 1's attendance record -> strictly 403 Forbidden
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
  assert.match(body.message, /not permitted to access, create, or modify attendance corrections/i);

  // Faculty 2 attempting update on Faculty 1's attendance record -> 403 Forbidden (Ownership)
  const putRes = await fetch(`${baseUrl}/faculty/attendance/records/${testRecordId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${facultyToken2}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: newStatus }),
  });
  const putBody = await putRes.json();
  assert.equal(putRes.status, 403);
  assert.equal(putBody.success, false);
  assert.match(putBody.message, /another faculty member's session/i);

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
  await pool.query(
    "DELETE FROM attendance_records WHERE session_id IN (SELECT session_id FROM class_sessions WHERE slot_id = 1 AND session_date = CURDATE())",
  );
  await pool.query("DELETE FROM class_sessions WHERE slot_id = 1 AND session_date = CURDATE()");

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

    // 7. Faculty Attendance Update in Active Session (PUT 200) + Faculty Override Denied (403)
    const overrideAttemptRes = await fetch(`${baseUrl}/faculty/attendance/records/${createdAttendanceId}/override`, {
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
    const overrideAttemptBody = await overrideAttemptRes.json();
    assert.equal(overrideAttemptRes.status, 403);
    assert.equal(overrideAttemptBody.success, false);
    assert.match(overrideAttemptBody.message, /not permitted to access, create, or modify attendance corrections/i);

    // Faculty validly updates attendance record while session is OPEN
    const updateRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/records/${createdAttendanceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "LATE" }),
    });
    const updateBody = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateBody.success, true);
    assert.equal(updateBody.data.status, "LATE");

    // Admin performs official attendance override with audit trail in attendance_corrections
    const adminOverrideRes = await fetch(`${baseUrl}/attendance/${createdAttendanceId}/override`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        new_status: "PRESENT",
        reason_code: "FACULTY_OVERRIDE",
        reason_note: "Admin verified legitimate arrival",
      }),
    });
    const adminOverrideBody = await adminOverrideRes.json();
    assert.equal(adminOverrideRes.status, 200);
    assert.equal(adminOverrideBody.success, true);
    assert.equal(adminOverrideBody.data.previous_status, "LATE");
    assert.equal(adminOverrideBody.data.new_status, "PRESENT");
    assert.equal(adminOverrideBody.data.reason_code, "FACULTY_OVERRIDE");

    // Verify audit entry in attendance_corrections table
    const [auditRows] = await pool.query(
      "SELECT * FROM attendance_corrections WHERE attendance_id = ? ORDER BY correction_id DESC LIMIT 1",
      [createdAttendanceId],
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].previous_status, "LATE");
    assert.equal(auditRows[0].new_status, "PRESENT");
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

test("FEAT-011 Attendance Override Validation: Admin invalid reason_code returns 400 and Faculty returns 403", async () => {
  // Admin call with invalid reason_code returns 400
  const res = await fetch(`${baseUrl}/attendance/1/override`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ new_status: "LATE", reason_code: "INVALID_REASON" }),
  });
  assert.equal(res.status, 400);

  // Faculty call returns 403 Forbidden
  const facRes = await fetch(`${baseUrl}/faculty/attendance/records/1/override`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ new_status: "LATE", reason_code: "INVALID_REASON" }),
  });
  assert.equal(facRes.status, 403);
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

// ============================================================================
// HIERARCHICAL ACADEMIC STRUCTURE & TIMETABLE/ATTENDANCE INTEGRATION TESTS
// School -> Department -> Program -> Batch -> Section -> Timetable -> Class Session -> Attendance Records
// ============================================================================

test("Hierarchical Academics: Schools RBAC, Validation, and Full CRUD Lifecycle", async () => {
  // 1. Unauthenticated request returns 401
  const unauthRes = await fetch(`${baseUrl}/schools`);
  assert.equal(unauthRes.status, 401);

  // 2. Student role attempting to create school returns 403
  const forbiddenRes = await fetch(`${baseUrl}/schools`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: "STEST", name: "School of Student" }),
  });
  assert.equal(forbiddenRes.status, 403);

  // 3. Validation: Missing code and name returns 400
  const invalidRes = await fetch(`${baseUrl}/schools`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(invalidRes.status, 400);

  // 4. Duplicate code returns 409 (SOET is seeded)
  const dupCodeRes = await fetch(`${baseUrl}/schools`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: "SOET", name: "Duplicate Engineering School" }),
  });
  assert.equal(dupCodeRes.status, 409);

  // 5. Create new school returns 201
  const uniqueCode = `ST${Date.now().toString().slice(-4)}`;
  const createRes = await fetch(`${baseUrl}/schools`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: uniqueCode,
      name: `Test School of Innovation ${uniqueCode}`,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  assert.equal(createBody.data.code, uniqueCode);
  const testSchoolId = createBody.data.school_id;

  // 6. List schools: returns department_count and includes newly created school
  const listRes = await fetch(`${baseUrl}/schools?search=${uniqueCode}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.equal(listBody.success, true);
  assert.ok(listBody.data.length >= 1);
  assert.equal(listBody.data[0].school_id, testSchoolId);

  // 7. Get school by ID returns school with departments array
  const getByIdRes = await fetch(`${baseUrl}/schools/${testSchoolId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getByIdBody = await getByIdRes.json();
  assert.equal(getByIdRes.status, 200);
  assert.equal(getByIdBody.data.code, uniqueCode);
  assert.ok(Array.isArray(getByIdBody.data.departments));

  // 8. Update school returns 200
  const updateRes = await fetch(`${baseUrl}/schools/${testSchoolId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Updated Test School ${uniqueCode}`,
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.data.name, `Updated Test School ${uniqueCode}`);

  // 9. Deactivate school returns 200, second call returns 400
  const delRes = await fetch(`${baseUrl}/schools/${testSchoolId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);

  const repeatDelRes = await fetch(`${baseUrl}/schools/${testSchoolId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(repeatDelRes.status, 400);
});

test("Hierarchical Academics: Department Filtering by School and Degrees Retrieval", async () => {
  // 1. Degrees endpoint retrieves degrees
  const degRes = await fetch(`${baseUrl}/degrees`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const degBody = await degRes.json();
  assert.equal(degRes.status, 200);
  assert.ok(degBody.data.length > 0);

  // 2. Department filtering by school_id
  const deptRes = await fetch(`${baseUrl}/departments?school_id=3`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deptBody = await deptRes.json();
  assert.equal(deptRes.status, 200);
  assert.ok(deptBody.data.length > 0);
  // Verify all returned departments belong to school_id = 3 and include school metadata
  for (const dept of deptBody.data) {
    assert.equal(dept.school_id, 3);
    assert.ok(dept.school_name);
  }
});

test("Hierarchical Academics: Programmes RBAC, Aliases, Filtering, and CRUD Lifecycle", async () => {
  // 1. Aliases: /programs and /programmes both return 200
  const progRes1 = await fetch(`${baseUrl}/programs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(progRes1.status, 200);

  const progRes2 = await fetch(`${baseUrl}/programmes`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(progRes2.status, 200);

  // 2. Student role cannot create programme
  const forbiddenRes = await fetch(`${baseUrl}/programs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      school_id: 3,
      degree_id: 1,
      name: "BTech Robotics",
    }),
  });
  assert.equal(forbiddenRes.status, 403);

  // 3. Validation: missing required fields returns 400
  const invalidRes = await fetch(`${baseUrl}/programs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ school_id: 3 }),
  });
  assert.equal(invalidRes.status, 400);

  // 4. Invalid school_id returns 400
  const badSchoolRes = await fetch(`${baseUrl}/programs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      school_id: 99999,
      degree_id: 1,
      name: "BTech NonExistent",
    }),
  });
  assert.equal(badSchoolRes.status, 400);

  // 4b. Mismatched department and school returns 400 (department 3 belongs to school 2, not school 3)
  const mismatchDeptRes = await fetch(`${baseUrl}/programs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      school_id: 3,
      department_id: 3,
      degree_id: 1,
      name: "BTech Mismatch",
    }),
  });
  assert.equal(mismatchDeptRes.status, 400);

  // 5. Create new programme returns 201 (department 5 belongs to school 3)
  const uniqueName = `Aerospace Informatics ${Date.now()}`;
  const uniqueCode = `AI${Date.now().toString().slice(-4)}`;
  const createRes = await fetch(`${baseUrl}/programs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      school_id: 3,
      department_id: 5,
      degree_id: 1,
      name: uniqueName,
      programme_code: uniqueCode,
      partner_track: "STANDARD",
      duration_years: 4.0,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  assert.equal(createBody.data.programme_code, uniqueCode);
  const testProgId = createBody.data.programme_id;

  // 6. Duplicate identity returns 409
  const dupRes = await fetch(`${baseUrl}/programs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      school_id: 3,
      degree_id: 1,
      name: uniqueName,
      programme_code: `D${uniqueCode.slice(1)}`,
      partner_track: "STANDARD",
    }),
  });
  assert.equal(dupRes.status, 409);

  // 7. Get programme by ID returns joined data and batches array
  const getByIdRes = await fetch(`${baseUrl}/programs/${testProgId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getByIdBody = await getByIdRes.json();
  assert.equal(getByIdRes.status, 200);
  assert.equal(getByIdBody.data.name, uniqueName);
  assert.ok(Array.isArray(getByIdBody.data.batches));

  // 8. Update programme returns 200
  const updateRes = await fetch(`${baseUrl}/programs/${testProgId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `${uniqueName} Updated`,
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.data.name, `${uniqueName} Updated`);

  // 9. Deactivate programme returns 200
  const delRes = await fetch(`${baseUrl}/programs/${testProgId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);
});

test("Hierarchical Academics: Batches Lifecycle, Relational Integrity, and Dependency Safeguards", async () => {
  // 1. Unauthenticated batches request returns 401
  const unauthRes = await fetch(`${baseUrl}/batches`);
  assert.equal(unauthRes.status, 401);

  // 2. Student role attempting to create batch returns 403
  const forbiddenRes = await fetch(`${baseUrl}/batches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ programme_id: 97, start_year_id: 1, label: "2029-33" }),
  });
  assert.equal(forbiddenRes.status, 403);

  // 3. Validation: missing fields returns 400
  const invalidRes = await fetch(`${baseUrl}/batches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: "2029-33" }),
  });
  assert.equal(invalidRes.status, 400);

  // 4. Duplicate (programme_id, start_year_id) returns 409 (programme 97, year 4 is seeded)
  const dupRes = await fetch(`${baseUrl}/batches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ programme_id: 97, start_year_id: 4, label: "2026-30 duplicate" }),
  });
  assert.equal(dupRes.status, 409);

  // 5. Create new batch for a different programme returns 201
  const createRes = await fetch(`${baseUrl}/batches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      programme_id: 77,
      start_year_id: 4,
      label: "2026-30 Test Batch",
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.data.label, "2026-30 Test Batch");
  const testBatchId = createBody.data.batch_id;

  // 6. List batches with filters: returns counts and hierarchy joins
  const listRes = await fetch(`${baseUrl}/batches?programme_id=77`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.ok(listBody.data.length >= 1);
  assert.equal(listBody.data[0].batch_id, testBatchId);
  assert.ok(listBody.data[0].programme_name);

  // 7. Update batch returns 200
  const updateRes = await fetch(`${baseUrl}/batches/${testBatchId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      label: "2026-30 Renamed Batch",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.data.label, "2026-30 Renamed Batch");

  // 8. Dependency safeguard: deleting seeded batch 4 (which has students and sections) returns 400
  const protectedDelRes = await fetch(`${baseUrl}/batches/4`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(protectedDelRes.status, 400);

  // 9. Deleting newly created empty batch succeeds returns 200
  const deleteRes = await fetch(`${baseUrl}/batches/${testBatchId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteRes.status, 200);
});

test("Hierarchical Academics: Section Creation with Batch, Hierarchy Retrieval, and Timetable Integration", async () => {
  // 1. Create section with invalid batch_id returns 400
  const invalidBatchRes = await fetch(`${baseUrl}/sections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      offering_id: 1,
      batch_id: 99999,
      section_code: "Z",
    }),
  });
  assert.equal(invalidBatchRes.status, 400);

  // 2. Create section with valid batch_id returns 201 with hierarchy fields
  const uniqueCode = `H${Date.now().toString().slice(-3)}`;
  const createSecRes = await fetch(`${baseUrl}/sections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      offering_id: 1,
      batch_id: 4,
      section_code: uniqueCode,
      max_strength: 55,
    }),
  });
  const createSecBody = await createSecRes.json();
  assert.equal(createSecRes.status, 201);
  assert.equal(createSecBody.data.batch_id, 4);
  assert.equal(createSecBody.data.batch_label, "2026-30");
  assert.ok(createSecBody.data.programme_name);
  const testSecId = createSecBody.data.section_id;

  // 3. List sections with batch_id filter
  const listSecRes = await fetch(`${baseUrl}/sections?batch_id=4`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listSecBody = await listSecRes.json();
  assert.equal(listSecRes.status, 200);
  assert.ok(listSecBody.data.some((s) => s.section_id === testSecId));

  // 4. Timetable slots query returns hierarchy metadata and filters by batch_id
  const ttRes = await fetch(`${baseUrl}/timetable?batch_id=4`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const ttBody = await ttRes.json();
  assert.equal(ttRes.status, 200);
  assert.ok(ttBody.data.length > 0);
  const sampleSlot = ttBody.data[0];
  assert.ok(sampleSlot.batch_label, "Timetable slot must include batch_label");
  assert.ok(sampleSlot.programme_name, "Timetable slot must include programme_name");
  assert.ok(sampleSlot.department_name, "Timetable slot must include department_name");
  assert.ok(sampleSlot.school_name, "Timetable slot must include school_name");

  // 5. Cleanup created section
  const cleanupRes = await fetch(`${baseUrl}/sections/${testSecId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(cleanupRes.status, 200);
});

test("FEAT-015 Release Verification: Academic DELETE RBAC, 404 JSON Fallback, and Route Aliases", async () => {
  // 1. DELETE /timetable/:id RBAC & Not Found
  const noTokenRes = await fetch(`${baseUrl}/timetable/999999`, { method: "DELETE" });
  assert.equal(noTokenRes.status, 401);

  const studentRes = await fetch(`${baseUrl}/timetable/999999`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentRes.status, 403);

  const notFoundTimetable = await fetch(`${baseUrl}/timetable/999999`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(notFoundTimetable.status, 404);
  const notFoundTTBody = await notFoundTimetable.json();
  assert.equal(notFoundTTBody.success, false);
  assert.equal(notFoundTTBody.message, "Timetable slot not found");

  // 2. DELETE /course-offerings/:id & /subjects/:id Not Found
  const notFoundOffering = await fetch(`${baseUrl}/course-offerings/999999`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(notFoundOffering.status, 404);
  const notFoundOffBody = await notFoundOffering.json();
  assert.equal(notFoundOffBody.success, false);

  const notFoundSubject = await fetch(`${baseUrl}/subjects/999999`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(notFoundSubject.status, 404);
  const notFoundSubjBody = await notFoundSubject.json();
  assert.equal(notFoundSubjBody.success, false);

  // 3. Fallback 404 JSON Response: Never returns HTML
  const unhandledRes = await fetch(`${baseUrl}/non-existent-endpoint-test-404`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(unhandledRes.status, 404);
  const unhandledContentType = unhandledRes.headers.get("content-type");
  assert.ok(unhandledContentType.includes("application/json"), "404 must return JSON, not HTML");
  const unhandledBody = await unhandledRes.json();
  assert.equal(unhandledBody.success, false);
  assert.ok(unhandledBody.message.includes("Cannot DELETE"));

  // 4. Aliases Verification
  const ttAlias1 = await fetch(`${baseUrl}/academics/timetable`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(ttAlias1.status, 200);

  const ttAlias2 = await fetch(`${baseUrl}/timetable_slots`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(ttAlias2.status, 200);

  const secAlias = await fetch(`${baseUrl}/academics/sections`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(secAlias.status, 200);
});

test("Academic Years: RBAC, Validations, Duplicate Detection, Full Lifecycle, and Safeties", async () => {
  // 1. Auth & RBAC
  const noTokenRes = await fetch(`${baseUrl}/academic-years`);
  assert.equal(noTokenRes.status, 401);

  const studentPostRes = await fetch(`${baseUrl}/academic-years`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: "2098-99", start_date: "2098-08-01", end_date: "2099-05-31" }),
  });
  assert.equal(studentPostRes.status, 403);

  // 2. Validations
  const missingLabelRes = await fetch(`${baseUrl}/academic-years`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ start_date: "2098-08-01", end_date: "2099-05-31" }),
  });
  assert.equal(missingLabelRes.status, 400);

  const invalidDatesRes = await fetch(`${baseUrl}/academic-years`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: "2098-99", start_date: "2099-05-31", end_date: "2098-08-01" }),
  });
  assert.equal(invalidDatesRes.status, 400);

  // 3. Create Valid Academic Year
  const testLabel = "2098-99";
  const createRes = await fetch(`${baseUrl}/academic-years`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: testLabel, start_date: "2098-08-01", end_date: "2099-05-31" }),
  });
  assert.equal(createRes.status, 201);
  const createdBody = await createRes.json();
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.data.label, testLabel);
  const createdYearId = createdBody.data.academic_year_id;

  // 4. Duplicate Label Detection (409)
  const dupRes = await fetch(`${baseUrl}/academic-years`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: testLabel, start_date: "2098-08-01", end_date: "2099-05-31" }),
  });
  assert.equal(dupRes.status, 409);

  // 5. List and Aliases
  const listRes = await fetch(`${baseUrl}/academic-years`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(listBody.data.some((y) => y.academic_year_id === createdYearId));

  const aliasRes = await fetch(`${baseUrl}/academics/years`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(aliasRes.status, 200);

  // 6. GetById
  const getByIdRes = await fetch(`${baseUrl}/academic-years/${createdYearId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getByIdRes.status, 200);
  const getByIdBody = await getByIdRes.json();
  assert.equal(getByIdBody.data.academic_year_id, createdYearId);
  assert.ok(Array.isArray(getByIdBody.data.terms));

  // 7. Update
  const updateRes = await fetch(`${baseUrl}/academic-years/${createdYearId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: "2098-99", start_date: "2098-08-15", end_date: "2099-06-15" }),
  });
  assert.equal(updateRes.status, 200);

  // 8. Relational Delete Safeguard: Seeded Year 1 has terms/batches
  const safeguardRes = await fetch(`${baseUrl}/academic-years/1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(safeguardRes.status, 409);

  // 9. Delete Created Year
  const deleteRes = await fetch(`${baseUrl}/academic-years/${createdYearId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteRes.status, 200);

  // Verify 404 after deletion
  const verifyDeleted = await fetch(`${baseUrl}/academic-years/${createdYearId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(verifyDeleted.status, 404);
});

test("Academic Terms: RBAC, Validation, Unique Term Constraint, and Offerings Safeties", async () => {
  // 1. Auth & RBAC
  const noTokenRes = await fetch(`${baseUrl}/academic-terms`);
  assert.equal(noTokenRes.status, 401);

  const studentPostRes = await fetch(`${baseUrl}/academic-terms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ academic_year_id: 1, term_type: "SUMMER", start_date: "2025-06-01", end_date: "2025-07-31" }),
  });
  assert.equal(studentPostRes.status, 403);

  // 2. Validations
  const invalidTypeRes = await fetch(`${baseUrl}/academic-terms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ academic_year_id: 1, term_type: "INVALID_TERM", start_date: "2025-06-01", end_date: "2025-07-31" }),
  });
  assert.equal(invalidTypeRes.status, 400);

  const invalidYearRes = await fetch(`${baseUrl}/academic-terms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ academic_year_id: 999999, term_type: "ODD", start_date: "2025-06-01", end_date: "2025-07-31" }),
  });
  assert.equal(invalidYearRes.status, 400);

  // 3. Duplicate Term in Academic Year (Year 1 already has 'ODD' term in seed)
  const dupTermRes = await fetch(`${baseUrl}/academic-terms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ academic_year_id: 1, term_type: "ODD", start_date: "2023-08-01", end_date: "2023-12-31" }),
  });
  assert.equal(dupTermRes.status, 409);

  // 4. Create Temporary Academic Year for Term Lifecycle Test
  const tempYearRes = await fetch(`${baseUrl}/academic-years`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label: "2096-97", start_date: "2096-08-01", end_date: "2097-07-31" }),
  });
  assert.equal(tempYearRes.status, 201);
  const tempYearBody = await tempYearRes.json();
  const tempYearId = tempYearBody.data.academic_year_id;

  // 5. Create Term in Temporary Year
  const createTermRes = await fetch(`${baseUrl}/academic-terms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ academic_year_id: tempYearId, term_type: "SUMMER", start_date: "2097-06-01", end_date: "2097-07-31" }),
  });
  assert.equal(createTermRes.status, 201);
  const createdTermBody = await createTermRes.json();
  const createdTermId = createdTermBody.data.term_id;

  // 6. List and Aliases
  const listTermsRes = await fetch(`${baseUrl}/academic-terms?academic_year_id=${tempYearId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listTermsRes.status, 200);
  const listTermsBody = await listTermsRes.json();
  assert.equal(listTermsBody.data.length, 1);
  assert.equal(listTermsBody.data[0].term_type, "SUMMER");

  const termsAliasRes = await fetch(`${baseUrl}/academics/terms`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(termsAliasRes.status, 200);

  // 7. GetById
  const getTermRes = await fetch(`${baseUrl}/academic-terms/${createdTermId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getTermRes.status, 200);

  // 8. Relational Delete Safeguard: Seeded Term 1 has course offerings
  const termSafeguardRes = await fetch(`${baseUrl}/academic-terms/1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(termSafeguardRes.status, 409);

  // 9. Delete Created Term & Cleanup Temporary Year
  const deleteTermRes = await fetch(`${baseUrl}/academic-terms/${createdTermId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteTermRes.status, 200);

  const deleteTempYear = await fetch(`${baseUrl}/academic-years/${tempYearId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteTempYear.status, 200);
});

test("Enrollments: RBAC, Capacity Enforcement, Duplicates, and Section Roster Lifecycle", async () => {
  // 1. Auth & RBAC
  const noTokenRes = await fetch(`${baseUrl}/enrollments`);
  assert.equal(noTokenRes.status, 401);

  const studentPostRes = await fetch(`${baseUrl}/enrollments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ student_id: 1, section_id: 1 }),
  });
  assert.equal(studentPostRes.status, 403);

  // 2. Validation: Non-existent student / section
  const invalidStudentRes = await fetch(`${baseUrl}/enrollments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ student_id: 999999, section_id: 1 }),
  });
  assert.equal(invalidStudentRes.status, 400);

  const invalidSectionRes = await fetch(`${baseUrl}/enrollments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ student_id: 1, section_id: 999999 }),
  });
  assert.equal(invalidSectionRes.status, 400);

  // 3. Create a test section with strict capacity max_strength = 1
  const testSecRes = await fetch(`${baseUrl}/sections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      offering_id: 1,
      section_code: "TEST-CAP",
      max_strength: 1,
    }),
  });
  assert.equal(testSecRes.status, 201);
  const testSecBody = await testSecRes.json();
  const testSecId = testSecBody.data.section_id;

  // 4. Enroll Student 1 -> Success 201
  const enroll1Res = await fetch(`${baseUrl}/enrollments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id: 1,
      section_id: testSecId,
      registration_type: "REGULAR",
    }),
  });
  assert.equal(enroll1Res.status, 201);
  const enroll1Body = await enroll1Res.json();
  const enrollment1Id = enroll1Body.data.enrollment_id;

  // 5. Duplicate Enrollment Detection -> 409
  const dupEnrollRes = await fetch(`${baseUrl}/enrollments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id: 1,
      section_id: testSecId,
    }),
  });
  assert.equal(dupEnrollRes.status, 409);

  // 6. Capacity Constraint Enforcement: Student 2 cannot enroll (capacity: 1) -> 400
  const capExceededRes = await fetch(`${baseUrl}/enrollments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id: 2,
      section_id: testSecId,
    }),
  });
  assert.equal(capExceededRes.status, 400);
  const capBody = await capExceededRes.json();
  assert.ok(capBody.message.includes("capacity"));

  // 7. Section Roster Endpoint (/sections/:id/roster)
  const rosterRes = await fetch(`${baseUrl}/sections/${testSecId}/roster`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(rosterRes.status, 200);
  const rosterBody = await rosterRes.json();
  assert.equal(rosterBody.data.total_enrolled, 1);
  assert.equal(rosterBody.data.active_enrolled, 1);
  assert.equal(rosterBody.data.students[0].student_id, 1);

  // 8. Update Enrollment Status to DROPPED -> Capacity frees up!
  const dropRes = await fetch(`${baseUrl}/enrollments/${enrollment1Id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "DROPPED" }),
  });
  assert.equal(dropRes.status, 200);

  // Roster should now reflect active_enrolled = 0
  const rosterAfterDrop = await fetch(`${baseUrl}/sections/${testSecId}/students`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(rosterAfterDrop.status, 200);
  const rosterDropBody = await rosterAfterDrop.json();
  assert.equal(rosterDropBody.data.active_enrolled, 0);

  // 9. Student 2 can now enroll because active count is 0
  const enroll2Res = await fetch(`${baseUrl}/enrollments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id: 2,
      section_id: testSecId,
    }),
  });
  assert.equal(enroll2Res.status, 201);
  const enroll2Body = await enroll2Res.json();
  const enrollment2Id = enroll2Body.data.enrollment_id;

  // 10. Cleanup created test enrollments & section
  const delEnr1 = await fetch(`${baseUrl}/enrollments/${enrollment1Id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delEnr1.status, 200);

  const delEnr2 = await fetch(`${baseUrl}/enrollments/${enrollment2Id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delEnr2.status, 200);

  const delSec = await fetch(`${baseUrl}/sections/${testSecId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delSec.status, 200);
});

test("Semester-Specific Timetable Engine: Isolation, Joins, Filters, and Student Enrollment Filter", async () => {
  // 1. Query Timetable with Admin Token
  const res = await fetch(`${baseUrl}/timetable`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.data.length > 0);

  const firstSlot = body.data[0];
  assert.ok(firstSlot.term_id !== undefined, "Timetable slot must include term_id");
  assert.ok(firstSlot.term_type !== undefined, "Timetable slot must include term_type");
  assert.ok(firstSlot.academic_year_id !== undefined, "Timetable slot must include academic_year_id");
  assert.ok(firstSlot.academic_year_label !== undefined, "Timetable slot must include academic_year_label");

  // 2. Semester Filter: querying term_id = 1 strictly isolates to term 1 slots
  const term1Res = await fetch(`${baseUrl}/timetable?term_id=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(term1Res.status, 200);
  const term1Body = await term1Res.json();
  for (const slot of term1Body.data) {
    assert.equal(slot.term_id, 1, "Slot must strictly belong to term 1");
  }

  // 3. Querying non-existent / empty term strictly returns 0 slots (no leaks)
  const emptyTermRes = await fetch(`${baseUrl}/timetable?term_id=99999`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(emptyTermRes.status, 200);
  const emptyTermBody = await emptyTermRes.json();
  assert.equal(emptyTermBody.count, 0);

  // 4. Student-based timetable filter: query timetable for student_id = 1
  const studentSlotsRes = await fetch(`${baseUrl}/timetable?student_id=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(studentSlotsRes.status, 200);
  const studentSlotsBody = await studentSlotsRes.json();
  assert.ok(Array.isArray(studentSlotsBody.data));
});

test("Student Portal: Strict Semester Isolation Across Courses, Timetable, and Attendance", async () => {
  // 1. Student Courses with term_id filter
  const allCoursesRes = await fetch(`${baseUrl}/student/me/courses`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(allCoursesRes.status, 200);
  const allCoursesBody = await allCoursesRes.json();

  if (allCoursesBody.data.length > 0) {
    const course = allCoursesBody.data[0];
    assert.ok(course.term_id !== undefined, "Course must expose term_id");
    assert.ok(course.term_type !== undefined, "Course must expose term_type");
    assert.ok(course.academic_year_label !== undefined, "Course must expose academic_year_label");

    // Filter by that specific term
    const termCoursesRes = await fetch(`${baseUrl}/student/me/courses?term_id=${course.term_id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(termCoursesRes.status, 200);
    const termCoursesBody = await termCoursesRes.json();
    for (const c of termCoursesBody.data) {
      assert.equal(c.term_id, course.term_id, "Courses must strictly belong to requested term");
    }
  }

  // 2. Querying non-existent term returns 0 courses (no leaks)
  const emptyCoursesRes = await fetch(`${baseUrl}/student/me/courses?term_id=99999`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(emptyCoursesRes.status, 200);
  const emptyCoursesBody = await emptyCoursesRes.json();
  assert.equal(emptyCoursesBody.count, 0);

  // 3. Student Timetable with semester isolation
  const ttRes = await fetch(`${baseUrl}/student/me/timetable?term_id=99999`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(ttRes.status, 200);
  const ttBody = await ttRes.json();
  assert.equal(ttBody.count, 0, "No timetable slots leaked for non-matching semester");

  // 4. Student Attendance with semester isolation
  const attRes = await fetch(`${baseUrl}/student/me/attendance?term_id=99999`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(attRes.status, 200);
  const attBody = await attRes.json();
  assert.equal(attBody.count, 0, "No attendance records leaked for non-matching semester");

  // 5. Student Dashboard with term_id filter
  const dashRes = await fetch(`${baseUrl}/student/me/dashboard?term_id=1`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(dashRes.status, 200);
  const dashBody = await dashRes.json();
  assert.ok(dashBody.data.profile, "Dashboard must return profile");
  assert.ok(dashBody.data.attendance, "Dashboard must return attendance metrics");
});

test("Faculty Portal: Term-Wise Timetable, Courses, Sections, and Attendance Isolation", async () => {
  // 1. Faculty Timetable with term filter
  const ttRes = await fetch(`${baseUrl}/faculty/timetable?term_id=1`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(ttRes.status, 200);
  const ttBody = await ttRes.json();
  for (const slot of ttBody.data) {
    assert.equal(slot.term_id, 1, "Slot must strictly belong to term 1");
  }

  const emptyTTRes = await fetch(`${baseUrl}/faculty/timetable?term_id=99999`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(emptyTTRes.status, 200);
  const emptyTTBody = await emptyTTRes.json();
  assert.equal(emptyTTBody.count, 0);

  // 2. Faculty Courses with term filter
  const coursesRes = await fetch(`${baseUrl}/faculty/courses?term_id=1`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(coursesRes.status, 200);
  const coursesBody = await coursesRes.json();
  for (const course of coursesBody.data) {
    assert.equal(course.term_id, 1);
  }

  // 3. Faculty Sections with term filter
  const secRes = await fetch(`${baseUrl}/faculty/sections?term_id=1`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(secRes.status, 200);
  const secBody = await secRes.json();
  for (const s of secBody.data) {
    assert.equal(s.term_id, 1);
  }

  // 4. Faculty Attendance Summary with term filter
  const summRes = await fetch(`${baseUrl}/faculty/attendance/summary?term_id=1`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(summRes.status, 200);
  const summBody = await summRes.json();
  assert.ok(summBody.data.summary, "Must return attendance summary");
});

test("Admin Semester-Wise Reports: Comprehensive Aggregated Attendance and Breakdown", async () => {
  // 1. Admin Attendance Report without filter
  const reportRes = await fetch(`${baseUrl}/admin/reports/attendance`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(reportRes.status, 200);
  const reportBody = await reportRes.json();
  assert.equal(reportBody.success, true);
  assert.ok(reportBody.data.summary !== undefined, "Report must include summary");
  assert.ok(Array.isArray(reportBody.data.sections_breakdown), "Report must include sections_breakdown");

  // 2. Admin Attendance Report with term_id filter
  const termReportRes = await fetch(`${baseUrl}/admin/reports/attendance?term_id=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(termReportRes.status, 200);
  const termReportBody = await termReportRes.json();
  for (const section of termReportBody.data.sections_breakdown) {
    assert.equal(section.term_id, 1, "Breakdown must strictly belong to term 1");
  }

  // 3. Alias /attendance/report
  const aliasReportRes = await fetch(`${baseUrl}/attendance/report`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(aliasReportRes.status, 200);

  // 4. Student Attendance Summary by Term: /attendance/student/:id/summary?term_id=1
  const studentSummRes = await fetch(`${baseUrl}/attendance/student/1/summary?term_id=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(studentSummRes.status, 200);
  const studentSummBody = await studentSummRes.json();
  assert.ok(studentSummBody.data.summary);

  // 5. Faculty attendance aliases /attendance/faculty/:id and /attendance/staff/:id
  const facAttRes = await fetch(`${baseUrl}/attendance/faculty/1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(facAttRes.status, 200);

  const staffAttRes = await fetch(`${baseUrl}/attendance/staff/1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(staffAttRes.status, 200);

  // 6. Report with specific filters (dates, department, section, subject)
  const filteredReportRes = await fetch(
    `${baseUrl}/admin/reports/attendance?department_id=1&section_id=1&subject_id=1&start_date=2020-01-01&end_date=2030-12-31`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(filteredReportRes.status, 200);
});

test("Enrollments & Academic Terms: Advanced Filtering, Updates, and Relational Safeguards", async () => {
  // 1. Enrollments Query with comprehensive filters
  const listEnrRes = await fetch(
    `${baseUrl}/enrollments?status=REGISTERED&registration_type=REGULAR&term_id=1&search=Student`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(listEnrRes.status, 200);
  const listEnrBody = await listEnrRes.json();
  assert.ok(Array.isArray(listEnrBody.data));

  // 2. Enrollments GetById for seeded enrollment 1
  const getEnrRes = await fetch(`${baseUrl}/enrollments/1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getEnrRes.status, 200);
  const getEnrBody = await getEnrRes.json();
  assert.equal(getEnrBody.data.enrollment_id, 1);
  assert.ok(getEnrBody.data.student_name);

  // 3. Enrollment Update Validation
  const invalidStatusRes = await fetch(`${baseUrl}/enrollments/1`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "INVALID_STATUS" }),
  });
  assert.equal(invalidStatusRes.status, 400);

  const invalidTypeRes = await fetch(`${baseUrl}/enrollments/1`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ registration_type: "INVALID_REG" }),
  });
  assert.equal(invalidTypeRes.status, 400);

  // 4. Delete Enrollment Safeguard: Seeded enrollment 1 has attendance records
  const delSafeguardRes = await fetch(`${baseUrl}/enrollments/1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delSafeguardRes.status, 409);
  const delSafeBody = await delSafeguardRes.json();
  assert.ok(delSafeBody.message.includes("attendance record"));

  // 5. Academic Terms Update & Search
  const searchTermsRes = await fetch(`${baseUrl}/academic-terms?search=ODD`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(searchTermsRes.status, 200);

  // 6. Academic Term Not Found
  const termNotFoundRes = await fetch(`${baseUrl}/academic-terms/999999`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(termNotFoundRes.status, 404);

  // 7. Academic Year Search with Year
  const yearSearchRes = await fetch(`${baseUrl}/academic-years?start_year=2024&search=2024`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(yearSearchRes.status, 200);
});

// ============================================================================
// FEAT-017: Faculty Session Management & Attendance Permission Control
// ============================================================================

test("FEAT-017 Faculty Sessions: Creation for own slot (201) and rejection for another faculty's slot (403)", async () => {
  const uniqueDate = `2026-11-${String(Math.floor(Math.random() * 25) + 1).padStart(2, "0")}`;

  // 1. Allowed: Faculty 1 creates session for own slot (slot 1) via /faculty/attendance/sessions
  const facCreateRes = await fetch(`${baseUrl}/faculty/attendance/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slot_id: 1,
      session_date: uniqueDate,
    }),
  });
  const facCreateBody = await facCreateRes.json();
  assert.equal(facCreateRes.status, 201);
  assert.equal(facCreateBody.success, true);
  assert.equal(facCreateBody.data.faculty_id, 1);
  assert.equal(facCreateBody.data.status, "SCHEDULED");
  const createdSessionId = facCreateBody.data.session_id;

  try {
    // 2. Duplicate session for same slot and exact start time rejected (409 Conflict)
    const dupRes = await fetch(`${baseUrl}/faculty/attendance/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slot_id: 1,
        session_date: uniqueDate,
      }),
    });
    assert.equal(dupRes.status, 409);

    // 2b. Allowed: Faculty 1 creates another session on the same date with distinct scheduled start time
    const secondSessionRes = await fetch(`${baseUrl}/faculty/attendance/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slot_id: 1,
        session_date: uniqueDate,
        scheduled_start: "14:00:00",
        scheduled_end: "15:00:00",
      }),
    });
    assert.equal(secondSessionRes.status, 201);
    const secondSessionBody = await secondSessionRes.json();
    assert.equal(secondSessionBody.success, true);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [secondSessionBody.data.session_id]);

    // 3. Denied: Faculty 1 attempts creating session for slot 2 (assigned to faculty 2) -> 403 Forbidden
    const crossRes = await fetch(`${baseUrl}/faculty/attendance/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slot_id: 2,
        session_date: `2026-11-28`,
      }),
    });
    const crossBody = await crossRes.json();
    assert.equal(crossRes.status, 403);
    assert.equal(crossBody.success, false);
    assert.match(crossBody.message, /another faculty member's timetable slot/i);

    // 4. Denied: Generic /attendance/sessions endpoint also enforces slot ownership for FACULTY role
    const genericCrossRes = await fetch(`${baseUrl}/attendance/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slot_id: 2,
        session_date: `2026-11-29`,
      }),
    });
    assert.equal(genericCrossRes.status, 403);
  } finally {
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [createdSessionId]);
  }
});

test("FEAT-017 Faculty Sessions: Lifecycle (Start, View Roster, Mark, Update, Finalize, Lock)", async () => {
  const uniqueDate = `2026-12-${String(Math.floor(Math.random() * 25) + 1).padStart(2, "0")}`;

  // 1. Create a session for Faculty 1
  const createRes = await fetch(`${baseUrl}/faculty/attendance/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slot_id: 1,
      session_date: uniqueDate,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  const sessionId = createBody.data.session_id;

  try {
    // 2. Start session (SCHEDULED -> OPEN)
    const startRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${sessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    assert.equal(startRes.status, 200);

    // 3. Inspect roster
    const rosterRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${sessionId}/roster`, {
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    const rosterBody = await rosterRes.json();
    assert.equal(rosterRes.status, 200);
    assert.ok(rosterBody.data.roster.length >= 1);

    // 4. Mark attendance for Student 1 (status: PRESENT)
    const markRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${sessionId}/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ student_id: 1, status: "PRESENT" }),
    });
    const markBody = await markRes.json();
    assert.equal(markRes.status, 201);
    const attendanceId = markBody.data.attendance_id;

    // 5. Cross-student rejection: marking a non-existent student outside roster returns 400
    const nonRosterRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${sessionId}/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ student_id: 999999, status: "PRESENT" }),
    });
    assert.equal(nonRosterRes.status, 400);

    // 6. Faculty updates attendance record while session is OPEN (PUT 200)
    const updateRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${sessionId}/records/${attendanceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "LATE" }),
    });
    const updateBody = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateBody.data.status, "LATE");

    // 7. Generic PUT /attendance/:id also permits faculty update on their open session
    const genericPutRes = await fetch(`${baseUrl}/attendance/${attendanceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "PRESENT" }),
    });
    assert.equal(genericPutRes.status, 200);

    // 8. Finalize session (OPEN -> CLOSED)
    const finalizeRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${sessionId}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    assert.equal(finalizeRes.status, 200);

    // 9. Post-finalization lock: Attempting to update attendance on CLOSED session returns 400
    const lockedUpdateRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${sessionId}/records/${attendanceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "ABSENT" }),
    });
    assert.equal(lockedUpdateRes.status, 400);
    const lockedBody = await lockedUpdateRes.json();
    assert.match(lockedBody.message, /session.*OPEN/i);
  } finally {
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [sessionId]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [sessionId]);
  }
});

test("FEAT-017 Faculty Permissions Denied: Start, Finalize, Roster, Mark, and Update on another faculty's session return 403", async () => {
  // Create test session for Faculty 1 on slot 1
  const [sess] = await pool.query(
    `INSERT INTO class_sessions (slot_id, session_date, faculty_id, classroom_id, scheduled_start, scheduled_end, present_until, late_until, status)
     VALUES (1, '2026-11-20', 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'SCHEDULED')`,
  );
  const testSessionId = sess.insertId;

  try {
    // 1. Faculty 2 cannot start Faculty 1's session (403 Forbidden)
    const f2StartRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken2}` },
    });
    assert.equal(f2StartRes.status, 403);

    // Generic endpoint also returns 403 for Faculty 2
    const genericStartRes = await fetch(`${baseUrl}/attendance/sessions/${testSessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken2}` },
    });
    assert.equal(genericStartRes.status, 403);

    // Start session as Faculty 1 to test OPEN state actions
    await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });

    // 2. Faculty 2 cannot view roster of Faculty 1's session (403 Forbidden)
    const f2RosterRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/roster`, {
      headers: { Authorization: `Bearer ${facultyToken2}` },
    });
    assert.equal(f2RosterRes.status, 403);

    // 3. Faculty 2 cannot mark attendance in Faculty 1's session (403 Forbidden)
    const f2MarkRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken2}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ student_id: 1, status: "PRESENT" }),
    });
    assert.equal(f2MarkRes.status, 403);

    // Generic /attendance also returns 403 for Faculty 2
    const genericMarkRes = await fetch(`${baseUrl}/attendance`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken2}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: testSessionId, enrollment_id: 1, status: "PRESENT" }),
    });
    assert.equal(genericMarkRes.status, 403);

    // Faculty 1 marks student 1
    const [rec] = await pool.query(
      "INSERT INTO attendance_records (session_id, enrollment_id, status, source, marked_at) VALUES (?, 1, 'PRESENT', 'MANUAL', NOW())",
      [testSessionId],
    );
    const recId = rec.insertId;

    // 4. Faculty 2 cannot update Faculty 1's attendance record (403 Forbidden)
    const f2UpdateRes = await fetch(`${baseUrl}/attendance/${recId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${facultyToken2}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "LATE" }),
    });
    assert.equal(f2UpdateRes.status, 403);

    // 5. Faculty 2 cannot finalize Faculty 1's session (403 Forbidden)
    const f2FinalizeRes = await fetch(`${baseUrl}/faculty/attendance/sessions/${testSessionId}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken2}` },
    });
    assert.equal(f2FinalizeRes.status, 403);

    const genericFinalizeRes = await fetch(`${baseUrl}/attendance/sessions/${testSessionId}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${facultyToken2}` },
    });
    assert.equal(genericFinalizeRes.status, 403);
  } finally {
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [testSessionId]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [testSessionId]);
  }
});

test("FEAT-017 Attendance Corrections & Overrides: Strict 403 for Faculty across all routes and aliases", async () => {
  // Create a dummy record
  const [sess] = await pool.query(
    `INSERT INTO class_sessions (slot_id, session_date, faculty_id, classroom_id, scheduled_start, scheduled_end, present_until, late_until, status)
     VALUES (1, '2026-11-21', 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'CLOSED')`,
  );
  const [rec] = await pool.query(
    "INSERT INTO attendance_records (session_id, enrollment_id, status, source, marked_at) VALUES (?, 1, 'PRESENT', 'MANUAL', NOW())",
    [sess.insertId],
  );
  const recId = rec.insertId;

  try {
    // 1. POST /attendance/:id/override with faculty token returns 403
    const r1 = await fetch(`${baseUrl}/attendance/${recId}/override`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_status: "LATE", reason_code: "FACULTY_OVERRIDE" }),
    });
    assert.equal(r1.status, 403);

    // 2. POST /faculty/attendance/records/:id/override returns 403
    const r2 = await fetch(`${baseUrl}/faculty/attendance/records/${recId}/override`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_status: "LATE", reason_code: "FACULTY_OVERRIDE" }),
    });
    assert.equal(r2.status, 403);

    // 3. POST /faculty/attendance/override/:id returns 403
    const r3 = await fetch(`${baseUrl}/faculty/attendance/override/${recId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_status: "LATE", reason_code: "FACULTY_OVERRIDE" }),
    });
    assert.equal(r3.status, 403);

    // 4. Alternate alias /faculty-portal/attendance/records/:id/override returns 403
    const r4 = await fetch(`${baseUrl}/faculty-portal/attendance/records/${recId}/override`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${facultyToken1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ new_status: "LATE", reason_code: "FACULTY_OVERRIDE" }),
    });
    assert.equal(r4.status, 403);

    // 5. GET /faculty/attendance/corrections returns 403
    const r5 = await fetch(`${baseUrl}/faculty/attendance/corrections`, {
      headers: { Authorization: `Bearer ${facultyToken1}` },
    });
    assert.equal(r5.status, 403);

    // 6. Unauthenticated requests to override endpoints return 401
    const unauthRes1 = await fetch(`${baseUrl}/attendance/${recId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_status: "LATE", reason_code: "FACULTY_OVERRIDE" }),
    });
    assert.equal(unauthRes1.status, 401);

    const unauthRes2 = await fetch(`${baseUrl}/faculty/attendance/records/${recId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_status: "LATE", reason_code: "FACULTY_OVERRIDE" }),
    });
    assert.equal(unauthRes2.status, 401);
  } finally {
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [sess.insertId]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [sess.insertId]);
  }
});

test("FEAT-017 Regression: Admin Attendance Correction workflow remains fully operational with audit trail", async () => {
  // Create a closed session with an attendance record
  const [sess] = await pool.query(
    `INSERT INTO class_sessions (slot_id, session_date, faculty_id, classroom_id, scheduled_start, scheduled_end, present_until, late_until, status)
     VALUES (1, '2026-11-22', 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 20 MINUTE), 'CLOSED')`,
  );
  const [rec] = await pool.query(
    "INSERT INTO attendance_records (session_id, enrollment_id, status, source, marked_at) VALUES (?, 1, 'ABSENT', 'MANUAL', NOW())",
    [sess.insertId],
  );
  const recId = rec.insertId;

  try {
    // Admin calls POST /attendance/:id/override
    const overrideRes = await fetch(`${baseUrl}/attendance/${recId}/override`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        new_status: "PRESENT",
        reason_code: "ON_DUTY_LEAVE",
        reason_note: "Student was on official university placement duty",
        supporting_ref: "OD_REF_2026_099",
      }),
    });
    const overrideBody = await overrideRes.json();
    assert.equal(overrideRes.status, 200);
    assert.equal(overrideBody.success, true);
    assert.equal(overrideBody.data.previous_status, "ABSENT");
    assert.equal(overrideBody.data.new_status, "PRESENT");
    assert.equal(overrideBody.data.reason_code, "ON_DUTY_LEAVE");
    assert.equal(overrideBody.data.source, "CORRECTION");

    // Verify database record in attendance_records
    const [recordRows] = await pool.query("SELECT status, source FROM attendance_records WHERE attendance_id = ?", [recId]);
    assert.equal(recordRows[0].status, "PRESENT");
    assert.equal(recordRows[0].source, "CORRECTION");

    // Verify audit entry in attendance_corrections table
    const [corrRows] = await pool.query(
      "SELECT * FROM attendance_corrections WHERE attendance_id = ? ORDER BY correction_id DESC LIMIT 1",
      [recId],
    );
    assert.equal(corrRows.length, 1);
    assert.equal(corrRows[0].previous_status, "ABSENT");
    assert.equal(corrRows[0].new_status, "PRESENT");
    assert.equal(corrRows[0].reason_code, "ON_DUTY_LEAVE");
    assert.equal(corrRows[0].supporting_ref, "OD_REF_2026_099");
    assert.equal(corrRows[0].approval_status, "APPROVED");

    // Clean up audit entry
    await pool.query("DELETE FROM attendance_corrections WHERE attendance_id = ?", [recId]);
  } finally {
    await pool.query("DELETE FROM attendance_records WHERE session_id = ?", [sess.insertId]);
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [sess.insertId]);
  }
});

test("Profile RBAC: Admin can view and update profile, whereas Student/Faculty are read-only", async () => {
  const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  const adminLoginBody = await adminLoginRes.json();
  const testAdminToken = adminLoginBody.token;

  const studentLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "J26AIM001", password: "Student@123" }),
  });
  const studentLoginBody = await studentLoginRes.json();
  const testStudentToken = studentLoginBody.token;

  // 1. Admin can GET profile
  const adminProfileRes = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${testAdminToken}` },
  });
  const adminProfileBody = await adminProfileRes.json();
  assert.equal(adminProfileRes.status, 200);
  assert.equal(adminProfileBody.success, true);
  assert.equal(adminProfileBody.data.role, "ADMIN");
  assert.ok(adminProfileBody.data.email);

  // 2. Student can GET profile (read-only institutional record)
  const studentProfileRes = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${testStudentToken}` },
  });
  const studentProfileBody = await studentProfileRes.json();
  assert.equal(studentProfileRes.status, 200);
  assert.equal(studentProfileBody.success, true);
  assert.equal(studentProfileBody.data.role, "STUDENT");
  assert.ok(studentProfileBody.data.register_no);

  // 3. Admin can update their profile (PUT /api/v1/auth/profile)
  const updateAdminRes = await fetch(`${baseUrl}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testAdminToken}`,
    },
    body: JSON.stringify({
      full_name: "Chief Administrator",
      email: "chief.admin@joyuniversity.edu.in",
    }),
  });
  const updateAdminBody = await updateAdminRes.json();
  assert.equal(updateAdminRes.status, 200);
  assert.equal(updateAdminBody.success, true);
  assert.equal(updateAdminBody.data.full_name, "Chief Administrator");
  assert.equal(updateAdminBody.data.email, "chief.admin@joyuniversity.edu.in");

  // Restore admin email & full_name
  await pool.query(
    "UPDATE users SET full_name = 'System Administrator', email = 'admin@joyuniversity.edu.in' WHERE username = 'admin'",
  );

  // 4. Student CANNOT update profile (Strict 403 Forbidden)
  const updateStudentRes = await fetch(`${baseUrl}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testStudentToken}`,
    },
    body: JSON.stringify({
      full_name: "Tampered Name",
      email: "tampered@example.com",
    }),
  });
  const updateStudentBody = await updateStudentRes.json();
  assert.equal(updateStudentRes.status, 403);
  assert.equal(updateStudentBody.success, false);

  // 5. Faculty can GET profile (read-only institutional record)
  const facultyLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "FAC001", password: "Faculty@123" }),
  });
  const facultyLoginBody = await facultyLoginRes.json();
  const testFacultyToken = facultyLoginBody.token;

  const facultyProfileRes = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${testFacultyToken}` },
  });
  const facultyProfileBody = await facultyProfileRes.json();
  assert.equal(facultyProfileRes.status, 200);
  assert.equal(facultyProfileBody.success, true);
  assert.equal(facultyProfileBody.data.role, "FACULTY");
  assert.ok(facultyProfileBody.data.employee_code);

  // 6. Faculty CANNOT update profile (Strict 403 Forbidden)
  const updateFacultyRes = await fetch(`${baseUrl}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testFacultyToken}`,
    },
    body: JSON.stringify({
      full_name: "Faculty Tampered Name",
      email: "facultytampered@example.com",
    }),
  });
  const updateFacultyBody = await updateFacultyRes.json();
  assert.equal(updateFacultyRes.status, 403);
  assert.equal(updateFacultyBody.success, false);
});

test("Designations Reference API: GET /api/v1/designations returns dynamic catalog", async () => {
  // 1. Without token returns 401
  const unauthRes = await fetch(`${baseUrl}/designations`);
  assert.equal(unauthRes.status, 401);

  // 2. With authenticated token returns 200 and dynamic array from database
  const res = await fetch(`${baseUrl}/designations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
  assert.ok(body.data[0].designation_id);
  assert.ok(body.data[0].name);

  // 3. Route alias /staff/designations works identically
  const aliasRes = await fetch(`${baseUrl}/staff/designations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const aliasBody = await aliasRes.json();
  assert.equal(aliasRes.status, 200);
  assert.equal(aliasBody.success, true);
  assert.equal(aliasBody.count, body.count);
});

test("Admin Student Creation with Academic Hierarchy, Demographics & Auth Account", async () => {
  const uniqueReg = `ACAD_REG_${Date.now()}`;
  const studentEmail = `acad_test_${Date.now()}@joyuniversity.edu.in`;

  // 1. Rejects invalid academic hierarchy: batch_id 4 belongs to programme 97, NOT 137
  const mismatchProgRes = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: `${uniqueReg}_MISMATCH`,
      full_name: "Mismatch Prog Student",
      batch_id: 4,
      programme_id: 137, // Mismatch!
    }),
  });
  const mismatchProgBody = await mismatchProgRes.json();
  assert.equal(mismatchProgRes.status, 400);
  assert.equal(mismatchProgBody.success, false);
  assert.match(mismatchProgBody.message, /Selected batch does not belong to the selected programme/i);

  // 2. Rejects invalid section hierarchy: section_id 193 belongs to batch 69, NOT batch 4
  const mismatchSecRes = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: `${uniqueReg}_SEC_MISMATCH`,
      full_name: "Mismatch Sec Student",
      batch_id: 4,
      section_id: 193, // Mismatch!
    }),
  });
  const mismatchSecBody = await mismatchSecRes.json();
  assert.equal(mismatchSecRes.status, 400);
  assert.equal(mismatchSecBody.success, false);
  assert.match(mismatchSecBody.message, /Selected section does not belong to the selected batch/i);

  // 3. Rejects invalid gender
  const invalidGenderRes = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: `${uniqueReg}_INV_GENDER`,
      full_name: "Invalid Gender Student",
      batch_id: 4,
      gender: "robot",
    }),
  });
  const invalidGenderBody = await invalidGenderRes.json();
  assert.equal(invalidGenderRes.status, 400);
  assert.equal(invalidGenderBody.success, false);

  // 4. Successfully creates student with full academic relationships & demographics
  const createRes = await fetch(`${baseUrl}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      register_no: uniqueReg,
      full_name: "Full Academic Student",
      email: studentEmail,
      phone: "+91 9123456789",
      school_id: 3,
      department_id: 5,
      programme_id: 97,
      batch_id: 4,
      section_id: 1,
      gender: "male",
      date_of_birth: "2005-04-12",
      blood_group: "B+",
      status: "ACTIVE",
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const createdId = createBody.data.student_id;
  assert.ok(createdId);
  assert.equal(createBody.data.programme_id, 97);
  assert.equal(createBody.data.section_id, 1);
  assert.equal(createBody.data.section_code, "A");
  assert.equal(createBody.data.gender, "male");

  // 5. GET /api/v1/students/:id returns complete academic details
  const getRes = await fetch(`${baseUrl}/students/${createdId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.success, true);
  assert.equal(getBody.data.register_no, uniqueReg);
  assert.equal(getBody.data.full_name, "Full Academic Student");
  assert.equal(getBody.data.programme_id, 97);
  assert.ok(getBody.data.programme_name);
  assert.equal(getBody.data.department_id, 5);
  assert.ok(getBody.data.department_name);
  assert.equal(getBody.data.school_id, 3);
  assert.ok(getBody.data.school_name);
  assert.equal(getBody.data.batch_id, 4);
  assert.equal(getBody.data.section_id, 1);
  assert.equal(getBody.data.section_code, "A");
  assert.equal(getBody.data.gender, "male");
  assert.equal(getBody.data.blood_group, "B+");

  // 6. Verify newly created student can log into system with default credentials
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: uniqueReg,
      password: "Student@123",
    }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.equal(loginBody.success, true);
  assert.equal(loginBody.data.role, "STUDENT");
  assert.equal(loginBody.data.student_id, createdId);

  // 7. Update student demographics and academic status
  const updateRes = await fetch(`${baseUrl}/students/${createdId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      full_name: "Full Academic Student Renamed",
      blood_group: "O+",
      status: "INTERNSHIP_BREAK",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.success, true);
  assert.equal(updateBody.data.blood_group, "O+");
  assert.equal(updateBody.data.status, "INTERNSHIP_BREAK");

  // 8. Relational Safeguard: Deleting student with active enrollment returns 409
  const deleteWithEnrRes = await fetch(`${baseUrl}/students/${createdId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteWithEnrBody = await deleteWithEnrRes.json();
  assert.equal(deleteWithEnrRes.status, 409);
  assert.equal(deleteWithEnrBody.success, false);
  assert.match(deleteWithEnrBody.message, /related records exist/i);

  // 9. Remove enrollment and verify clean deletion of student & linked user
  const pool = require("../config/mysql");
  await pool.query("DELETE FROM enrollments WHERE student_id = ?", [createdId]);

  const deleteRes = await fetch(`${baseUrl}/students/${createdId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteBody = await deleteRes.json();
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteBody.success, true);

  // 10. Verify student and linked user no longer exist
  const [remainingUser] = await pool.query("SELECT user_id FROM users WHERE username = ?", [uniqueReg]);
  assert.equal(remainingUser.length, 0);
});

test("Degrees Module: Full CRUD Lifecycle, Level Validation & Duplicate Constraint", async () => {
  const pool = require("../config/mysql");
  const uniqueCode = `DEG_${Date.now()}`;

  // 1. Validation: Level must be one of UG, PG, DOCTORAL, DIPLOMA
  const invalidLevelRes = await fetch(`${baseUrl}/degrees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: uniqueCode,
      name: "Invalid Level Degree",
      level: "INVALID_LEVEL",
    }),
  });
  const invalidLevelBody = await invalidLevelRes.json();
  assert.equal(invalidLevelRes.status, 400);
  assert.equal(invalidLevelBody.success, false);

  // 2. Create valid Degree
  const createRes = await fetch(`${baseUrl}/degrees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: uniqueCode,
      name: "Bachelor of Technology Test",
      level: "UG",
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const degreeId = createBody.data.degree_id;
  assert.ok(degreeId);
  assert.equal(createBody.data.code, uniqueCode);
  assert.equal(createBody.data.level, "UG");

  // 3. Duplicate Code Check: Returns 409
  const dupRes = await fetch(`${baseUrl}/degrees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: uniqueCode,
      name: "Duplicate Degree Code",
      level: "UG",
    }),
  });
  const dupBody = await dupRes.json();
  assert.equal(dupRes.status, 409);
  assert.equal(dupBody.success, false);

  // 4. GET /api/v1/degrees/:id
  const getRes = await fetch(`${baseUrl}/degrees/${degreeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.data.code, uniqueCode);
  assert.equal(getBody.data.name, "Bachelor of Technology Test");

  // 5. PUT /api/v1/degrees/:id
  const updateRes = await fetch(`${baseUrl}/degrees/${degreeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Bachelor of Technology Updated",
      level: "UG",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.data.name, "Bachelor of Technology Updated");

  // 6. DELETE /api/v1/degrees/:id
  const deleteRes = await fetch(`${baseUrl}/degrees/${degreeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteBody = await deleteRes.json();
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteBody.success, true);

  // Cleanup verify
  const [remaining] = await pool.query("SELECT degree_id FROM degrees WHERE degree_id = ?", [degreeId]);
  assert.equal(remaining.length, 0);
});

test("Faculty Module: Full Demographics, Auth Sync, Default Login & Soft Deactivation", async () => {
  const pool = require("../config/mysql");
  const uniqueCode = `EMP_${Date.now()}`;
  const uniqueEmail = `faculty_${Date.now()}@test.smartcampus.edu`;

  // 1. Create Faculty with full demographics
  const createRes = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      employee_code: uniqueCode,
      full_name: "Dr. Full Demographics Professor",
      email: uniqueEmail,
      phone: "+91-9876543210",
      gender: "female",
      date_of_birth: "1988-08-20",
      blood_group: "O+",
      joining_year: 2022,
      in_charge_class: "Sec-A CS",
      designation_id: 1,
      school_id: 3,
      department_id: 5,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const facultyId = createBody.data.faculty_id;
  assert.ok(facultyId);
  assert.equal(createBody.data.phone, "+91-9876543210");
  assert.equal(createBody.data.gender, "female");
  assert.equal(createBody.data.blood_group, "O+");
  assert.equal(createBody.data.joining_year, 2022);
  assert.equal(createBody.data.in_charge_class, "Sec-A CS");

  // 2. Verify faculty can log into system with employee code and default password
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: uniqueCode,
      password: "Faculty@123",
    }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.equal(loginBody.success, true);
  assert.equal(loginBody.data.role, "FACULTY");
  assert.equal(loginBody.data.faculty_id, facultyId);

  // 3. Update faculty demographics and verify synchronized to users table
  const updateRes = await fetch(`${baseUrl}/staff/t/${facultyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      phone: "+91-9999888877",
      blood_group: "AB+",
      in_charge_class: "Sec-B CS",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.data.phone, "+91-9999888877");
  assert.equal(updateBody.data.blood_group, "AB+");
  assert.equal(updateBody.data.in_charge_class, "Sec-B CS");

  // 4. Soft deactivate faculty and verify synced to users table
  const deleteRes = await fetch(`${baseUrl}/staff/t/${facultyId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteBody = await deleteRes.json();
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteBody.success, true);

  // Verify is_active = 0 in faculty and users
  const [fRow] = await pool.query("SELECT is_active FROM faculty WHERE faculty_id = ?", [facultyId]);
  assert.equal(fRow[0].is_active, 0);
  const [uRow] = await pool.query("SELECT is_active FROM users WHERE faculty_id = ?", [facultyId]);
  assert.equal(uRow[0].is_active, 0);

  // Clean up
  await pool.query("DELETE FROM users WHERE faculty_id = ?", [facultyId]);
  await pool.query("DELETE FROM faculty WHERE faculty_id = ?", [facultyId]);
});

test("Classroom Module: Department Association, Validation & Infrastructure Query Projections", async () => {
  const pool = require("../config/mysql");
  const uniqueRoom = `R-${Date.now().toString().slice(-4)}`;

  // 1. Validation: Rejects invalid department_id
  const invalidDeptRes = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      block_id: 1,
      room_no: uniqueRoom,
      room_type: "CLASSROOM",
      department_id: 99999,
      capacity: 45,
    }),
  });
  const invalidDeptBody = await invalidDeptRes.json();
  assert.equal(invalidDeptRes.status, 400);
  assert.equal(invalidDeptBody.success, false);
  assert.match(invalidDeptBody.message, /department/i);

  // 2. Create Classroom with valid department_id
  const createRes = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      block_id: 1,
      room_no: uniqueRoom,
      department_id: 5,
      room_type: "LAB",
      capacity: 50,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const roomId = createBody.data.classroom_id;
  assert.ok(roomId);
  assert.equal(createBody.data.department_id, 5);
  assert.equal(createBody.data.room_type, "LAB");

  // 3. GET /api/v1/classrooms/:id verifies department joins
  const getRes = await fetch(`${baseUrl}/classrooms/${roomId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.data.room_no, uniqueRoom);
  assert.equal(getBody.data.department_id, 5);
  assert.ok(getBody.data.department_name);
  assert.ok(getBody.data.block_name);

  // 4. Update classroom
  const updateRes = await fetch(`${baseUrl}/classrooms/${roomId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      capacity: 65,
      room_type: "SMART_CLASSROOM",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.data.capacity, 65);
  assert.equal(updateBody.data.room_type, "SMART_CLASSROOM");

  // 5. Clean up
  await pool.query("DELETE FROM classrooms WHERE classroom_id = ?", [roomId]);
});
