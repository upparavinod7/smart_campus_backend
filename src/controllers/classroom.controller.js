const pool = require("../config/mysql");

const ALLOWED_ROOM_TYPES = ["CLASSROOM", "SMART_CLASSROOM", "LAB", "SEMINAR_HALL", "OTHER"];

// GET /api/v1/classrooms
const getClassrooms = async (req, res) => {
  try {
    const { block_id, department_id, room_type, is_active, search, q } = req.query || {};
    const searchTerm = search || q;

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

    if (searchTerm) {
      conditions.push("(c.room_no LIKE ? OR b.name LIKE ? OR dept.name LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [classrooms] = await pool.query(
      `
      SELECT
          c.classroom_id,
          c.block_id,
          b.code AS block_code,
          b.name AS block_name,
          c.department_id,
          dept.name AS department_name,
          dept.code AS department_code,
          c.room_no,
          c.room_type,
          c.capacity,
          c.is_active,
          c.created_at,
          c.updated_at
      FROM classrooms c
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN departments dept ON c.department_id = dept.department_id
      ${whereClause}
      ORDER BY c.classroom_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Classrooms retrieved successfully",
      count: classrooms.length,
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

// GET /api/v1/classrooms/:id
const getClassroomById = async (req, res) => {
  try {
    const { id } = req.params;

    const [classrooms] = await pool.query(
      `
      SELECT
          c.classroom_id,
          c.block_id,
          b.code AS block_code,
          b.name AS block_name,
          c.department_id,
          dept.name AS department_name,
          dept.code AS department_code,
          c.room_no,
          c.room_type,
          c.capacity,
          c.is_active,
          c.created_at,
          c.updated_at
      FROM classrooms c
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN departments dept ON c.department_id = dept.department_id
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

// POST /api/v1/classrooms
const createClassroom = async (req, res) => {
  try {
    const { block_id, room_no, room_type, capacity, department_id, is_active } = req.body || {};

    // Required fields
    if (!block_id || !room_no || !room_type) {
      return res.status(400).json({
        success: false,
        message: "block_id, room_no and room_type are required",
      });
    }

    const trimmedRoomNo = String(room_no).trim();
    if (!trimmedRoomNo) {
      return res.status(400).json({
        success: false,
        message: "room_no cannot be empty",
      });
    }

    if (!ALLOWED_ROOM_TYPES.includes(room_type)) {
      return res.status(400).json({
        success: false,
        message: `room_type must be one of: ${ALLOWED_ROOM_TYPES.join(", ")}`,
      });
    }

    // Check block exists
    const [blocks] = await pool.query(
      `SELECT block_id FROM blocks WHERE block_id = ? LIMIT 1`,
      [Number(block_id)],
    );

    if (blocks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid block_id",
      });
    }

    // Check duplicate room number in this block (or overall depending on constraint)
    const [existingClassroom] = await pool.query(
      `SELECT classroom_id FROM classrooms WHERE block_id = ? AND room_no = ? LIMIT 1`,
      [Number(block_id), trimmedRoomNo],
    );

    if (existingClassroom.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Classroom with this room_no already exists in this block",
      });
    }

    // Check department if provided
    let targetDeptId = null;
    if (department_id !== undefined && department_id !== null && department_id !== "") {
      const [departments] = await pool.query(
        `SELECT department_id FROM departments WHERE department_id = ? LIMIT 1`,
        [Number(department_id)],
      );
      if (departments.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id",
        });
      }
      targetDeptId = Number(department_id);
    }

    const activeStatus = is_active === undefined ? 1 : (is_active ? 1 : 0);
    const parsedCapacity = capacity !== undefined && capacity !== null && capacity !== "" ? Number(capacity) : null;

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
      [Number(block_id), targetDeptId, trimmedRoomNo, room_type, parsedCapacity, activeStatus],
    );

    return res.status(201).json({
      success: true,
      message: "Classroom created successfully",
      data: {
        classroom_id: result.insertId,
        block_id: Number(block_id),
        department_id: targetDeptId,
        room_no: trimmedRoomNo,
        room_type,
        capacity: parsedCapacity,
        is_active: activeStatus,
      },
    });
  } catch (error) {
    console.error("Create classroom error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A classroom with this room number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /api/v1/classrooms/:id
const updateClassroom = async (req, res) => {
  try {
    const { id } = req.params;
    const { block_id, room_no, room_type, capacity, department_id, is_active } = req.body || {};

    const [existingClassroom] = await pool.query(
      `SELECT * FROM classrooms WHERE classroom_id = ? LIMIT 1`,
      [id],
    );

    if (existingClassroom.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Classroom not found",
      });
    }

    const classroom = existingClassroom[0];

    const targetBlockId = block_id !== undefined ? Number(block_id) : classroom.block_id;
    if (block_id !== undefined) {
      const [blocks] = await pool.query(
        `SELECT block_id FROM blocks WHERE block_id = ? LIMIT 1`,
        [targetBlockId],
      );

      if (blocks.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid block_id",
        });
      }
    }

    let targetDeptId = classroom.department_id;
    if (department_id !== undefined) {
      if (department_id === null || department_id === "") {
        targetDeptId = null;
      } else {
        const [departments] = await pool.query(
          `SELECT department_id FROM departments WHERE department_id = ? LIMIT 1`,
          [Number(department_id)],
        );
        if (departments.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid department_id",
          });
        }
        targetDeptId = Number(department_id);
      }
    }

    const targetRoomNo = room_no !== undefined ? String(room_no).trim() : classroom.room_no;
    const targetRoomType = room_type !== undefined ? room_type : classroom.room_type;

    if (room_type !== undefined && !ALLOWED_ROOM_TYPES.includes(targetRoomType)) {
      return res.status(400).json({
        success: false,
        message: `room_type must be one of: ${ALLOWED_ROOM_TYPES.join(", ")}`,
      });
    }

    const updatedClassroom = {
      block_id: targetBlockId,
      department_id: targetDeptId,
      room_no: targetRoomNo,
      room_type: targetRoomType,
      capacity: capacity !== undefined ? (capacity ? Number(capacity) : null) : classroom.capacity,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : classroom.is_active,
    };

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
      [
        updatedClassroom.block_id,
        updatedClassroom.department_id,
        updatedClassroom.room_no,
        updatedClassroom.room_type,
        updatedClassroom.capacity,
        updatedClassroom.is_active,
        id,
      ],
    );

    return res.status(200).json({
      success: true,
      message: "Classroom updated successfully",
      data: {
        classroom_id: Number(id),
        ...updatedClassroom,
      },
    });
  } catch (error) {
    console.error("Update classroom error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A classroom with this room number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE /api/v1/classrooms/:id
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

    // Check if referenced by active timetable slots
    const [slots] = await pool.query(
      `SELECT slot_id FROM timetable_slots WHERE classroom_id = ? LIMIT 1`,
      [id],
    );

    if (slots.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete or deactivate classroom because associated timetable slots exist",
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

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete classroom because related records exist",
      });
    }

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
