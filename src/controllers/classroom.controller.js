const pool = require("../config/mysql");

// GET /classrooms
const getClassrooms = async (req, res) => {
  try {
    const [classrooms] = await pool.query(`
            SELECT
                classroom_id,
                block_id,
                room_no,
                room_type,
                capacity,
                is_active,
                created_at,
                updated_at
            FROM classrooms
            ORDER BY classroom_id
        `);

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

// GET /classrooms/:id
const getClassroomById = async (req, res) => {
  try {
    const { id } = req.params;

    const [classrooms] = await pool.query(
      `
            SELECT
                classroom_id,
                block_id,
                room_no,
                room_type,
                capacity,
                is_active,
                created_at,
                updated_at
            FROM classrooms
            WHERE classroom_id = ?
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

// POST /classrooms
const createClassroom = async (req, res) => {
  try {
    const { block_id, room_no, room_type, capacity, is_active } = req.body;

    // Required fields
    if (!block_id || !room_no || !room_type) {
      return res.status(400).json({
        success: false,
        message: "block_id, room_no and room_type are required",
      });
    }

    // Check block exists
    const [blocks] = await pool.query(
      `
            SELECT block_id
            FROM blocks
            WHERE block_id = ?
            LIMIT 1
        `,
      [block_id],
    );

    if (blocks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid block_id",
      });
    }

    // Check duplicate room number
    const [existingClassroom] = await pool.query(
      `
            SELECT classroom_id
            FROM classrooms
            WHERE room_no = ?
            LIMIT 1
        `,
      [room_no],
    );

    if (existingClassroom.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Classroom with this room_no already exists",
      });
    }

    const [result] = await pool.query(
      `
            INSERT INTO classrooms (
                block_id,
                room_no,
                room_type,
                capacity,
                is_active
            )
            VALUES (?, ?, ?, ?, ?)
        `,
      [block_id, room_no, room_type, capacity ?? null, is_active ?? 1],
    );

    return res.status(201).json({
      success: true,
      message: "Classroom created successfully",
      data: {
        classroom_id: result.insertId,
        block_id,
        room_no,
        room_type,
        capacity: capacity ?? null,
        is_active: is_active ?? 1,
      },
    });
  } catch (error) {
    console.error("Create classroom error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// PUT /classrooms/:id
const updateClassroom = async (req, res) => {
  try {
    const { id } = req.params;

    const { block_id, room_no, room_type, capacity, is_active } = req.body;

    // Check classroom exists
    const [existingClassroom] = await pool.query(
      `
            SELECT *
            FROM classrooms
            WHERE classroom_id = ?
            LIMIT 1
        `,
      [id],
    );

    if (existingClassroom.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Classroom not found",
      });
    }

    const classroom = existingClassroom[0];

    // If block_id is being changed, validate it
    if (block_id !== undefined) {
      const [blocks] = await pool.query(
        `
                SELECT block_id
                FROM blocks
                WHERE block_id = ?
                LIMIT 1
            `,
        [block_id],
      );

      if (blocks.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid block_id",
        });
      }
    }

    const updatedClassroom = {
      block_id: block_id ?? classroom.block_id,
      room_no: room_no ?? classroom.room_no,
      room_type: room_type ?? classroom.room_type,
      capacity: capacity ?? classroom.capacity,
      is_active: is_active ?? classroom.is_active,
    };

    await pool.query(
      `
            UPDATE classrooms
            SET
                block_id = ?,
                room_no = ?,
                room_type = ?,
                capacity = ?,
                is_active = ?
            WHERE classroom_id = ?
        `,
      [
        updatedClassroom.block_id,
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

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE /classrooms/:id
const deleteClassroom = async (req, res) => {
  try {
    const { id } = req.params;

    const [classrooms] = await pool.query(
      `
            SELECT classroom_id, is_active
            FROM classrooms
            WHERE classroom_id = ?
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

    if (!classrooms[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Classroom is already inactive",
      });
    }

    await pool.query(
      `
            UPDATE classrooms
            SET is_active = 0
            WHERE classroom_id = ?
        `,
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
