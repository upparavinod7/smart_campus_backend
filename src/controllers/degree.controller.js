const pool = require("../config/mysql");

const ALLOWED_LEVELS = ["UG", "PG", "DOCTORAL", "DIPLOMA"];

/**
 * GET /api/v1/degrees
 * List all academic degrees.
 */
const getDegrees = async (req, res) => {
  try {
    const [degrees] = await pool.query(
      `
      SELECT
          d.degree_id,
          d.code,
          d.name,
          d.level,
          d.created_at,
          d.updated_at,
          (SELECT COUNT(*) FROM programmes p WHERE p.degree_id = d.degree_id) AS programmes_count
      FROM degrees d
      ORDER BY d.degree_id ASC
      `,
    );

    return res.status(200).json({
      success: true,
      message: "Degrees retrieved successfully",
      count: degrees.length,
      data: degrees,
    });
  } catch (error) {
    console.error("Get degrees error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/degrees/:id
 * Retrieve a single degree by ID.
 */
const getDegreeById = async (req, res) => {
  try {
    const { id } = req.params;

    const [degrees] = await pool.query(
      `
      SELECT
          d.degree_id,
          d.code,
          d.name,
          d.level,
          d.created_at,
          d.updated_at,
          (SELECT COUNT(*) FROM programmes p WHERE p.degree_id = d.degree_id) AS programmes_count
      FROM degrees d
      WHERE d.degree_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (degrees.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Degree not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Degree retrieved successfully",
      data: degrees[0],
    });
  } catch (error) {
    console.error("Get degree by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/degrees
 * Create a new academic degree. ADMIN only.
 */
const createDegree = async (req, res) => {
  try {
    const { code, name, level } = req.body || {};

    if (!code || !name || !level) {
      return res.status(400).json({
        success: false,
        message: "code, name, and level are required",
      });
    }

    const trimmedCode = code.toString().trim().toUpperCase();
    const trimmedName = name.toString().trim();
    const upperLevel = level.toString().trim().toUpperCase();

    if (!trimmedCode || !trimmedName) {
      return res.status(400).json({
        success: false,
        message: "code and name cannot be empty",
      });
    }

    if (!ALLOWED_LEVELS.includes(upperLevel)) {
      return res.status(400).json({
        success: false,
        message: `level must be one of: ${ALLOWED_LEVELS.join(", ")}`,
      });
    }

    // Check duplicate code
    const [existingCode] = await pool.query(
      "SELECT degree_id FROM degrees WHERE code = ? LIMIT 1",
      [trimmedCode],
    );
    if (existingCode.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Degree with this code already exists",
      });
    }

    // Check duplicate name
    const [existingName] = await pool.query(
      "SELECT degree_id FROM degrees WHERE name = ? LIMIT 1",
      [trimmedName],
    );
    if (existingName.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Degree with this name already exists",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO degrees (code, name, level)
      VALUES (?, ?, ?)
      `,
      [trimmedCode, trimmedName, upperLevel],
    );

    return res.status(201).json({
      success: true,
      message: "Degree created successfully",
      data: {
        degree_id: result.insertId,
        code: trimmedCode,
        name: trimmedName,
        level: upperLevel,
      },
    });
  } catch (error) {
    console.error("Create degree error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A degree with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/degrees/:id
 * Update an existing degree. ADMIN only.
 */
const updateDegree = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, level } = req.body || {};

    const [existing] = await pool.query(
      "SELECT * FROM degrees WHERE degree_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Degree not found",
      });
    }

    const current = existing[0];
    const updatedCode = code !== undefined ? code.toString().trim().toUpperCase() : current.code;
    const updatedName = name !== undefined ? name.toString().trim() : current.name;
    const updatedLevel = level !== undefined ? level.toString().trim().toUpperCase() : current.level;

    if (!updatedCode || !updatedName) {
      return res.status(400).json({
        success: false,
        message: "code and name cannot be empty",
      });
    }

    if (!ALLOWED_LEVELS.includes(updatedLevel)) {
      return res.status(400).json({
        success: false,
        message: `level must be one of: ${ALLOWED_LEVELS.join(", ")}`,
      });
    }

    // Check duplicate code if changed
    if (updatedCode !== current.code) {
      const [dupCode] = await pool.query(
        "SELECT degree_id FROM degrees WHERE code = ? AND degree_id <> ? LIMIT 1",
        [updatedCode, id],
      );
      if (dupCode.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Degree with this code already exists",
        });
      }
    }

    // Check duplicate name if changed
    if (updatedName !== current.name) {
      const [dupName] = await pool.query(
        "SELECT degree_id FROM degrees WHERE name = ? AND degree_id <> ? LIMIT 1",
        [updatedName, id],
      );
      if (dupName.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Degree with this name already exists",
        });
      }
    }

    await pool.query(
      `
      UPDATE degrees
      SET code = ?, name = ?, level = ?
      WHERE degree_id = ?
      `,
      [updatedCode, updatedName, updatedLevel, id],
    );

    return res.status(200).json({
      success: true,
      message: "Degree updated successfully",
      data: {
        degree_id: Number(id),
        code: updatedCode,
        name: updatedName,
        level: updatedLevel,
      },
    });
  } catch (error) {
    console.error("Update degree error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A degree with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/degrees/:id
 * Delete an academic degree if not referenced by programmes. ADMIN only.
 */
const deleteDegree = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT degree_id FROM degrees WHERE degree_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Degree not found",
      });
    }

    // Check foreign key dependencies
    const [programmes] = await pool.query(
      "SELECT programme_id FROM programmes WHERE degree_id = ? LIMIT 1",
      [id],
    );

    if (programmes.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete degree because associated programmes exist",
      });
    }

    await pool.query("DELETE FROM degrees WHERE degree_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "Degree deleted successfully",
    });
  } catch (error) {
    console.error("Delete degree error:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete degree because related records exist",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getDegrees,
  getDegreeById,
  createDegree,
  updateDegree,
  deleteDegree,
};
