const pool = require("../config/mysql");

/**
 * Resolves the subject_id from request parameters across various route shapes:
 * - /subjects/:subjectId or /subjects/:id
 * - /topics/:topicId
 * - /materials/:materialId
 * - /quizzes/:quizId
 * - /attempts/:attemptId
 * - /questions/:questionId
 */
async function resolveSubjectId(req) {
  if (req.params.subjectId) return parseInt(req.params.subjectId, 10);
  if (req.body && req.body.subject_id) return parseInt(req.body.subject_id, 10);

  const fullPath = (req.baseUrl || "") + (req.path || "") + (req.originalUrl || "");

  if ((fullPath.includes("/subjects/") || fullPath.endsWith("/subjects")) && req.params.id) {
    return parseInt(req.params.id, 10);
  }

  const topicId = req.params.topicId || (fullPath.includes("/topics/") && req.params.id);
  if (topicId) {
    const [rows] = await pool.query(
      "SELECT subject_id FROM academic_topics WHERE topic_id = ?",
      [topicId],
    );
    if (rows.length > 0) return rows[0].subject_id;
  }

  const materialId = req.params.materialId || (fullPath.includes("/materials/") && req.params.id);
  if (materialId) {
    const [rows] = await pool.query(
      `SELECT t.subject_id 
       FROM academic_materials m
       JOIN academic_topics t ON m.topic_id = t.topic_id
       WHERE m.material_id = ?`,
      [materialId],
    );
    if (rows.length > 0) return rows[0].subject_id;
  }

  const quizId = req.params.quizId || (fullPath.includes("/quizzes/") && req.params.id);
  if (quizId) {
    const [rows] = await pool.query(
      `SELECT t.subject_id 
       FROM academic_quizzes q
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE q.quiz_id = ?`,
      [quizId],
    );
    if (rows.length > 0) return rows[0].subject_id;
  }

  const attemptId = req.params.attemptId || (fullPath.includes("/attempts/") && req.params.id);
  if (attemptId) {
    const [rows] = await pool.query(
      `SELECT t.subject_id 
       FROM academic_attempts a
       JOIN academic_quizzes q ON a.quiz_id = q.quiz_id
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE a.attempt_id = ?`,
      [attemptId],
    );
    if (rows.length > 0) return rows[0].subject_id;
  }

  const questionId = req.params.questionId || (fullPath.includes("/questions/") && req.params.id);
  if (questionId) {
    const [rows] = await pool.query(
      `SELECT t.subject_id 
       FROM academic_questions q
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE q.question_id = ?`,
      [questionId],
    );
    if (rows.length > 0) return rows[0].subject_id;
  }

  const jobId = req.params.jobId || (fullPath.includes("/jobs/") && req.params.id);
  if (jobId) {
    const [rows] = await pool.query(
      `SELECT t.subject_id 
       FROM academic_ml_jobs j
       JOIN academic_topics t ON j.topic_id = t.topic_id
       WHERE j.job_id = ?`,
      [jobId],
    );
    if (rows.length > 0) return rows[0].subject_id;
  }

  return null;
}

/**
 * Checks whether a faculty member is assigned, coordinating, teaching, or in the department of a subject
 */
async function isFacultyAuthorizedForSubject(facultyId, subjectId) {
  if (!facultyId || !subjectId) return false;

  // 1. Direct assignment in subject_staff_assignments
  const [staffRows] = await pool.query(
    "SELECT 1 FROM subject_staff_assignments WHERE subject_id = ? AND faculty_id = ? LIMIT 1",
    [subjectId, facultyId],
  );
  if (staffRows.length > 0) return true;

  // 2. Coordinator in course_offerings
  const [coordRows] = await pool.query(
    "SELECT 1 FROM course_offerings WHERE subject_id = ? AND coordinator_faculty_id = ? LIMIT 1",
    [subjectId, facultyId],
  );
  if (coordRows.length > 0) return true;

  // 3. Timetable slot assignment
  const [slotRows] = await pool.query(
    `SELECT 1 
     FROM timetable_slots ts
     JOIN sections s ON ts.section_id = s.section_id
     JOIN course_offerings co ON s.offering_id = co.offering_id
     WHERE co.subject_id = ? AND ts.faculty_id = ? AND ts.is_active = 1
     LIMIT 1`,
    [subjectId, facultyId],
  );
  if (slotRows.length > 0) return true;

  // 4. Department HOD (only authenticated Head of Department has department-wide scope)
  const [hodRows] = await pool.query(
    `SELECT 1 
     FROM subjects sub
     JOIN faculty f ON sub.owner_department_id = f.department_id
     LEFT JOIN designations des ON f.designation_id = des.designation_id
     WHERE sub.subject_id = ? AND f.faculty_id = ? AND f.is_active = 1
       AND (
         des.name LIKE '%Head of Department%' OR 
         des.name LIKE '%HOD%' OR 
         f.employee_code LIKE '%HOD%'
       )
     LIMIT 1`,
    [subjectId, facultyId],
  );
  if (hodRows.length > 0) return true;

  return false;
}

