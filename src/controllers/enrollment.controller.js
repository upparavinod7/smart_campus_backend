const pool = require("../config/mysql");

const ALLOWED_REGISTRATION_TYPES = ["REGULAR", "BACKLOG", "IMPROVEMENT"];
const ALLOWED_ENROLLMENT_STATUSES = ["REGISTERED", "DROPPED"];

/**
 * GET /api/v1/enrollments
 * List enrollments with filters for section, student, status, offering, term, batch, and search.
 */
const getEnrollments = async (req, res) => {
  try {
    const {
      section_id,
      student_id,
      status,
      registration_type,
      offering_id,
      term_id,
      batch_id,
      programme_id,
      search,
      q,
    } = req.query;

    const searchTerm = search || q;
    const conditions = [];
    const params = [];

    if (section_id) {
      conditions.push("e.section_id = ?");
      params.push(Number(section_id));
    }

    if (student_id) {
      conditions.push("e.student_id = ?");
      params.push(Number(student_id));
    }

    if (status) {
      conditions.push("e.status = ?");
      params.push(status.toUpperCase());
    }

    if (registration_type) {
      conditions.push("e.registration_type = ?");
      params.push(registration_type.toUpperCase());
    }

    if (offering_id) {
      conditions.push("sec.offering_id = ?");
      params.push(Number(offering_id));
    }

    if (term_id) {
      conditions.push("co.term_id = ?");
      params.push(Number(term_id));
    }

    if (batch_id) {
      conditions.push("sec.batch_id = ?");
      params.push(Number(batch_id));
    }

    if (programme_id) {
      conditions.push("bt.programme_id = ?");
      params.push(Number(programme_id));
    }

    if (searchTerm) {
      conditions.push(
        "(s.full_name LIKE ? OR s.register_no LIKE ? OR sub.name LIKE ? OR sub.subject_code LIKE ? OR sec.section_code LIKE ?)",
      );
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [enrollments] = await pool.query(
      `
      SELECT
          e.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name AS student_name,
          s.email AS student_email,
          s.status AS student_status,
          e.section_id,
          sec.section_code,
          sec.batch_id,
          bt.label AS batch_label,
          p.programme_id,
          p.name AS programme_name,
          p.programme_code,
          co.offering_id,
          co.term_id,
          at.term_type,
          ay.academic_year_id,
          ay.label AS academic_year_label,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          sub.credits,
          e.registration_type,
          e.status,
          e.registered_on,
          e.dropped_on,
          e.created_at,
          e.updated_at
      FROM enrollments e
      JOIN students s ON e.student_id = s.student_id
      JOIN sections sec ON e.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      ${whereClause}
      ORDER BY e.registered_on DESC, e.enrollment_id DESC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Enrollments retrieved successfully",
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    console.error("Get enrollments error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/enrollments/:id
 * Retrieve a single enrollment by ID.
 */
const getEnrollmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [enrollments] = await pool.query(
      `
      SELECT
          e.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name AS student_name,
          s.email AS student_email,
          s.status AS student_status,
          e.section_id,
          sec.section_code,
          sec.max_strength,
          sec.batch_id,
          bt.label AS batch_label,
          p.programme_id,
          p.name AS programme_name,
          p.programme_code,
          co.offering_id,
          co.term_id,
          at.term_type,
          ay.academic_year_id,
          ay.label AS academic_year_label,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          sub.credits,
          e.registration_type,
          e.status,
          e.registered_on,
          e.dropped_on,
          e.created_at,
          e.updated_at,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.enrollment_id = e.enrollment_id) AS total_attendance_records
      FROM enrollments e
      JOIN students s ON e.student_id = s.student_id
      JOIN sections sec ON e.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      WHERE e.enrollment_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Enrollment retrieved successfully",
      data: enrollments[0],
    });
  } catch (error) {
    console.error("Get enrollment by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/enrollments
 * Enroll a student in a section. Admin only.
 */
const createEnrollment = async (req, res) => {
  try {
    const {
      student_id,
      section_id,
      registration_type = "REGULAR",
      registered_on,
    } = req.body;

    if (!student_id) {
      return res.status(400).json({
        success: false,
        message: "student_id is required",
      });
    }

    if (!section_id) {
      return res.status(400).json({
        success: false,
        message: "section_id is required",
      });
    }

    const regType = String(registration_type).toUpperCase();
    if (!ALLOWED_REGISTRATION_TYPES.includes(regType)) {
      return res.status(400).json({
        success: false,
        message: `registration_type must be one of: ${ALLOWED_REGISTRATION_TYPES.join(", ")}`,
      });
    }

    // Verify student exists and is active
    const [students] = await pool.query(
      "SELECT student_id, register_no, full_name, status, batch_id FROM students WHERE student_id = ? LIMIT 1",
      [Number(student_id)],
    );

    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Student with ID ${student_id} does not exist`,
      });
    }

    const student = students[0];

    // Verify section exists and fetch details
    const [sections] = await pool.query(
      `
      SELECT
          sec.section_id,
          sec.section_code,
          sec.max_strength,
          sec.batch_id,
          sec.offering_id,
          co.term_id,
          sub.name AS subject_name,
          sub.subject_code
      FROM sections sec
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      WHERE sec.section_id = ?
      LIMIT 1
      `,
      [Number(section_id)],
    );

    if (sections.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Section with ID ${section_id} does not exist`,
      });
    }

    const section = sections[0];

    // Check duplicate enrollment
    const [existing] = await pool.query(
      "SELECT enrollment_id, status FROM enrollments WHERE student_id = ? AND section_id = ? LIMIT 1",
      [Number(student_id), Number(section_id)],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Student ${student.full_name} (${student.register_no}) is already enrolled in section ${section.section_code} (Status: ${existing[0].status})`,
        data: existing[0],
      });
    }

    // Check section capacity if max_strength is specified
    if (section.max_strength && section.max_strength > 0) {
      const [currentEnrolled] = await pool.query(
        "SELECT COUNT(*) AS total FROM enrollments WHERE section_id = ? AND status = 'REGISTERED'",
        [Number(section_id)],
      );

      if (currentEnrolled[0].total >= section.max_strength) {
        return res.status(400).json({
          success: false,
          message: `Section ${section.section_code} has reached its maximum capacity of ${section.max_strength} students`,
        });
      }
    }

    const enrollmentDate = registered_on && !isNaN(Date.parse(registered_on))
      ? registered_on
      : new Date().toISOString().slice(0, 10);

    const [result] = await pool.query(
      `
      INSERT INTO enrollments (student_id, section_id, registration_type, status, registered_on)
      VALUES (?, ?, ?, 'REGISTERED', ?)
      `,
      [Number(student_id), Number(section_id), regType, enrollmentDate],
    );

    const [newEnrollment] = await pool.query(
      `
      SELECT
          e.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name AS student_name,
          e.section_id,
          sec.section_code,
          sub.subject_code,
          sub.name AS subject_name,
          e.registration_type,
          e.status,
          e.registered_on,
          e.created_at
      FROM enrollments e
      JOIN students s ON e.student_id = s.student_id
      JOIN sections sec ON e.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      WHERE e.enrollment_id = ?
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Student enrolled successfully",
      data: newEnrollment[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Student is already enrolled in this section",
      });
    }
    console.error("Create enrollment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/enrollments/:id
 * Update enrollment status or registration type. Admin only.
 */
const updateEnrollment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, registration_type, dropped_on } = req.body;

    const [existing] = await pool.query(
      "SELECT * FROM enrollments WHERE enrollment_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    const current = existing[0];
    const newStatus = status !== undefined ? String(status).toUpperCase() : current.status;
    const newRegType = registration_type !== undefined
      ? String(registration_type).toUpperCase()
      : current.registration_type;

    if (!ALLOWED_ENROLLMENT_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${ALLOWED_ENROLLMENT_STATUSES.join(", ")}`,
      });
    }

    if (!ALLOWED_REGISTRATION_TYPES.includes(newRegType)) {
      return res.status(400).json({
        success: false,
        message: `registration_type must be one of: ${ALLOWED_REGISTRATION_TYPES.join(", ")}`,
      });
    }

    let finalDroppedOn = current.dropped_on;

    if (newStatus === "DROPPED") {
      finalDroppedOn = dropped_on && !isNaN(Date.parse(dropped_on))
        ? dropped_on
        : new Date().toISOString().slice(0, 10);
    } else if (newStatus === "REGISTERED") {
      finalDroppedOn = null;

      // If re-activating from DROPPED to REGISTERED, verify section capacity
      if (current.status === "DROPPED") {
        const [sectionRows] = await pool.query(
          "SELECT max_strength FROM sections WHERE section_id = ? LIMIT 1",
          [current.section_id],
        );
        if (sectionRows.length > 0 && sectionRows[0].max_strength) {
          const [activeCount] = await pool.query(
            "SELECT COUNT(*) AS total FROM enrollments WHERE section_id = ? AND status = 'REGISTERED'",
            [current.section_id],
          );
          if (activeCount[0].total >= sectionRows[0].max_strength) {
            return res.status(400).json({
              success: false,
              message: `Cannot re-register student: Section has reached its maximum capacity of ${sectionRows[0].max_strength} students`,
            });
          }
        }
      }
    }

    await pool.query(
      `
      UPDATE enrollments
      SET status = ?, registration_type = ?, dropped_on = ?
      WHERE enrollment_id = ?
      `,
      [newStatus, newRegType, finalDroppedOn, id],
    );

    const [updated] = await pool.query(
      `
      SELECT
          e.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name AS student_name,
          e.section_id,
          sec.section_code,
          e.registration_type,
          e.status,
          e.registered_on,
          e.dropped_on,
          e.updated_at
      FROM enrollments e
      JOIN students s ON e.student_id = s.student_id
      JOIN sections sec ON e.section_id = sec.section_id
      WHERE e.enrollment_id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Enrollment updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Update enrollment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/enrollments/:id
 * Delete an enrollment record if no attendance records exist. Admin only.
 */
const deleteEnrollment = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM enrollments WHERE enrollment_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    // Check if attendance records exist
    const [records] = await pool.query(
      "SELECT COUNT(*) AS total FROM attendance_records WHERE enrollment_id = ?",
      [id],
    );

    if (records[0].total > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete enrollment: ${records[0].total} attendance record(s) exist for this enrollment. Consider updating status to DROPPED instead.`,
      });
    }

    await pool.query("DELETE FROM enrollments WHERE enrollment_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "Enrollment deleted successfully",
    });
  } catch (error) {
    console.error("Delete enrollment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getEnrollments,
  getEnrollmentById,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
};

