const pool = require("../../config/mysql");
const { logAcademicEvent } = require("../../utils/academicLedger");

/**
 * Helper to resolve full faculty identity, department association, and HOD status
 */
async function resolveFacultyProfile(user) {
  if (!user || user.role !== "FACULTY" || !user.faculty_id) {
    return { isFaculty: false, isHOD: false, departmentId: null, employeeCode: null };
  }
  const [rows] = await pool.query(
    `SELECT f.faculty_id, f.employee_code, f.full_name, f.department_id, f.is_active,
            des.name AS designation_name,
            d.name AS department_name
     FROM faculty f
     LEFT JOIN designations des ON f.designation_id = des.designation_id
     LEFT JOIN departments d ON f.department_id = d.department_id
     WHERE f.faculty_id = ? AND f.is_active = 1`,
    [user.faculty_id],
  );
  if (rows.length === 0) {
    return { isFaculty: false, isHOD: false, departmentId: null, employeeCode: null };
  }
  const fac = rows[0];
  const isHOD = Boolean(
    (fac.designation_name && (
      fac.designation_name.includes("Head of Department") || 
      fac.designation_name.includes("HOD")
    )) ||
    (fac.employee_code && fac.employee_code.toUpperCase().includes("HOD")) ||
    (user.username && user.username.toUpperCase().includes("HOD"))
  );

  return {
    isFaculty: true,
    isHOD,
    departmentId: fac.department_id,
    departmentName: fac.department_name,
    employeeCode: fac.employee_code,
    fullName: fac.full_name,
    designationName: fac.designation_name,
  };
}

/**
 * GET /api/v1/academic/subjects
 * Retrieves subjects tailored to role:
 * - Admin: institution-wide visibility across all departments/programmes with multi-filters
 * - HOD: all subjects belonging to HOD's department (owner_department_id = HOD_dept)
 * - Faculty: ONLY subjects assigned to faculty in subject_staff_assignments, coordinator or timetable slot
 * - Student: registered/enrolled subjects
 */
