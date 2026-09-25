const pool = require("../config/mysql");

// GET /attendance/sessions
const getAttendanceSessions = async (req, res) => {
  try {
    const [sessions] = await pool.query(`
            SELECT
                session_id,
                slot_id,
                session_date,
                faculty_id,
                classroom_id,
                scheduled_start,
                scheduled_end,
                present_until,
                late_until,
                status,
                opened_at,
                closed_at,
                closed_by_user,
                cancel_reason,
                created_at,
                updated_at
            FROM class_sessions
            ORDER BY session_id
        `);

    return res.status(200).json({
      success: true,
      message: "Attendance sessions retrieved successfully",
      data: sessions,
    });
  } catch (error) {
    console.error("Get attendance sessions error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /attendance/sessions/:id
const getAttendanceSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [sessions] = await pool.query(
      `
            SELECT
                session_id,
                slot_id,
                session_date,
                faculty_id,
                classroom_id,
                scheduled_start,
                scheduled_end,
                present_until,
                late_until,
                status,
                opened_at,
                closed_at,
                closed_by_user,
                cancel_reason,
                created_at,
                updated_at
            FROM class_sessions
            WHERE session_id = ?
            LIMIT 1
        `,
      [id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance session retrieved successfully",
      data: sessions[0],
    });
  } catch (error) {
    console.error("Get attendance session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const createAttendanceSession = async (req, res) => {
  try {
    const {
      slot_id,
      session_date,
      faculty_id,
      classroom_id,
      scheduled_start,
      scheduled_end,
      present_until,
      late_until,
    } = req.body;

    if (
      !slot_id ||
      !session_date ||
      !faculty_id ||
      !classroom_id ||
      !scheduled_start ||
      !scheduled_end
    ) {
      return res.status(400).json({
        success: false,
        message:
          "slot_id, session_date, faculty_id, classroom_id, scheduled_start and scheduled_end are required",
      });
    }

    // Check slot
    const [slots] = await pool.query(
      `
            SELECT slot_id
            FROM timetable_slots
            WHERE slot_id = ?
            LIMIT 1
            `,
      [slot_id],
    );

    if (slots.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid slot_id",
      });
    }

    // Check faculty
    const [faculty] = await pool.query(
      `
            SELECT faculty_id
            FROM faculty
            WHERE faculty_id = ?
            LIMIT 1
            `,
      [faculty_id],
    );

    if (faculty.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid faculty_id",
      });
    }

    // Check classroom
    const [classrooms] = await pool.query(
      `
            SELECT classroom_id
            FROM classrooms
            WHERE classroom_id = ?
            LIMIT 1
            `,
      [classroom_id],
    );

    if (classrooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid classroom_id",
      });
    }

    // Prevent duplicate session for same slot/date
    const [existingSession] = await pool.query(
      `
            SELECT session_id
            FROM class_sessions
            WHERE slot_id = ?
              AND session_date = ?
            LIMIT 1
            `,
      [slot_id, session_date],
    );

    if (existingSession.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Attendance session already exists for this slot and date",
      });
    }

    const [result] = await pool.query(
      `
            INSERT INTO class_sessions (
                slot_id,
                session_date,
                faculty_id,
                classroom_id,
                scheduled_start,
                scheduled_end,
                present_until,
                late_until,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED')
            `,
      [
        slot_id,
        session_date,
        faculty_id,
        classroom_id,
        scheduled_start,
        scheduled_end,
        present_until ?? null,
        late_until ?? null,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Attendance session created successfully",
      data: {
        session_id: result.insertId,
        slot_id,
        session_date,
        faculty_id,
        classroom_id,
        scheduled_start,
        scheduled_end,
        present_until: present_until ?? null,
        late_until: late_until ?? null,
        status: "SCHEDULED",
      },
    });
  } catch (error) {
    console.error("Create attendance session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const startAttendanceSession = async (req, res) => {
  try {
    const { id } = req.params;

    // Check whether session exists
    const [sessions] = await pool.query(
      `
            SELECT
                session_id,
                status,
                opened_at,
                scheduled_start,
                scheduled_end
            FROM class_sessions
            WHERE session_id = ?
            LIMIT 1
            `,
      [id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Session can only be started from SCHEDULED state
    if (session.status !== "SCHEDULED") {
      return res.status(400).json({
        success: false,
        message: `Attendance session cannot be started because its current status is ${session.status}`,
      });
    }

    // Start the session
    await pool.query(
      `
            UPDATE class_sessions
            SET
                status = 'OPEN',
                opened_at = NOW()
            WHERE session_id = ?
            `,
      [id],
    );

    // Fetch updated session
    const [updatedSessions] = await pool.query(
      `
            SELECT
                session_id,
                slot_id,
                session_date,
                faculty_id,
                classroom_id,
                scheduled_start,
                scheduled_end,
                present_until,
                late_until,
                status,
                opened_at,
                closed_at,
                closed_by_user,
                cancel_reason
            FROM class_sessions
            WHERE session_id = ?
            LIMIT 1
            `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance session started successfully",
      data: updatedSessions[0],
    });
  } catch (error) {
    console.error("Start attendance session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const finalizeAttendanceSession = async (req, res) => {
  try {
    const { id } = req.params;

    // Check whether session exists
    const [sessions] = await pool.query(
      `
      SELECT
        session_id,
        status,
        opened_at,
        closed_at
      FROM class_sessions
      WHERE session_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Session can only be finalized when it is OPEN
    if (session.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Attendance session cannot be finalized because its current status is ${session.status}`,
      });
    }

    // Finalize the session
    await pool.query(
      `
      UPDATE class_sessions
      SET
        status = 'CLOSED',
        closed_at = NOW(),
        closed_by_user = ?
      WHERE session_id = ?
      `,
      [req.user.user_id, id],
    );

    // Fetch updated session
    const [updatedSessions] = await pool.query(
      `
      SELECT
        session_id,
        slot_id,
        session_date,
        faculty_id,
        classroom_id,
        scheduled_start,
        scheduled_end,
        present_until,
        late_until,
        status,
        opened_at,
        closed_at,
        closed_by_user,
        cancel_reason
      FROM class_sessions
      WHERE session_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance session finalized successfully",
      data: updatedSessions[0],
    });

  } catch (error) {
    console.error("Finalize attendance session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAttendanceSessionStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [sessions] = await pool.query(
      `
      SELECT
        session_id,
        status,
        opened_at,
        closed_at
      FROM class_sessions
      WHERE session_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance session status retrieved successfully",
      data: sessions[0],
    });

  } catch (error) {
    console.error("Get attendance session status error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAttendanceSessions,
  getAttendanceSessionById,
  createAttendanceSession,
  startAttendanceSession,
  finalizeAttendanceSession,
  getAttendanceSessionStatus
};
