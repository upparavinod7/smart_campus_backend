const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const app = require("../app");
const pool = require("../config/mysql");
const { logAcademicEvent } = require("../utils/academicLedger");

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
  if (!studentData.success || !studentData.data) {
    throw new Error(
      `Student login failed in academic test setup (${studentRes.status}): ${studentData.message || JSON.stringify(studentData)}. Ensure demo seed is applied ('npm run db:seed:demo').`,
    );
  }
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
    await pool.query(
      `DELETE FROM academic_score_corrections WHERE attempt_id IN (
        SELECT a.attempt_id FROM academic_attempts a 
        JOIN academic_quizzes q ON a.quiz_id = q.quiz_id 
        WHERE q.topic_id = ?
      )`,
      [testTopicId],
    );
    await pool.query(
      `DELETE FROM academic_attempt_answers WHERE attempt_id IN (
        SELECT a.attempt_id FROM academic_attempts a 
        JOIN academic_quizzes q ON a.quiz_id = q.quiz_id 
        WHERE q.topic_id = ?
      )`,
      [testTopicId],
    );
    await pool.query(
      `DELETE FROM academic_attempts WHERE quiz_id IN (
        SELECT quiz_id FROM academic_quizzes WHERE topic_id = ?
      )`,
      [testTopicId],
    );
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

  // 2b. Add MCQ question using correct_answer / correct_option payload (Frontend compatibility)
  const q3Res = await fetch(`${baseUrl}/academic/topics/${testTopicId}/questions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "MCQ",
      text: "Which activation function outputs values in the range [0, 1]?",
      options: [
        { key: "A", text: "Sigmoid" },
        { key: "B", text: "ReLU" },
        { key: "C", text: "LeakyReLU" },
        { key: "D", text: "Linear" },
      ],
      correct_answer: "A",
      explanation: "Sigmoid maps real numbers to the (0, 1) probability interval.",
      marks: 1.0,
      difficulty: "Easy",
    }),
  });
  const q3Body = await q3Res.json();
  assert.equal(q3Res.status, 201);
  assert.equal(q3Body.data.answer, "A");
  assert.equal(q3Body.data.correct_answer, "A");

  // Clean up temporary question so quiz preview and attempt downstream tests preserve 2-question benchmark
  await fetch(`${baseUrl}/academic/questions/${q3Body.data.question_id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });

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
  const testIdempotencyKey = `test_key_${Date.now()}`;
  const submitRes = await fetch(`${baseUrl}/academic/attempts/${testAttemptId}/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: testIdempotencyKey,
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
    body: JSON.stringify({ idempotency_key: testIdempotencyKey }),
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

test("Phase 1: Question Soft-Archiving & Historical Attempt Preservation (AC-QZ-07)", async () => {
  // testQuestionId is referenced in academic_attempt_answers for testAttemptId
  const [ansBefore] = await pool.query(
    "SELECT * FROM academic_attempt_answers WHERE question_id = ?",
    [testQuestionId],
  );
  assert.ok(ansBefore.length > 0, "Question should be referenced in attempt answers");

  // Deleting referenced question should NOT physically delete it, but soft-archive it
  const delRes = await fetch(`${baseUrl}/academic/questions/${testQuestionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const delBody = await delRes.json();
  assert.equal(delRes.status, 200);
  assert.equal(delBody.archived, true);
  assert.match(delBody.message, /archived/i);

  // Verify status in DB is 'Archived'
  const [qRows] = await pool.query("SELECT status FROM academic_questions WHERE question_id = ?", [testQuestionId]);
  assert.equal(qRows.length, 1);
  assert.equal(qRows[0].status, "Archived");

  // Verify attempt answers are completely preserved
  const [ansAfter] = await pool.query(
    "SELECT * FROM academic_attempt_answers WHERE question_id = ?",
    [testQuestionId],
  );
  assert.equal(ansAfter.length, ansBefore.length);

  // Verify raw hard delete is blocked by MySQL foreign key RESTRICT constraint
  await assert.rejects(
    async () => {
      await pool.query("DELETE FROM academic_questions WHERE question_id = ?", [testQuestionId]);
    },
    (err) => err.code === "ER_ROW_IS_REFERENCED_2" || /foreign key constraint fails/i.test(err.message),
  );
});

