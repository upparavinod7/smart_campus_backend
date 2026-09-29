const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../app");
const pool = require("../config/mysql");

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

// FEAT-006: Faculty and Staff Management (CRUD) & Authorization Tests
test("Staff/Faculty CRUD RBAC: GET /api/v1/staff/t without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/staff/t`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("Staff/Faculty CRUD RBAC: POST /api/v1/staff/t without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee_code: "FAC_RBAC_1", full_name: "Test Faculty" }),
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("Staff/Faculty CRUD RBAC: POST /api/v1/staff/t with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ employee_code: "FAC_RBAC_2", full_name: "Test Faculty" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("Staff/Faculty CRUD RBAC: PUT /api/v1/staff/t/1 with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/staff/t/1`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ full_name: "Unauthorized Update" }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("Staff/Faculty CRUD RBAC: DELETE /api/v1/staff/t/1 with STUDENT role returns 403", async () => {
  const res = await fetch(`${baseUrl}/staff/t/1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("Staff/Faculty CRUD RBAC: GET /api/v1/faculty without token returns 401", async () => {
  const res = await fetch(`${baseUrl}/faculty`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("Staff/Faculty CRUD Validation: POST /api/v1/staff/t requires employee_code and full_name", async () => {
  const res = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ employee_code: "ONLY_CODE" }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /required/i);
});

test("Staff/Faculty CRUD Validation: POST /api/v1/staff/t rejects invalid department_id", async () => {
  const res = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      employee_code: `FAC_INV_DEP_${Date.now()}`,
      full_name: "Invalid Dep Faculty",
      department_id: 999999,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Invalid department_id");
});

test("Staff/Faculty CRUD Validation: POST /api/v1/staff/t rejects invalid designation_id", async () => {
  const res = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      employee_code: `FAC_INV_DESG_${Date.now()}`,
      full_name: "Invalid Desg Faculty",
      department_id: 1,
      designation_id: 999999,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Invalid designation_id");
});

test("Staff/Faculty CRUD Full Lifecycle: List, Create, Duplicate Check, GetById, Update, Deactivate, Inactive Check", async () => {
  // 1. List faculty via /staff/t and /faculty as ADMIN
  const listStaffRes = await fetch(`${baseUrl}/staff/t`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listStaffBody = await listStaffRes.json();
  assert.equal(listStaffRes.status, 200);
  assert.equal(listStaffBody.success, true);
  assert.ok(Array.isArray(listStaffBody.data));

  const listFacultyRes = await fetch(`${baseUrl}/faculty`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listFacultyBody = await listFacultyRes.json();
  assert.equal(listFacultyRes.status, 200);
  assert.equal(listFacultyBody.success, true);
  assert.ok(Array.isArray(listFacultyBody.data));

  // 2. Create a new faculty member
  const uniqueCode = `FAC_TEST_${Date.now()}`;
  const uniqueEmail = `faculty_${Date.now()}@joyuniversity.edu.in`;
  const createRes = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      employee_code: uniqueCode,
      full_name: "Dr. Alan Turing",
      email: uniqueEmail,
      designation_id: 1,
      department_id: 1,
      is_active: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  const createdId = createBody.data.faculty_id;
  assert.ok(createdId);

  // 3. Duplicate employee_code returns 409
  const dupCodeRes = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      employee_code: uniqueCode,
      full_name: "Duplicate Code Faculty",
      department_id: 1,
    }),
  });
  const dupCodeBody = await dupCodeRes.json();
  assert.equal(dupCodeRes.status, 409);
  assert.equal(dupCodeBody.success, false);
  assert.equal(dupCodeBody.message, "Employee code already exists");

  // 4. Duplicate email returns 409
  const dupEmailRes = await fetch(`${baseUrl}/staff/t`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      employee_code: `FAC_DIFF_${Date.now()}`,
      full_name: "Duplicate Email Faculty",
      email: uniqueEmail,
      department_id: 1,
    }),
  });
  const dupEmailBody = await dupEmailRes.json();
  assert.equal(dupEmailRes.status, 409);
  assert.equal(dupEmailBody.success, false);
  assert.equal(dupEmailBody.message, "Email already exists");

  // 5. Retrieve faculty member by ID (with joined details)
  const getRes = await fetch(`${baseUrl}/staff/t/${createdId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.success, true);
  assert.equal(getBody.data.employee_code, uniqueCode);
  assert.equal(getBody.data.full_name, "Dr. Alan Turing");
  assert.equal(getBody.data.email, uniqueEmail);
  assert.equal(getBody.data.is_active, 1);
  assert.ok(getBody.data.designation_name);
  assert.ok(getBody.data.department_name);
  assert.ok(getBody.data.school_name);
  // Ensure no password or sensitive hash fields exist
  assert.equal(getBody.data.password, undefined);
  assert.equal(getBody.data.password_hash, undefined);

  // 6. Update faculty member record
  const updateRes = await fetch(`${baseUrl}/staff/t/${createdId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      full_name: "Dr. Alan M. Turing",
      designation_id: 2,
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.success, true);
  assert.equal(updateBody.data.full_name, "Dr. Alan M. Turing");
  assert.equal(updateBody.data.designation_id, 2);

  // 7. Deactivate faculty member
  const deleteRes = await fetch(`${baseUrl}/staff/t/${createdId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const deleteBody = await deleteRes.json();
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteBody.success, true);
  assert.equal(deleteBody.message, "Faculty member deactivated successfully");

  // 8. Attempting to deactivate again returns 400
  const repeatDeleteRes = await fetch(`${baseUrl}/staff/t/${createdId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const repeatDeleteBody = await repeatDeleteRes.json();
  assert.equal(repeatDeleteRes.status, 400);
  assert.equal(repeatDeleteBody.success, false);
  assert.equal(repeatDeleteBody.message, "Faculty member is already inactive");

  // 9. Verify is_active is now 0
  const verifyRes = await fetch(`${baseUrl}/staff/t/${createdId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const verifyBody = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyBody.data.is_active, 0);
});

