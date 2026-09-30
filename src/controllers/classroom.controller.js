const pool = require("../config/mysql");

const VALID_ROOM_TYPES = ["CLASSROOM", "SMART_CLASSROOM", "LAB", "SEMINAR_HALL", "OTHER"];

/**
 * GET /api/v1/classrooms
 * Retrieves classrooms with joined block and department info, plus optional filters.
 */
const getClassrooms = async (req, res) => {
  try {
    const { block_id, department_id, room_type, is_active, search } = req.query;

    const conditions = [];
    const params = [];

    if (block_id !== undefined && block_id !== "") {
      conditions.push("c.block_id = ?");
      params.push(Number(block_id));
    }

    if (department_id !== undefined && department_id !== "") {
      conditions.push("c.department_id = ?");
      params.push(Number(department_id));
    }

    if (room_type !== undefined && room_type !== "") {
      conditions.push("c.room_type = ?");
      params.push(room_type);
    }

    if (is_active !== undefined && is_active !== "") {
      const activeVal = is_active === "true" || is_active === "1" ? 1 : 0;
      conditions.push("c.is_active = ?");
      params.push(activeVal);
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push("(c.room_no LIKE ? OR b.name LIKE ? OR b.code LIKE ? OR d.name LIKE ?)");
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [classrooms] = await pool.query(
      `
      SELECT
          c.classroom_id,
          c.block_id,
          b.name AS block_name,
          b.code AS block_code,
          c.department_id,
          d.name AS department_name,
          d.code AS department_code,
          c.room_no,
          c.room_type,
          c.capacity,
          c.is_active,
          c.created_at,
          c.updated_at
      FROM classrooms c
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN departments d ON c.department_id = d.department_id
      ${whereClause}
      ORDER BY c.classroom_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Classrooms retrieved successfully",
      data: classrooms,
    });
  } catch (error) {
    console.error("Get classrooms error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/classrooms/:id
 * Retrieves a single classroom by ID with joined block and department info.
 */
const getClassroomById = async (req, res) => {
  try {
    const { id } = req.params;

    const [classrooms] = await pool.query(
      `
      SELECT
          c.classroom_id,
          c.block_id,
          b.name AS block_name,
          b.code AS block_code,
          c.department_id,
          d.name AS department_name,
          d.code AS department_code,
          c.room_no,
          c.room_type,
          c.capacity,
          c.is_active,
          c.created_at,
          c.updated_at
      FROM classrooms c
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN departments d ON c.department_id = d.department_id
      WHERE c.classroom_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (classrooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Classroom not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Classroom retrieved successfully",
      data: classrooms[0],
    });
  } catch (error) {
    console.error("Get classroom error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/classrooms
 * Creates a new classroom. ADMIN only.
 */
const createClassroom = async (req, res) => {
  try {
    const { block_id, department_id, room_no, room_type, capacity, is_active } = req.body || {};

    // Validate required fields
    if (
      !block_id ||
      !department_id ||
      !room_no ||
      typeof room_no !== "string" ||
      !room_no.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "block_id, department_id and room_no are required",
      });
    }

    const trimmedRoomNo = room_no.trim();
    const resolvedRoomType = room_type || "CLASSROOM";

    if (!VALID_ROOM_TYPES.includes(resolvedRoomType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid room_type. Must be one of: ${VALID_ROOM_TYPES.join(", ")}`,
      });
    }

    // Validate capacity if provided
    let resolvedCapacity = null;
    if (capacity !== undefined && capacity !== null && capacity !== "") {
      const numCapacity = Number(capacity);
      if (!Number.isInteger(numCapacity) || numCapacity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Capacity must be a positive integer",
        });
      }
      resolvedCapacity = numCapacity;
    }

    // Verify block exists and is active
    const [blocks] = await pool.query(
      `SELECT block_id, is_active FROM blocks WHERE block_id = ? LIMIT 1`,
      [block_id],
    );

    if (blocks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid block_id",
      });
    }

    if (!blocks[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign classroom to an inactive block",
      });
    }

    // Verify department exists and is active
    const [departments] = await pool.query(
      `SELECT department_id, is_active FROM departments WHERE department_id = ? LIMIT 1`,
      [department_id],
    );

    if (departments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid department_id",
      });
    }

    if (!departments[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign classroom to an inactive department",
      });
    }

    const activeStatus = is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : 1;

    // Insert classroom record
    const [result] = await pool.query(
      `
      INSERT INTO classrooms (
          block_id,
          department_id,
          room_no,
          room_type,
          capacity,
          is_active
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [block_id, department_id, trimmedRoomNo, resolvedRoomType, resolvedCapacity, activeStatus],
    );

    // Retrieve inserted record with joins
    const [createdClassroom] = await pool.query(
      `
      SELECT
          c.classroom_id,
          c.block_id,
          b.name AS block_name,
          b.code AS block_code,
          c.department_id,
          d.name AS department_name,
          d.code AS department_code,
          c.room_no,
          c.room_type,
          c.capacity,
          c.is_active,
          c.created_at,
          c.updated_at
      FROM classrooms c
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN departments d ON c.department_id = d.department_id
      WHERE c.classroom_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Classroom created successfully",
      data: createdClassroom[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Classroom with this room_no already exists in this block",
      });
    }

    console.error("Create classroom error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/classrooms/:id
 * Updates an existing classroom. ADMIN only.
 */
const updateClassroom = async (req, res) => {
  try {
    const { id } = req.params;
    const { block_id, department_id, room_no, room_type, capacity, is_active } = req.body || {};

    const [existing] = await pool.query(
      `SELECT * FROM classrooms WHERE classroom_id = ? LIMIT 1`,
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Classroom not found",
      });
    }

    const current = existing[0];

    // Validate block_id if provided
    let targetBlockId = current.block_id;
    if (block_id !== undefined) {
      const [blocks] = await pool.query(
        `SELECT block_id, is_active FROM blocks WHERE block_id = ? LIMIT 1`,
        [block_id],
      );

      if (blocks.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid block_id",
        });
      }

      if (!blocks[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign classroom to an inactive block",
        });
      }

      targetBlockId = Number(block_id);
    }

    // Validate department_id if provided
    let targetDeptId = current.department_id;
    if (department_id !== undefined) {
      const [departments] = await pool.query(
        `SELECT department_id, is_active FROM departments WHERE department_id = ? LIMIT 1`,
        [department_id],
      );

      if (departments.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id",
        });
      }

      if (!departments[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign classroom to an inactive department",
        });
      }

      targetDeptId = Number(department_id);
    }

    // Validate room_no if provided
    let targetRoomNo = current.room_no;
    if (room_no !== undefined) {
      if (typeof room_no !== "string" || !room_no.trim()) {
        return res.status(400).json({
          success: false,
          message: "room_no cannot be empty",
        });
      }
      targetRoomNo = room_no.trim();
    }

    // Validate room_type if provided
    let targetRoomType = current.room_type;
    if (room_type !== undefined) {
      if (!VALID_ROOM_TYPES.includes(room_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid room_type. Must be one of: ${VALID_ROOM_TYPES.join(", ")}`,
        });
      }
      targetRoomType = room_type;
    }

    // Validate capacity if provided
    let targetCapacity = current.capacity;
    if (capacity !== undefined) {
      if (capacity === null || capacity === "") {
        targetCapacity = null;
      } else {
        const numCapacity = Number(capacity);
        if (!Number.isInteger(numCapacity) || numCapacity <= 0) {
          return res.status(400).json({
            success: false,
            message: "Capacity must be a positive integer",
          });
        }
        targetCapacity = numCapacity;
      }
    }

    const targetIsActive =
      is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : current.is_active;

    await pool.query(
      `
      UPDATE classrooms
      SET
          block_id = ?,
          department_id = ?,
          room_no = ?,
          room_type = ?,
          capacity = ?,
          is_active = ?
      WHERE classroom_id = ?
      `,
      [targetBlockId, targetDeptId, targetRoomNo, targetRoomType, targetCapacity, targetIsActive, id],
    );

    const [updated] = await pool.query(
      `
      SELECT
          c.classroom_id,
          c.block_id,
          b.name AS block_name,
          b.code AS block_code,
          c.department_id,
          d.name AS department_name,
          d.code AS department_code,
          c.room_no,
          c.room_type,
          c.capacity,
          c.is_active,
          c.created_at,
          c.updated_at
      FROM classrooms c
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN departments d ON c.department_id = d.department_id
      WHERE c.classroom_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Classroom updated successfully",
      data: updated[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Classroom with this room_no already exists in this block",
      });
    }

    console.error("Update classroom error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/classrooms/:id
 * Soft deactivates a classroom (is_active = 0). ADMIN only.
 */
const deleteClassroom = async (req, res) => {
  try {
    const { id } = req.params;

    const [classrooms] = await pool.query(
      `SELECT classroom_id, is_active FROM classrooms WHERE classroom_id = ? LIMIT 1`,
      [id],
    );

    if (classrooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Classroom not found",
      });
    }

    if (!classrooms[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Classroom is already inactive",
      });
    }

    await pool.query(
      `UPDATE classrooms SET is_active = 0 WHERE classroom_id = ?`,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Classroom deactivated successfully",
    });
  } catch (error) {
    console.error("Deactivate classroom error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getClassrooms,
  getClassroomById,
  createClassroom,
  updateClassroom,
  deleteClassroom,
};
