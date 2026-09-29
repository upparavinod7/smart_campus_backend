const pool = require("../config/mysql");

// GET /api/v1/faculty
const getFaculty = async (req, res) => {
  try {
    const [faculty] = await pool.query(`
      SELECT
        f.faculty_id,
        f.employee_code,
        f.full_name,
        f.email,
        f.designation_id,
        d.name AS designation_name,
        f.school_id,
        s.name AS school_name,
        s.code AS school_code,
        f.department_id,
        dep.name AS department_name,
        dep.code AS department_code,
        f.is_active,
        f.created_at,
        f.updated_at
      FROM faculty f
      LEFT JOIN designations d ON f.designation_id = d.designation_id
      LEFT JOIN schools s ON f.school_id = s.school_id
      LEFT JOIN departments dep ON f.department_id = dep.department_id
      ORDER BY f.faculty_id ASC
    `);

    return res.status(200).json({
      success: true,
      message: "Faculty retrieved successfully",
      count: faculty.length,
      data: faculty,
    });
  } catch (error) {
    console.error("Get faculty error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/v1/faculty/:id
const getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;

    const [faculty] = await pool.query(
      `
      SELECT
        f.faculty_id,
        f.employee_code,
        f.full_name,
        f.email,
        f.designation_id,
        d.name AS designation_name,
        f.school_id,
        s.name AS school_name,
        s.code AS school_code,
        f.department_id,
        dep.name AS department_name,
        dep.code AS department_code,
        f.is_active,
        f.created_at,
        f.updated_at
      FROM faculty f
      LEFT JOIN designations d ON f.designation_id = d.designation_id
      LEFT JOIN schools s ON f.school_id = s.school_id
      LEFT JOIN departments dep ON f.department_id = dep.department_id
      WHERE f.faculty_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Faculty member retrieved successfully",
      data: faculty[0],
    });
  } catch (error) {
    console.error("Get faculty member error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/v1/faculty
const createFaculty = async (req, res) => {
  try {
    const {
      employee_code,
      full_name,
      email,
      designation_id,
      school_id,
      department_id,
      is_active,
    } = req.body;

    if (!employee_code || !full_name) {
      return res.status(400).json({
        success: false,
        message: "employee_code and full_name are required",
      });
    }

    let effectiveSchoolId = school_id;

    // Check department if provided
    if (department_id) {
      const [department] = await pool.query(
        `
        SELECT department_id, school_id
        FROM departments
        WHERE department_id = ?
        LIMIT 1
        `,
        [department_id],
      );

      if (department.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id",
        });
      }

      if (!effectiveSchoolId) {
        effectiveSchoolId = department[0].school_id;
      }
    }

    if (!effectiveSchoolId) {
      return res.status(400).json({
        success: false,
        message: "school_id or valid department_id is required",
      });
    }

    // Check duplicate employee code
    const [existingEmployee] = await pool.query(
      `
      SELECT faculty_id
      FROM faculty
      WHERE employee_code = ?
      LIMIT 1
      `,
      [employee_code.trim()],
    );

    if (existingEmployee.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Employee code already exists",
      });
    }

    // Check duplicate email if provided
    if (email && email.trim()) {
      const [existingEmail] = await pool.query(
        `
        SELECT faculty_id
        FROM faculty
        WHERE email = ?
        LIMIT 1
        `,
        [email.trim()],
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Check school
    const [school] = await pool.query(
      `
      SELECT school_id
      FROM schools
      WHERE school_id = ?
      LIMIT 1
      `,
      [effectiveSchoolId],
    );

    if (school.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid school_id",
      });
    }

    // Check designation if provided
    if (designation_id) {
      const [designation] = await pool.query(
        `
        SELECT designation_id
        FROM designations
        WHERE designation_id = ?
        LIMIT 1
        `,
        [designation_id],
      );

      if (designation.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid designation_id",
        });
      }
    }

    const activeStatus = is_active === undefined ? 1 : is_active ? 1 : 0;

    const [result] = await pool.query(
      `
      INSERT INTO faculty
        (
          employee_code,
          full_name,
          email,
          designation_id,
          school_id,
          department_id,
          is_active
        )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        employee_code.trim(),
        full_name.trim(),
        email ? email.trim() : null,
        designation_id || null,
        effectiveSchoolId,
        department_id || null,
        activeStatus,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Faculty member created successfully",
      data: {
        faculty_id: result.insertId,
        employee_code: employee_code.trim(),
        full_name: full_name.trim(),
        email: email ? email.trim() : null,
        designation_id: designation_id || null,
        school_id: effectiveSchoolId,
        department_id: department_id || null,
        is_active: activeStatus,
      },
    });
  } catch (error) {
    console.error("Create faculty error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A faculty member with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /api/v1/faculty/:id
const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      employee_code,
      full_name,
      email,
      designation_id,
      school_id,
      department_id,
      is_active,
    } = req.body;

    const [existingFaculty] = await pool.query(
      `
            SELECT *
            FROM faculty
            WHERE faculty_id = ?
            LIMIT 1
            `,
      [id],
    );

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    const faculty = existingFaculty[0];
    let effectiveSchoolId = school_id !== undefined ? school_id : faculty.school_id;

    if (department_id !== undefined && department_id !== null) {
      const [department] = await pool.query(
        `
        SELECT department_id, school_id
        FROM departments
        WHERE department_id = ?
        LIMIT 1
        `,
        [department_id],
      );

      if (department.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id",
        });
      }

      if (school_id === undefined) {
        effectiveSchoolId = department[0].school_id;
      }
    }

    if (effectiveSchoolId !== undefined) {
      const [school] = await pool.query(
        `
        SELECT school_id
        FROM schools
        WHERE school_id = ?
        LIMIT 1
        `,
        [effectiveSchoolId],
      );

      if (school.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid school_id",
        });
      }
    }

    if (designation_id !== undefined && designation_id !== null) {
      const [designation] = await pool.query(
        `
        SELECT designation_id
        FROM designations
        WHERE designation_id = ?
        LIMIT 1
        `,
        [designation_id],
      );

      if (designation.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid designation_id",
        });
      }
    }

    if (employee_code && employee_code.trim() !== faculty.employee_code) {
      const [existingEmp] = await pool.query(
        `
        SELECT faculty_id
        FROM faculty
        WHERE employee_code = ? AND faculty_id != ?
        LIMIT 1
        `,
        [employee_code.trim(), id],
      );

      if (existingEmp.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Employee code already exists",
        });
      }
    }

    if (email && email.trim() !== faculty.email) {
      const [existingEmail] = await pool.query(
        `
        SELECT faculty_id
        FROM faculty
        WHERE email = ? AND faculty_id != ?
        LIMIT 1
        `,
        [email.trim(), id],
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const updatedFaculty = {
      employee_code: employee_code !== undefined ? employee_code.trim() : faculty.employee_code,
      full_name: full_name !== undefined ? full_name.trim() : faculty.full_name,
      email: email !== undefined ? (email ? email.trim() : null) : faculty.email,
      designation_id: designation_id !== undefined ? designation_id : faculty.designation_id,
      school_id: effectiveSchoolId,
      department_id: department_id !== undefined ? department_id : faculty.department_id,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : faculty.is_active,
    };

    await pool.query(
      `
      UPDATE faculty
      SET
        employee_code = ?,
        full_name = ?,
        email = ?,
        designation_id = ?,
        school_id = ?,
        department_id = ?,
        is_active = ?
      WHERE faculty_id = ?
      `,
      [
        updatedFaculty.employee_code,
        updatedFaculty.full_name,
        updatedFaculty.email,
        updatedFaculty.designation_id,
        updatedFaculty.school_id,
        updatedFaculty.department_id,
        updatedFaculty.is_active,
        id,
      ],
    );

    return res.status(200).json({
      success: true,
      message: "Faculty member updated successfully",
      data: {
        faculty_id: Number(id),
        ...updatedFaculty,
      },
    });
  } catch (error) {
    console.error("Update faculty error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A faculty member with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE /api/v1/faculty/:id
// DELETE /api/v1/staff/t/:id
const deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingFaculty] = await pool.query(
      `
      SELECT faculty_id, is_active
      FROM faculty
      WHERE faculty_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    if (!existingFaculty[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Faculty member is already inactive",
      });
    }

    await pool.query(
      `
      UPDATE faculty
      SET is_active = 0
      WHERE faculty_id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Faculty member deactivated successfully",
    });
  } catch (error) {
    console.error("Deactivate faculty error:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Cannot modify this faculty member because related records exist",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
module.exports = {
  getFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
};
