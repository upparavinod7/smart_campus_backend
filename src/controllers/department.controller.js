const pool = require("../config/mysql");

// GET /api/v1/departments
const getDepartments = async (req, res) => {
  try {
    const [departments] = await pool.query(
      `
            SELECT
                department_id,
                school_id,
                name,
                code,
                is_active,
                created_at,
                updated_at
            FROM departments
            ORDER BY department_id
            `,
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

// GET /api/v1/departments/:id
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [departments] = await pool.query(
      `
            SELECT
                department_id,
                school_id,
                name,
                code,
                is_active,
                created_at,
                updated_at
            FROM departments
            WHERE department_id = ?
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

// POST /api/v1/departments
const createDepartment = async (req, res) => {
  try {
    const { school_id, name, code, is_active } = req.body;

    // Required fields
    if (!school_id || !name) {
      return res.status(400).json({
        success: false,
        message: "school_id and name are required",
      });
    }

    // Check school exists
    const [schools] = await pool.query(
      `
            SELECT school_id
            FROM schools
            WHERE school_id = ?
            LIMIT 1
            `,
      [school_id],
    );

    if (schools.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid school_id",
      });
    }

    // Check duplicate code
    if (code) {
      const [existingCodes] = await pool.query(
        `
            SELECT department_id
            FROM departments
            WHERE code = ?
            LIMIT 1
            `,
        [code],
      );

      if (existingCodes.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Department code already exists",
        });
      }
    }

    // Check duplicate name in school
    const [existingNames] = await pool.query(
      `
            SELECT department_id
            FROM departments
            WHERE school_id = ? AND name = ?
            LIMIT 1
            `,
      [school_id, name],
    );

    if (existingNames.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Department name already exists in this school",
      });
    }

    // Create department
    const [result] = await pool.query(
      `
            INSERT INTO departments
                (school_id, name, code, is_active)
            VALUES
                (?, ?, ?, ?)
            `,
      [school_id, name, code ?? null, is_active ?? 1],
    );

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: {
        department_id: result.insertId,
        school_id,
        name,
        code: code ?? null,
        is_active: is_active ?? 1,
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Department code or name already exists",
      });
    }
    console.error("Create department error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /api/v1/departments/:id
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const { school_id, name, code, is_active } = req.body;

    // Check department exists
    const [existingDepartments] = await pool.query(
      `
            SELECT *
            FROM departments
            WHERE department_id = ?
            LIMIT 1
            `,
      [id],
    );

    if (existingDepartments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const department = existingDepartments[0];

    // Validate school if provided
    if (school_id !== undefined) {
      const [schools] = await pool.query(
        `
                SELECT school_id
                FROM schools
                WHERE school_id = ?
                LIMIT 1
                `,
        [school_id],
      );

      if (schools.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid school_id",
        });
      }
    }

    const updatedDepartment = {
      school_id: school_id ?? department.school_id,
      name: name ?? department.name,
      code: code ?? department.code,
      is_active: is_active ?? department.is_active,
    };

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
      [
        updatedDepartment.school_id,
        updatedDepartment.name,
        updatedDepartment.code,
        updatedDepartment.is_active,
        id,
      ],
    );

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: {
        department_id: Number(id),
        ...updatedDepartment,
      },
    });
  } catch (error) {
    console.error("Update department error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE /api/v1/departments/:id
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const [departments] = await pool.query(
      `
            SELECT department_id, is_active
            FROM departments
            WHERE department_id = ?
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

    if (!departments[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Department is already inactive",
      });
    }

    await pool.query(
      `
            UPDATE departments
            SET is_active = 0
            WHERE department_id = ?
            `,
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
