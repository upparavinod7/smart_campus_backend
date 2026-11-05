const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../app");
const pool = require("../config/mysql");

let server;
let baseUrl;
let adminToken;
let facultyToken;
let studentToken;

let testSubjectId;
let testTopicId;
let testMaterialId;
let testQuizId;
let testQuestionId;
let testAttemptId;
let facultyId;
let studentUserId;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      resolve();
    });
  });

  // Login admin
  const adminRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "Admin@123" }),
  });
  const adminData = await adminRes.json();
  adminToken = adminData.token;

  // Login faculty
  const facultyRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "FAC001", password: "Faculty@123" }),
  });
  const facultyData = await facultyRes.json();
  facultyToken = facultyData.token;
  facultyId = facultyData.data.faculty_id;

  // Login student
  const studentRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "J26AIM001", password: "Student@123" }),
  });
  const studentData = await studentRes.json();
  studentToken = studentData.token;
  studentUserId = studentData.data.user_id;

  // Find a subject where the student is enrolled
  const [enrolledSubjects] = await pool.query(
    `SELECT s.subject_id 
     FROM subjects s
     JOIN course_offerings co ON s.subject_id = co.subject_id
     JOIN sections sec ON co.offering_id = sec.offering_id
     JOIN enrollments e ON sec.section_id = e.section_id
     WHERE e.student_id = ? AND e.status = 'REGISTERED'
     LIMIT 1`,
    [studentData.data.student_id],
  );

  if (enrolledSubjects.length > 0) {
    testSubjectId = enrolledSubjects[0].subject_id;
  } else {
    // If not found, fallback to first subject and register student enrollment for testing
    const [allSubs] = await pool.query("SELECT subject_id FROM subjects LIMIT 1");
    testSubjectId = allSubs[0].subject_id;
  }
});

test.after(async () => {
  // Cleanup test topic and cascading academic records created during test
  if (testTopicId) {
    await pool.query("DELETE FROM academic_topics WHERE topic_id = ?", [testTopicId]);
  }
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test("Academic OpenAPI Spec: GET /api/v1/academic/openapi.json", async () => {
  const res = await fetch(`${baseUrl}/academic/openapi.json`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.openapi, "3.0.3");
  assert.equal(body.info.title, "Smart Campus Academic Module API");
  assert.ok(body.paths["/subjects"]);
  assert.ok(body.paths["/quizzes/{id}/attempts"]);
});

test("Academic Policy Matrix: GET & PUT /api/v1/academic/permissions", async () => {
  // Get permissions list
  const getRes = await fetch(`${baseUrl}/academic/permissions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.ok(Array.isArray(getBody.data));
  assert.ok(getBody.data.length >= 8);

  // Student cannot update permissions (403)
  const studentPut = await fetch(`${baseUrl}/academic/permissions/MANAGE_TOPICS`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: "Unauthorized change" }),
  });
  assert.equal(studentPut.status, 403);

  // Admin updates permission
  const adminPut = await fetch(`${baseUrl}/academic/permissions/MANAGE_TOPICS`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: "Create, edit, and manage topics for assigned subjects" }),
  });
  assert.equal(adminPut.status, 200);
});

test("Academic Subjects RBAC: GET /api/v1/academic/subjects", async () => {
  // Unauthenticated returns 401
  const unauthRes = await fetch(`${baseUrl}/academic/subjects`);
  assert.equal(unauthRes.status, 401);

  // Admin sees all subjects
  const adminRes = await fetch(`${baseUrl}/academic/subjects`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminBody = await adminRes.json();
  assert.equal(adminRes.status, 200);
  assert.ok(adminBody.data.length > 0);

  // Student sees their enrolled subjects
  const studentRes = await fetch(`${baseUrl}/academic/subjects`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentBody = await studentRes.json();
  assert.equal(studentRes.status, 200);
  assert.ok(studentBody.data.length > 0);
});

test("Academic Staff Assignment: POST & DELETE /api/v1/academic/subjects/:id/staff", async () => {
  // Assign faculty to test subject
  const assignRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}/staff`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ faculty_id: facultyId, role: "Subject Staff" }),
  });
  const assignBody = await assignRes.json();
  assert.equal(assignRes.status, 201);
  assert.equal(assignBody.success, true);
  assert.ok(assignBody.assignment_id);

  // Get subject details includes staff assignment
  const detailsRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const detailsBody = await detailsRes.json();
  assert.equal(detailsRes.status, 200);
  assert.ok(detailsBody.data.staff.some((s) => s.faculty_id === facultyId));
});

