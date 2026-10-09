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
    // Clean up created record
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






