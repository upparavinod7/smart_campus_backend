const pool = require("../config/mysql");

/**
 * GET /api/v1/sections
 * List sections with relational joins to offerings, subjects, terms, and enrolled counts.
 */
const getSections = async (req, res) => {
  try {
    const { offering_id, section_code, search, q } = req.query;
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (offering_id) {
      conditions.push("sec.offering_id = ?");
      params.push(Number(offering_id));
    }

    if (section_code) {
      conditions.push("sec.section_code = ?");
      params.push(section_code.trim().toUpperCase());
    }

    if (searchTerm) {
      conditions.push("(sub.name LIKE ? OR sub.subject_code LIKE ? OR sec.section_code LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [sections] = await pool.query(
      `
      SELECT
          sec.section_id,
          sec.offering_id,
          sec.section_code,
          sec.max_strength,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          at.term_id,
          at.term_type,
          ay.label AS academic_year_label,
          (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = sec.section_id) AS enrolled_students_count,
          sec.created_at,
          sec.updated_at
      FROM sections sec
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      ${whereClause}
      ORDER BY sec.section_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Sections retrieved successfully",
      count: sections.length,
      data: sections,
    });
  } catch (error) {
    console.error("Get sections error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/sections/:id
 * Retrieve a single section by ID.
 */
const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [sections] = await pool.query(
      `
      SELECT
          sec.section_id,
          sec.offering_id,
          sec.section_code,
          sec.max_strength,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          at.term_id,
          at.term_type,
          ay.label AS academic_year_label,
          (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = sec.section_id) AS enrolled_students_count,
          sec.created_at,
          sec.updated_at
      FROM sections sec
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      WHERE sec.section_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (sections.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Section retrieved successfully",
      data: sections[0],
    });
  } catch (error) {
    console.error("Get section by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/sections
 * Create a new section under a course offering. ADMIN only.
 */
const createSection = async (req, res) => {
  try {
    const { offering_id, section_code, max_strength } = req.body || {};

    if (!offering_id || !section_code) {
      return res.status(400).json({
        success: false,
        message: "offering_id and section_code are required",
      });
    }

    const offeringNum = Number(offering_id);
    const trimmedCode = section_code.toString().trim().toUpperCase();

    if (isNaN(offeringNum) || !trimmedCode) {
      return res.status(400).json({
        success: false,
        message: "offering_id must be a valid number and section_code cannot be empty",
      });
    }

    // Verify course offering exists
    const [offeringRows] = await pool.query(
      "SELECT offering_id FROM course_offerings WHERE offering_id = ? LIMIT 1",
      [offeringNum],
    );
    if (offeringRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid offering_id: course offering does not exist",
      });
    }

    // Validate max_strength if provided
    let parsedStrength = null;
    if (max_strength !== undefined && max_strength !== null) {
      parsedStrength = Number(max_strength);
      if (isNaN(parsedStrength) || parsedStrength <= 0) {
        return res.status(400).json({
          success: false,
          message: "max_strength must be a positive integer",
        });
      }
    }

    // Unique constraint check (offering_id, section_code)
    const [existingSection] = await pool.query(
      "SELECT section_id FROM sections WHERE offering_id = ? AND section_code = ? LIMIT 1",
      [offeringNum, trimmedCode],
    );
    if (existingSection.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Section '${trimmedCode}' already exists for this course offering`,
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO sections (offering_id, section_code, max_strength)
      VALUES (?, ?, ?)
      `,
      [offeringNum, trimmedCode, parsedStrength],
    );

    const [createdRows] = await pool.query(
      `
      SELECT
          sec.section_id,
          sec.offering_id,
          sec.section_code,
          sec.max_strength,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          at.term_id,
          at.term_type,
          ay.label AS academic_year_label,
          0 AS enrolled_students_count,
          sec.created_at,
          sec.updated_at
      FROM sections sec
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      WHERE sec.section_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: createdRows[0],
    });
  } catch (error) {
    console.error("Create section error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/sections/:id
 * Update an existing section. ADMIN only.
 */
const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { offering_id, section_code, max_strength } = req.body || {};

    const [existingRows] = await pool.query(
      "SELECT * FROM sections WHERE section_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    const current = existingRows[0];
    let newOffering = current.offering_id;
    let newCode = current.section_code;
    let newStrength = current.max_strength;

    if (offering_id !== undefined) {
      const offeringNum = Number(offering_id);
      const [offeringRows] = await pool.query(
        "SELECT offering_id FROM course_offerings WHERE offering_id = ? LIMIT 1",
        [offeringNum],
      );
      if (offeringRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid offering_id: course offering does not exist",
        });
      }
      newOffering = offeringNum;
    }

    if (section_code !== undefined) {
      newCode = section_code.toString().trim().toUpperCase();
      if (!newCode) {
        return res.status(400).json({
          success: false,
          message: "section_code cannot be empty",
        });
      }
    }

    if (max_strength !== undefined) {
      if (max_strength === null) {
        newStrength = null;
      } else {
        const parsed = Number(max_strength);
        if (isNaN(parsed) || parsed <= 0) {
          return res.status(400).json({
            success: false,
            message: "max_strength must be a positive integer",
          });
        }
        newStrength = parsed;
      }
    }

    // Unique conflict check
    if (newOffering !== current.offering_id || newCode !== current.section_code) {
      const [dupRows] = await pool.query(
        "SELECT section_id FROM sections WHERE offering_id = ? AND section_code = ? AND section_id != ? LIMIT 1",
        [newOffering, newCode, id],
      );
      if (dupRows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Section '${newCode}' already exists for this course offering`,
        });
      }
    }

    await pool.query(
      `
      UPDATE sections
      SET offering_id = ?, section_code = ?, max_strength = ?, updated_at = NOW()
      WHERE section_id = ?
      `,
      [newOffering, newCode, newStrength, id],
    );

    const [updatedRows] = await pool.query(
      `
      SELECT
          sec.section_id,
          sec.offering_id,
          sec.section_code,
          sec.max_strength,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          at.term_id,
          at.term_type,
          ay.label AS academic_year_label,
          (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = sec.section_id) AS enrolled_students_count,
          sec.created_at,
          sec.updated_at
      FROM sections sec
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      WHERE sec.section_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Section updated successfully",
      data: updatedRows[0],
    });
  } catch (error) {
    console.error("Update section error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/sections/:id
 * Delete a section if not referenced by enrollments or timetable slots. ADMIN only.
 */
const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingRows] = await pool.query(
      "SELECT section_id FROM sections WHERE section_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    // Check if referenced by enrollments
    const [enrollmentRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM enrollments WHERE section_id = ?",
      [id],
    );
    if (enrollmentRows[0].total > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete section with active enrollments",
      });
    }

    // Check if referenced by timetable slots
    const [slotRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM timetable_slots WHERE section_id = ?",
      [id],
    );
    if (slotRows[0].total > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete section referenced by timetable slots",
      });
    }

    await pool.query("DELETE FROM sections WHERE section_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "Section deleted successfully",
      data: {
        section_id: Number(id),
      },
    });
  } catch (error) {
    console.error("Delete section error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
};