test("Phase 1: Audit Ledger Preservation on User Account Deletion", async () => {
  // Create temporary test user
  const [uRes] = await pool.query(
    "INSERT INTO users (username, email, password_hash, role) VALUES ('temp_audit_user', 'temp_audit@test.edu', 'hash', 'STUDENT')",
  );
  const tempUserId = uRes.insertId;

  // Log compliance event with actor snapshot
  const eventId = await logAcademicEvent({
    personId: tempUserId,
    actorRole: "STUDENT",
    actorUsername: "temp_audit_user",
    locationId: "ACAD-TEST",
    eventType: "USER_LIFECYCLE_TEST",
    payload: { retentionTest: true },
  });
  assert.ok(eventId, "Event ID should be returned");

  // Delete the user
  await pool.query("DELETE FROM users WHERE user_id = ?", [tempUserId]);

  // Verify user is gone from users table
  const [userCheck] = await pool.query("SELECT * FROM users WHERE user_id = ?", [tempUserId]);
  assert.equal(userCheck.length, 0);

  // Verify audit ledger entry STILL EXISTS and preserves actor snapshot
  const [ledgerRows] = await pool.query("SELECT * FROM academic_audit_ledger WHERE ledger_id = ?", [eventId]);
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].person_id, tempUserId);
  assert.equal(ledgerRows[0].actor_role, "STUDENT");
  assert.equal(ledgerRows[0].actor_username, "temp_audit_user");

  // Clean up test audit row
  await pool.query("DELETE FROM academic_audit_ledger WHERE ledger_id = ?", [eventId]);
});

test("Phase 1: Academic Demo Seeder Security Safeguards", async () => {
  const { execSync } = require("child_process");
  const scriptPath = path.resolve(__dirname, "../scripts/seedAcademicDemo.js");

  // 1. Refuses execution in production environment
  assert.throws(
    () => {
      execSync(`NODE_ENV=production node "${scriptPath}"`, { stdio: "pipe" });
    },
    (err) => err.status === 1,
  );

  // 2. Refuses execution against production database name
  assert.throws(
    () => {
      execSync(`NODE_ENV=development DB_USER=root DB_NAME=campus_production node "${scriptPath}"`, { stdio: "pipe" });
    },
    (err) => err.status === 1,
  );

  // 3. Refuses destructive reset without explicit confirmation flag
  assert.throws(
    () => {
      execSync(`NODE_ENV=development DB_USER=root DB_NAME=test_db node "${scriptPath}" --reset`, { stdio: "pipe" });
    },
    (err) => err.status === 1,
  );
});

test("Phase 2: ML Question Generation Bridge & Job Status Polling (AC-ML-01, AC-ROL-02)", async () => {
  // 1. Post question generation job
  const genRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/questions/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      count: 3,
      difficulty_mix: { easy: 1, medium: 2 },
    }),
  });
  const genBody = await genRes.json();
  assert.equal(genRes.status, 202);
  assert.equal(genBody.success, true);
  assert.equal(genBody.data.status, "PENDING");
  const testJobId = genBody.data.job_id;

  // 2. Poll job status
  const jobRes = await fetch(`${baseUrl}/academic/jobs/${testJobId}`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const jobBody = await jobRes.json();
  assert.equal(jobRes.status, 200);
  assert.equal(jobBody.success, true);
  assert.equal(jobBody.data.job_id, testJobId);
  assert.equal(jobBody.data.status, "PENDING");

  // 3. Test per-subject ML feature toggle (AC-ROL-02)
  await pool.query("UPDATE subjects SET ml_enabled = 0 WHERE subject_id = ?", [testSubjectId]);
  const disabledGenRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}/questions/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ count: 5 }),
  });
  const disabledGenBody = await disabledGenRes.json();
  assert.equal(disabledGenRes.status, 403);
  assert.equal(disabledGenBody.code, "ML_DISABLED_FOR_SUBJECT");

  // Re-enable ML for subject
  await pool.query("UPDATE subjects SET ml_enabled = 1 WHERE subject_id = ?", [testSubjectId]);
});

