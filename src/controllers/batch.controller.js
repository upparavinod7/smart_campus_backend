const pool = require("../config/mysql");

/**
 * GET /api/v1/batches
 * List batches with joins to programme, academic year, department, school, and counts.
 */
const getBatches = async (req, res) => {
  try {
    const {
      programme_id,
      start_year_id,
      department_id,
      school_id,
      search,
      q,
    } = req.query;
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (programme_id !== undefined && programme_id !== "") {
      conditions.push("b.programme_id = ?");
      params.push(Number(programme_id));
    }

    if (start_year_id !== undefined && start_year_id !== "") {
      conditions.push("b.start_year_id = ?");
      params.push(Number(start_year_id));
    }

    if (department_id !== undefined && department_id !== "") {
      conditions.push("p.department_id = ?");
      params.push(Number(department_id));
    }

    if (school_id !== undefined && school_id !== "") {
      conditions.push("p.school_id = ?");
      params.push(Number(school_id));
    }

    if (searchTerm) {
      conditions.push("(b.label LIKE ? OR p.name LIKE ? OR ay.label LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [batches] = await pool.query(
      `
      SELECT
          b.batch_id,
          b.programme_id,
          p.name AS programme_name,
          p.programme_code,
          p.department_id,
          d.name AS department_name,
          p.school_id,
          s.name AS school_name,
          b.start_year_id,
          ay.label AS start_year_label,
          b.label,
          b.created_at,
          b.updated_at,
          (SELECT COUNT(*) FROM sections sec WHERE sec.batch_id = b.batch_id) AS section_count,
          (SELECT COUNT(*) FROM students st WHERE st.batch_id = b.batch_id) AS student_count
      FROM batches b
      JOIN programmes p ON b.programme_id = p.programme_id
      JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      JOIN schools s ON p.school_id = s.school_id
      ${whereClause}
      ORDER BY b.batch_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Batches retrieved successfully",
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    console.error("Get batches error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/batches/:id
 * Retrieve single batch by ID.
 */
const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    const [batches] = await pool.query(
      `
      SELECT
          b.batch_id,
          b.programme_id,
          p.name AS programme_name,
          p.programme_code,
          p.department_id,
          d.name AS department_name,
          p.school_id,
          s.name AS school_name,
          b.start_year_id,
          ay.label AS start_year_label,
          b.label,
          b.created_at,
          b.updated_at,
          (SELECT COUNT(*) FROM sections sec WHERE sec.batch_id = b.batch_id) AS section_count,
          (SELECT COUNT(*) FROM students st WHERE st.batch_id = b.batch_id) AS student_count
      FROM batches b
      JOIN programmes p ON b.programme_id = p.programme_id
      JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      JOIN schools s ON p.school_id = s.school_id
      WHERE b.batch_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const [sections] = await pool.query(
      `
      SELECT
          sec.section_id,
          sec.section_code,
          sec.max_strength,
          sub.name AS subject_name,
          sub.subject_code
      FROM sections sec
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      WHERE sec.batch_id = ?
      ORDER BY sec.section_code ASC
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Batch retrieved successfully",
      data: {
        ...batches[0],
        sections,
      },
    });
  } catch (error) {
    console.error("Get batch by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/batches
 * Create a new batch. ADMIN only.
 */
const createBatch = async (req, res) => {
  try {
    const { programme_id, start_year_id, label } = req.body || {};

    if (!programme_id || !start_year_id || !label) {
      return res.status(400).json({
        success: false,
        message: "programme_id, start_year_id, and label are required",
      });
    }

    const progNum = Number(programme_id);
    const yearNum = Number(start_year_id);
    const trimmedLabel = label.toString().trim();

    if (isNaN(progNum) || isNaN(yearNum) || !trimmedLabel) {
      return res.status(400).json({
        success: false,
        message: "Invalid input: programme_id and start_year_id must be valid numbers, label cannot be empty",
      });
    }

    // Verify programme exists
    const [prog] = await pool.query(
      "SELECT programme_id FROM programmes WHERE programme_id = ? LIMIT 1",
      [progNum],
    );
    if (prog.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid programme_id: programme does not exist",
      });
    }

    // Verify academic year exists
    const [year] = await pool.query(
      "SELECT academic_year_id FROM academic_years WHERE academic_year_id = ? LIMIT 1",
      [yearNum],
    );
    if (year.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid start_year_id: academic year does not exist",
      });
    }

    // Unique check (programme_id, start_year_id)
    const [dup] = await pool.query(
      "SELECT batch_id FROM batches WHERE programme_id = ? AND start_year_id = ? LIMIT 1",
      [progNum, yearNum],
    );
    if (dup.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A batch for this programme and start year already exists",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO batches (programme_id, start_year_id, label)
      VALUES (?, ?, ?)
      `,
      [progNum, yearNum, trimmedLabel],
    );

    const [newBatch] = await pool.query(
      `
      SELECT
          b.batch_id,
          b.programme_id,
          p.name AS programme_name,
          b.start_year_id,
          ay.label AS start_year_label,
          b.label,
          b.created_at,
          b.updated_at
      FROM batches b
      JOIN programmes p ON b.programme_id = p.programme_id
      JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
      WHERE b.batch_id = ?
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Batch created successfully",
      data: newBatch[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A batch for this programme and start year already exists",
      });
    }
    console.error("Create batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/batches/:id
 * Update an existing batch. ADMIN only.
 */
const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { programme_id, start_year_id, label } = req.body || {};

    const [existing] = await pool.query(
      "SELECT * FROM batches WHERE batch_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const current = existing[0];
    const newProg = programme_id !== undefined ? Number(programme_id) : current.programme_id;
    const newYear = start_year_id !== undefined ? Number(start_year_id) : current.start_year_id;
    const newLabel = label !== undefined ? label.toString().trim() : current.label;

    if (!newLabel) {
      return res.status(400).json({
        success: false,
        message: "label cannot be empty",
      });
    }

    if (programme_id !== undefined) {
      const [prog] = await pool.query("SELECT programme_id FROM programmes WHERE programme_id = ? LIMIT 1", [newProg]);
      if (prog.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid programme_id" });
      }
    }

    if (start_year_id !== undefined) {
      const [year] = await pool.query("SELECT academic_year_id FROM academic_years WHERE academic_year_id = ? LIMIT 1", [newYear]);
      if (year.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid start_year_id" });
      }
    }

    if (newProg !== current.programme_id || newYear !== current.start_year_id) {
      const [dup] = await pool.query(
        "SELECT batch_id FROM batches WHERE programme_id = ? AND start_year_id = ? AND batch_id != ? LIMIT 1",
        [newProg, newYear, id],
      );
      if (dup.length > 0) {
        return res.status(409).json({
          success: false,
          message: "A batch for this programme and start year already exists",
        });
      }
    }

    await pool.query(
      `
      UPDATE batches
      SET programme_id = ?, start_year_id = ?, label = ?, updated_at = NOW()
      WHERE batch_id = ?
      `,
      [newProg, newYear, newLabel, id],
    );

    const [updated] = await pool.query(
      `
      SELECT
          b.batch_id,
          b.programme_id,
          p.name AS programme_name,
          b.start_year_id,
          ay.label AS start_year_label,
          b.label,
          b.created_at,
          b.updated_at
      FROM batches b
      JOIN programmes p ON b.programme_id = p.programme_id
      JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
      WHERE b.batch_id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Batch updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A batch for this programme and start year already exists",
      });
    }
    console.error("Update batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/batches/:id
 * Delete batch if no students or sections are attached. ADMIN only.
 */
const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT batch_id FROM batches WHERE batch_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    // Check students attached
    const [students] = await pool.query(
      "SELECT COUNT(*) AS total FROM students WHERE batch_id = ?",
      [id],
    );
    if (students[0].total > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete batch with assigned students",
      });
    }

    // Check sections attached
    const [sections] = await pool.query(
      "SELECT COUNT(*) AS total FROM sections WHERE batch_id = ?",
      [id],
    );
    if (sections[0].total > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete batch with assigned sections",
      });
    }

    await pool.query("DELETE FROM batches WHERE batch_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "Batch deleted successfully",
      data: { batch_id: Number(id) },
    });
  } catch (error) {
    console.error("Delete batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
};
