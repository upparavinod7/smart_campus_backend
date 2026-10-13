const pool = require("../config/mysql");

const ALLOWED_TERM_TYPES = ["ODD", "EVEN", "SUMMER"];

/**
 * GET /api/v1/academic-terms
 * List academic terms with joined academic year, offerings count, and filter support.
 */
const getAcademicTerms = async (req, res) => {
  try {
    const { academic_year_id, term_type, search, q } = req.query;
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    if (term_type) {
      conditions.push("at.term_type = ?");
      params.push(term_type.toUpperCase());
    }

    if (searchTerm) {
      conditions.push("(ay.label LIKE ? OR at.term_type LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [terms] = await pool.query(
      `
      SELECT
          at.term_id,
          at.academic_year_id,
          ay.label AS academic_year_label,
          ay.start_date AS academic_year_start,
          ay.end_date AS academic_year_end,
          at.term_type,
          at.start_date,
          at.end_date,
          at.created_at,
          at.updated_at,
          (SELECT COUNT(*) FROM course_offerings co WHERE co.term_id = at.term_id) AS offerings_count
      FROM academic_terms at
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      ${whereClause}
      ORDER BY at.start_date DESC, at.term_id DESC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Academic terms retrieved successfully",
      count: terms.length,
      data: terms,
    });
  } catch (error) {
    console.error("Get academic terms error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/academic-terms/:id
 * Retrieve a single academic term by ID with details.
 */
const getAcademicTermById = async (req, res) => {
  try {
    const { id } = req.params;

    const [terms] = await pool.query(
      `
      SELECT
          at.term_id,
          at.academic_year_id,
          ay.label AS academic_year_label,
          ay.start_date AS academic_year_start,
          ay.end_date AS academic_year_end,
          at.term_type,
          at.start_date,
          at.end_date,
          at.created_at,
          at.updated_at,
          (SELECT COUNT(*) FROM course_offerings co WHERE co.term_id = at.term_id) AS offerings_count
      FROM academic_terms at
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      WHERE at.term_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (terms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Academic term not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Academic term retrieved successfully",
      data: terms[0],
    });
  } catch (error) {
    console.error("Get academic term by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/academic-terms
 * Create a new academic term. Admin only.
 */
const createAcademicTerm = async (req, res) => {
  try {
    const { academic_year_id, term_type, start_date, end_date } = req.body;

    if (!academic_year_id) {
      return res.status(400).json({
        success: false,
        message: "academic_year_id is required",
      });
    }

    if (!term_type || !ALLOWED_TERM_TYPES.includes(term_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `term_type is required and must be one of: ${ALLOWED_TERM_TYPES.join(", ")}`,
      });
    }

    if (!start_date || isNaN(Date.parse(start_date))) {
      return res.status(400).json({
        success: false,
        message: "Valid start_date is required (YYYY-MM-DD)",
      });
    }

    if (!end_date || isNaN(Date.parse(end_date))) {
      return res.status(400).json({
        success: false,
        message: "Valid end_date is required (YYYY-MM-DD)",
      });
    }

    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({
        success: false,
        message: "end_date must be after start_date",
      });
    }

    // Verify parent academic_year exists
    const [years] = await pool.query(
      "SELECT academic_year_id, label FROM academic_years WHERE academic_year_id = ? LIMIT 1",
      [Number(academic_year_id)],
    );

    if (years.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Academic year with ID ${academic_year_id} does not exist`,
      });
    }

    const normalizedTermType = term_type.toUpperCase();

    // Check duplicate (academic_year_id, term_type)
    const [existing] = await pool.query(
      "SELECT term_id FROM academic_terms WHERE academic_year_id = ? AND term_type = ? LIMIT 1",
      [Number(academic_year_id), normalizedTermType],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Academic term '${normalizedTermType}' already exists for academic year '${years[0].label}'`,
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO academic_terms (academic_year_id, term_type, start_date, end_date)
      VALUES (?, ?, ?, ?)
      `,
      [Number(academic_year_id), normalizedTermType, start_date, end_date],
    );

    const [newTerm] = await pool.query(
      `
      SELECT
          at.term_id,
          at.academic_year_id,
          ay.label AS academic_year_label,
          at.term_type,
          at.start_date,
          at.end_date,
          at.created_at,
          at.updated_at
      FROM academic_terms at
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      WHERE at.term_id = ?
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Academic term created successfully",
      data: newTerm[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Academic term already exists for this academic year",
      });
    }
    console.error("Create academic term error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/academic-terms/:id
 * Update an academic term. Admin only.
 */
const updateAcademicTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const { academic_year_id, term_type, start_date, end_date } = req.body;

    const [existing] = await pool.query(
      "SELECT * FROM academic_terms WHERE term_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Academic term not found",
      });
    }

    const current = existing[0];
    const newYearId = academic_year_id !== undefined ? Number(academic_year_id) : current.academic_year_id;
    const newTermType = term_type !== undefined ? term_type.toUpperCase() : current.term_type;
    const newStartDate = start_date !== undefined ? start_date : current.start_date;
    const newEndDate = end_date !== undefined ? end_date : current.end_date;

    if (!ALLOWED_TERM_TYPES.includes(newTermType)) {
      return res.status(400).json({
        success: false,
        message: `term_type must be one of: ${ALLOWED_TERM_TYPES.join(", ")}`,
      });
    }

    if (newStartDate && isNaN(Date.parse(newStartDate))) {
      return res.status(400).json({
        success: false,
        message: "Valid start_date is required",
      });
    }

    if (newEndDate && isNaN(Date.parse(newEndDate))) {
      return res.status(400).json({
        success: false,
        message: "Valid end_date is required",
      });
    }

    if (new Date(newEndDate) <= new Date(newStartDate)) {
      return res.status(400).json({
        success: false,
        message: "end_date must be after start_date",
      });
    }

    if (academic_year_id !== undefined) {
      const [yearExists] = await pool.query(
        "SELECT academic_year_id FROM academic_years WHERE academic_year_id = ? LIMIT 1",
        [newYearId],
      );
      if (yearExists.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Academic year with ID ${newYearId} does not exist`,
        });
      }
    }

    // Check duplicate if year or term_type changed
    if (newYearId !== current.academic_year_id || newTermType !== current.term_type) {
      const [duplicate] = await pool.query(
        "SELECT term_id FROM academic_terms WHERE academic_year_id = ? AND term_type = ? AND term_id != ? LIMIT 1",
        [newYearId, newTermType, id],
      );
      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Academic term '${newTermType}' already exists for this academic year`,
        });
      }
    }

    await pool.query(
      `
      UPDATE academic_terms
      SET academic_year_id = ?, term_type = ?, start_date = ?, end_date = ?
      WHERE term_id = ?
      `,
      [newYearId, newTermType, newStartDate, newEndDate, id],
    );

    const [updated] = await pool.query(
      `
      SELECT
          at.term_id,
          at.academic_year_id,
          ay.label AS academic_year_label,
          at.term_type,
          at.start_date,
          at.end_date,
          at.created_at,
          at.updated_at
      FROM academic_terms at
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      WHERE at.term_id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Academic term updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Academic term already exists for this academic year",
      });
    }
    console.error("Update academic term error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/academic-terms/:id
 * Delete an academic term if no course offerings exist for it. Admin only.
 */
const deleteAcademicTerm = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM academic_terms WHERE term_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Academic term not found",
      });
    }

    // Check if referenced by course_offerings
    const [offerings] = await pool.query(
      "SELECT COUNT(*) AS total FROM course_offerings WHERE term_id = ?",
      [id],
    );

    if (offerings[0].total > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete academic term: ${offerings[0].total} course offering(s) are associated with it`,
      });
    }

    await pool.query("DELETE FROM academic_terms WHERE term_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "Academic term deleted successfully",
    });
  } catch (error) {
    console.error("Delete academic term error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAcademicTerms,
  getAcademicTermById,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
};

