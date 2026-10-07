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



