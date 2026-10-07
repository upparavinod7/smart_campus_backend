const pool = require("../config/mysql");

const ALLOWED_DELIVERY_TYPES = ["THEORY", "LAB", "PROJECT", "INTERNSHIP", "OTHER"];

/**
 * GET /api/v1/subjects
 * List subjects with filtering by search, department, and active status.
 */
const getSubjects = async (req, res) => {
  try {
    const { search, q, department_id, owner_department_id, is_active } = req.query;
    const searchTerm = search || q;
    const targetDeptId = department_id || owner_department_id;

    const conditions = [];
    const params = [];

    if (searchTerm) {
      conditions.push("(s.name LIKE ? OR s.subject_code LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern);
    }

    if (targetDeptId !== undefined && targetDeptId !== "") {
      conditions.push("s.owner_department_id = ?");
      params.push(Number(targetDeptId));
    }

    if (is_active !== undefined && is_active !== "") {
      const activeVal = is_active === "true" || is_active === "1" ? 1 : 0;
      conditions.push("s.is_active = ?");
      params.push(activeVal);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [subjects] = await pool.query(
      `
      SELECT
          s.subject_id,
          s.subject_code,
          s.name,
          s.credits,
          s.delivery_type,
          s.category_id,
          cc.name AS category_name,
          s.owner_school_id,
          sch.name AS school_name,
          s.owner_department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.is_active,
          s.created_at,
          s.updated_at
      FROM subjects s
      LEFT JOIN course_categories cc ON s.category_id = cc.category_id
      LEFT JOIN schools sch ON s.owner_school_id = sch.school_id
      LEFT JOIN departments d ON s.owner_department_id = d.department_id AND s.owner_school_id = d.school_id
      ${whereClause}
      ORDER BY s.subject_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Subjects retrieved successfully",
      count: subjects.length,
      data: subjects,
    });
  } catch (error) {
    console.error("Get subjects error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/subjects/:id
 * Retrieve a single subject by ID with relational metadata.
 */
const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const [subjects] = await pool.query(
      `
      SELECT
          s.subject_id,
          s.subject_code,
          s.name,
          s.credits,
          s.delivery_type,
          s.category_id,
          cc.name AS category_name,
          s.owner_school_id,
          sch.name AS school_name,
          s.owner_department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.is_active,
          s.created_at,
          s.updated_at
      FROM subjects s
      LEFT JOIN course_categories cc ON s.category_id = cc.category_id
      LEFT JOIN schools sch ON s.owner_school_id = sch.school_id
      LEFT JOIN departments d ON s.owner_department_id = d.department_id AND s.owner_school_id = d.school_id
      WHERE s.subject_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (subjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subject retrieved successfully",
      data: subjects[0],
    });
  } catch (error) {
    console.error("Get subject by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/subjects
 * Create a new academic subject. ADMIN only.
 */
const createSubject = async (req, res) => {
  try {
    const {
      subject_code,
      name,
      credits,
      delivery_type = "THEORY",
      category_id,
      owner_department_id,
      owner_school_id,
      is_active = 1,
    } = req.body || {};

    // Validate required fields
    if (!subject_code || !name) {
      return res.status(400).json({
        success: false,
        message: "subject_code and name are required",
      });
    }

    const trimmedCode = subject_code.toString().trim().toUpperCase();
    const trimmedName = name.toString().trim();

    if (!trimmedCode || !trimmedName) {
      return res.status(400).json({
        success: false,
        message: "subject_code and name cannot be empty",
      });
    }

    // Validate delivery_type if provided
    if (delivery_type && !ALLOWED_DELIVERY_TYPES.includes(delivery_type)) {
      return res.status(400).json({
        success: false,
        message: `delivery_type must be one of: ${ALLOWED_DELIVERY_TYPES.join(", ")}`,
      });
    }

    // Validate credits if provided
    let parsedCredits = null;
    if (credits !== undefined && credits !== null) {
      parsedCredits = Number(credits);
      if (isNaN(parsedCredits) || parsedCredits < 0) {
        return res.status(400).json({
          success: false,
          message: "credits must be a positive number",
        });
      }
    }

    // Check duplicate subject code
    const [existingCode] = await pool.query(
      "SELECT subject_id FROM subjects WHERE subject_code = ? LIMIT 1",
      [trimmedCode],
    );

    if (existingCode.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Subject with code '${trimmedCode}' already exists`,
      });
    }

    // Validate department and resolve school
    let resolvedSchoolId = owner_school_id ? Number(owner_school_id) : null;
    let resolvedDeptId = owner_department_id ? Number(owner_department_id) : null;

    if (resolvedDeptId) {
      const [deptRows] = await pool.query(
        "SELECT department_id, school_id, is_active FROM departments WHERE department_id = ? LIMIT 1",
        [resolvedDeptId],
      );

      if (deptRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id: department does not exist",
        });
      }

      if (!deptRows[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Department is inactive",
        });
      }

      // Automatically set owner_school_id to satisfy composite foreign key / check constraint
      resolvedSchoolId = deptRows[0].school_id;
    } else if (resolvedSchoolId) {
      const [schoolRows] = await pool.query(
        "SELECT school_id FROM schools WHERE school_id = ? LIMIT 1",
        [resolvedSchoolId],
      );

      if (schoolRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid owner_school_id: school does not exist",
        });
      }
    }

    // Validate category if provided
    let resolvedCatId = category_id ? Number(category_id) : null;
    if (resolvedCatId) {
      const [catRows] = await pool.query(
        "SELECT category_id FROM course_categories WHERE category_id = ? LIMIT 1",
        [resolvedCatId],
      );

      if (catRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid category_id: course category does not exist",
        });
      }
    }

    const [result] = await pool.query(
      `
      INSERT INTO subjects (
          subject_code,
          name,
          credits,
          delivery_type,
          category_id,
          owner_school_id,
          owner_department_id,
          is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        trimmedCode,
        trimmedName,
        parsedCredits,
        delivery_type,
        resolvedCatId,
        resolvedSchoolId,
        resolvedDeptId,
        is_active ? 1 : 0,
      ],
    );

    const [createdRows] = await pool.query(
      `
      SELECT
          s.subject_id,
          s.subject_code,
          s.name,
          s.credits,
          s.delivery_type,
          s.category_id,
          cc.name AS category_name,
          s.owner_school_id,
          sch.name AS school_name,
          s.owner_department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.is_active,
          s.created_at,
          s.updated_at
      FROM subjects s
      LEFT JOIN course_categories cc ON s.category_id = cc.category_id
      LEFT JOIN schools sch ON s.owner_school_id = sch.school_id
      LEFT JOIN departments d ON s.owner_department_id = d.department_id AND s.owner_school_id = d.school_id
      WHERE s.subject_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Subject created successfully",
      data: createdRows[0],
    });
  } catch (error) {
    console.error("Create subject error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/subjects/:id
 * Update an existing academic subject. ADMIN only.
 */
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject_code,
      name,
      credits,
      delivery_type,
      category_id,
      owner_department_id,
      owner_school_id,
      is_active,
    } = req.body || {};

    const [existingRows] = await pool.query(
      "SELECT * FROM subjects WHERE subject_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const current = existingRows[0];
    let newCode = current.subject_code;
    let newName = current.name;
    let newCredits = current.credits;
    let newDelivery = current.delivery_type;
    let newCategory = current.category_id;
    let newDept = current.owner_department_id;
    let newSchool = current.owner_school_id;
    let newActive = current.is_active;

    if (subject_code !== undefined) {
      newCode = subject_code.toString().trim().toUpperCase();
      if (!newCode) {
        return res.status(400).json({
          success: false,
          message: "subject_code cannot be empty",
        });
      }

      if (newCode !== current.subject_code) {
        const [dupRows] = await pool.query(
          "SELECT subject_id FROM subjects WHERE subject_code = ? AND subject_id != ? LIMIT 1",
          [newCode, id],
        );
        if (dupRows.length > 0) {
          return res.status(409).json({
            success: false,
            message: `Subject with code '${newCode}' already exists`,
          });
        }
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

    if (credits !== undefined) {
      if (credits === null) {
        newCredits = null;
      } else {
        const parsed = Number(credits);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({
            success: false,
            message: "credits must be a positive number",
          });
        }
        newCredits = parsed;
      }
    }

    if (delivery_type !== undefined) {
      if (!ALLOWED_DELIVERY_TYPES.includes(delivery_type)) {
        return res.status(400).json({
          success: false,
          message: `delivery_type must be one of: ${ALLOWED_DELIVERY_TYPES.join(", ")}`,
        });
      }
      newDelivery = delivery_type;
    }

    if (owner_department_id !== undefined) {
      if (owner_department_id === null) {
        newDept = null;
        newSchool = owner_school_id !== undefined ? owner_school_id : null;
      } else {
        const deptId = Number(owner_department_id);
        const [deptRows] = await pool.query(
          "SELECT department_id, school_id, is_active FROM departments WHERE department_id = ? LIMIT 1",
          [deptId],
        );
        if (deptRows.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid department_id: department does not exist",
          });
        }
        newDept = deptId;
        newSchool = deptRows[0].school_id;
      }
    }

    if (category_id !== undefined) {
      if (category_id === null) {
        newCategory = null;
      } else {
        const catId = Number(category_id);
        const [catRows] = await pool.query(
          "SELECT category_id FROM course_categories WHERE category_id = ? LIMIT 1",
          [catId],
        );
        if (catRows.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid category_id: course category does not exist",
          });
        }
        newCategory = catId;
      }
    }

    if (is_active !== undefined) {
      newActive = is_active ? 1 : 0;
    }

    await pool.query(
      `
      UPDATE subjects
      SET
          subject_code = ?,
          name = ?,
          credits = ?,
          delivery_type = ?,
          category_id = ?,
          owner_school_id = ?,
          owner_department_id = ?,
          is_active = ?,
          updated_at = NOW()
      WHERE subject_id = ?
      `,
      [
        newCode,
        newName,
        newCredits,
        newDelivery,
        newCategory,
        newSchool,
        newDept,
        newActive,
        id,
      ],
    );

    const [updatedRows] = await pool.query(
      `
      SELECT
          s.subject_id,
          s.subject_code,
          s.name,
          s.credits,
          s.delivery_type,
          s.category_id,
          cc.name AS category_name,
          s.owner_school_id,
          sch.name AS school_name,
          s.owner_department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.is_active,
          s.created_at,
          s.updated_at
      FROM subjects s
      LEFT JOIN course_categories cc ON s.category_id = cc.category_id
      LEFT JOIN schools sch ON s.owner_school_id = sch.school_id
      LEFT JOIN departments d ON s.owner_department_id = d.department_id AND s.owner_school_id = d.school_id
      WHERE s.subject_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Subject updated successfully",
      data: updatedRows[0],
    });
  } catch (error) {
    console.error("Update subject error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/subjects/:id
 * Soft deactivates an academic subject. ADMIN only.
 */
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingRows] = await pool.query(
      "SELECT subject_id, is_active FROM subjects WHERE subject_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    if (!existingRows[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Subject is already inactive",
      });
    }

    await pool.query(
      "UPDATE subjects SET is_active = 0, updated_at = NOW() WHERE subject_id = ?",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Subject deactivated successfully",
      data: {
        subject_id: Number(id),
        is_active: 0,
      },
    });
  } catch (error) {
    console.error("Delete subject error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
