const pool = require("../../config/mysql");
const { logAcademicEvent } = require("../../utils/academicLedger");

/**
 * GET /api/v1/academic/subjects
 * Retrieves subjects tailored to role (Admin: all, Faculty: assigned/dept, Student: enrolled)
 */
async function getSubjects(req, res) {
  try {
    const user = req.user;
    const { search, department_id, is_active } = req.query;

    let sql = `
      SELECT DISTINCT 
        s.subject_id, s.subject_code AS code, s.subject_code, s.name,
        s.owner_department_id AS department_id, s.owner_department_id,
        s.credits AS credit_hours, s.credits, s.is_active,
        d.name AS department_name, d.code AS department_code
      FROM subjects s
      LEFT JOIN departments d ON s.owner_department_id = d.department_id
    `;
    const params = [];
    const conditions = [];

    if (user.role === "STUDENT") {
      sql += `
        JOIN course_offerings co ON s.subject_id = co.subject_id
        JOIN sections sec ON co.offering_id = sec.offering_id
        JOIN enrollments e ON sec.section_id = e.section_id
      `;
      conditions.push("e.student_id = ? AND e.status = 'REGISTERED'");
      params.push(user.student_id);
    } else if (user.role === "FACULTY") {
      sql += `
        LEFT JOIN subject_staff_assignments ssa ON s.subject_id = ssa.subject_id AND ssa.faculty_id = ?
        LEFT JOIN course_offerings co_f ON s.subject_id = co_f.subject_id AND co_f.coordinator_faculty_id = ?
        LEFT JOIN sections sec_f ON co_f.offering_id = sec_f.offering_id
        LEFT JOIN timetable_slots ts_f ON sec_f.section_id = ts_f.section_id AND ts_f.faculty_id = ? AND ts_f.is_active = 1
        LEFT JOIN faculty f_dept ON s.owner_department_id = f_dept.department_id AND f_dept.faculty_id = ?
      `;
      params.push(user.faculty_id, user.faculty_id, user.faculty_id, user.faculty_id);
      conditions.push("(ssa.assignment_id IS NOT NULL OR co_f.offering_id IS NOT NULL OR ts_f.slot_id IS NOT NULL OR f_dept.faculty_id IS NOT NULL)");
    }

    if (search) {
      conditions.push("(s.name LIKE ? OR s.subject_code LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (department_id) {
      conditions.push("s.owner_department_id = ?");
      params.push(department_id);
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
 */
async function getSubjectById(req, res) {
  try {
    const subjectId = req.params.id;

    const [rows] = await pool.query(
      `SELECT s.*, s.subject_code AS code, d.name AS department_name, d.code AS department_code
       FROM subjects s
       LEFT JOIN departments d ON s.owner_department_id = d.department_id
       WHERE s.subject_id = ?`,
      [subjectId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    const [staff] = await pool.query(
      `SELECT ssa.assignment_id, ssa.faculty_id, ssa.role, ssa.created_at,
              f.employee_code, f.full_name, f.email, des.name AS designation_name
       FROM subject_staff_assignments ssa
       JOIN faculty f ON ssa.faculty_id = f.faculty_id
       LEFT JOIN designations des ON f.designation_id = des.designation_id
       WHERE ssa.subject_id = ?
       ORDER BY ssa.role ASC, f.full_name ASC`,
      [subjectId],
    );

    const [topicCount] = await pool.query(
      "SELECT COUNT(*) AS total_topics FROM academic_topics WHERE subject_id = ?",
      [subjectId],
    );

    return res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        total_topics: topicCount[0].total_topics,
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
 * Assign faculty to subject
 */
async function assignStaff(req, res) {
  try {
    const subjectId = req.params.id;
    const { faculty_id, role = "Subject Staff" } = req.body;

    if (!faculty_id) {
      return res.status(400).json({ success: false, message: "faculty_id is required" });
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
       ON DUPLICATE KEY UPDATE role = VALUES(role), updated_at = NOW()`,
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
 */
async function removeStaff(req, res) {
  try {
    const { id: subjectId, assignmentId } = req.params;

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

