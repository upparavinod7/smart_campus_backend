const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

const STORAGE_DIR = path.resolve(__dirname, "../../storage/materials");

/**
 * Generates a valid, minimal PDF 1.4 binary buffer containing readable title text
 */
function buildSamplePdfBuffer(title, bodyLines) {
  const safeText = (str) => String(str).replace(/[()\\]/g, "\\$&");
  const lines = [title, ...bodyLines];
  let contentStream = "BT\n/F1 16 Tf\n50 740 Td\n";
  contentStream += `(${safeText(lines[0])}) Tj\n/F1 11 Tf\n0 -28 Td\n`;
  for (let i = 1; i < lines.length; i++) {
    contentStream += `(${safeText(lines[i])}) Tj\n0 -18 Td\n`;
  }
  contentStream += "ET\n";

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

function createSampleFile(filename, bufferOrText) {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  const targetPath = path.join(STORAGE_DIR, filename);
  fs.writeFileSync(targetPath, bufferOrText);
  return {
    path: targetPath,
    size: Buffer.isBuffer(bufferOrText) ? bufferOrText.length : Buffer.byteLength(bufferOrText, "utf8"),
  };
}

async function seedAcademicDemo() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset") || args.includes("--force");
  let connection;

  try {
    // Safety Check 1: Strict Environment Allowlisting
    const allowedEnvs = ["development", "test", "demo", "local"];
    const currentEnv = (process.env.NODE_ENV || "development").toLowerCase();
    if (!allowedEnvs.includes(currentEnv) || currentEnv === "production" || currentEnv === "prod" || currentEnv === "staging") {
      console.error(
        `[SEED-ACADEMIC] ✗ Execution aborted: NODE_ENV='${process.env.NODE_ENV}' is not an allowlisted development/test environment. Allowlist: ${allowedEnvs.join(", ")}`,
      );
      process.exit(1);
    }

    const dbConfig = {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };

    if (!dbConfig.user || !dbConfig.database) {
      throw new Error("Missing mandatory DB_USER or DB_NAME in environment.");
    }

    // Safety Check 2: Database Name Inspection
    const dbName = String(dbConfig.database || "").toLowerCase();
    if (dbName.includes("prod") || dbName.includes("production") || dbName.includes("live")) {
      console.error(
        `[SEED-ACADEMIC] ✗ Execution aborted: Target database '${dbConfig.database}' appears to be a production database. Refusing destructive operations.`,
      );
      process.exit(1);
    }

    // Safety Check 3: Explicit Destructive Reset Confirmation
    if (shouldReset) {
      const isExplicitlyConfirmed =
        args.includes("--confirm-destructive-reset") ||
        args.includes("--confirm") ||
        process.env.CONFIRM_ACADEMIC_RESET === "true" ||
        process.env.CONFIRM_ACADEMIC_RESET === "yes";

      if (!isExplicitlyConfirmed) {
        console.error(
          "[SEED-ACADEMIC] ✗ Refusing destructive reset without explicit confirmation.\n" +
          "[SEED-ACADEMIC] To reset and re-seed demo tables, pass `--confirm-destructive-reset` or set `CONFIRM_ACADEMIC_RESET=true`.",
        );
        process.exit(1);
      }
    }

    connection = await mysql.createConnection(dbConfig);

    // Check if academic data already exists
    const [existingTopics] = await connection.query("SELECT COUNT(*) AS cnt FROM academic_topics");
    if (existingTopics[0].cnt > 0 && !shouldReset) {
      console.log(
        `[SEED-ACADEMIC] Academic tables already contain ${existingTopics[0].cnt} topic(s). Skipping seed.`,
      );
      console.log("[SEED-ACADEMIC] Run with `--reset` to clear academic tables and re-seed demo fixtures.");
      process.exit(0);
    }

    await connection.beginTransaction();

    if (shouldReset) {
      console.log("[SEED-ACADEMIC] Clearing existing academic demo tables...");
      await connection.query("DELETE FROM academic_ml_jobs");
      await connection.query("DELETE FROM academic_audit_ledger");
      await connection.query("DELETE FROM academic_score_corrections");
      await connection.query("DELETE FROM academic_attempt_answers");
      await connection.query("DELETE FROM academic_attempts");
      await connection.query("DELETE FROM academic_quizzes");
      await connection.query("DELETE FROM academic_questions");
      await connection.query("DELETE FROM academic_material_progress");
      await connection.query("DELETE FROM academic_material_versions");
      await connection.query("DELETE FROM academic_materials");
      await connection.query("DELETE FROM academic_topics");
      await connection.query("DELETE FROM subject_staff_assignments");
    }

    // 1. Discover core users dynamically
    const [adminUsers] = await connection.query(
      "SELECT user_id, username FROM users WHERE role = 'ADMIN' AND is_active = 1 ORDER BY user_id ASC LIMIT 1",
    );
    const [facultyUsers] = await connection.query(
      "SELECT user_id, username, faculty_id FROM users WHERE role = 'FACULTY' AND faculty_id IS NOT NULL AND is_active = 1 ORDER BY user_id ASC LIMIT 1",
    );
    const [studentUsers] = await connection.query(
      "SELECT user_id, username, student_id FROM users WHERE role = 'STUDENT' AND student_id IS NOT NULL AND is_active = 1 ORDER BY user_id ASC LIMIT 1",
    );

    if (adminUsers.length === 0 || facultyUsers.length === 0 || studentUsers.length === 0) {
      throw new Error(
        "Core demo users (admin, FAC001, J26AIM001) not found. Run `npm run db:seed:demo` first.",
      );
    }

    const adminUser = adminUsers[0];
    const primaryFaculty = facultyUsers[0];
    const primaryStudent = studentUsers[0];

    // 2. Ensure peer student & co-teacher login accounts exist for multi-student/multi-staff testing
    const studentPassHash = await bcrypt.hash("Student@123", 10);
    const facultyPassHash = await bcrypt.hash("Faculty@123", 10);

    const ensurePeerStudentUser = async (registerNo, preferredUsername) => {
      const [stuRows] = await connection.query(
        "SELECT student_id, full_name, email FROM students WHERE register_no = ? LIMIT 1",
        [registerNo],
      );
      if (stuRows.length === 0) return null;
      const stu = stuRows[0];
      const [uRows] = await connection.query(
        "SELECT user_id, username, student_id FROM users WHERE student_id = ? LIMIT 1",
        [stu.student_id],
      );
      if (uRows.length > 0) return uRows[0];

      const email = stu.email || `${preferredUsername.toLowerCase()}@joyuniversity.edu.in`;
      const [ins] = await connection.query(
        `INSERT INTO users (username, full_name, email, password_hash, role, student_id, is_active)
         VALUES (?, ?, ?, ?, 'STUDENT', ?, 1)`,
        [preferredUsername, stu.full_name, email, studentPassHash, stu.student_id],
      );
      return { user_id: ins.insertId, username: preferredUsername, student_id: stu.student_id };
    };

    const ensurePeerFacultyUser = async (employeeCode) => {
      const [facRows] = await connection.query(
        "SELECT faculty_id, full_name, email FROM faculty WHERE employee_code = ? LIMIT 1",
        [employeeCode],
      );
      if (facRows.length === 0) return null;
      const fac = facRows[0];
      const [uRows] = await connection.query(
        "SELECT user_id, username, faculty_id FROM users WHERE faculty_id = ? LIMIT 1",
        [fac.faculty_id],
      );
      if (uRows.length > 0) return uRows[0];

      const email = fac.email || `${employeeCode.toLowerCase()}@joyuniversity.edu.in`;
      const [ins] = await connection.query(
        `INSERT INTO users (username, full_name, email, password_hash, role, faculty_id, is_active)
         VALUES (?, ?, ?, ?, 'FACULTY', ?, 1)`,
        [employeeCode, fac.full_name, email, facultyPassHash, fac.faculty_id],
      );
      return { user_id: ins.insertId, username: employeeCode, faculty_id: fac.faculty_id };
    };

    const peerStudent2 = await ensurePeerStudentUser("JU26AIML002", "JU26AIML002");
    const peerStudent3 = await ensurePeerStudentUser("JU26AIML003", "JU26AIML003");
    const coFaculty = await ensurePeerFacultyUser("FAC002");

    // 3. Discover enrolled subjects for primary student + non-enrolled subject for RBAC testing
    const [enrolledSubs] = await connection.query(
      `SELECT DISTINCT s.subject_id, s.subject_code, s.name
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.section_id
       JOIN course_offerings co ON sec.offering_id = co.offering_id
       JOIN subjects s ON co.subject_id = s.subject_id
       WHERE e.student_id = ? AND e.status = 'REGISTERED'
       ORDER BY s.subject_id ASC`,
      [primaryStudent.student_id],
    );

    if (enrolledSubs.length === 0) {
      throw new Error(`Primary student (${primaryStudent.username}) has no registered enrollments.`);
    }

    const [unEnrolledSubs] = await connection.query(
      `SELECT subject_id, subject_code, name
       FROM subjects
       WHERE is_active = 1 AND subject_id NOT IN (?)
       ORDER BY subject_id ASC LIMIT 1`,
      [enrolledSubs.map((s) => s.subject_id)],
    );

    const subjMain = enrolledSubs[0]; // e.g., AIML102 or AIML104
    const subjSecondary = enrolledSubs[1] || enrolledSubs[0]; // e.g., AIML103
    const subjLab = enrolledSubs[2] || enrolledSubs[0]; // e.g., AIML106
    const subjRestricted = unEnrolledSubs[0] || null; // e.g., AIML101

    console.log(
      `[SEED-ACADEMIC] Seeding academic module across subjects: ${enrolledSubs.map((s) => s.subject_code).join(", ")}${subjRestricted ? ` (+ restricted ${subjRestricted.subject_code})` : ""}`,
    );

    // 4. Seed Subject Staff Assignments
    for (const sub of enrolledSubs) {
      await connection.query(
        `INSERT INTO subject_staff_assignments (subject_id, faculty_id, role, assigned_by)
         VALUES (?, ?, 'Subject Staff', ?)
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [sub.subject_id, primaryFaculty.faculty_id, adminUser.user_id],
      );
    }
    if (coFaculty) {
      await connection.query(
        `INSERT INTO subject_staff_assignments (subject_id, faculty_id, role, assigned_by)
         VALUES (?, ?, 'Co-Teacher', ?)
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [subjMain.subject_id, coFaculty.faculty_id, adminUser.user_id],
      );
    }
    if (subjRestricted) {
      await connection.query(
        `INSERT INTO subject_staff_assignments (subject_id, faculty_id, role, assigned_by)
         VALUES (?, ?, 'Subject Staff', ?)
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [subjRestricted.subject_id, primaryFaculty.faculty_id, adminUser.user_id],
      );
    }

    // Helper to create topic + quiz stub
    const insertTopic = async ({ subjectId, title, description, position, quizEnabled = 1 }) => {
      const [res] = await connection.query(
        `INSERT INTO academic_topics (subject_id, title, description, position, quiz_enabled, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [subjectId, title, description, position, quizEnabled, primaryFaculty.user_id],
      );
      return res.insertId;
    };

    const insertMaterial = async ({
      topicId,
      type,
      title,
      description,
      fileRef = null,
      mimeType = null,
      fileSize = null,
      status = "Published",
      requiredFlag = 0,
      position = 1,
      version = 1,
      extractedText = "",
    }) => {
      const [res] = await connection.query(
        `INSERT INTO academic_materials
          (topic_id, type, title, description, file_ref, version, status, required_flag, position, mime_type, file_size, virus_scan_status, extracted_text_ref, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLEAN', ?, ?)`,
        [
          topicId,
          type,
          title,
          description,
          fileRef,
          version,
          status,
          requiredFlag,
          position,
          mimeType,
          fileSize,
          extractedText || description,
          primaryFaculty.user_id,
        ],
      );
      const materialId = res.insertId;
      for (let v = 1; v <= version; v++) {
        await connection.query(
          `INSERT INTO academic_material_versions
            (material_id, version, file_ref, mime_type, file_size, change_summary, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            materialId,
            v,
            fileRef,
            mimeType,
            fileSize,
            v === 1 ? "Initial publication" : "Updated examples and typo fixes",
            primaryFaculty.user_id,
          ],
        );
      }
      return materialId;
    };

    const insertQuestion = async ({
      topicId,
      type = "MCQ",
      text,
      options = null,
      answer,
      explanation = null,
      marks = 1.0,
      difficulty = "Medium",
      origin = "Manual",
      status = "Approved",
      sourceRef = null,
    }) => {
      const [res] = await connection.query(
        `INSERT INTO academic_questions
          (topic_id, type, text, options, answer, explanation, marks, difficulty, source_ref, origin, approved_by, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          topicId,
          type,
          text,
          options ? JSON.stringify(options) : null,
          answer,
          explanation,
          marks,
          difficulty,
          sourceRef,
          origin,
          status === "Approved" ? primaryFaculty.user_id : null,
          status,
          primaryFaculty.user_id,
        ],
      );
      return res.insertId;
    };

    // =========================================================================
    // SCENARIO A (Subject 1): UNLOCKED & COMPLETED TOPIC + ATTEMPT + SCORE CORRECTION
    // =========================================================================
    const topic1Id = await insertTopic({
      subjectId: subjMain.subject_id,
      title: `Foundations & Core Principles (${subjMain.subject_code})`,
      description: "Core concepts, complexity foundations, and mathematical intuition.",
      position: 1,
      quizEnabled: 1,
    });

    const pdf1 = createSampleFile(
      `demo_${subjMain.subject_code}_foundations_v2.pdf`,
      buildSamplePdfBuffer(`${subjMain.subject_code}: Foundations Lecture Notes`, [
        "1. Overview of core principles and analytical bounds.",
        "2. Step-by-step worked examples and edge cases.",
        "3. Key takeaways required before attempting Topic 1 Quiz.",
      ]),
    );

    const mat1Id = await insertMaterial({
      topicId: topic1Id,
      type: "PDF",
      title: "Unit 1 Comprehensive Lecture Notes (v2)",
      description: "Mandatory reading covering foundational definitions and worked proofs.",
      fileRef: pdf1.path,
      mimeType: "application/pdf",
      fileSize: pdf1.size,
      status: "Published",
      requiredFlag: 1,
      position: 1,
      version: 2,
      extractedText:
        "Overview of core principles and analytical bounds. Worked examples covering worst-case and average-case analysis.",
    });

    const mat2Id = await insertMaterial({
      topicId: topic1Id,
      type: "Link",
      title: "Interactive Concept Visualizer Reference",
      description: "External interactive visualization lab tool.",
      fileRef: "https://visualgo.net/en",
      mimeType: "text/uri-list",
      status: "Published",
      requiredFlag: 1,
      position: 2,
    });

    await insertMaterial({
      topicId: topic1Id,
      type: "Notes",
      title: "Optional Supplemental Practice Sheet",
      description: "Extra ungraded practice problems with step-by-step hints.",
      mimeType: "text/plain",
      status: "Published",
      requiredFlag: 0,
      position: 3,
    });

    const slideDraft = createSampleFile(
      `demo_${subjMain.subject_code}_draft_slides.txt`,
      "Slide 1: Draft Advanced Extensions\nSlide 2: Instructor review pending before student release.",
    );
    await insertMaterial({
      topicId: topic1Id,
      type: "Slide",
      title: "Instructor Draft: Advanced Extensions Slides",
      description: "Unpublished draft visible only to faculty and admins.",
      fileRef: slideDraft.path,
      mimeType: "text/plain",
      fileSize: slideDraft.size,
      status: "Draft",
      requiredFlag: 0,
      position: 4,
    });

    // Questions for Topic 1
    const q1Id = await insertQuestion({
      topicId: topic1Id,
      type: "MCQ",
      text: "Which metric best characterizes worst-case algorithmic scalability as input size n grows?",
      options: ["Big-O Notation", "Constant Offset", "Clock Frequency", "Memory Address"],
      answer: "Big-O Notation",
      explanation: "Big-O describes the upper bound growth rate as input size approaches infinity.",
      marks: 2.0,
      difficulty: "Easy",
      sourceRef: `material:${mat1Id}`,
    });

    const q2Id = await insertQuestion({
      topicId: topic1Id,
      type: "MCQ",
      text: "Which property ensures an iterative algorithm terminates cleanly across all valid inputs?",
      options: ["Loop Invariant & Variant", "Global Variables", "Dynamic Casting", "Static Linking"],
      answer: "Loop Invariant & Variant",
      explanation: "A decreasing variant bounded below guarantees loop termination.",
      marks: 2.0,
      difficulty: "Medium",
    });

    const q3Id = await insertQuestion({
      topicId: topic1Id,
      type: "TrueFalse",
      text: "An O(n log n) algorithm scales strictly better than an O(n^2) algorithm for sufficiently large n.",
      options: ["True", "False"],
      answer: "True",
      explanation: "Linearithmic growth is asymptotically slower than quadratic growth.",
      marks: 1.0,
      difficulty: "Easy",
    });

    const q4Id = await insertQuestion({
      topicId: topic1Id,
      type: "MCQ",
      text: "What is the space complexity of an in-place iterative reversal using only constant pointers?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
      answer: "O(1)",
      explanation: "Only a fixed number of pointer variables are allocated regardless of input length.",
      marks: 2.0,
      difficulty: "Medium",
    });

    // Draft ML-origin question to demonstrate future ML approval workflow
    await insertQuestion({
      topicId: topic1Id,
      type: "MCQ",
      text: "[ML Suggested Draft] Which technique trades extra memory space for faster lookup performance?",
      options: ["Hashing / Memoization", "Bubble Sort", "Linear Scan", "Recursion Unrolling"],
      answer: "Hashing / Memoization",
      explanation: "Caching computed results or using hash tables improves lookup speed.",
      marks: 1.0,
      difficulty: "Easy",
      origin: "ML",
      status: "Draft",
      sourceRef: `material:${mat1Id}`,
    });

    const [quiz1Res] = await connection.query(
      `INSERT INTO academic_quizzes
        (topic_id, title, description, version, time_limit, pass_mark, max_attempts, open_at, close_at, status, shuffle_questions, shuffle_options, show_explanation, created_by)
       VALUES (?, ?, ?, 1, 20, 60.00, 3, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 90 DAY), 'Published', 1, 1, 1, ?)`,
      [
        topic1Id,
        `Topic 1 Assessment: ${subjMain.subject_code}`,
        "Covers foundational notes and interactive reference concepts.",
        primaryFaculty.user_id,
      ],
    );
    const quiz1Id = quiz1Res.insertId;

    // Complete required materials for primary student J26AIM001
    await connection.query(
      `INSERT INTO academic_material_progress (person_id, material_id, percent, status, completed_at)
       VALUES (?, ?, 100, 'COMPLETED', DATE_SUB(NOW(), INTERVAL 2 DAY)),
              (?, ?, 100, 'COMPLETED', DATE_SUB(NOW(), INTERVAL 2 DAY))`,
      [primaryStudent.user_id, mat1Id, primaryStudent.user_id, mat2Id],
    );

    // Partial progress for peerStudent2 (keeps analytics funnel realistic, leaves peerStudent3 unstarted)
    if (peerStudent2) {
      await connection.query(
        `INSERT INTO academic_material_progress (person_id, material_id, percent, status, completed_at)
         VALUES (?, ?, 60, 'IN_PROGRESS', NULL)`,
        [peerStudent2.user_id, mat1Id],
      );
    }

    // Seed 1 completed quiz attempt + 1 score correction for primary student
    const frozenSet1 = [
      { question_id: q1Id, type: "MCQ", text: "Which metric best characterizes worst-case algorithmic scalability as input size n grows?", options: ["Big-O Notation", "Constant Offset", "Clock Frequency", "Memory Address"], marks: 2, difficulty: "Easy" },
      { question_id: q2Id, type: "MCQ", text: "Which property ensures an iterative algorithm terminates cleanly across all valid inputs?", options: ["Loop Invariant & Variant", "Global Variables", "Dynamic Casting", "Static Linking"], marks: 2, difficulty: "Medium" },
      { question_id: q3Id, type: "TrueFalse", text: "An O(n log n) algorithm scales strictly better than an O(n^2) algorithm for sufficiently large n.", options: ["True", "False"], marks: 1, difficulty: "Easy" },
      { question_id: q4Id, type: "MCQ", text: "What is the space complexity of an in-place iterative reversal using only constant pointers?", options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"], marks: 2, difficulty: "Medium" },
    ];

    const [att1Res] = await connection.query(
      `INSERT INTO academic_attempts
        (quiz_id, person_id, attempt_number, started_at, expires_at, submitted_at, score, max_score, percentage, result, status, question_set, idempotency_key)
       VALUES (?, ?, 1, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 23 HOUR), DATE_SUB(NOW(), INTERVAL 1425 MINUTE), 6.00, 7.00, 85.71, 'PASSED', 'SUBMITTED', ?, ?)`,
      [quiz1Id, primaryStudent.user_id, JSON.stringify(frozenSet1), `seed_attempt_${quiz1Id}_${primaryStudent.user_id}_1`],
    );
    const attempt1Id = att1Res.insertId;

    await connection.query(
      `INSERT INTO academic_attempt_answers (attempt_id, question_id, answer, is_correct, marks_awarded)
       VALUES (?, ?, 'Big-O Notation', 1, 2.00),
              (?, ?, 'Loop Invariant & Variant', 1, 2.00),
              (?, ?, 'True', 1, 1.00),
              (?, ?, 'O(n)', 0, 0.00)`,
      [attempt1Id, q1Id, attempt1Id, q2Id, attempt1Id, q3Id, attempt1Id, q4Id],
    );

    await connection.query(
      `INSERT INTO academic_score_corrections (attempt_id, previous_score, new_score, reason_code, justification, corrected_by)
       VALUES (?, 5.00, 6.00, 'PARTIAL_STEP_CREDIT', 'Granted 1 additional point after manual review of working step submission.', ?)`,
      [attempt1Id, primaryFaculty.user_id],
    );

    // =========================================================================
    // SCENARIO B (Subject 1 Topic 2): LOCKED QUIZ UNTIL REQUIRED MATERIAL COMPLETED
    // =========================================================================
    const topic2Id = await insertTopic({
      subjectId: subjMain.subject_id,
      title: "Structured Problem Solving & Applied Models",
      description: "Complete both required materials below to unlock the Topic 2 Quiz (AC-STU-03).",
      position: 2,
      quizEnabled: 1,
    });

    const pdf2 = createSampleFile(
      `demo_${subjMain.subject_code}_topic2_guide.pdf`,
      buildSamplePdfBuffer(`${subjMain.subject_code}: Topic 2 Study Guide`, [
        "Mandatory prerequisite reading for Topic 2 Assessment.",
        "Complete progress tracking (percent = 100) to unlock the quiz.",
      ]),
    );

    const mat5Id = await insertMaterial({
      topicId: topic2Id,
      type: "PDF",
      title: "Required Reading: Core Algorithms & Workflows",
      description: "Currently in-progress (50%) for demo student J26AIM001.",
      fileRef: pdf2.path,
      mimeType: "application/pdf",
      fileSize: pdf2.size,
      status: "Published",
      requiredFlag: 1,
      position: 1,
    });

    await insertMaterial({
      topicId: topic2Id,
      type: "Notes",
      title: "Required Checklist: Common Edge Cases & Proofs",
      description: "Not yet started by J26AIM001 — blocks Topic 2 quiz until marked 100%.",
      mimeType: "text/plain",
      status: "Published",
      requiredFlag: 1,
      position: 2,
    });

    // Student J26AIM001 has only completed 50% of mat5 and 0% of second required material -> Quiz 2 is LOCKED!
    await connection.query(
      `INSERT INTO academic_material_progress (person_id, material_id, percent, status, completed_at)
       VALUES (?, ?, 50, 'IN_PROGRESS', NULL)`,
      [primaryStudent.user_id, mat5Id],
    );

    await insertQuestion({
      topicId: topic2Id,
      type: "MCQ",
      text: "Which traversal order uses a FIFO Queue to explore nodes level-by-level?",
      options: ["Breadth-First Search (BFS)", "Depth-First Search (DFS)", "Postorder", "Topological Backtrack"],
      answer: "Breadth-First Search (BFS)",
      explanation: "BFS uses a Queue (FIFO) to explore all neighbors at the current depth first.",
      marks: 2.0,
      difficulty: "Easy",
    });
    await insertQuestion({
      topicId: topic2Id,
      type: "TrueFalse",
      text: "A Stack follows the Last-In, First-Out (LIFO) ordering principle.",
      options: ["True", "False"],
      answer: "True",
      explanation: "Push and pop always operate on the top element of the stack.",
      marks: 1.0,
      difficulty: "Easy",
    });

    await connection.query(
      `INSERT INTO academic_quizzes
        (topic_id, title, description, version, time_limit, pass_mark, max_attempts, open_at, close_at, status, shuffle_questions, shuffle_options, show_explanation, created_by)
       VALUES (?, 'Topic 2 Unlock Verification Quiz', 'Locked until all required Topic 2 materials reach 100% completion.', 1, 15, 50.00, 2, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 90 DAY), 'Published', 1, 1, 1, ?)`,
      [topic2Id, primaryFaculty.user_id],
    );

    // =========================================================================
    // SCENARIO C (Secondary Enrolled Subject): UNLOCKED & READY FOR FIRST ATTEMPT
    // =========================================================================
    const targetSecSub = subjSecondary.subject_id !== subjMain.subject_id ? subjSecondary : subjMain;
    const topic3Id = await insertTopic({
      subjectId: targetSecSub.subject_id,
      title: `Ready-to-Take Module (${targetSecSub.subject_code})`,
      description: "Required materials already completed by J26AIM001; quiz is unlocked with 0 attempts so far.",
      position: targetSecSub.subject_id === subjMain.subject_id ? 3 : 1,
      quizEnabled: 1,
    });

    const matSecId = await insertMaterial({
      topicId: topic3Id,
      type: "Notes",
      title: `${targetSecSub.subject_code} Quick Reference Summary`,
      description: "Essential concepts summary marked complete for J26AIM001.",
      mimeType: "text/plain",
      status: "Published",
      requiredFlag: 1,
      position: 1,
    });

    await connection.query(
      `INSERT INTO academic_material_progress (person_id, material_id, percent, status, completed_at)
       VALUES (?, ?, 100, 'COMPLETED', NOW())`,
      [primaryStudent.user_id, matSecId],
    );

    await insertQuestion({
      topicId: topic3Id,
      type: "MCQ",
      text: "When starting a timed quiz attempt in Smart Campus, which server rule enforces fairness?",
      options: [
        "Frozen sanitized question snapshot + server expires_at",
        "Client-side timer only",
        "Sending correct answers inside initial quiz payload",
        "Unlimited unauthenticated retries",
      ],
      answer: "Frozen sanitized question snapshot + server expires_at",
      explanation: "Answer keys are stripped from student payloads and expiry is checked on the server.",
      marks: 2.0,
      difficulty: "Medium",
    });
    await insertQuestion({
      topicId: topic3Id,
      type: "TrueFalse",
      text: "Submitting the same quiz attempt twice with an idempotency key prevents duplicate grade rows.",
      options: ["True", "False"],
      answer: "True",
      explanation: "Duplicate submit requests return the existing evaluated score record.",
      marks: 1.0,
      difficulty: "Easy",
    });

    await connection.query(
      `INSERT INTO academic_quizzes
        (topic_id, title, description, version, time_limit, pass_mark, max_attempts, open_at, close_at, status, shuffle_questions, shuffle_options, show_explanation, created_by)
       VALUES (?, ?, 'Unlocked & ready for immediate student attempt.', 1, 15, 50.00, 3, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 90 DAY), 'Published', 1, 1, 1, ?)`,
      [topic3Id, `${targetSecSub.subject_code} Ready Quiz`, primaryFaculty.user_id],
    );

    // =========================================================================
    // SCENARIO D (Lab / Third Subject): DRAFT TOPIC + UPCOMING SCHEDULED QUIZ
    // =========================================================================
    const topic4Id = await insertTopic({
      subjectId: subjLab.subject_id,
      title: `Practical Drill & Upcoming Quiz (${subjLab.subject_code})`,
      description: "Contains a lab manual and an upcoming scheduled quiz window.",
      position: subjLab.subject_id === subjMain.subject_id ? 4 : 1,
      quizEnabled: 1,
    });

    await insertMaterial({
      topicId: topic4Id,
      type: "Notes",
      title: "Lab Instructions & Rubric",
      description: "Step-by-step instructions for laboratory evaluation.",
      mimeType: "text/plain",
      status: "Published",
      requiredFlag: 1,
      position: 1,
    });

    await insertQuestion({
      topicId: topic4Id,
      type: "TrueFalse",
      text: "Unit tests and boundary checks must pass before lab submission.",
      options: ["True", "False"],
      answer: "True",
      explanation: "Automated grading validates edge cases alongside nominal behavior.",
      marks: 1.0,
      difficulty: "Easy",
    });

    await connection.query(
      `INSERT INTO academic_quizzes
        (topic_id, title, description, version, time_limit, pass_mark, max_attempts, open_at, close_at, status, created_by)
       VALUES (?, ?, 'Scheduled to open in the future (tests open_at window rule).', 1, 10, 50.00, 2, DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 'Published', ?)`,
      [topic4Id, `${subjLab.subject_code} Scheduled Upcoming Quiz`, primaryFaculty.user_id],
    );

    // =========================================================================
    // SCENARIO E (Unenrolled Subject): RBAC ISOLATION TEST FIXTURE
    // =========================================================================
    if (subjRestricted) {
      const topicRestrId = await insertTopic({
        subjectId: subjRestricted.subject_id,
        title: `Restricted Subject Topic (${subjRestricted.subject_code})`,
        description: "Student J26AIM001 is NOT enrolled in this subject (verifies 403 enrollment guard).",
        position: 1,
        quizEnabled: 1,
      });

      await insertQuestion({
        topicId: topicRestrId,
        type: "TrueFalse",
        text: "Enrolled students only may access this quiz.",
        options: ["True", "False"],
        answer: "True",
        marks: 1.0,
      });

      await connection.query(
        `INSERT INTO academic_quizzes
          (topic_id, title, description, version, time_limit, pass_mark, max_attempts, status, created_by)
         VALUES (?, ?, 'Restricted to students registered in this subject.', 1, 10, 50.00, 1, 'Published', ?)`,
        [topicRestrId, `${subjRestricted.subject_code} Restricted Quiz`, primaryFaculty.user_id],
      );
    }

    // =========================================================================
    // SCENARIO F: ML BRIDGE JOB + FOUR-FIELD AUDIT LEDGER EVENTS
    // =========================================================================
    await connection.query(
      `INSERT INTO academic_ml_jobs (topic_id, material_id, job_type, status, requested_by, result_summary)
       VALUES (?, ?, 'QUESTION_GENERATION', 'COMPLETED', ?, ?)`,
      [
        topic1Id,
        mat1Id,
        primaryFaculty.user_id,
        JSON.stringify({ generated_drafts: 1, note: "ML schema compatibility placeholder" }),
      ],
    );

    const ledgerEvents = [
      [primaryFaculty.user_id, `ACAD-TOPIC-${topic1Id}`, "MATERIAL_UPLOAD", JSON.stringify({ materialId: mat1Id, title: "Unit 1 Comprehensive Lecture Notes (v2)" }), null],
      [primaryStudent.user_id, `ACAD-MAT-${mat1Id}`, "MATERIAL_COMPLETED", JSON.stringify({ materialId: mat1Id, percent: 100 }), null],
      [primaryStudent.user_id, `ACAD-QUIZ-${quiz1Id}`, "QUIZ_ATTEMPT_START", JSON.stringify({ attemptId: attempt1Id, attemptNumber: 1 }), null],
      [primaryStudent.user_id, `ACAD-QUIZ-${quiz1Id}`, "QUIZ_SUBMIT", JSON.stringify({ attemptId: attempt1Id, score: 6, maxScore: 7, result: "PASSED" }), null],
      [primaryFaculty.user_id, `ACAD-QUIZ-${quiz1Id}`, "SCORE_CORRECTION", JSON.stringify({ attemptId: attempt1Id, previousScore: 5, newScore: 6 }), "PARTIAL_STEP_CREDIT"],
    ];

    for (const [personId, locationId, eventType, payload, reasonCode] of ledgerEvents) {
      await connection.query(
        `INSERT INTO academic_audit_ledger (person_id, location_id, timestamp, event_type, payload, reason_code)
         VALUES (?, ?, NOW(), ?, ?, ?)`,
        [personId, locationId, eventType, payload, reasonCode],
      );
    }

    await connection.commit();

    console.log("[SEED-ACADEMIC] ✓ Academic Module dummy data seeded successfully!");
    console.log("[SEED-ACADEMIC] Demo Accounts & Credentials:");
    console.log(`  - Admin:           ${adminUser.username} / Admin@123`);
    console.log(`  - Subject Staff:   ${primaryFaculty.username} / Faculty@123`);
    if (coFaculty) console.log(`  - Co-Teacher:      ${coFaculty.username} / Faculty@123`);
    console.log(`  - Student 1 (Main): ${primaryStudent.username} / Student@123`);
    if (peerStudent2) console.log(`  - Student 2 (WIP):  ${peerStudent2.username} / Student@123`);
    if (peerStudent3) console.log(`  - Student 3 (New):  ${peerStudent3.username} / Student@123`);
    console.log("[SEED-ACADEMIC] Seeded Test Scenarios:");
    console.log(`  - Unlocked + Completed Attempt + Score Correction: Subject ${subjMain.subject_code}, Topic ${topic1Id}, Quiz ${quiz1Id}`);
    console.log(`  - Locked Quiz (PREREQUISITES_NOT_MET AC-STU-03):   Subject ${subjMain.subject_code}, Topic ${topic2Id}`);
    console.log(`  - Ready to Attempt (Unlocked, 0 attempts):         Subject ${targetSecSub.subject_code}, Topic ${topic3Id}`);
    console.log(`  - Scheduled Future Open Window:                    Subject ${subjLab.subject_code}, Topic ${topic4Id}`);
    if (subjRestricted) {
      console.log(`  - Enrollment Guard (403 Forbidden for J26AIM001):  Subject ${subjRestricted.subject_code}`);
    }

    process.exit(0);
  } catch (err) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("[SEED-ACADEMIC] ✗ Academic demo seeding failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  seedAcademicDemo();
}

module.exports = { seedAcademicDemo };