test("Phase 2: Standalone Quiz Unlock Status Endpoint (AC-STU-03)", async () => {
  const attemptsBefore = await pool.query(
    "SELECT COUNT(*) AS cnt FROM academic_attempts WHERE quiz_id = ? AND person_id = ?",
    [testQuizId, studentUserId],
  );

  const statusRes = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/status`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const statusBody = await statusRes.json();
  assert.equal(statusRes.status, 200);
  assert.equal(statusBody.success, true);
  assert.equal(typeof statusBody.data.is_unlocked, "boolean");
  assert.equal(typeof statusBody.data.required_materials_completed, "boolean");
  assert.ok(statusBody.data.attempts_taken >= 1);
  assert.ok(statusBody.data.max_attempts >= 1);

  // Verify status check did NOT create any attempts (read-only)
  const attemptsAfter = await pool.query(
    "SELECT COUNT(*) AS cnt FROM academic_attempts WHERE quiz_id = ? AND person_id = ?",
    [testQuizId, studentUserId],
  );
  assert.equal(attemptsAfter[0][0].cnt, attemptsBefore[0][0].cnt);
});

test("Phase 2: HOD Department Trends & Cross-Department Isolation (AC-RES-03)", async () => {
  // Find department of testSubjectId
  const [subRows] = await pool.query("SELECT owner_department_id FROM subjects WHERE subject_id = ?", [testSubjectId]);
  const deptId = subRows[0].owner_department_id;

  // 1. Authorized faculty views own department trends
  const deptRes = await fetch(`${baseUrl}/academic/departments/${deptId}/trends`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const deptBody = await deptRes.json();
  assert.equal(deptRes.status, 200);
  assert.equal(deptBody.success, true);
  assert.ok(deptBody.data.summary.total_subjects >= 1);
  assert.ok(Array.isArray(deptBody.data.subjects_trends));

  // 2. Cross-department isolation: Querying non-existent or foreign department returns 403
  const foreignDeptRes = await fetch(`${baseUrl}/academic/departments/999999/trends`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(foreignDeptRes.status, 403);
});

test("Phase 2: Random Question Selection with questions_to_draw (AC-QZ-05)", async () => {
  // Add a second approved question to testTopicId
  const [q2Res] = await pool.query(
    `INSERT INTO academic_questions 
      (topic_id, type, text, options, answer, explanation, marks, difficulty, status, created_by)
     VALUES (?, 'MCQ', 'What is gradient descent?', '["Optimization algorithm", "Loss function", "Activation function"]', 'Optimization algorithm', 'Optimizes weights', 1.0, 'Easy', 'Approved', ?)`,
    [testTopicId, facultyId],
  );
  const q2Id = q2Res.insertId;

  // Allow extra attempts on testQuizId
  await pool.query("UPDATE academic_quizzes SET max_attempts = 15, questions_to_draw = 1 WHERE quiz_id = ?", [testQuizId]);

  // Start attempt with questions_to_draw = 1
  const drawAttemptRes = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const drawAttemptBody = await drawAttemptRes.json();
  assert.equal(drawAttemptRes.status, 201);
  assert.equal(drawAttemptBody.data.questions.length, 1);

  // Resume attempt: verify frozen question set contains the exact same 1 question
  const resumeRes = await fetch(`${baseUrl}/academic/attempts/${drawAttemptBody.data.attempt_id}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const resumeBody = await resumeRes.json();
  assert.equal(resumeRes.status, 200);
  assert.equal(resumeBody.data.question_set.length, 1);
  assert.equal(resumeBody.data.question_set[0].question_id, drawAttemptBody.data.questions[0].question_id);

  // Cancel active attempt so next start request evaluates question drawing logic
  await pool.query("UPDATE academic_attempts SET status = 'CANCELLED' WHERE quiz_id = ? AND person_id = ? AND status = 'IN_PROGRESS'", [testQuizId, studentUserId]);

  // Error case: questions_to_draw exceeds available approved questions
  await pool.query("UPDATE academic_quizzes SET questions_to_draw = 50 WHERE quiz_id = ?", [testQuizId]);
  const excessRes = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const excessBody = await excessRes.json();
  assert.equal(excessRes.status, 400);
  assert.equal(excessBody.code, "INSUFFICIENT_QUESTIONS_IN_BANK");

  // Restore questions_to_draw
  await pool.query("UPDATE academic_quizzes SET questions_to_draw = NULL WHERE quiz_id = ?", [testQuizId]);
});

