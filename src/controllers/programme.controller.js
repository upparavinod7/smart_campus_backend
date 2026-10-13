const pool = require("../config/mysql");

/**
 * GET /api/v1/programmes or /api/v1/programs
 * List academic programmes with joins to school, department, degree, and batch count.
 */
const getProgrammes = async (req, res) => {
  try {
    const { school_id, department_id, degree_id, is_active, search, q } = req.query;
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (school_id !== undefined && school_id !== "") {
      conditions.push("p.school_id = ?");
      params.push(Number(school_id));
    }

    if (department_id !== undefined && department_id !== "") {
      conditions.push("p.department_id = ?");
      params.push(Number(department_id));
    }

    if (degree_id !== undefined && degree_id !== "") {
      conditions.push("p.degree_id = ?");
      params.push(Number(degree_id));
    }

    if (is_active !== undefined && is_active !== "") {
      const activeVal = is_active === "true" || is_active === "1" ? 1 : 0;
      conditions.push("p.is_active = ?");
      params.push(activeVal);
    }

    if (searchTerm) {
      conditions.push("(p.name LIKE ? OR p.programme_code LIKE ? OR d.name LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [programmes] = await pool.query(
      `
      SELECT
          p.programme_id,
          p.school_id,
          s.name AS school_name,
          s.code AS school_code,
          p.department_id,
          d.name AS department_name,
          d.code AS department_code,
          p.degree_id,
          deg.code AS degree_code,
          deg.name AS degree_name,
          deg.level AS degree_level,
          p.programme_code,
          p.name,
          p.partner_track,
          p.duration_years,
          p.is_active,
          p.created_at,
          p.updated_at,
          (SELECT COUNT(*) FROM batches b WHERE b.programme_id = p.programme_id) AS batch_count
      FROM programmes p
      JOIN schools s ON p.school_id = s.school_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      JOIN degrees deg ON p.degree_id = deg.degree_id
      ${whereClause}
      ORDER BY p.programme_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Programmes retrieved successfully",
      count: programmes.length,
      data: programmes,
    });
  } catch (error) {
    console.error("Get programmes error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/programmes/:id
 * Retrieve a single programme with batches list.
 */
const getProgrammeById = async (req, res) => {
  try {
    const { id } = req.params;

    const [programmes] = await pool.query(
      `
      SELECT
          p.programme_id,
          p.school_id,
          s.name AS school_name,
          s.code AS school_code,
          p.department_id,
          d.name AS department_name,
          d.code AS department_code,
          p.degree_id,
          deg.code AS degree_code,
          deg.name AS degree_name,
          deg.level AS degree_level,
          p.programme_code,
          p.name,
          p.partner_track,
          p.duration_years,
          p.is_active,
          p.created_at,
          p.updated_at
      FROM programmes p
      JOIN schools s ON p.school_id = s.school_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      JOIN degrees deg ON p.degree_id = deg.degree_id
      WHERE p.programme_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (programmes.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Programme not found",
      });
    }

    const [batches] = await pool.query(
      `
      SELECT
          b.batch_id,
          b.start_year_id,
          ay.label AS start_year_label,
          b.label,
          b.created_at
      FROM batches b
      JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
      WHERE b.programme_id = ?
      ORDER BY b.batch_id ASC
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Programme retrieved successfully",
      data: {
        ...programmes[0],
        batches,
      },
    });
  } catch (error) {
    console.error("Get programme by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/programmes
 * Create a new programme. ADMIN only.
 */
const createProgramme = async (req, res) => {
  try {
    const {
      school_id,
      department_id,
      degree_id,
      name,
      programme_code,
      partner_track = "STANDARD",
      duration_years = 4.0,
      is_active = 1,
    } = req.body || {};

    if (!school_id || !degree_id || !name) {
      return res.status(400).json({
        success: false,
        message: "school_id, degree_id, and name are required",
      });
    }

    const trimmedName = name.toString().trim();
    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: "name cannot be empty",
      });
    }

    // Verify school exists
    const [schools] = await pool.query(
      "SELECT school_id FROM schools WHERE school_id = ? LIMIT 1",
      [school_id],
    );
    if (schools.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid school_id: school does not exist",
      });
    }

    // Verify degree exists
    const [degrees] = await pool.query(
      "SELECT degree_id FROM degrees WHERE degree_id = ? LIMIT 1",
      [degree_id],
    );
    if (degrees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid degree_id: degree does not exist",
      });
    }

    // Verify department if supplied
    if (department_id) {
      const [depts] = await pool.query(
        "SELECT department_id, school_id FROM departments WHERE department_id = ? LIMIT 1",
        [department_id],
      );
      if (depts.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id: department does not exist",
        });
      }
      if (depts[0].school_id !== Number(school_id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id: department does not belong to the specified school",
        });
      }
    }

    const trimmedCode = programme_code ? programme_code.toString().trim().toUpperCase() : null;

    // Check unique code if provided
    if (trimmedCode) {
      const [existingCode] = await pool.query(
        "SELECT programme_id FROM programmes WHERE programme_code = ? LIMIT 1",
        [trimmedCode],
      );
      if (existingCode.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Programme code already exists",
        });
      }
    }

    // Check unique composite (school_id, degree_id, name, partner_track)
    const [existingIdentity] = await pool.query(
      `
      SELECT programme_id FROM programmes
      WHERE school_id = ? AND degree_id = ? AND name = ? AND partner_track = ?
      LIMIT 1
      `,
      [school_id, degree_id, trimmedName, partner_track],
    );
    if (existingIdentity.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A programme with this name, school, degree, and track already exists",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO programmes
          (school_id, department_id, degree_id, programme_code, name, partner_track, duration_years, is_active)
      VALUES
          (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        school_id,
        department_id || null,
        degree_id,
        trimmedCode,
        trimmedName,
        partner_track,
        duration_years,
        is_active ? 1 : 0,
      ],
    );

    const [newProg] = await pool.query(
      `
      SELECT
          p.programme_id,
          p.school_id,
          s.name AS school_name,
          p.department_id,
          d.name AS department_name,
          p.degree_id,
          deg.code AS degree_code,
          p.programme_code,
          p.name,
          p.partner_track,
          p.duration_years,
          p.is_active,
          p.created_at,
          p.updated_at
      FROM programmes p
      JOIN schools s ON p.school_id = s.school_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      JOIN degrees deg ON p.degree_id = deg.degree_id
      WHERE p.programme_id = ?
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Programme created successfully",
      data: newProg[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Programme code or identity already exists",
      });
    }
    console.error("Create programme error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/programmes/:id
 * Update an existing programme. ADMIN only.
 */
const updateProgramme = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      school_id,
      department_id,
      degree_id,
      name,
      programme_code,
      partner_track,
      duration_years,
      is_active,
    } = req.body || {};

    const [existing] = await pool.query(
      "SELECT * FROM programmes WHERE programme_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Programme not found",
      });
    }

    const current = existing[0];
    const newSchoolId = school_id !== undefined ? Number(school_id) : current.school_id;
    const newDeptId = department_id !== undefined ? (department_id ? Number(department_id) : null) : current.department_id;
    const newDegreeId = degree_id !== undefined ? Number(degree_id) : current.degree_id;
    const newName = name !== undefined ? name.toString().trim() : current.name;
    const newCode = programme_code !== undefined ? (programme_code ? programme_code.toString().trim().toUpperCase() : null) : current.programme_code;
    const newTrack = partner_track !== undefined ? partner_track : current.partner_track;
    const newDuration = duration_years !== undefined ? duration_years : current.duration_years;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active;

    if (!newName) {
      return res.status(400).json({
        success: false,
        message: "name cannot be empty",
      });
    }

    // Verify school
    if (school_id !== undefined) {
      const [s] = await pool.query("SELECT school_id FROM schools WHERE school_id = ? LIMIT 1", [newSchoolId]);
      if (s.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid school_id" });
      }
    }

    // Verify degree
    if (degree_id !== undefined) {
      const [d] = await pool.query("SELECT degree_id FROM degrees WHERE degree_id = ? LIMIT 1", [newDegreeId]);
      if (d.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid degree_id" });
      }
    }

    // Verify department
    if (newDeptId) {
      const [dept] = await pool.query("SELECT department_id, school_id FROM departments WHERE department_id = ? LIMIT 1", [newDeptId]);
      if (dept.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid department_id" });
      }
      if (dept[0].school_id !== newSchoolId) {
        return res.status(400).json({ success: false, message: "Invalid department_id: department does not belong to the specified school" });
      }
    }

    // Check duplicate code
    if (newCode && newCode !== current.programme_code) {
      const [dupCode] = await pool.query(
        "SELECT programme_id FROM programmes WHERE programme_code = ? AND programme_id != ? LIMIT 1",
        [newCode, id],
      );
      if (dupCode.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Programme code already exists",
        });
      }
    }

    // Check duplicate identity
    if (
      newSchoolId !== current.school_id ||
      newDegreeId !== current.degree_id ||
      newName !== current.name ||
      newTrack !== current.partner_track
    ) {
      const [dupId] = await pool.query(
        `SELECT programme_id FROM programmes
         WHERE school_id = ? AND degree_id = ? AND name = ? AND partner_track = ? AND programme_id != ?
         LIMIT 1`,
        [newSchoolId, newDegreeId, newName, newTrack, id],
      );
      if (dupId.length > 0) {
        return res.status(409).json({
          success: false,
          message: "A programme with this name, school, degree, and track already exists",
        });
      }
    }

    await pool.query(
      `
      UPDATE programmes
      SET school_id = ?, department_id = ?, degree_id = ?, programme_code = ?, name = ?, partner_track = ?, duration_years = ?, is_active = ?, updated_at = NOW()
      WHERE programme_id = ?
      `,
      [newSchoolId, newDeptId, newDegreeId, newCode, newName, newTrack, newDuration, newActive, id],
    );

    const [updated] = await pool.query(
      `
      SELECT
          p.programme_id,
          p.school_id,
          s.name AS school_name,
          p.department_id,
          d.name AS department_name,
          p.degree_id,
          deg.code AS degree_code,
          p.programme_code,
          p.name,
          p.partner_track,
          p.duration_years,
          p.is_active,
          p.created_at,
          p.updated_at
      FROM programmes p
      JOIN schools s ON p.school_id = s.school_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      JOIN degrees deg ON p.degree_id = deg.degree_id
      WHERE p.programme_id = ?
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Programme updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Programme code or identity already exists",
      });
    }
    console.error("Update programme error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/programmes/:id
 * Deactivate programme. ADMIN only.
 */
const deleteProgramme = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT programme_id, is_active FROM programmes WHERE programme_id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Programme not found",
      });
    }

    if (!existing[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Programme is already inactive",
      });
    }

    await pool.query(
      "UPDATE programmes SET is_active = 0, updated_at = NOW() WHERE programme_id = ?",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Programme deactivated successfully",
      data: { programme_id: Number(id) },
    });
  } catch (error) {
    console.error("Delete programme error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getProgrammes,
  getProgrammeById,
  createProgramme,
  updateProgramme,
  deleteProgramme,
};
