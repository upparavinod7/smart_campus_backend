const pool = require("../../config/mysql");
const { logAcademicEvent } = require("../../utils/academicLedger");

/**
 * GET /api/v1/academic/subjects/:id/results
 * Analytics dashboard for staff & HOD: completion funnel, per-question correctness, unstarted students
 */
async function getSubjectResults(req, res) {
  try {
    const subjectId = req.params.id;

    // 1. Enrolled students count
    const [enrolledRows] = await pool.query(
      `SELECT COUNT(DISTINCT e.student_id) AS total_enrolled
       FROM enrollments e
       JOIN sections s ON e.section_id = s.section_id
       JOIN course_offerings co ON s.offering_id = co.offering_id
       WHERE co.subject_id = ? AND e.status = 'REGISTERED'`,
      [subjectId],
    );
    const totalEnrolled = enrolledRows[0].total_enrolled || 0;

    // 2. Topic-by-topic funnel
    const [topicFunnels] = await pool.query(
      `SELECT 
        t.topic_id, t.title AS topic_title, t.position,
        (SELECT COUNT(DISTINCT p.person_id) 
         FROM academic_material_progress p 
         JOIN academic_materials m ON p.material_id = m.material_id 
         WHERE m.topic_id = t.topic_id AND p.status != 'NOT_STARTED') AS students_started_materials,
        (SELECT COUNT(DISTINCT a.person_id) 
         FROM academic_attempts a 
         JOIN academic_quizzes q ON a.quiz_id = q.quiz_id 
         WHERE q.topic_id = t.topic_id) AS students_attempted_quiz,
        (SELECT COUNT(DISTINCT a.person_id) 
         FROM academic_attempts a 
         JOIN academic_quizzes q ON a.quiz_id = q.quiz_id 
         WHERE q.topic_id = t.topic_id AND a.result = 'PASSED') AS students_passed_quiz,
        (SELECT COUNT(*) 
         FROM academic_attempts a 
         JOIN academic_quizzes q ON a.quiz_id = q.quiz_id 
         WHERE q.topic_id = t.topic_id AND a.status = 'SUBMITTED') AS total_quiz_submissions
       FROM academic_topics t
       WHERE t.subject_id = ?
       ORDER BY t.position ASC`,
      [subjectId],
    );

    // 3. Question difficulty & correctness breakdown
    const [questionStats] = await pool.query(
      `SELECT 
        q.question_id, q.topic_id, t.title AS topic_title, q.text, q.type, q.marks, q.difficulty,
        COUNT(ans.answer_id) AS total_answers,
        COUNT(CASE WHEN ans.is_correct = 1 THEN 1 END) AS correct_answers,
        ROUND((COUNT(CASE WHEN ans.is_correct = 1 THEN 1 END) / NULLIF(COUNT(ans.answer_id), 0)) * 100, 2) AS accuracy_percentage
       FROM academic_questions q
       JOIN academic_topics t ON q.topic_id = t.topic_id
       LEFT JOIN academic_attempt_answers ans ON q.question_id = ans.question_id
       WHERE t.subject_id = ?
       GROUP BY q.question_id, q.topic_id, t.title, q.text, q.type, q.marks, q.difficulty
       ORDER BY accuracy_percentage ASC, total_answers DESC`,
      [subjectId],
    );

    // 4. Students who have not started any topic
    const [unstartedStudents] = await pool.query(
      `SELECT DISTINCT stu.student_id, stu.register_no, u.full_name, u.email
       FROM enrollments e
       JOIN students stu ON e.student_id = stu.student_id
       JOIN users u ON u.student_id = stu.student_id
       JOIN sections s ON e.section_id = s.section_id
       JOIN course_offerings co ON s.offering_id = co.offering_id
       WHERE co.subject_id = ? AND e.status = 'REGISTERED'
         AND u.user_id NOT IN (
           SELECT DISTINCT p.person_id 
           FROM academic_material_progress p
           JOIN academic_materials m ON p.material_id = m.material_id
           JOIN academic_topics t ON m.topic_id = t.topic_id
           WHERE t.subject_id = ?
         )
       ORDER BY stu.register_no ASC`,
      [subjectId, subjectId],
    );

    return res.status(200).json({
      success: true,
      data: {
        subject_id: parseInt(subjectId, 10),
        total_enrolled: totalEnrolled,
        funnel: topicFunnels,
        question_accuracy: questionStats,
        unstarted_students_count: unstartedStudents.length,
        unstarted_students: unstartedStudents,
      },
    });
  } catch (err) {
    console.error("[AcademicAnalytics] getSubjectResults error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/subjects/:id/results/export
 * Exports subject grades and quiz performance as CSV
 */
async function exportSubjectResultsCsv(req, res) {
  try {
    const subjectId = req.params.id;

    const [rows] = await pool.query(
      `SELECT 
        stu.register_no, u.full_name, t.title AS topic_title,
        a.attempt_number, a.score, a.max_score, a.percentage, a.result, a.submitted_at
       FROM enrollments e
       JOIN students stu ON e.student_id = stu.student_id
       JOIN users u ON u.student_id = stu.student_id
       JOIN sections s ON e.section_id = s.section_id
       JOIN course_offerings co ON s.offering_id = co.offering_id
       LEFT JOIN academic_attempts a ON a.person_id = u.user_id AND a.status = 'SUBMITTED'
       LEFT JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       LEFT JOIN academic_topics t ON q.topic_id = t.topic_id AND t.subject_id = co.subject_id
       WHERE co.subject_id = ? AND e.status = 'REGISTERED'
       ORDER BY stu.register_no ASC, t.position ASC, a.attempt_number ASC`,
      [subjectId],
    );

    let csv = "Register No,Full Name,Topic,Attempt,Score,Max Score,Percentage,Result,Submitted At\n";
    rows.forEach((r) => {
      const line = [
        `"${r.register_no || ""}"`,
        `"${r.full_name || ""}"`,
        `"${r.topic_title || "N/A"}"`,
        r.attempt_number || "",
        r.score !== null ? r.score : "",
        r.max_score !== null ? r.max_score : "",
        r.percentage !== null ? `${r.percentage}%` : "",
        `"${r.result || "N/A"}"`,
        `"${r.submitted_at ? new Date(r.submitted_at).toISOString() : ""}"`,
      ].join(",");
      csv += line + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="subject_${subjectId}_academic_results.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[AcademicAnalytics] exportSubjectResultsCsv error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/me/progress
 * Returns student's personal learning progress across all enrolled subjects
 */
async function getMyAcademicProgress(req, res) {
  try {
    const user = req.user;

    // Fetch student's enrolled subjects
    const [subjects] = await pool.query(
      `SELECT DISTINCT 
        s.subject_id, s.subject_code AS code, s.subject_code, s.name
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.section_id
       JOIN course_offerings co ON sec.offering_id = co.offering_id
       JOIN subjects s ON co.subject_id = s.subject_id
       WHERE e.student_id = ? AND e.status = 'REGISTERED'
       ORDER BY s.subject_code ASC`,
      [user.student_id],
    );

    const resultSubjects = [];

    for (const sub of subjects) {
      // Fetch topics for this subject
      const [topics] = await pool.query(
        `SELECT t.topic_id, t.title, t.position, t.quiz_enabled,
          q.quiz_id, q.title AS quiz_title, q.pass_mark, q.status AS quiz_status
         FROM academic_topics t
         LEFT JOIN academic_quizzes q ON t.topic_id = q.topic_id
         WHERE t.subject_id = ?
         ORDER BY t.position ASC`,
        [sub.subject_id],
      );

      for (const t of topics) {
        // Material progress
        const [matStats] = await pool.query(
          `SELECT 
            COUNT(m.material_id) AS total_materials,
            COUNT(CASE WHEN m.required_flag = 1 THEN 1 END) AS total_required,
            COUNT(CASE WHEN p.status = 'COMPLETED' THEN 1 END) AS completed_materials,
            COUNT(CASE WHEN m.required_flag = 1 AND p.status = 'COMPLETED' THEN 1 END) AS completed_required
           FROM academic_materials m
           LEFT JOIN academic_material_progress p ON m.material_id = p.material_id AND p.person_id = ?
           WHERE m.topic_id = ? AND m.status = 'Published'`,
          [user.user_id, t.topic_id],
        );

        t.materials_summary = matStats[0];

        // Quiz attempts
        if (t.quiz_id) {
          const [attempts] = await pool.query(
            `SELECT attempt_id, attempt_number, score, max_score, percentage, result, status, submitted_at
             FROM academic_attempts
             WHERE quiz_id = ? AND person_id = ?
             ORDER BY attempt_number DESC`,
            [t.quiz_id, user.user_id],
          );
          t.quiz_attempts = attempts;
          t.best_percentage = attempts.length > 0
            ? Math.max(...attempts.map((a) => (a.percentage ? parseFloat(a.percentage) : 0)))
            : null;
          t.quiz_passed = attempts.some((a) => a.result === "PASSED");
        }
      }

      sub.topics = topics;
      resultSubjects.push(sub);
    }

    return res.status(200).json({
      success: true,
      data: resultSubjects,
    });
  } catch (err) {
    console.error("[AcademicAnalytics] getMyAcademicProgress error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/attempts/:id/score-correction
 * Manual score correction with audit trail
 */
async function correctAttemptScore(req, res) {
  const conn = await pool.getConnection();
  try {
    const attemptId = req.params.id;
    const user = req.user;
    const { new_score, reason_code, justification } = req.body;

    if (new_score === undefined || new_score === null || isNaN(parseFloat(new_score))) {
      return res.status(400).json({ success: false, message: "new_score (numeric) is required" });
    }

    if (!reason_code || !justification) {
      return res.status(400).json({
        success: false,
        message: "reason_code and justification are mandatory for score corrections",
      });
    }

    await conn.beginTransaction();

    const [attempts] = await conn.query(
      `SELECT a.*, q.pass_mark, q.quiz_id, q.topic_id 
       FROM academic_attempts a
       JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       WHERE a.attempt_id = ? FOR UPDATE`,
      [attemptId],
    );

    if (attempts.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }

    const attempt = attempts[0];
    const previousScore = parseFloat(attempt.score) || 0;
    const targetScore = parseFloat(new_score);
    const maxScore = parseFloat(attempt.max_score) || targetScore;
    const passMark = parseFloat(attempt.pass_mark) || 50.0;

    const newPercentage = maxScore > 0 ? (targetScore / maxScore) * 100 : 0;
    const newResult = newPercentage >= passMark ? "PASSED" : "FAILED";

    // Insert into academic_score_corrections
    await conn.query(
      `INSERT INTO academic_score_corrections
        (attempt_id, previous_score, new_score, reason_code, justification, corrected_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [attemptId, previousScore, targetScore, reason_code, justification, user.user_id],
    );

    // Update attempt
    await conn.query(
      `UPDATE academic_attempts SET
        score = ?,
        percentage = ?,
        result = ?,
        status = 'SUBMITTED'
       WHERE attempt_id = ?`,
      [targetScore, newPercentage.toFixed(2), newResult, attemptId],
    );

    await conn.commit();

    await logAcademicEvent({
      personId: user.user_id,
      locationId: `ACAD-QUIZ-${attempt.quiz_id}`,
      eventType: "SCORE_CORRECTION",
      reasonCode: reason_code,
      payload: {
        attemptId,
        previousScore,
        newScore: targetScore,
        justification,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Score successfully corrected",
      data: {
        attempt_id: parseInt(attemptId, 10),
        previous_score: previousScore,
        new_score: targetScore,
        max_score: maxScore,
        percentage: parseFloat(newPercentage.toFixed(2)),
        result: newResult,
        reason_code,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("[AcademicAnalytics] correctAttemptScore error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    conn.release();
  }
}

/**
 * GET /api/v1/academic/permissions
 */
async function getPermissionsMatrix(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM academic_permission_matrix ORDER BY policy_id ASC");
    rows.forEach((r) => {
      if (typeof r.allowed_roles === "string") {
        try {
          r.allowed_roles = JSON.parse(r.allowed_roles);
        } catch (e) {}
      }
    });

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[AcademicAnalytics] getPermissionsMatrix error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/permissions/:action
 */
async function updatePermissionPolicy(req, res) {
  try {
    const { action } = req.params;
    const { allowed_roles, requires_subject_staff, description } = req.body;

    const [existing] = await pool.query("SELECT * FROM academic_permission_matrix WHERE action = ?", [action]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Policy action not found" });
    }

    const updates = [];
    const params = [];

    if (allowed_roles !== undefined) {
      const jsonStr = typeof allowed_roles === "string" ? allowed_roles : JSON.stringify(allowed_roles);
      updates.push("allowed_roles = ?");
      params.push(jsonStr);
    }

    if (requires_subject_staff !== undefined) {
      updates.push("requires_subject_staff = ?");
      params.push(requires_subject_staff ? 1 : 0);
    }

    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }

    if (updates.length > 0) {
      params.push(action);
      await pool.query(`UPDATE academic_permission_matrix SET ${updates.join(", ")}, updated_at = NOW() WHERE action = ?`, params);
    }

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-POL-${action}`,
      eventType: "POLICY_UPDATED",
      payload: req.body,
    });

    return res.status(200).json({ success: true, message: "Policy updated successfully" });
  } catch (err) {
    console.error("[AcademicAnalytics] updatePermissionPolicy error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/admin/oversight
 * College-wide academic oversight for Admin
 */
async function getAdminAcademicOversight(req, res) {
  try {
    const { department_id, search } = req.query;

    // 1. All uploaded materials across college
    let matSql = `
      SELECT 
        m.material_id, m.title, m.type, m.version, m.status, m.required_flag, m.created_at, m.file_ref,
        s.subject_code, s.name AS subject_name, s.owner_department_id AS department_id,
        t.title AS topic_title,
        d.name AS department_name, d.code AS department_code,
        COALESCE(f.full_name, u.full_name, u.username) AS faculty_name,
        f.employee_code,
        (SELECT COUNT(*) FROM academic_material_progress p WHERE p.material_id = m.material_id AND p.status = 'COMPLETED') AS completed_students_count
      FROM academic_materials m
      JOIN academic_topics t ON m.topic_id = t.topic_id
      JOIN subjects s ON t.subject_id = s.subject_id
      LEFT JOIN departments d ON s.owner_department_id = d.department_id
      LEFT JOIN users u ON m.created_by = u.user_id
      LEFT JOIN faculty f ON u.faculty_id = f.faculty_id
    `;
    const matParams = [];
    const matConds = [];
    if (department_id) {
      matConds.push("s.owner_department_id = ?");
      matParams.push(department_id);
    }
    if (search) {
      matConds.push("(m.title LIKE ? OR s.subject_code LIKE ? OR s.name LIKE ? OR f.full_name LIKE ?)");
      matParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (matConds.length > 0) matSql += " WHERE " + matConds.join(" AND ");
    matSql += " ORDER BY m.created_at DESC LIMIT 200";
    const [materials] = await pool.query(matSql, matParams);

    // 2. All quizzes across college
    let quizSql = `
      SELECT 
        q.quiz_id, q.title, q.version, q.time_limit, q.pass_mark, q.max_attempts, q.open_at, q.close_at, q.status, q.created_at,
        s.subject_code, s.name AS subject_name, s.owner_department_id AS department_id,
        t.title AS topic_title,
        d.name AS department_name, d.code AS department_code,
        COALESCE(f.full_name, u.full_name, u.username) AS faculty_name,
        f.employee_code,
        (SELECT COUNT(*) FROM academic_questions qn WHERE qn.topic_id = q.topic_id AND qn.status = 'Approved') AS total_questions,
        (SELECT COUNT(*) FROM academic_attempts a WHERE a.quiz_id = q.quiz_id) AS total_attempts,
        (SELECT COUNT(*) FROM academic_attempts a WHERE a.quiz_id = q.quiz_id AND a.result = 'PASSED') AS passed_attempts
      FROM academic_quizzes q
      JOIN academic_topics t ON q.topic_id = t.topic_id
      JOIN subjects s ON t.subject_id = s.subject_id
      LEFT JOIN departments d ON s.owner_department_id = d.department_id
      LEFT JOIN users u ON q.created_by = u.user_id
      LEFT JOIN faculty f ON u.faculty_id = f.faculty_id
    `;
    const quizParams = [];
    const quizConds = [];
    if (department_id) {
      quizConds.push("s.owner_department_id = ?");
      quizParams.push(department_id);
    }
    if (search) {
      quizConds.push("(q.title LIKE ? OR s.subject_code LIKE ? OR s.name LIKE ? OR f.full_name LIKE ?)");
      quizParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (quizConds.length > 0) quizSql += " WHERE " + quizConds.join(" AND ");
    quizSql += " ORDER BY q.created_at DESC LIMIT 200";
    const [quizzes] = await pool.query(quizSql, quizParams);

    // 3. Student activities in quizzes & study materials
    const [studentAttempts] = await pool.query(
      `SELECT 
        a.attempt_id, a.attempt_number, a.score, a.max_score, a.percentage, a.result, a.status, a.started_at, a.submitted_at,
        q.title AS quiz_title,
        s.subject_code, s.name AS subject_name,
        COALESCE(stu.full_name, u.full_name, u.username) AS student_name,
        COALESCE(stu.register_no, u.username) AS register_no,
        d.name AS department_name
       FROM academic_attempts a
       JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       JOIN academic_topics t ON q.topic_id = t.topic_id
       JOIN subjects s ON t.subject_id = s.subject_id
       LEFT JOIN departments d ON s.owner_department_id = d.department_id
       LEFT JOIN users u ON a.person_id = u.user_id
       LEFT JOIN students stu ON u.student_id = stu.student_id
       ORDER BY a.started_at DESC LIMIT 100`,
    );

    // 4. College-wide faculty summary
    const [facultySummary] = await pool.query(
      `SELECT 
        f.faculty_id, f.employee_code, f.full_name, f.email,
        des.name AS designation,
        d.name AS department_name, d.code AS department_code,
        COUNT(DISTINCT m.material_id) AS total_materials,
        COUNT(DISTINCT q.quiz_id) AS total_quizzes
       FROM faculty f
       LEFT JOIN designations des ON f.designation_id = des.designation_id
       LEFT JOIN departments d ON f.department_id = d.department_id
       LEFT JOIN users u ON f.faculty_id = u.faculty_id
       LEFT JOIN academic_materials m ON m.created_by = u.user_id
       LEFT JOIN academic_quizzes q ON q.created_by = u.user_id
       WHERE f.is_active = 1
       GROUP BY f.faculty_id, f.employee_code, f.full_name, f.email, des.name, d.name, d.code
       ORDER BY d.name ASC, f.full_name ASC`,
    );

    // 5. Overall summary counts
    const [summaryCounts] = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM faculty WHERE is_active = 1) AS total_faculty,
        (SELECT COUNT(*) FROM academic_materials) AS total_materials,
        (SELECT COUNT(*) FROM academic_quizzes) AS total_quizzes,
        (SELECT COUNT(*) FROM academic_attempts) AS total_attempts,
        (SELECT COUNT(DISTINCT person_id) FROM academic_attempts) AS total_students_participated,
        (SELECT ROUND(AVG(percentage), 1) FROM academic_attempts WHERE status = 'SUBMITTED') AS average_quiz_score`,
    );

    return res.status(200).json({
      success: true,
      data: {
        summary: summaryCounts[0] || {},
        materials,
        quizzes,
        student_activities: studentAttempts,
        faculty_summary: facultySummary,
      },
    });
  } catch (err) {
    console.error("[AcademicAnalytics] getAdminAcademicOversight error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

module.exports = {
  getSubjectResults,
  exportSubjectResultsCsv,
  getMyAcademicProgress,
  correctAttemptScore,
  getPermissionsMatrix,
  updatePermissionPolicy,
  getAdminAcademicOversight,
};