test("Academic Topics Lifecycle: Create, Get, Update, Reorder", async () => {
  // 1. Create topic
  const createRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}/topics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Automated Testing Topic - Neural Networks",
      description: "Comprehensive introduction to artificial neural networks",
      position: 1,
      quiz_enabled: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  testTopicId = createBody.data.topic_id;
  assert.ok(testTopicId);

  // 2. Get Topic Details
  const getRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.data.title, "Automated Testing Topic - Neural Networks");
  assert.ok(getBody.data.quiz_id);
  testQuizId = getBody.data.quiz_id;

  // 3. Update Topic
  const updateRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: "Updated curriculum description" }),
  });
  assert.equal(updateRes.status, 200);

  // 4. Reorder Topics
  const reorderRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}/topics/reorder`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topics: [{ topic_id: testTopicId, position: 2 }],
    }),
  });
  assert.equal(reorderRes.status, 200);
});

test("Study Materials Lifecycle: Create, Publish, Student Visibility, Reorder", async () => {
  // 1. Create Material (Notes)
  const createRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/materials`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Lecture 1: Architecture Notes",
      type: "Notes",
      notes_content: "Perceptrons, Feedforward, Backpropagation fundamentals.",
      required_flag: true,
      status: "Draft",
      position: 1,
    }),
  });
  const createBody = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(createBody.success, true);
  testMaterialId = createBody.data.material_id;
  assert.ok(testMaterialId);

  // 2. Student should NOT see Draft material
  const studentViewDraft = await fetch(`${baseUrl}/academic/topics/${testTopicId}/materials`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentDraftBody = await studentViewDraft.json();
  assert.equal(studentViewDraft.status, 200);
  assert.equal(studentDraftBody.data.length, 0);

  // 3. Publish Material
  const publishRes = await fetch(`${baseUrl}/academic/materials/${testMaterialId}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "Published" }),
  });
  assert.equal(publishRes.status, 200);

  // 4. Student now sees published material with initial progress
  const studentViewPub = await fetch(`${baseUrl}/academic/topics/${testTopicId}/materials`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentPubBody = await studentViewPub.json();
  assert.equal(studentViewPub.status, 200);
  assert.equal(studentPubBody.data.length, 1);
  assert.equal(studentPubBody.data[0].material_id, testMaterialId);
  assert.equal(studentPubBody.data[0].user_progress.status, "NOT_STARTED");
});

test("Question Bank & Quiz Configuration: Authoring & Preview", async () => {
  // 1. Add MCQ question
  const q1Res = await fetch(`${baseUrl}/academic/topics/${testTopicId}/questions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "MCQ",
      text: "What algorithm is primarily used to train neural networks via gradient descent?",
      options: ["Backpropagation", "K-Means", "Dijkstra", "Apriori"],
      answer: "Backpropagation",
      explanation: "Backpropagation calculates gradients of the loss function.",
      marks: 2.0,
      difficulty: "Medium",
      status: "Approved",
    }),
  });
  const q1Body = await q1Res.json();
  assert.equal(q1Res.status, 201);
  testQuestionId = q1Body.data.question_id;

  // 2. Add True/False question
  const q2Res = await fetch(`${baseUrl}/academic/topics/${testTopicId}/questions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "TrueFalse",
      text: "A perceptron can solve linearly non-separable problems such as XOR by itself.",
      options: ["True", "False"],
      answer: "False",
      explanation: "A single layer perceptron is limited to linearly separable functions.",
      marks: 1.0,
      difficulty: "Easy",
      status: "Approved",
    }),
  });
  assert.equal(q2Res.status, 201);

  // 3. Configure and publish the quiz
  const quizConfigRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/quiz`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Neural Networks Assessment",
      time_limit: 15,
      pass_mark: 60.0,
      max_attempts: 2,
      status: "Published",
      shuffle_questions: 1,
      shuffle_options: 1,
      show_explanation: 1,
    }),
  });
  const quizConfigBody = await quizConfigRes.json();
  assert.equal(quizConfigRes.status, 200);
  assert.equal(quizConfigBody.success, true);

  // 4. Staff preview of quiz
  const previewRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/quiz/preview`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const previewBody = await previewRes.json();
  assert.equal(previewRes.status, 200);
  assert.equal(previewBody.data.total_questions, 2);
  assert.equal(previewBody.data.time_limit, 15);
});

test("Quiz Unlock Rules: Enforces Required Material Prerequisite (AC-STU-03)", async () => {
  // Attempting quiz BEFORE completing required material MUST be blocked with 403
  const lockedAttemptRes = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const lockedBody = await lockedAttemptRes.json();
  assert.equal(lockedAttemptRes.status, 403);
  assert.equal(lockedBody.success, false);
  assert.equal(lockedBody.code, "PREREQUISITES_NOT_MET");
  assert.ok(lockedBody.uncompleted_materials.length > 0);

  // Student completes required material (progress = 100%)
  const progRes = await fetch(`${baseUrl}/academic/materials/${testMaterialId}/progress`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ percent: 100 }),
  });
  assert.equal(progRes.status, 200);

  // Now attempting quiz MUST succeed (201)
  const unlockAttemptRes = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const unlockBody = await unlockAttemptRes.json();
  assert.equal(unlockAttemptRes.status, 201);
  assert.equal(unlockBody.success, true);
  testAttemptId = unlockBody.data.attempt_id;
  assert.ok(testAttemptId);
  assert.equal(unlockBody.data.attempt_number, 1);
  assert.ok(unlockBody.data.remaining_seconds > 0);

  // Verify frozen question set does NOT leak correct answers
  for (const q of unlockBody.data.questions) {
    assert.equal(q.answer, undefined);
    assert.equal(q.explanation, undefined);
  }
});

test("Quiz Attempt Engine: Resume, Autosave Answers, and Idempotent Submission", async () => {
  // 1. Resume attempt
  const getAttemptRes = await fetch(`${baseUrl}/academic/attempts/${testAttemptId}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const getAttemptBody = await getAttemptRes.json();
  assert.equal(getAttemptRes.status, 200);
  assert.equal(getAttemptBody.data.status, "IN_PROGRESS");
  assert.ok(getAttemptBody.data.remaining_seconds > 0);

  // 2. Autosave answers
  const saveRes = await fetch(`${baseUrl}/academic/attempts/${testAttemptId}/answers`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question_id: testQuestionId,
      answer: "Backpropagation",
    }),
  });
  const saveBody = await saveRes.json();
  assert.equal(saveRes.status, 200);
  assert.equal(saveBody.saved_count, 1);

  // 3. Final submission
  const submitRes = await fetch(`${baseUrl}/academic/attempts/${testAttemptId}/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: "test_key_attempt_1",
      answers: [
        { question_id: testQuestionId, answer: "Backpropagation" },
      ],
    }),
  });
  const submitBody = await submitRes.json();
  assert.equal(submitRes.status, 200);
  assert.equal(submitBody.success, true);
  assert.equal(submitBody.data.score, 2.0); // 2.0 marks for Q1
  assert.equal(submitBody.data.max_score, 3.0); // 2.0 + 1.0
  assert.equal(submitBody.data.percentage, 66.67);
  assert.equal(submitBody.data.result, "PASSED"); // 66.67% >= 60.0% pass_mark

  // 4. Idempotency test: duplicate submit returns identical score
  const dupSubmitRes = await fetch(`${baseUrl}/academic/attempts/${testAttemptId}/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idempotency_key: "test_key_attempt_1" }),
  });
  const dupSubmitBody = await dupSubmitRes.json();
  assert.equal(dupSubmitRes.status, 200);
  assert.equal(dupSubmitBody.already_submitted, true);
  assert.equal(dupSubmitBody.data.score, 2.0);
});