test("Phase 2: Failed Student Remediation Feedback (AC-STU-07)", async () => {
  // Ensure no active attempt before starting fresh attempt
  await pool.query("UPDATE academic_attempts SET status = 'CANCELLED' WHERE quiz_id = ? AND person_id = ? AND status = 'IN_PROGRESS'", [testQuizId, studentUserId]);
  await pool.query("UPDATE academic_quizzes SET max_attempts = 20 WHERE quiz_id = ?", [testQuizId]);

  const startRes = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const startBody = await startRes.json();
  assert.equal(startRes.status, 201);
  const failAttemptId = startBody.data.attempt_id;

  // Submit completely wrong answers to force failure
  const submitFailRes = await fetch(`${baseUrl}/academic/attempts/${failAttemptId}/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: `fail_test_${Date.now()}`,
      answers: [
        { question_id: testQuestionId, answer: "Totally Wrong Answer 123" },
      ],
    }),
  });
  const submitFailBody = await submitFailRes.json();
  assert.equal(submitFailRes.status, 200);
  assert.equal(submitFailBody.data.result, "FAILED");
  assert.ok(submitFailBody.data.remediation !== null);
  assert.ok(submitFailBody.data.remediation.weak_topics.length > 0);
  assert.ok(submitFailBody.data.remediation.missed_questions_count > 0);
  assert.ok(Array.isArray(submitFailBody.data.remediation.recommended_materials));
  assert.equal(typeof submitFailBody.data.remediation.retry_allowed, "boolean");
});

test("Topic Deletion & Cascade Cleanliness", async () => {
  // 1. Attempting to delete testTopicId (which has historical attempts) must return 409 Conflict
  const blockedDelRes = await fetch(`${baseUrl}/academic/topics/${testTopicId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const blockedDelBody = await blockedDelRes.json();
  assert.equal(blockedDelRes.status, 409);
  assert.equal(blockedDelBody.code, "TOPIC_HAS_HISTORICAL_RECORDS");

  // 2. Create a clean unattempted topic to verify cascade deletion
  const cleanTopicRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}/topics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Clean Temporary Topic",
      description: "Topic with no student attempts for cascade test",
      position: 99,
    }),
  });
  const cleanTopicBody = await cleanTopicRes.json();
  assert.equal(cleanTopicRes.status, 201);
  const cleanTopicId = cleanTopicBody.data ? cleanTopicBody.data.topic_id : cleanTopicBody.topic_id;

  // Add material to clean topic
  await pool.query(
    "INSERT INTO academic_materials (topic_id, type, title, status) VALUES (?, 'Notes', 'Temp Notes', 'Draft')",
    [cleanTopicId],
  );

  // Delete the unattempted topic
  const delTopicRes = await fetch(`${baseUrl}/academic/topics/${cleanTopicId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const delTopicBody = await delTopicRes.json();
  assert.equal(delTopicRes.status, 200);
  assert.equal(delTopicBody.success, true);

  // Verify materials for this topic are cascade-deleted
  const [mats] = await pool.query("SELECT * FROM academic_materials WHERE topic_id = ?", [cleanTopicId]);
  assert.equal(mats.length, 0);

  // Verify quiz for this topic is cascade-deleted
  const [quizzes] = await pool.query("SELECT * FROM academic_quizzes WHERE topic_id = ?", [cleanTopicId]);
  assert.equal(quizzes.length, 0);
});

test("Short-Lived HMAC-Signed Material Download URLs (AC-SEC-01)", async () => {
  const testStorageDir = path.resolve(__dirname, "../../storage/materials");
  if (!fs.existsSync(testStorageDir)) {
    fs.mkdirSync(testStorageDir, { recursive: true });
  }
  const testFilePath = path.join(testStorageDir, `signed_test_${Date.now()}.txt`);
  fs.writeFileSync(testFilePath, "CONFIDENTIAL_ACADEMIC_MATERIAL_CONTENT");

  // Create a published material with this file
  const [insertMat] = await pool.query(
    `INSERT INTO academic_materials 
      (topic_id, type, title, description, file_ref, version, status, mime_type, file_size, created_by)
     VALUES (?, 'PDF', 'Signed URL Test Material', 'Test signed download URLs', ?, 1, 'Published', 'text/plain', 39, ?)`,
    [testTopicId, testFilePath, facultyId],
  );
  const signedMatId = insertMat.insertId;

  // 1. Generate signed URL as student
  const signRes = await fetch(`${baseUrl}/academic/materials/${signedMatId}/signed-url`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const signBody = await signRes.json();
  assert.equal(signRes.status, 200);
  assert.equal(signBody.success, true);
  assert.ok(signBody.data.download_url);
  assert.equal(signBody.data.expires_in_seconds, 300);

  // 2. Download via signed URL (NO Authorization header!)
  const downloadUrl = signBody.data.download_url;
  const fullDownloadUrl = `${baseUrl.replace("/api/v1", "")}${downloadUrl}`;
  const dlRes = await fetch(fullDownloadUrl);
  const dlText = await dlRes.text();
  assert.equal(dlRes.status, 200);
  assert.equal(dlText, "CONFIDENTIAL_ACADEMIC_MATERIAL_CONTENT");

  // 3. Reject expired signature
  const parsedUrl = new URL(fullDownloadUrl);
  parsedUrl.searchParams.set("expires", String(Date.now() - 5000)); // 5 seconds in the past
  const expiredRes = await fetch(parsedUrl.toString());
  const expiredBody = await expiredRes.json();
  assert.equal(expiredRes.status, 403);
  assert.equal(expiredBody.code, "SIGNATURE_EXPIRED");

  // 4. Reject tampered signature
  parsedUrl.searchParams.set("expires", String(Date.now() + 60000));
  parsedUrl.searchParams.set("signature", "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
  const tamperedRes = await fetch(parsedUrl.toString());
  const tamperedBody = await tamperedRes.json();
  assert.equal(tamperedRes.status, 403);
  assert.equal(tamperedBody.code, "INVALID_SIGNATURE");

  // Cleanup file
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
  await pool.query("DELETE FROM academic_materials WHERE material_id = ?", [signedMatId]);
});

test("Material Version Snapshots on Published Content Edits (AC-MAT-02)", async () => {
  // 1. Create a published material
  const [insertMat] = await pool.query(
    `INSERT INTO academic_materials 
      (topic_id, type, title, description, version, status, required_flag, created_by)
     VALUES (?, 'Notes', 'Version Track Title', 'Initial Content Description', 1, 'Published', 0, ?)`,
    [testTopicId, facultyId],
  );
  const verMatId = insertMat.insertId;

  // Record initial version 1
  await pool.query(
    `INSERT INTO academic_material_versions
      (material_id, version, change_summary, created_by)
     VALUES (?, 1, 'Initial creation', ?)`,
    [verMatId, facultyId],
  );

  // 2. Update title, description, and required flag
  const updateRes = await fetch(`${baseUrl}/academic/materials/${verMatId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Updated Version Track Title",
      description: "Updated Content Description with New Notes",
      required_flag: true,
      change_summary: "Major syllabus update",
    }),
  });
  const updateBody = await updateRes.json();
  assert.equal(updateRes.status, 200);
  assert.equal(updateBody.version, 2);

  // 3. Verify academic_material_versions has 2 records
  const [versions] = await pool.query(
    "SELECT * FROM academic_material_versions WHERE material_id = ? ORDER BY version ASC",
    [verMatId],
  );
  assert.equal(versions.length, 2);
  assert.equal(versions[0].version, 1);
  assert.equal(versions[1].version, 2);
  assert.equal(versions[1].change_summary, "Major syllabus update");

  // Cleanup
  await pool.query("DELETE FROM academic_materials WHERE material_id = ?", [verMatId]);
});

