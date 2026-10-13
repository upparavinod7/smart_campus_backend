const pool = require("../config/mysql");

/**
 * GET /api/v1/schools
 * List all schools with optional status or search filter, plus department count.
 */
const getSchools = async (req, res) => {
  try {
    const { is_active, search, q } = req.query;
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (is_active !== undefined && is_active !== "") {
      const activeVal = is_active === "true" || is_active === "1" ? 1 : 0;
      conditions.push("s.is_active = ?");
      params.push(activeVal);
    }

    if (searchTerm) {
      conditions.push("(s.name LIKE ? OR s.code LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [schools] = await pool.query(
      `
      SELECT
          s.school_id,
          s.code,
          s.name,
          s.is_active,
          s.created_at,
          s.updated_at,
          (SELECT COUNT(*) FROM departments d WHERE d.school_id = s.school_id AND d.is_active = 1) AS department_count
      FROM schools s
      ${whereClause}
      ORDER BY s.school_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Schools retrieved successfully",
      count: schools.length,
      data: schools,
    });
  } catch (error) {
    console.error("Get schools error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/schools/:id
 * Retrieve a single school by ID with its departments.
 */
const getSchoolById = async (req, res) => {
  try {
    const { id } = req.params;

    const [schools] = await pool.query(
      `
      SELECT
          s.school_id,
          s.code,
          s.name,
          s.is_active,
          s.created_at,
          s.updated_at
      FROM schools s
      WHERE s.school_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (schools.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    const [departments] = await pool.query(
      `
      SELECT
          department_id,
          name,
          code,
          is_active
      FROM departments
      WHERE school_id = ?
      ORDER BY department_id ASC
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "School retrieved successfully",
      data: {
        ...schools[0],
        departments,
      },
    });
  } catch (error) {
    console.error("Get school by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/schools
 * Create a new school. ADMIN only.
 */
const createSchool = async (req, res) => {
  try {
    const { code, name, is_active } = req.body || {};

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: "code and name are required",
      });
    }

    const trimmedCode = code.toString().trim().toUpperCase();
    const trimmedName = name.toString().trim();

    if (!trimmedCode || !trimmedName) {
      return res.status(400).json({
        success: false,
        message: "code and name cannot be empty",
      });
    }

    // Check duplicate code
    const [existingCode] = await pool.query(
      "SELECT school_id FROM schools WHERE code = ? LIMIT 1",
      [trimmedCode],
    );
    if (existingCode.length > 0) {
      return res.status(409).json({
        success: false,
        message: "School code already exists",
      });
    }

    // Check duplicate name
    const [existingName] = await pool.query(
      "SELECT school_id FROM schools WHERE name = ? LIMIT 1",
      [trimmedName],
    );
    if (existingName.length > 0) {
      return res.status(409).json({
        success: false,
        message: "School name already exists",
      });
    }

    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    const [result] = await pool.query(
      `
      INSERT INTO schools (code, name, is_active)
      VALUES (?, ?, ?)
      `,
      [trimmedCode, trimmedName, activeVal],
    );

    const [newSchool] = await pool.query(
      "SELECT school_id, code, name, is_active, created_at, updated_at FROM schools WHERE school_id = ?",
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "School created successfully",
      data: newSchool[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "School code or name already exists",
      });
    }
    console.error("Create school error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/schools/:id
 * Update an existing school. ADMIN only.
 */
const updateSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, is_active } = req.body || {};

    const [existing] = await pool.query(
      "SELECT * FROM schools WHERE school_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    const current = existing[0];
    let newCode = current.code;
    let newName = current.name;
    let newActive = current.is_active;

    if (code !== undefined) {
      newCode = code.toString().trim().toUpperCase();
      if (!newCode) {
        return res.status(400).json({
          success: false,
          message: "code cannot be empty",
        });
      }
    }

    if (name !== undefined) {
      newName = name.toString().trim();
      if (!newName) {
        return res.status(400).json({
          success: false,
          message: "name cannot be empty",
        });
      }
    }

    if (is_active !== undefined) {
      newActive = is_active ? 1 : 0;
    }

    // Check unique code collision
    if (newCode !== current.code) {
      const [dupCode] = await pool.query(
        "SELECT school_id FROM schools WHERE code = ? AND school_id != ? LIMIT 1",
        [newCode, id],
      );
      if (dupCode.length > 0) {
        return res.status(409).json({
          success: false,
          message: "School code already exists",
        });
      }
    }

    // Check unique name collision
    if (newName !== current.name) {
      const [dupName] = await pool.query(
        "SELECT school_id FROM schools WHERE name = ? AND school_id != ? LIMIT 1",
        [newName, id],
      );
      if (dupName.length > 0) {
        return res.status(409).json({
          success: false,
          message: "School name already exists",
        });
      }
    }

    await pool.query(
      `
      UPDATE schools
      SET code = ?, name = ?, is_active = ?, updated_at = NOW()
      WHERE school_id = ?
      `,
      [newCode, newName, newActive, id],
    );

    const [updated] = await pool.query(
      "SELECT school_id, code, name, is_active, created_at, updated_at FROM schools WHERE school_id = ?",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "School updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "School code or name already exists",
      });
    }
    console.error("Update school error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/schools/:id
 * Deactivate a school. ADMIN only.
 */
const deleteSchool = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT school_id, is_active FROM schools WHERE school_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    if (!existing[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "School is already inactive",
      });
    }

    await pool.query(
      "UPDATE schools SET is_active = 0, updated_at = NOW() WHERE school_id = ?",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "School deactivated successfully",
      data: { school_id: Number(id) },
    });
  } catch (error) {
    console.error("Delete school error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
};
