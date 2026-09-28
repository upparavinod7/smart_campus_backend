const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../app");

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

test.after((t, done) => {
  server.close(done);
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