test("CSV Formula Injection Sanitization (AC-SEC-03)", async () => {
  // Update topic title temporarily with a formula trigger
  await pool.query(
    "UPDATE academic_topics SET title = '=SUM(A1:A10)' WHERE topic_id = ?",
    [testTopicId],
  );

  const csvRes = await fetch(`${baseUrl}/academic/subjects/${testSubjectId}/results/export`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get("content-type"), /text\/csv/);

  const csvContent = await csvRes.text();
  // Formula =SUM(A1:A10) must be prefixed with single quote: "'=SUM(A1:A10)"
  assert.ok(csvContent.includes("\"'=SUM(A1:A10)\""));
  assert.ok(!csvContent.includes("\"=SUM(A1:A10)\""));

  // Restore topic title
  await pool.query(
    "UPDATE academic_topics SET title = 'Test Topic 1 - Fundamentals' WHERE topic_id = ?",
    [testTopicId],
  );
});

test("Rate Limiting on Quiz Attempts (AC-SEC-04)", async () => {
  let hitRateLimit = false;
  let retryAfterHeader = null;

  // Rapidly fire requests to trigger rate limit (max 10 requests per minute)
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${baseUrl}/academic/quizzes/${testQuizId}/attempts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (res.status === 429) {
      hitRateLimit = true;
      retryAfterHeader = res.headers.get("retry-after");
      const body = await res.json();
      assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
      break;
    }
  }

  assert.equal(hitRateLimit, true);
  assert.ok(retryAfterHeader !== null);
});
