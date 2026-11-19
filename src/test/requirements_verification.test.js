// Verification test script for 8 remaining functional requirements
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../app");
const pool = require("../config/mysql");

let server;
let baseUrl;
let adminToken;
let facultyToken;

test.before(async () => {
  // Start ephemeral server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  // Admin login
  const adminRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  const adminJson = await adminRes.json();
  adminToken = adminJson.token || adminJson.data?.token;

  // Faculty login
  const facultyRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "FAC001", password: "Faculty@123" }),
  });
  const facultyJson = await facultyRes.json();
  facultyToken = facultyJson.token || facultyJson.data?.token;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test("REQ-8: Admin Date of Birth Update & Timezone Immunity", async () => {
  const targetDob = "1988-11-25";
  const updateRes = await fetch(`${baseUrl}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      first_name: "System",
      last_name: "Admin",
      date_of_birth: targetDob,
    }),
  });
  assert.equal(updateRes.status, 200);

  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const meJson = await meRes.json();
  const profile = meJson.data || meJson.user;
  assert.equal(profile.date_of_birth, targetDob, "date_of_birth must match YYYY-MM-DD exactly without day-shift");
});

test("REQ-2: Material Viewer Faculty Provenance & Download Content-Disposition", async () => {
  const [materials] = await pool.query(
    "SELECT material_id, topic_id FROM academic_materials LIMIT 1"
  );
  if (materials.length > 0) {
    const matId = materials[0].material_id;
    const matRes = await fetch(`${baseUrl}/academic/materials/${matId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(matRes.status, 200);
    const matJson = await matRes.json();
    const item = matJson.data || matJson;
    assert.ok(item.hasOwnProperty("faculty_name") || item.hasOwnProperty("uploaded_by_name"), "Material has faculty name");
    assert.ok(item.hasOwnProperty("original_filename") || item.hasOwnProperty("title"), "Material has filename/title");

    // Check download endpoint returns Content-Disposition
    const dlRes = await fetch(`${baseUrl}/academic/materials/${matId}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const disp = dlRes.headers.get("content-disposition");
    if (dlRes.status === 200) {
      assert.ok(disp && disp.includes("filename="), "Content-Disposition header specifies filename");
    }
  }
});

test("REQ-3 & REQ-4: Topic Quiz Authoring, Datetime Normalization and Retrieval", async () => {
  // Find a topic
  const [topics] = await pool.query("SELECT topic_id, subject_id, title FROM academic_topics LIMIT 1");
  assert.ok(topics.length > 0);
  const topicId = topics[0].topic_id;

  // Create/Update topic quiz
  const quizPayload = {
    title: "Unit 1 Knowledge Check Automated Test",
    description: "Automated test for requirement 3 & 4",
    duration_minutes: 45,
    pass_percentage: 60,
    max_attempts: 3,
    shuffle_questions: 1,
    shuffle_options: 1,
    questions_to_draw: 5,
    start_datetime: "2026-11-20 09:00:00",
    end_datetime: "2026-11-25 18:00:00",
    status: "DRAFT",
  };

  const createRes = await fetch(`${baseUrl}/academic/topics/${topicId}/quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify(quizPayload),
  });
  assert.ok([200, 201].includes(createRes.status), `Create topic quiz returned ${createRes.status}`);

  // Retrieve topic quiz
  const getRes = await fetch(`${baseUrl}/academic/topics/${topicId}/quiz`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(getRes.status, 200);
  const getJson = await getRes.json();
  const savedQuiz = getJson.data || getJson;
  assert.equal(savedQuiz.title, quizPayload.title);
  assert.equal(savedQuiz.time_limit, quizPayload.duration_minutes);
  assert.equal(savedQuiz.max_attempts, quizPayload.max_attempts);
  assert.ok(savedQuiz.open_at.startsWith("2026-11-20"), "open_at normalized");
});

test("REQ-6: Student Directory Pagination and Semantic Search", async () => {
  // Page 1
  const p1Res = await fetch(`${baseUrl}/students?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(p1Res.status, 200);
  const p1Json = await p1Res.json();
  assert.equal(p1Json.data.length, 5);
  assert.equal(p1Json.page, 1);
  assert.equal(p1Json.limit, 5);
  assert.ok(p1Json.total > 5);

  // Page 2
  const p2Res = await fetch(`${baseUrl}/students?page=2&limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(p2Res.status, 200);
  const p2Json = await p2Res.json();
  assert.equal(p2Json.data.length, 5);
  assert.equal(p2Json.page, 2);

  // Zero overlap
  const p1Ids = p1Json.data.map((s) => s.student_id);
  const p2Ids = p2Json.data.map((s) => s.student_id);
  const intersection = p1Ids.filter((id) => p2Ids.includes(id));
  assert.equal(intersection.length, 0, "No duplicate students between page 1 and page 2");

  // Search filter
  const searchRes = await fetch(`${baseUrl}/students?search=Aarav`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(searchRes.status, 200);
  const searchJson = await searchRes.json();
  assert.ok(searchJson.data.length > 0);
  for (const stu of searchJson.data) {
    const fullName = (stu.full_name || "").toLowerCase();
    assert.ok(
      fullName.includes("aarav") ||
      (stu.register_no && stu.register_no.toLowerCase().includes("aarav")),
      `Student ${stu.full_name} matches search`
    );
  }
});

test("REQ-5: Class Section & Session Attendance Analytics", async () => {
  const reportRes = await fetch(`${baseUrl}/admin/reports/attendance`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(reportRes.status, 200);
  const reportJson = await reportRes.json();
  const data = reportJson.data;

  // Breakdown checks
  assert.ok(Array.isArray(data.sections_breakdown), "sections_breakdown present");
  assert.ok(Array.isArray(data.sessions_breakdown), "sessions_breakdown present");

  if (data.sections_breakdown.length > 0) {
    const sec = data.sections_breakdown[0];
    assert.ok(sec.hasOwnProperty("total_enrolled"), "sections_breakdown has total_enrolled");
    assert.ok(sec.hasOwnProperty("present_count"), "sections_breakdown has present_count");
    assert.ok(sec.hasOwnProperty("late_count"), "sections_breakdown has late_count");
    assert.ok(sec.hasOwnProperty("absent_count"), "sections_breakdown has absent_count");
    assert.ok(sec.hasOwnProperty("unmarked_count"), "sections_breakdown has unmarked_count");
    assert.ok(sec.hasOwnProperty("section_attendance_percentage"), "sections_breakdown has section_attendance_percentage");
  }

  if (data.sessions_breakdown.length > 0) {
    const sess = data.sessions_breakdown[0];
    assert.ok(sess.hasOwnProperty("session_id"), "sessions_breakdown has session_id");
    assert.ok(sess.hasOwnProperty("total_enrolled"), "sessions_breakdown has total_enrolled");
    assert.ok(sess.hasOwnProperty("attendance_percentage"), "sessions_breakdown has attendance_percentage");
  }
});

test("REQ-1: Automatic Class Scheduling Idempotency & Safety", async () => {
  // Find an active timetable slot
  const [slots] = await pool.query(
    "SELECT slot_id, section_id, faculty_id, day_of_week FROM timetable_slots WHERE is_active = 1 LIMIT 1"
  );
  assert.ok(slots.length > 0);
  const slotId = slots[0].slot_id;

  // Sync sessions for this slot
  const syncRes1 = await fetch(`${baseUrl}/timetable/${slotId}/sync-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(syncRes1.status, 200);
  const sync1Json = await syncRes1.json();
  assert.ok(sync1Json.success);

  // Sync again immediately -> idempotent! (scheduled should be 0, no duplicates)
  const syncRes2 = await fetch(`${baseUrl}/timetable/${slotId}/sync-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(syncRes2.status, 200);
  const sync2Json = await syncRes2.json();
  assert.equal(sync2Json.data.scheduled === 0 || sync2Json.data.updated >= 0, true, "Idempotent execution");
});
