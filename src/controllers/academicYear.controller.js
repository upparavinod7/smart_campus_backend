const pool = require("../config/mysql");

/**
 * GET /api/v1/academic-years
 * List academic years with optional search, date filtering, and associated terms count.
 */
const getAcademicYears = async (req, res) => {
  try {
    const { search, q, start_year, end_year } = req.query;
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (searchTerm) {
      conditions.push("ay.label LIKE ?");
      params.push(`%${searchTerm.trim()}%`);
    }

    if (start_year) {
      conditions.push("YEAR(ay.start_date) = ?");
      params.push(Number(start_year));
    }

    if (end_year) {
      conditions.push("YEAR(ay.end_date) = ?");
      params.push(Number(end_year));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [years] = await pool.query(
      `
      SELECT
          ay.academic_year_id,
          ay.label,
          ay.start_date,
          ay.end_date,
          ay.created_at,
          ay.updated_at,
          (SELECT COUNT(*) FROM academic_terms at WHERE at.academic_year_id = ay.academic_year_id) AS terms_count,
          (SELECT COUNT(*) FROM batches b WHERE b.start_year_id = ay.academic_year_id) AS batches_count
      FROM academic_years ay
      ${whereClause}
      ORDER BY ay.start_date DESC, ay.academic_year_id DESC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Academic years retrieved successfully",
      count: years.length,
      data: years,
    });
  } catch (error) {
    console.error("Get academic years error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/academic-years/:id
 * Retrieve a single academic year by ID, including its associated academic terms.
 */
const getAcademicYearById = async (req, res) => {
  try {
    const { id } = req.params;

    const [years] = await pool.query(
      `
      SELECT
          ay.academic_year_id,
          ay.label,
          ay.start_date,
          ay.end_date,
          ay.created_at,
          ay.updated_at,
          (SELECT COUNT(*) FROM batches b WHERE b.start_year_id = ay.academic_year_id) AS batches_count
      FROM academic_years ay
      WHERE ay.academic_year_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (years.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Academic year not found",
      });
    }

    const [terms] = await pool.query(
      `
      SELECT
          at.term_id,
          at.term_type,
          at.start_date,
          at.end_date,
          at.created_at,
          at.updated_at,
          (SELECT COUNT(*) FROM course_offerings co WHERE co.term_id = at.term_id) AS offerings_count
      FROM academic_terms at
      WHERE at.academic_year_id = ?
      ORDER BY at.start_date ASC, at.term_id ASC
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Academic year retrieved successfully",
      data: {
        ...years[0],
        terms,
      },
    });
  } catch (error) {
    console.error("Get academic year by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/academic-years
 * Create a new academic year. Admin only.
 */
const createAcademicYear = async (req, res) => {
  try {
    const { label, start_date, end_date } = req.body;

    if (!label || typeof label !== "string" || !label.trim()) {
      return res.status(400).json({
        success: false,
        message: "label is required",
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

    const trimmedLabel = label.trim().substring(0, 9);

    // Check duplicate label
    const [existing] = await pool.query(
      "SELECT academic_year_id FROM academic_years WHERE label = ? LIMIT 1",
      [trimmedLabel],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Academic year with label '${trimmedLabel}' already exists`,
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO academic_years (label, start_date, end_date)
      VALUES (?, ?, ?)
      `,
      [trimmedLabel, start_date, end_date],
    );

    const [newYear] = await pool.query(
      "SELECT * FROM academic_years WHERE academic_year_id = ?",
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Academic year created successfully",
      data: newYear[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Academic year label already exists",
      });
    }
    console.error("Create academic year error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/academic-years/:id
 * Update an existing academic year. Admin only.
 */
const updateAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, start_date, end_date } = req.body;

    const [existing] = await pool.query(
      "SELECT * FROM academic_years WHERE academic_year_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Academic year not found",
      });
    }

    const current = existing[0];
    const newLabel = label !== undefined ? label.trim().substring(0, 9) : current.label;
    const newStartDate = start_date !== undefined ? start_date : current.start_date;
    const newEndDate = end_date !== undefined ? end_date : current.end_date;

    if (!newLabel) {
      return res.status(400).json({
        success: false,
        message: "label cannot be empty",
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

    // Check duplicate label if changed
    if (newLabel !== current.label) {
      const [duplicate] = await pool.query(
        "SELECT academic_year_id FROM academic_years WHERE label = ? AND academic_year_id != ? LIMIT 1",
        [newLabel, id],
      );
      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Academic year with label '${newLabel}' already exists`,
        });
      }
    }

    await pool.query(
      `
      UPDATE academic_years
      SET label = ?, start_date = ?, end_date = ?
      WHERE academic_year_id = ?
      `,
      [newLabel, newStartDate, newEndDate, id],
    );

    const [updated] = await pool.query(
      "SELECT * FROM academic_years WHERE academic_year_id = ?",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Academic year updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Academic year label already exists",
      });
    }
    console.error("Update academic year error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/academic-years/:id
 * Delete an academic year if not referenced by terms or batches. Admin only.
 */
const deleteAcademicYear = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM academic_years WHERE academic_year_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Academic year not found",
      });
    }

    // Check if referenced by academic_terms
    const [terms] = await pool.query(
      "SELECT COUNT(*) AS total FROM academic_terms WHERE academic_year_id = ?",
      [id],
    );
    if (terms[0].total > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete academic year: ${terms[0].total} academic term(s) are associated with it`,
      });
    }

    // Check if referenced by batches
    const [batches] = await pool.query(
      "SELECT COUNT(*) AS total FROM batches WHERE start_year_id = ?",
      [id],
    );
    if (batches[0].total > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete academic year: ${batches[0].total} batch(es) reference it as start_year`,
      });
    }

    await pool.query("DELETE FROM academic_years WHERE academic_year_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "Academic year deleted successfully",
    });
  } catch (error) {
    console.error("Delete academic year error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAcademicYears,
  getAcademicYearById,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
};