test("Score Correction with Four-Field Audit Ledger (AC-STAFF-04)", async () => {
  // Correct score to 3.0 with mandatory reason_code and justification
  const correctRes = await fetch(`${baseUrl}/academic/attempts/${testAttemptId}/score-correction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      new_score: 3.0,
      reason_code: "QUESTION_AMBIGUITY_ADJUSTMENT",
      justification: "Full credit granted for question 2 due to alternative wording interpretation.",
    }),
  });
  const correctBody = await correctRes.json();
  assert.equal(correctRes.status, 200);
  assert.equal(correctBody.success, true);
  assert.equal(correctBody.data.new_score, 3.0);
  assert.equal(correctBody.data.percentage, 100);
  assert.equal(correctBody.data.result, "PASSED");

  // Verify Four-Field Event was logged in academic_audit_ledger
  const [ledgerRows] = await pool.query(
    "SELECT * FROM academic_audit_ledger WHERE event_type = 'SCORE_CORRECTION' AND reason_code = 'QUESTION_AMBIGUITY_ADJUSTMENT' ORDER BY ledger_id DESC LIMIT 1",
  );
  assert.ok(ledgerRows.length > 0);
  assert.equal(ledgerRows[0].reason_code, "QUESTION_AMBIGUITY_ADJUSTMENT");
  assert.ok(ledgerRows[0].location_id.startsWith("ACAD-QUIZ-"));
});

test("Academic Analytics & Export: Funnel, Accuracy, CSV & Student Progress", async () => {
  // 1. Subject Analytics Dashboard
  const analyticsRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}/results`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const analyticsBody = await analyticsRes.json();
  assert.equal(analyticsRes.status, 200);
  assert.ok(Array.isArray(analyticsBody.data.funnel));
  assert.ok(Array.isArray(analyticsBody.data.question_accuracy));

  // 2. CSV Export
  const csvRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}/results/export`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get("content-type"), /text\/csv/);
  const csvText = await csvRes.text();
  assert.match(csvText, /Register No,Full Name,Topic,Attempt,Score/);

  // 3. Student Personal Progress
  const myProgRes = await fetch(`${baseUrl}/academic/me/progress`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const myProgBody = await myProgRes.json();
  assert.equal(myProgRes.status, 200);
  assert.ok(Array.isArray(myProgBody.data));
  const enrolledSubject = myProgBody.data.find((s) => s.subject_id === testSubjectId);
  assert.ok(enrolledSubject);
});

test("Security & RBAC Enforcement: Student Mutation Rejections", async () => {
  // Student cannot create question
  const qRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/questions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: "Hacked?", answer: "Yes" }),
  });
  assert.equal(qRes.status, 403);

  // Student cannot configure quiz
  const quizRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/quiz`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ time_limit: 999 }),
  });
  assert.equal(quizRes.status, 403);

  // Student cannot delete materials
  const delMatRes = await fetch(`${baseUrl}/academic/materials/${testMaterialId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(delMatRes.status, 403);
});

test("Quiz Engine Max Attempts Enforcement (AC-STU-03)", async () => {
  // Submit attempt 2
  const attempt2Start = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const a2Body = await attempt2Start.json();
  assert.equal(attempt2Start.status, 201);
  assert.equal(a2Body.data.attempt_number, 2);

  // Submit attempt 2
  const a2Submit = await fetch(`${baseUrl}/academic/attempts/${a2Body.data.attempt_id}/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ answers: [] }),
  });
  assert.equal(a2Submit.status, 200);

  // Attempt 3 must be blocked because max_attempts was configured as 2
  const attempt3Start = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const a3Body = await attempt3Start.json();
  assert.equal(attempt3Start.status, 403);
  assert.equal(a3Body.code, "MAX_ATTEMPTS_REACHED");
});