/**
 * Checks whether a student is enrolled in a registered section for the subject
 */
async function isStudentEnrolledInSubject(studentId, subjectId) {
  if (!studentId || !subjectId) return false;

  const [rows] = await pool.query(
    `SELECT 1 
     FROM enrollments e
     JOIN sections s ON e.section_id = s.section_id
     JOIN course_offerings co ON s.offering_id = co.offering_id
     WHERE e.student_id = ? AND co.subject_id = ? AND e.status = 'REGISTERED'
     LIMIT 1`,
    [studentId, subjectId],
  );

  return rows.length > 0;
}

/**
 * Policy & RBAC middleware enforcing AC-POL-01
 */
function requireAcademicPolicy(action) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // 1. Fetch policy definition
      const [policies] = await pool.query(
        "SELECT * FROM academic_permission_matrix WHERE action = ? LIMIT 1",
        [action],
      );

      let allowedRoles = ["ADMIN", "FACULTY"];
      let requiresSubjectStaff = 1;

      if (policies.length > 0) {
        allowedRoles = typeof policies[0].allowed_roles === "string"
          ? JSON.parse(policies[0].allowed_roles)
          : policies[0].allowed_roles;
        requiresSubjectStaff = policies[0].requires_subject_staff;
      }

      // 2. Check role match
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Role ${user.role} is not permitted to perform action '${action}'.`,
        });
      }

      // ADMIN has superuser access
      if (user.role === "ADMIN") {
        return next();
      }

      // 3. If action requires subject staff association
      if (requiresSubjectStaff) {
        const subjectId = await resolveSubjectId(req);
        if (subjectId) {
          req.academicSubjectId = subjectId;
          if (user.role === "FACULTY") {
            const authorized = await isFacultyAuthorizedForSubject(user.faculty_id, subjectId);
            if (!authorized) {
              return res.status(403).json({
                success: false,
                message: "Access denied. You are not assigned to or authorized for this subject.",
              });
            }
          }
        }
      }

      next();
    } catch (err) {
      console.error("[AcademicAuth] Error validating policy:", err);
      return res.status(500).json({
        success: false,
        message: "Internal authorization failure",
      });
    }
  };
}

/**
 * Ensures student is actively enrolled before accessing student-facing academic resources
 */
function requireStudentSubjectEnrollment() {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      // Admins and faculty can view content
      if (user.role === "ADMIN" || user.role === "FACULTY") {
        return next();
      }

      if (user.role !== "STUDENT") {
        return res.status(403).json({ success: false, message: "Student role required" });
      }

      const subjectId = await resolveSubjectId(req);
      if (subjectId) {
        req.academicSubjectId = subjectId;
        const enrolled = await isStudentEnrolledInSubject(user.student_id, subjectId);
        if (!enrolled) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You are not enrolled in this subject.",
          });
        }
      }

      next();
    } catch (err) {
      console.error("[AcademicAuth] Student enrollment check failed:", err);
      return res.status(500).json({ success: false, message: "Internal error checking enrollment" });
    }
  };
}

module.exports = {
  resolveSubjectId,
  isFacultyAuthorizedForSubject,
  isStudentEnrolledInSubject,
  requireAcademicPolicy,
  requireStudentSubjectEnrollment,
};

