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
// FEAT-008: Campus Block & Classroom Management (CRUD) Tests
// =============================================================================

// --- Block Authentication & RBAC ---
test("Block CRUD: GET /api/v1/blocks without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/blocks`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Block CRUD: GET /api/v1/blocks/:id without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/blocks/1`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Block CRUD RBAC: POST /api/v1/blocks with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ code: "BLKTST", name: "Student Block" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Block CRUD RBAC: PUT /api/v1/blocks/:id with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/blocks/1`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ name: "Unauthorized Update" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Block CRUD RBAC: DELETE /api/v1/blocks/:id with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/blocks/1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

// --- Block Validation, Conflicts, and Not Found ---
test("Block CRUD Validation: POST /api/v1/blocks requires code and name", async () => {
  const res = await fetch(`${baseUrl}/blocks`, {
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
  assert.match(body.message, /code and name are required/i);
});

test("Block CRUD Not Found: GET, PUT, and DELETE on non-existent block return 404", async () => {
  const nonExistentId = 999999;

  const getRes = await fetch(`${baseUrl}/blocks/${nonExistentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getRes.status, 404);
  assert.equal((await getRes.json()).success, false);

  const putRes = await fetch(`${baseUrl}/blocks/${nonExistentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name: "Non-existent" }),
  });
  assert.equal(putRes.status, 404);
  assert.equal((await putRes.json()).success, false);

  const delRes = await fetch(`${baseUrl}/blocks/${nonExistentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 404);
  assert.equal((await delRes.json()).success, false);
});

// --- Block Full Lifecycle (List, Filter/Search, Create, Duplicate Conflict, Update, Deactivate, Repeat Deactivation) ---
test("Block CRUD Full Lifecycle: List, Search, Filter, Create, Duplicate Conflict, Update, Deactivate", async () => {
  const uniqueCode = `B${Date.now().toString().slice(-6)}`;
  const uniqueName = `Block_Test_${Date.now()}`;

  // 1. Create a block as ADMIN
  const createRes = await fetch(`${baseUrl}/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: uniqueCode,
      name: uniqueName,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  assert.equal(createBody.data.code, uniqueCode);
  assert.equal(createBody.data.name, uniqueName);
  const createdBlockId = createBody.data.block_id;
  assert.ok(createdBlockId);

  // 2. Duplicate code conflict returns 409
  const dupCodeRes = await fetch(`${baseUrl}/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: uniqueCode,
      name: `Different_Name_${Date.now()}`,
    }),
  });
  assert.equal(dupCodeRes.status, 409);
  assert.equal((await dupCodeRes.json()).success, false);

  // 3. Duplicate name conflict returns 409
  const dupNameRes = await fetch(`${baseUrl}/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      code: `DIFF${Date.now().toString().slice(-4)}`,
      name: uniqueName,
    }),
  });
  assert.equal(dupNameRes.status, 409);
  assert.equal((await dupNameRes.json()).success, false);

  // 4. Retrieve block by ID
  const getRes = await fetch(`${baseUrl}/blocks/${createdBlockId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.success, true);
  assert.equal(getBody.data.block_id, createdBlockId);
  assert.equal(getBody.data.code, uniqueCode);

  // 5. Search filter finds the created block
  const searchRes = await fetch(`${baseUrl}/blocks?search=${uniqueCode}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const searchBody = await searchRes.json();
  assert.equal(searchRes.status, 200);
  assert.ok(searchBody.data.some((b) => b.block_id === createdBlockId));

  // 6. Active status filter works
  const activeRes = await fetch(`${baseUrl}/blocks?is_active=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const activeBody = await activeRes.json();
  assert.equal(activeRes.status, 200);
  assert.ok(activeBody.data.every((b) => b.is_active === 1));

  // 7. Update block
  const updatedName = `${uniqueName}_Updated`;
  const updateRes = await fetch(`${baseUrl}/blocks/${createdBlockId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: updatedName,
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.success, true);
  assert.equal(updateBody.data.name, updatedName);

  // 8. Soft deactivate block
  const delRes = await fetch(`${baseUrl}/blocks/${createdBlockId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const delBody = await delRes.json();
  assert.equal(delRes.status, 200);
  assert.equal(delBody.success, true);
  assert.match(delBody.message, /deactivated successfully/i);

  // 9. Verify block is inactive
  const verifyRes = await fetch(`${baseUrl}/blocks/${createdBlockId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const verifyBody = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyBody.data.is_active, 0);

  // 10. Repeated deactivation is rejected with 400
  const repeatDelRes = await fetch(`${baseUrl}/blocks/${createdBlockId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(repeatDelRes.status, 400);
  assert.match((await repeatDelRes.json()).message, /already inactive/i);
});

// --- Classroom Authentication & RBAC ---
test("Classroom CRUD: GET /api/v1/classrooms without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/classrooms`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Classroom CRUD: GET /api/v1/classrooms/:id without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/classrooms/1`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Authorization token is required");
});

test("Classroom CRUD RBAC: POST /api/v1/classrooms with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      block_id: 1,
      department_id: 1,
      room_no: "STU101",
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Classroom CRUD RBAC: PUT /api/v1/classrooms/:id with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/classrooms/1`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ room_no: "UNAUTH101" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

test("Classroom CRUD RBAC: DELETE /api/v1/classrooms/:id with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/classrooms/1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.match(body.message, /permission|forbidden|access denied/i);
});

// --- Classroom Validation: Required fields, Foreign keys, Inactive block, Capacity ---
test("Classroom CRUD Validation: POST /api/v1/classrooms requires block_id, department_id, and room_no", async () => {
  const res = await fetch(`${baseUrl}/classrooms`, {
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

test("Classroom CRUD Validation: POST /api/v1/classrooms rejects invalid block_id", async () => {
  const res = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      block_id: 999999,
      department_id: 1,
      room_no: `INV_BLK_${Date.now()}`,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /invalid block_id/i);
});

test("Classroom CRUD Validation: POST /api/v1/classrooms rejects invalid department_id", async () => {
  const res = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      block_id: 1,
      department_id: 999999,
      room_no: `INV_DEPT_${Date.now()}`,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /invalid department_id/i);
});

test("Classroom CRUD Validation: POST /api/v1/classrooms rejects assigning classroom to inactive block", async () => {
  // Block 3 is inactive in test db (is_active = 0)
  const res = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      block_id: 3,
      department_id: 1,
      room_no: `INACT_BLK_${Date.now()}`,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /inactive block/i);
});

test("Classroom CRUD Validation: POST /api/v1/classrooms rejects invalid capacity values", async () => {
  for (const invalidCapacity of [-10, 0, "not-a-number", 12.5]) {
    const res = await fetch(`${baseUrl}/classrooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        block_id: 1,
        department_id: 1,
        room_no: `CAP_TEST_${Date.now()}`,
        capacity: invalidCapacity,
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, `Expected 400 for capacity ${invalidCapacity}`);
    assert.equal(body.success, false);
    assert.match(body.message, /positive integer/i);
  }
});

test("Classroom CRUD Not Found: GET, PUT, and DELETE on non-existent classroom return 404", async () => {
  const nonExistentId = 999999;

  const getRes = await fetch(`${baseUrl}/classrooms/${nonExistentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getRes.status, 404);
  assert.equal((await getRes.json()).success, false);

  const putRes = await fetch(`${baseUrl}/classrooms/${nonExistentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ room_no: "NonExistentRoom" }),
  });
  assert.equal(putRes.status, 404);
  assert.equal((await putRes.json()).success, false);

  const delRes = await fetch(`${baseUrl}/classrooms/${nonExistentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 404);
  assert.equal((await delRes.json()).success, false);
});

// --- Classroom Full Lifecycle: List with joins, Filters, Create, Duplicate Check, Update, Deactivate, Repeat Deactivation ---
test("Classroom CRUD Full Lifecycle: List with joins, Filter, Create, Duplicate Conflict, Update, Deactivate", async () => {
  // 1. List classrooms with block and department joins
  const listRes = await fetch(`${baseUrl}/classrooms`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.equal(listBody.success, true);
  assert.ok(Array.isArray(listBody.data));
  assert.ok(listBody.data.length > 0);
  // Verify joined metadata
  const firstRoom = listBody.data[0];
  assert.ok(firstRoom.block_name);
  assert.ok(firstRoom.department_name);

  // 2. Create a new classroom linked to block 1 and department 1
  const uniqueRoomNo = `R${Date.now().toString().slice(-5)}`;
  const createRes = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      block_id: 1,
      department_id: 1,
      room_no: uniqueRoomNo,
      room_type: "SMART_CLASSROOM",
      capacity: 75,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const createdClassroomId = createBody.data.classroom_id;
  assert.ok(createdClassroomId);
  assert.equal(createBody.data.room_no, uniqueRoomNo);
  assert.equal(createBody.data.room_type, "SMART_CLASSROOM");
  assert.equal(createBody.data.capacity, 75);
  assert.equal(createBody.data.block_id, 1);
  assert.equal(createBody.data.department_id, 1);
  assert.ok(createBody.data.block_name);
  assert.ok(createBody.data.department_name);

  // 3. Duplicate room_no in same block returns 409
  const dupRes = await fetch(`${baseUrl}/classrooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      block_id: 1,
      department_id: 1,
      room_no: uniqueRoomNo,
    }),
  });
  const dupBody = await dupRes.json();
  assert.equal(dupRes.status, 409);
  assert.equal(dupBody.success, false);
  assert.match(dupBody.message, /already exists in this block/i);

  // 4. Retrieve created classroom by ID
  const getRes = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.success, true);
  assert.equal(getBody.data.classroom_id, createdClassroomId);
  assert.equal(getBody.data.room_no, uniqueRoomNo);
  assert.ok(getBody.data.block_name);
  assert.ok(getBody.data.department_name);

  // 5. Query filtering by block_id, department_id, and search
  const filteredRes = await fetch(`${baseUrl}/classrooms?block_id=1&department_id=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const filteredBody = await filteredRes.json();
  assert.equal(filteredRes.status, 200);
  assert.ok(filteredBody.data.every((c) => c.block_id === 1 && c.department_id === 1));

  const searchRes = await fetch(`${baseUrl}/classrooms?search=${uniqueRoomNo}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const searchBody = await searchRes.json();
  assert.equal(searchRes.status, 200);
  assert.ok(searchBody.data.some((c) => c.classroom_id === createdClassroomId));

  // 6. Update classroom attributes
  const updatedRoomNo = `${uniqueRoomNo}_U`;
  const updateRes = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      room_no: updatedRoomNo,
      capacity: 80,
      room_type: "LAB",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.success, true);
  assert.equal(updateBody.data.room_no, updatedRoomNo);
  assert.equal(updateBody.data.capacity, 80);
  assert.equal(updateBody.data.room_type, "LAB");
  assert.ok(updateBody.data.block_name);
  assert.ok(updateBody.data.department_name);

  // 7. Soft deactivate classroom
  const delRes = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const delBody = await delRes.json();
  assert.equal(delRes.status, 200);
  assert.equal(delBody.success, true);
  assert.match(delBody.message, /deactivated successfully/i);

  // 8. Verify classroom is inactive
  const verifyRes = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const verifyBody = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyBody.data.is_active, 0);

  // 9. Repeated deactivation is rejected with 400
  const repeatDelRes = await fetch(`${baseUrl}/classrooms/${createdClassroomId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(repeatDelRes.status, 400);
  assert.match((await repeatDelRes.json()).message, /already inactive/i);
});