test("Multipart Upload & Virus Scanner Security Hook", async () => {
  const boundary = "----WebKitFormBoundaryX999X";
  const maliciousPayload = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="title"',
    "",
    "Malicious Slide Asset",
    `--${boundary}`,
    'Content-Disposition: form-data; name="type"',
    "",
    "Slide",
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="exploit.ppt"',
    "Content-Type: application/vnd.ms-powerpoint",
    "",
    "<?php system($_GET['cmd']); ?>",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const uploadRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/materials`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: maliciousPayload,
  });

  const uploadBody = await uploadRes.json();
  assert.equal(uploadRes.status, 400);
  assert.equal(uploadBody.success, false);
  assert.match(uploadBody.message, /security scanner/i);
});

test("Topic Deletion & Cascade Cleanliness", async () => {
  // Delete the test topic
  const delTopicRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const delTopicBody = await delTopicRes.json();
  assert.equal(delTopicRes.status, 200);
  assert.equal(delTopicBody.success, true);

  // Verify materials for this topic are gone
  const [mats] = await pool.query("SELECT * FROM academic_materials WHERE topic_id = ?", [testTopicId]);
  assert.equal(mats.length, 0);

  // Verify quiz for this topic is gone
  const [quizzes] = await pool.query("SELECT * FROM academic_quizzes WHERE topic_id = ?", [testTopicId]);
  assert.equal(quizzes.length, 0);

  // Set testTopicId to null so after hook doesn't re-delete
  testTopicId = null;
});
