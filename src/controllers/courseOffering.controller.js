const pool = require("../config/mysql");

/**
 * GET /api/v1/course-offerings
 * List course offerings with relational joins to terms, years, subjects, faculty, and section counts.
 */
const getCourseOfferings = async (req, res) => {
  try {
    const { term_id, subject_id, coordinator_faculty_id, search, q } = req.query;
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (term_id) {
      conditions.push("co.term_id = ?");
      params.push(Number(term_id));
    }

    if (subject_id) {
      conditions.push("co.subject_id = ?");
      params.push(Number(subject_id));
    }

    if (coordinator_faculty_id) {
      conditions.push("co.coordinator_faculty_id = ?");
      params.push(Number(coordinator_faculty_id));
    }

    if (searchTerm) {
      conditions.push("(sub.name LIKE ? OR sub.subject_code LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [offerings] = await pool.query(
      `
      SELECT
          co.offering_id,
          co.term_id,
          at.term_type,
          at.start_date AS term_start_date,
          at.end_date AS term_end_date,
          ay.academic_year_id,
          ay.label AS academic_year_label,
          co.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          sub.credits,
          sub.delivery_type,
          co.coordinator_faculty_id,
          f.full_name AS coordinator_faculty_name,
          f.employee_code AS coordinator_employee_code,
          (SELECT COUNT(*) FROM sections sec WHERE sec.offering_id = co.offering_id) AS section_count,
          co.created_at,
          co.updated_at
      FROM course_offerings co
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      LEFT JOIN faculty f ON co.coordinator_faculty_id = f.faculty_id
      ${whereClause}
      ORDER BY co.offering_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Course offerings retrieved successfully",
      count: offerings.length,
      data: offerings,
    });
  } catch (error) {
    console.error("Get course offerings error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/course-offerings/:id
 * Retrieve a single course offering by ID.
 */
const getCourseOfferingById = async (req, res) => {
  try {
    const { id } = req.params;

    const [offerings] = await pool.query(
      `
      SELECT
          co.offering_id,
          co.term_id,
          at.term_type,
          at.start_date AS term_start_date,
          at.end_date AS term_end_date,
          ay.academic_year_id,
          ay.label AS academic_year_label,
          co.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          sub.credits,
          sub.delivery_type,
          co.coordinator_faculty_id,
          f.full_name AS coordinator_faculty_name,
          f.employee_code AS coordinator_employee_code,
          (SELECT COUNT(*) FROM sections sec WHERE sec.offering_id = co.offering_id) AS section_count,
          co.created_at,
          co.updated_at
      FROM course_offerings co
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      LEFT JOIN faculty f ON co.coordinator_faculty_id = f.faculty_id
      WHERE co.offering_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (offerings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course offering not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course offering retrieved successfully",
      data: offerings[0],
    });
  } catch (error) {
    console.error("Get course offering by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/course-offerings
 * Create a new course offering. ADMIN only.
 */
const createCourseOffering = async (req, res) => {
  try {
    const { term_id, subject_id, coordinator_faculty_id } = req.body || {};

    if (!term_id || !subject_id) {
      return res.status(400).json({
        success: false,
        message: "term_id and subject_id are required",
      });
    }

    const termNum = Number(term_id);
    const subjectNum = Number(subject_id);

    if (isNaN(termNum) || isNaN(subjectNum)) {
      return res.status(400).json({
        success: false,
        message: "term_id and subject_id must be valid numbers",
      });
    }

    // Verify academic term exists
    const [termRows] = await pool.query(
      "SELECT term_id FROM academic_terms WHERE term_id = ? LIMIT 1",
      [termNum],
    );
    if (termRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid term_id: academic term does not exist",
      });
    }

    // Verify subject exists and is active
    const [subjectRows] = await pool.query(
      "SELECT subject_id, is_active FROM subjects WHERE subject_id = ? LIMIT 1",
      [subjectNum],
    );
    if (subjectRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject_id: subject does not exist",
      });
    }
    if (!subjectRows[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Subject is inactive",
      });
    }

    // Verify coordinator faculty if provided
    let coordId = null;
    if (coordinator_faculty_id) {
      coordId = Number(coordinator_faculty_id);
      const [facRows] = await pool.query(
        "SELECT faculty_id, is_active FROM faculty WHERE faculty_id = ? LIMIT 1",
        [coordId],
      );
      if (facRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid coordinator_faculty_id: faculty does not exist",
        });
      }
      if (!facRows[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Coordinator faculty member is inactive",
        });
      }
    }

    // Unique constraint check (term_id, subject_id)
    const [existingOffering] = await pool.query(
      "SELECT offering_id FROM course_offerings WHERE term_id = ? AND subject_id = ? LIMIT 1",
      [termNum, subjectNum],
    );
    if (existingOffering.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Course offering already exists for this term and subject",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO course_offerings (term_id, subject_id, coordinator_faculty_id)
      VALUES (?, ?, ?)
      `,
      [termNum, subjectNum, coordId],
    );

    const [createdRows] = await pool.query(
      `
      SELECT
          co.offering_id,
          co.term_id,
          at.term_type,
          at.start_date AS term_start_date,
          at.end_date AS term_end_date,
          ay.academic_year_id,
          ay.label AS academic_year_label,
          co.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          sub.credits,
          sub.delivery_type,
          co.coordinator_faculty_id,
          f.full_name AS coordinator_faculty_name,
          f.employee_code AS coordinator_employee_code,
          0 AS section_count,
          co.created_at,
          co.updated_at
      FROM course_offerings co
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      LEFT JOIN faculty f ON co.coordinator_faculty_id = f.faculty_id
      WHERE co.offering_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Course offering created successfully",
      data: createdRows[0],
    });
  } catch (error) {
    console.error("Create course offering error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/course-offerings/:id
 * Update an existing course offering. ADMIN only.
 */
const updateCourseOffering = async (req, res) => {
  try {
    const { id } = req.params;
    const { term_id, subject_id, coordinator_faculty_id } = req.body || {};

    const [existingRows] = await pool.query(
      "SELECT * FROM course_offerings WHERE offering_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course offering not found",
      });
    }

    const current = existingRows[0];
    let newTerm = current.term_id;
    let newSubject = current.subject_id;
    let newCoord = current.coordinator_faculty_id;

    if (term_id !== undefined) {
      const termNum = Number(term_id);
      const [termRows] = await pool.query(
        "SELECT term_id FROM academic_terms WHERE term_id = ? LIMIT 1",
        [termNum],
      );
      if (termRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid term_id: academic term does not exist",
        });
      }
      newTerm = termNum;
    }

    if (subject_id !== undefined) {
      const subjectNum = Number(subject_id);
      const [subjectRows] = await pool.query(
        "SELECT subject_id, is_active FROM subjects WHERE subject_id = ? LIMIT 1",
        [subjectNum],
      );
      if (subjectRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid subject_id: subject does not exist",
        });
      }
      if (!subjectRows[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Subject is inactive",
        });
      }
      newSubject = subjectNum;
    }

    if (coordinator_faculty_id !== undefined) {
      if (coordinator_faculty_id === null) {
        newCoord = null;
      } else {
        const coordId = Number(coordinator_faculty_id);
        const [facRows] = await pool.query(
          "SELECT faculty_id, is_active FROM faculty WHERE faculty_id = ? LIMIT 1",
          [coordId],
        );
        if (facRows.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid coordinator_faculty_id: faculty does not exist",
          });
        }
        if (!facRows[0].is_active) {
          return res.status(400).json({
            success: false,
            message: "Coordinator faculty member is inactive",
          });
        }
        newCoord = coordId;
      }
    }

    // Check duplicate if term or subject changed
    if (newTerm !== current.term_id || newSubject !== current.subject_id) {
      const [dupRows] = await pool.query(
        "SELECT offering_id FROM course_offerings WHERE term_id = ? AND subject_id = ? AND offering_id != ? LIMIT 1",
        [newTerm, newSubject, id],
      );
      if (dupRows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Course offering already exists for this term and subject",
        });
      }
    }

    await pool.query(
      `
      UPDATE course_offerings
      SET term_id = ?, subject_id = ?, coordinator_faculty_id = ?, updated_at = NOW()
      WHERE offering_id = ?
      `,
      [newTerm, newSubject, newCoord, id],
    );

    const [updatedRows] = await pool.query(
      `
      SELECT
          co.offering_id,
          co.term_id,
          at.term_type,
          at.start_date AS term_start_date,
          at.end_date AS term_end_date,
          ay.academic_year_id,
          ay.label AS academic_year_label,
          co.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          sub.credits,
          sub.delivery_type,
          co.coordinator_faculty_id,
          f.full_name AS coordinator_faculty_name,
          f.employee_code AS coordinator_employee_code,
          (SELECT COUNT(*) FROM sections sec WHERE sec.offering_id = co.offering_id) AS section_count,
          co.created_at,
          co.updated_at
      FROM course_offerings co
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      LEFT JOIN faculty f ON co.coordinator_faculty_id = f.faculty_id
      WHERE co.offering_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Course offering updated successfully",
      data: updatedRows[0],
    });
  } catch (error) {
    console.error("Update course offering error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/course-offerings/:id
 * Delete a course offering if not referenced by sections. ADMIN only.
 */
const deleteCourseOffering = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingRows] = await pool.query(
      "SELECT offering_id FROM course_offerings WHERE offering_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course offering not found",
      });
    }

    // Check if referenced by sections
    const [sectionRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM sections WHERE offering_id = ?",
      [id],
    );

    if (sectionRows[0].total > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete course offering referenced by existing sections",
      });
    }

    await pool.query("DELETE FROM course_offerings WHERE offering_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "Course offering deleted successfully",
      data: {
        offering_id: Number(id),
      },
    });
  } catch (error) {
    console.error("Delete course offering error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getCourseOfferings,
  getCourseOfferingById,
  createCourseOffering,
  updateCourseOffering,
  deleteCourseOffering,
};