async function getSubjects(req, res) {
  try {
    const user = req.user;
    const {
      search,
      department_id,
      school_id,
      programme_id,
      batch_id,
      academic_year_id,
      year,
      semester,
      faculty_id,
      is_active,
    } = req.query;

    let sql = `
      SELECT DISTINCT 
        s.subject_id, s.subject_code AS code, s.subject_code, s.name,
        s.owner_department_id AS department_id, s.owner_department_id,
        s.owner_school_id,
        s.credits AS credit_hours, s.credits, s.is_active, s.ml_enabled, s.delivery_type,
        d.name AS department_name, d.code AS department_code,
        sch.school_id, sch.name AS school_name, sch.code AS school_code,
        ps.programme_id, p.name AS programme_name, p.programme_code,
        ps.semester_no AS semester, ps.year_no AS year,
        (SELECT COUNT(DISTINCT ssa.faculty_id) FROM subject_staff_assignments ssa WHERE ssa.subject_id = s.subject_id) AS assigned_faculty_count,
        (SELECT COUNT(*) FROM academic_topics t WHERE t.subject_id = s.subject_id) AS total_topics,
        (SELECT COUNT(*) FROM academic_materials m JOIN academic_topics t ON m.topic_id = t.topic_id WHERE t.subject_id = s.subject_id) AS total_materials,
        (SELECT COUNT(*) FROM academic_quizzes q JOIN academic_topics t ON q.topic_id = t.topic_id WHERE t.subject_id = s.subject_id) AS total_quizzes,
        (SELECT COUNT(*) FROM academic_questions aq JOIN academic_topics t ON aq.topic_id = t.topic_id WHERE t.subject_id = s.subject_id) AS total_questions,
        (SELECT COUNT(DISTINCT e.student_id) 
         FROM enrollments e 
         JOIN sections sec ON e.section_id = sec.section_id 
         JOIN course_offerings co ON sec.offering_id = co.offering_id 
         WHERE co.subject_id = s.subject_id AND e.status = 'REGISTERED') AS total_enrolled
    `;

    if (user.role === "FACULTY") {
      sql += `, (
        SELECT ssa.role FROM subject_staff_assignments ssa 
        WHERE ssa.subject_id = s.subject_id AND ssa.faculty_id = ? 
        LIMIT 1
      ) AS my_assignment_role`;
    }

    sql += `
      FROM subjects s
      LEFT JOIN departments d ON s.owner_department_id = d.department_id
      LEFT JOIN schools sch ON s.owner_school_id = sch.school_id
      LEFT JOIN (
        SELECT subject_id, MIN(programme_id) AS programme_id, MIN(semester_no) AS semester_no, MIN(year_no) AS year_no
        FROM programme_subjects
        GROUP BY subject_id
      ) ps ON s.subject_id = ps.subject_id
      LEFT JOIN programmes p ON ps.programme_id = p.programme_id
    `;

    const params = [];
    if (user.role === "FACULTY") {
      params.push(user.faculty_id);
    }
    const conditions = [];

    if (user.role === "STUDENT") {
      sql += `
        JOIN course_offerings co_stu ON s.subject_id = co_stu.subject_id
        JOIN sections sec_stu ON co_stu.offering_id = sec_stu.offering_id
        JOIN enrollments e_stu ON sec_stu.section_id = e_stu.section_id
      `;
      conditions.push("e_stu.student_id = ? AND e_stu.status = 'REGISTERED'");
      params.push(user.student_id);
    } else if (user.role === "FACULTY") {
      const facProfile = await resolveFacultyProfile(user);

      if (facProfile.isHOD) {
        // HOD sees all subjects in their own department
        if (department_id && parseInt(department_id, 10) !== facProfile.departmentId) {
          return res.status(403).json({
            success: false,
            message: "Access denied. HOD is only authorized to view subjects in their own department.",
          });
        }
        conditions.push("s.owner_department_id = ?");
        params.push(facProfile.departmentId);
      } else {
        // Regular Faculty: ONLY assigned subjects!
        if (faculty_id && parseInt(faculty_id, 10) !== user.faculty_id) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Faculty can only view their own assigned subjects.",
          });
        }
        conditions.push(`(
          EXISTS (SELECT 1 FROM subject_staff_assignments ssa_fac WHERE ssa_fac.subject_id = s.subject_id AND ssa_fac.faculty_id = ?) OR
          EXISTS (SELECT 1 FROM course_offerings co_fac WHERE co_fac.subject_id = s.subject_id AND co_fac.coordinator_faculty_id = ?) OR
          EXISTS (
            SELECT 1 FROM timetable_slots ts_fac 
            JOIN sections sec_ts ON ts_fac.section_id = sec_ts.section_id 
            JOIN course_offerings co_ts ON sec_ts.offering_id = co_ts.offering_id 
            WHERE co_ts.subject_id = s.subject_id AND ts_fac.faculty_id = ? AND ts_fac.is_active = 1
          )
        )`);
        params.push(user.faculty_id, user.faculty_id, user.faculty_id);
      }
    } else if (user.role === "ADMIN") {
      // Admin has unrestricted discovery
      if (department_id) {
        conditions.push("s.owner_department_id = ?");
        params.push(department_id);
      }
    }

    // Common filters for Admin and HOD
    if (faculty_id && (user.role === "ADMIN" || user.role === "FACULTY")) {
      conditions.push("EXISTS (SELECT 1 FROM subject_staff_assignments ssa_flt WHERE ssa_flt.subject_id = s.subject_id AND ssa_flt.faculty_id = ?)");
      params.push(faculty_id);
    }

    if (school_id) {
      conditions.push("s.owner_school_id = ?");
      params.push(school_id);
    }

    if (programme_id) {
      conditions.push("EXISTS (SELECT 1 FROM programme_subjects ps_flt WHERE ps_flt.subject_id = s.subject_id AND ps_flt.programme_id = ?)");
      params.push(programme_id);
    }

    if (batch_id) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM course_offerings co_b 
          JOIN sections sec_b ON co_b.offering_id = sec_b.offering_id 
          WHERE co_b.subject_id = s.subject_id AND sec_b.batch_id = ?
        ) OR EXISTS (
          SELECT 1 FROM programme_subjects ps_b 
          JOIN batches b_flt ON ps_b.programme_id = b_flt.programme_id 
          WHERE ps_b.subject_id = s.subject_id AND b_flt.batch_id = ?
        )
      )`);
      params.push(batch_id, batch_id);
    }

    if (semester) {
      conditions.push("EXISTS (SELECT 1 FROM programme_subjects ps_sem WHERE ps_sem.subject_id = s.subject_id AND ps_sem.semester_no = ?)");
      params.push(semester);
    }

    const yearVal = academic_year_id || year;
    if (yearVal) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM course_offerings co_y 
          JOIN academic_terms at_y ON co_y.term_id = at_y.term_id 
          WHERE co_y.subject_id = s.subject_id AND (at_y.academic_year_id = ? OR at_y.term_id = ?)
        ) OR EXISTS (
          SELECT 1 FROM programme_subjects ps_y 
          WHERE ps_y.subject_id = s.subject_id AND ps_y.year_no = ?
        )
      )`);
      params.push(yearVal, yearVal, yearVal);
    }

    if (search) {
      conditions.push("(s.name LIKE ? OR s.subject_code LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (is_active !== undefined) {
      conditions.push("s.is_active = ?");
      params.push(is_active === "true" || is_active === "1" ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.subject_code ASC";

    const [subjects] = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects,
    });
  } catch (err) {
    console.error("[AcademicSubject] getSubjects error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/subjects/:id
 * Fetches enriched subject details with strict role-based access control:
 * - Admin: Allowed
 * - HOD: Allowed if subject belongs to HOD's department (403 otherwise)
 * - Regular Faculty: Allowed if assigned to subject (403 otherwise)
 * - Student: Allowed if enrolled (403 otherwise)
 */
async function getSubjectById(req, res) {
  try {
    const subjectId = parseInt(req.params.id, 10);
    const user = req.user;

    const [rows] = await pool.query(
      `SELECT s.*, s.subject_code AS code, 
              d.name AS department_name, d.code AS department_code,
              sch.school_id, sch.name AS school_name, sch.code AS school_code,
              ps.programme_id, p.name AS programme_name, p.programme_code,
              ps.semester_no AS semester, ps.year_no AS year
       FROM subjects s
       LEFT JOIN departments d ON s.owner_department_id = d.department_id
       LEFT JOIN schools sch ON s.owner_school_id = sch.school_id
       LEFT JOIN (
         SELECT subject_id, MIN(programme_id) AS programme_id, MIN(semester_no) AS semester_no, MIN(year_no) AS year_no
         FROM programme_subjects
         GROUP BY subject_id
       ) ps ON s.subject_id = ps.subject_id
       LEFT JOIN programmes p ON ps.programme_id = p.programme_id
       WHERE s.subject_id = ?`,
      [subjectId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    const subject = rows[0];

    // Role-based Access Authorization Check
    if (user.role === "ADMIN") {
      // Superuser access granted
    } else if (user.role === "FACULTY") {
      const facProfile = await resolveFacultyProfile(user);
      if (facProfile.isHOD) {
        if (subject.owner_department_id !== facProfile.departmentId) {
          return res.status(403).json({
            success: false,
            message: "Access denied. HOD is only authorized to view subjects in their own department.",
          });
        }
      } else {
        // Regular faculty: must be assigned
        const [isAssigned] = await pool.query(
          `SELECT 1 FROM subject_staff_assignments WHERE subject_id = ? AND faculty_id = ?
           UNION
           SELECT 1 FROM course_offerings WHERE subject_id = ? AND coordinator_faculty_id = ?
           UNION
           SELECT 1 FROM timetable_slots ts
           JOIN sections sec ON ts.section_id = sec.section_id
           JOIN course_offerings co ON sec.offering_id = co.offering_id
           WHERE co.subject_id = ? AND ts.faculty_id = ? AND ts.is_active = 1
           LIMIT 1`,
          [subjectId, user.faculty_id, subjectId, user.faculty_id, subjectId, user.faculty_id],
        );

        if (isAssigned.length === 0) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You are not assigned to or authorized for this subject.",
          });
        }
      }
    } else if (user.role === "STUDENT") {
      const [isEnrolled] = await pool.query(
        `SELECT 1 
         FROM enrollments e
         JOIN sections s ON e.section_id = s.section_id
         JOIN course_offerings co ON s.offering_id = co.offering_id
         WHERE e.student_id = ? AND co.subject_id = ? AND e.status = 'REGISTERED'
         LIMIT 1`,
        [user.student_id, subjectId],
      );
      if (isEnrolled.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not enrolled in this subject.",
        });
      }
    }

    const [staff] = await pool.query(
      `SELECT ssa.assignment_id, ssa.faculty_id, ssa.role, ssa.created_at,
              f.employee_code, f.full_name, f.email, des.name AS designation_name,
              d.name AS department_name
       FROM subject_staff_assignments ssa
       JOIN faculty f ON ssa.faculty_id = f.faculty_id
       LEFT JOIN designations des ON f.designation_id = des.designation_id
       LEFT JOIN departments d ON f.department_id = d.department_id
       WHERE ssa.subject_id = ?
       ORDER BY 
         CASE 
           WHEN ssa.role IN ('Primary Instructor', 'Subject Staff', 'Course Coordinator') THEN 1
           WHEN ssa.role = 'Co-Teacher' THEN 2
           WHEN ssa.role = 'Lab Assistant' THEN 3
           ELSE 4
         END ASC,
         f.full_name ASC`,
      [subjectId],
    );

    const [topicCount] = await pool.query(
      "SELECT COUNT(*) AS total_topics FROM academic_topics WHERE subject_id = ?",
      [subjectId],
    );

    const [materialCount] = await pool.query(
      `SELECT COUNT(*) AS total_materials,
              COUNT(CASE WHEN m.status = 'Published' THEN 1 END) AS published_materials
       FROM academic_materials m
       JOIN academic_topics t ON m.topic_id = t.topic_id
       WHERE t.subject_id = ?`,
      [subjectId],
    );

    const [quizCount] = await pool.query(
      `SELECT COUNT(*) AS total_quizzes,
              COUNT(CASE WHEN q.status = 'Published' THEN 1 END) AS published_quizzes
       FROM academic_quizzes q
       JOIN academic_topics t ON q.topic_id = t.topic_id
       WHERE t.subject_id = ?`,
      [subjectId],
    );

    const [questionCount] = await pool.query(
      `SELECT COUNT(*) AS total_questions
       FROM academic_questions aq
       JOIN academic_topics t ON aq.topic_id = t.topic_id
       WHERE t.subject_id = ?`,
      [subjectId],
    );

    const [enrolledCount] = await pool.query(
      `SELECT COUNT(DISTINCT e.student_id) AS total_enrolled
       FROM enrollments e
       JOIN sections sec ON e.section_id = sec.section_id
       JOIN course_offerings co ON sec.offering_id = co.offering_id
       WHERE co.subject_id = ? AND e.status = 'REGISTERED'`,
      [subjectId],
    );

    // Identify user's individual role if faculty
    let myRole = null;
    if (user.role === "FACULTY") {
      const match = staff.find((s) => s.faculty_id === user.faculty_id);
      myRole = match ? match.role : "Faculty";
    }

    return res.status(200).json({
      success: true,
      data: {
        ...subject,
        total_topics: topicCount[0].total_topics,
        total_materials: materialCount[0].total_materials,
        published_materials: materialCount[0].published_materials,
        total_quizzes: quizCount[0].total_quizzes,
        published_quizzes: quizCount[0].published_quizzes,
        total_questions: questionCount[0].total_questions,
        total_enrolled: enrolledCount[0].total_enrolled,
        my_role: myRole,
        staff,
      },
    });
  } catch (err) {
    console.error("[AcademicSubject] getSubjectById error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/subjects/:id/staff
 * Assign faculty to subject (Only Admin or Department HOD)
 */
async function assignStaff(req, res) {
  try {
    const subjectId = parseInt(req.params.id, 10);
    const { faculty_id, role = "Subject Staff" } = req.body;

    if (!faculty_id) {
      return res.status(400).json({ success: false, message: "faculty_id is required" });
    }

    // Verify subject existence and department
    const [subRows] = await pool.query(
      "SELECT subject_id, owner_department_id FROM subjects WHERE subject_id = ?",
      [subjectId],
    );
    if (subRows.length === 0) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }
    const subject = subRows[0];

    // Authorization: Only ADMIN or HOD of that subject's department
    if (req.user.role === "ADMIN") {
      // Authorized
    } else if (req.user.role === "FACULTY") {
      const facProfile = await resolveFacultyProfile(req.user);
      if (!facProfile.isHOD || facProfile.departmentId !== subject.owner_department_id) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only the department HOD or an Administrator can assign faculty to this subject.",
        });
      }
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const [facultyRows] = await pool.query(
      "SELECT faculty_id, full_name, is_active FROM faculty WHERE faculty_id = ?",
      [faculty_id],
    );
    if (facultyRows.length === 0 || !facultyRows[0].is_active) {
      return res.status(400).json({ success: false, message: "Faculty member not found or inactive" });
    }

    const [result] = await pool.query(
      `INSERT INTO subject_staff_assignments (subject_id, faculty_id, role, assigned_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         assignment_id = LAST_INSERT_ID(assignment_id),
         role = VALUES(role),
         updated_at = NOW()`,
      [subjectId, faculty_id, role, req.user.user_id],
    );

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-SUBJ-${subjectId}`,
      eventType: "STAFF_ASSIGNED",
      payload: { faculty_id, role, subjectId },
    });

    return res.status(201).json({
      success: true,
      message: "Staff member assigned successfully",
      assignment_id: result.insertId,
    });
  } catch (err) {
    console.error("[AcademicSubject] assignStaff error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * DELETE /api/v1/academic/subjects/:id/staff/:assignmentId
 * Remove faculty assignment (Only Admin or Department HOD)
 */
async function removeStaff(req, res) {
  try {
    const { id: subjectId, assignmentId } = req.params;

    const [subRows] = await pool.query(
      "SELECT subject_id, owner_department_id FROM subjects WHERE subject_id = ?",
      [subjectId],
    );
    if (subRows.length === 0) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }
    const subject = subRows[0];

    // Authorization: Only ADMIN or HOD of that subject's department
    if (req.user.role === "ADMIN") {
      // Authorized
    } else if (req.user.role === "FACULTY") {
      const facProfile = await resolveFacultyProfile(req.user);
      if (!facProfile.isHOD || facProfile.departmentId !== subject.owner_department_id) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only the department HOD or an Administrator can remove faculty assignments.",
        });
      }
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM subject_staff_assignments WHERE assignment_id = ? AND subject_id = ?",
      [assignmentId, subjectId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    await pool.query("DELETE FROM subject_staff_assignments WHERE assignment_id = ?", [assignmentId]);

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-SUBJ-${subjectId}`,
      eventType: "STAFF_REMOVED",
      payload: { assignmentId, faculty_id: rows[0].faculty_id },
    });

    return res.status(200).json({ success: true, message: "Staff assignment removed" });
  } catch (err) {
    console.error("[AcademicSubject] removeStaff error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/subjects/:id/topics
 */
async function getSubjectTopics(req, res) {
  try {
    const subjectId = req.params.id;
    const user = req.user;

    const [topics] = await pool.query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM academic_materials m WHERE m.topic_id = t.topic_id) AS total_materials,
        (SELECT COUNT(*) FROM academic_materials m WHERE m.topic_id = t.topic_id AND m.status = 'Published') AS published_materials,
        (SELECT COUNT(*) FROM academic_materials m WHERE m.topic_id = t.topic_id AND m.status = 'Published' AND m.required_flag = 1) AS required_materials,
        (SELECT COUNT(*) FROM academic_questions q WHERE q.topic_id = t.topic_id AND q.status = 'Approved') AS approved_questions,
        q.quiz_id, q.title AS quiz_title, q.status AS quiz_status, q.time_limit AS quiz_time_limit,
        q.pass_mark AS quiz_pass_mark, q.max_attempts AS quiz_max_attempts
       FROM academic_topics t
       LEFT JOIN academic_quizzes q ON t.topic_id = q.topic_id
       WHERE t.subject_id = ?
       ORDER BY t.position ASC, t.topic_id ASC`,
      [subjectId],
    );

    // If student, calculate their personal completion for each topic
    if (user && user.role === "STUDENT") {
      for (const topic of topics) {
        const [progressRows] = await pool.query(
          `SELECT 
            COUNT(m.material_id) AS total_req,
            COUNT(CASE WHEN p.status = 'COMPLETED' THEN 1 END) AS completed_req
           FROM academic_materials m
           LEFT JOIN academic_material_progress p ON m.material_id = p.material_id AND p.person_id = ?
           WHERE m.topic_id = ? AND m.status = 'Published' AND m.required_flag = 1`,
          [user.user_id, topic.topic_id],
        );
        const totalReq = progressRows[0].total_req || 0;
        const compReq = progressRows[0].completed_req || 0;
        topic.required_completed = totalReq === 0 || compReq >= totalReq;
        topic.completed_required_materials_count = compReq;
      }
    }

    return res.status(200).json({
      success: true,
      count: topics.length,
      data: topics,
    });
  } catch (err) {
    console.error("[AcademicSubject] getSubjectTopics error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /api/v1/academic/subjects/:id/topics
 */
async function createTopic(req, res) {
  try {
    const subjectId = req.params.id;
    const { title, description, position, quiz_enabled = 1 } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Topic title is required" });
    }

    let nextPos = position;
    if (nextPos === undefined || nextPos === null) {
      const [posRows] = await pool.query(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM academic_topics WHERE subject_id = ?",
        [subjectId],
      );
      nextPos = posRows[0].next_pos;
    }

    const [result] = await pool.query(
      `INSERT INTO academic_topics (subject_id, title, description, position, quiz_enabled, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subjectId, title.trim(), description || null, nextPos, quiz_enabled ? 1 : 0, req.user.user_id],
    );

    const topicId = result.insertId;

    // Automatically create a draft quiz stub for this topic
    await pool.query(
      `INSERT INTO academic_quizzes (topic_id, title, description, created_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [topicId, `${title.trim()} Quiz`, `Assessment for topic: ${title.trim()}`, req.user.user_id],
    );

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-TOPIC-${topicId}`,
      eventType: "TOPIC_CREATED",
      payload: { topicId, subjectId, title: title.trim(), position: nextPos },
    });

    return res.status(201).json({
      success: true,
      message: "Topic created successfully",
      data: {
        topic_id: topicId,
        subject_id: parseInt(subjectId, 10),
        title: title.trim(),
        description: description || null,
        position: nextPos,
        quiz_enabled: !!quiz_enabled,
      },
    });
  } catch (err) {
    console.error("[AcademicSubject] createTopic error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * GET /api/v1/academic/topics/:id
 */
async function getTopicById(req, res) {
  try {
    const topicId = req.params.id;

    const [rows] = await pool.query(
      `SELECT t.*, s.subject_code AS subject_code, s.subject_code AS code, s.name AS subject_name,
        q.quiz_id, q.title AS quiz_title, q.status AS quiz_status, q.time_limit, q.pass_mark, q.max_attempts
       FROM academic_topics t
       JOIN subjects s ON t.subject_id = s.subject_id
       LEFT JOIN academic_quizzes q ON t.topic_id = q.topic_id
       WHERE t.topic_id = ?`,
      [topicId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    console.error("[AcademicSubject] getTopicById error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/topics/:id
 */
async function updateTopic(req, res) {
  try {
    const topicId = req.params.id;
    const { title, description, position, quiz_enabled } = req.body;

    const [existing] = await pool.query("SELECT * FROM academic_topics WHERE topic_id = ?", [topicId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ success: false, message: "Title cannot be empty" });
      updates.push("title = ?");
      params.push(title.trim());
    }

    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }

    if (position !== undefined) {
      updates.push("position = ?");
      params.push(parseInt(position, 10));
    }

    if (quiz_enabled !== undefined) {
      updates.push("quiz_enabled = ?");
      params.push(quiz_enabled ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(topicId);
      await pool.query(`UPDATE academic_topics SET ${updates.join(", ")}, updated_at = NOW() WHERE topic_id = ?`, params);
    }

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-TOPIC-${topicId}`,
      eventType: "TOPIC_UPDATED",
      payload: req.body,
    });

    return res.status(200).json({ success: true, message: "Topic updated successfully" });
  } catch (err) {
    console.error("[AcademicSubject] updateTopic error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * DELETE /api/v1/academic/topics/:id
 */
async function deleteTopic(req, res) {
  try {
    const topicId = req.params.id;

    const [existing] = await pool.query("SELECT subject_id FROM academic_topics WHERE topic_id = ?", [topicId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    // Safety Check: Check if topic has historical student quiz attempts or answers
    const [historyRows] = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM academic_attempts a JOIN academic_quizzes q ON a.quiz_id = q.quiz_id WHERE q.topic_id = ?) AS attempt_count,
        (SELECT COUNT(*) FROM academic_attempt_answers ans JOIN academic_questions q ON ans.question_id = q.question_id WHERE q.topic_id = ?) AS answer_count`,
      [topicId, topicId],
    );

    const attemptCount = historyRows[0].attempt_count || 0;
    const answerCount = historyRows[0].answer_count || 0;

    if (attemptCount > 0 || answerCount > 0) {
      return res.status(409).json({
        success: false,
        code: "TOPIC_HAS_HISTORICAL_RECORDS",
        message: `Cannot delete topic because it contains ${attemptCount} student quiz attempt(s) and ${answerCount} recorded answer(s). Topic must remain preserved for academic record integrity.`,
        data: { attempt_count: attemptCount, answer_count: answerCount },
      });
    }

    await pool.query("DELETE FROM academic_topics WHERE topic_id = ?", [topicId]);

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-TOPIC-${topicId}`,
      eventType: "TOPIC_DELETED",
      payload: { subject_id: existing[0].subject_id },
    });

    return res.status(200).json({ success: true, message: "Topic deleted successfully" });
  } catch (err) {
    console.error("[AcademicSubject] deleteTopic error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * PUT /api/v1/academic/subjects/:id/topics/reorder
 * Reorder topic positions atomically
 */
async function reorderTopics(req, res) {
  const conn = await pool.getConnection();
  try {
    const subjectId = req.params.id;
    const { topics } = req.body;

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ success: false, message: "topics array is required" });
    }

    await conn.beginTransaction();

    for (const item of topics) {
      if (item.topic_id && item.position !== undefined) {
        await conn.query(
          "UPDATE academic_topics SET position = ?, updated_at = NOW() WHERE topic_id = ? AND subject_id = ?",
          [item.position, item.topic_id, subjectId],
        );
      }
    }

    await conn.commit();

    await logAcademicEvent({
      personId: req.user.user_id,
      locationId: `ACAD-SUBJ-${subjectId}`,
      eventType: "TOPICS_REORDERED",
      payload: { topicsCount: topics.length },
    });

    return res.status(200).json({ success: true, message: "Topics reordered successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("[AcademicSubject] reorderTopics error:", err);
    return res.status(500).json({ success: false, message: "Failed to reorder topics" });
  } finally {
    conn.release();
  }
}

module.exports = {
  getSubjects,
  getSubjectById,
  assignStaff,
  removeStaff,
  getSubjectTopics,
  createTopic,
  getTopicById,
  updateTopic,
  deleteTopic,
  reorderTopics,
};

