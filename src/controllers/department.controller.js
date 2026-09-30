const pool = require("../config/mysql");

/**
 * GET /api/v1/departments
 * Retrieves list of academic departments with optional filters and school joins.
 */
const getDepartments = async (req, res) => {
  try {
    const { school_id, is_active, search } = req.query;

    const conditions = [];
    const params = [];

    if (school_id !== undefined && school_id !== "") {
      conditions.push("d.school_id = ?");
      params.push(Number(school_id));
    }

    if (is_active !== undefined && is_active !== "") {
      const activeVal =
        is_active === "true" || is_active === "1" || is_active === 1 ? 1 : 0;
      conditions.push("d.is_active = ?");
      params.push(activeVal);
    }

    if (search && search.trim() !== "") {
      conditions.push("(d.name LIKE ? OR d.code LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [departments] = await pool.query(
      `
      SELECT
          d.department_id,
          d.school_id,
          s.name AS school_name,
          s.code AS school_code,
          d.name,
          d.code,
          d.is_active,
          d.created_at,
          d.updated_at
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.school_id
      ${whereClause}
      ORDER BY d.department_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Departments retrieved successfully",
      data: departments,
    });
  } catch (error) {
    console.error("Get departments error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/departments/:id
 * Retrieves a single department by its ID including school metadata.
 */
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [departments] = await pool.query(
      `
      SELECT
          d.department_id,
          d.school_id,
          s.name AS school_name,
          s.code AS school_code,
          d.name,
          d.code,
          d.is_active,
          d.created_at,
          d.updated_at
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.school_id
      WHERE d.department_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (departments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Department retrieved successfully",
      data: departments[0],
    });
  } catch (error) {
    console.error("Get department error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/departments
 * Creates a new department. ADMIN only.
 */
const createDepartment = async (req, res) => {
  try {
    const { school_id, name, code, is_active } = req.body || {};

    // Validate required fields
    if (!school_id || !name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "school_id and name are required",
      });
    }

    const trimmedName = name.trim();
    const trimmedCode = code && typeof code === "string" ? code.trim() : null;

    // Validate foreign key: school_id must exist in schools
    const [schools] = await pool.query(
      `SELECT school_id, name, code FROM schools WHERE school_id = ? LIMIT 1`,
      [school_id],
    );

    if (schools.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid school_id",
      });
    }

    const activeStatus = is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : 1;

    // Insert new department
    const [result] = await pool.query(
      `
      INSERT INTO departments (school_id, name, code, is_active)
      VALUES (?, ?, ?, ?)
      `,
      [school_id, trimmedName, trimmedCode, activeStatus],
    );

    // Retrieve inserted record with school join
    const [createdDept] = await pool.query(
      `
      SELECT
          d.department_id,
          d.school_id,
          s.name AS school_name,
          s.code AS school_code,
          d.name,
          d.code,
          d.is_active,
          d.created_at,
          d.updated_at
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.school_id
      WHERE d.department_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: createdDept[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A department with this name already exists in this school",
      });
    }

    console.error("Create department error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/departments/:id
 * Updates an existing department. ADMIN only.
 */
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { school_id, name, code, is_active } = req.body || {};

    // Check if department exists
    const [existing] = await pool.query(
      `SELECT * FROM departments WHERE department_id = ? LIMIT 1`,
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const current = existing[0];

    // Validate school_id if provided
    let targetSchoolId = current.school_id;
    if (school_id !== undefined) {
      const [schools] = await pool.query(
        `SELECT school_id FROM schools WHERE school_id = ? LIMIT 1`,
        [school_id],
      );

      if (schools.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid school_id",
        });
      }
      targetSchoolId = Number(school_id);
    }

    const targetName =
      name !== undefined && typeof name === "string" ? name.trim() : current.name;
    const targetCode =
      code !== undefined
        ? code === null
          ? null
          : typeof code === "string"
          ? code.trim()
          : current.code
        : current.code;
    const targetIsActive =
      is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : current.is_active;

    await pool.query(
      `
      UPDATE departments
      SET
          school_id = ?,
          name = ?,
          code = ?,
          is_active = ?
      WHERE department_id = ?
      `,
      [targetSchoolId, targetName, targetCode, targetIsActive, id],
    );

    // Retrieve updated record with school join
    const [updated] = await pool.query(
      `
      SELECT
          d.department_id,
          d.school_id,
          s.name AS school_name,
          s.code AS school_code,
          d.name,
          d.code,
          d.is_active,
          d.created_at,
          d.updated_at
      FROM departments d
      LEFT JOIN schools s ON d.school_id = s.school_id
      WHERE d.department_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A department with this name already exists in this school",
      });
    }

    console.error("Update department error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/departments/:id
 * Soft deactivates a department (is_active = 0). ADMIN only.
 */
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const [departments] = await pool.query(
      `SELECT department_id, is_active FROM departments WHERE department_id = ? LIMIT 1`,
      [id],
    );

    if (departments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    if (!departments[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Department is already inactive",
      });
    }

    await pool.query(
      `UPDATE departments SET is_active = 0 WHERE department_id = ?`,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Department deactivated successfully",
    });
  } catch (error) {
    console.error("Deactivate department error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
