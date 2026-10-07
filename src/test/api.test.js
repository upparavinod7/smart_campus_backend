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



