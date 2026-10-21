const pool = require("../config/mysql");
const { resolveFacultyRecord } = require("./facultyPortal.controller");

// GET /attendance/sessions
const getAttendanceSessions = async (req, res) => {
  try {
    let whereClause = "";
    const params = [];

    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec) {
        return res.status(403).json({
          success: false,
          message: "Faculty profile not found or account is not linked to a faculty member",
        });
      }
      whereClause = "WHERE faculty_id = ?";
      params.push(facultyRec.faculty_id);
    }

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
      ${whereClause}
      ORDER BY session_id
      `,
      params,
    );

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

    const session = sessions[0];

    // Ownership check for faculty
    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec || session.faculty_id !== facultyRec.faculty_id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access another faculty member's attendance session",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Attendance session retrieved successfully",
      data: session,
    });
  } catch (error) {
    console.error("Get attendance session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const formatDateTime = (dateStr, timeOrDt) => {
  if (!timeOrDt) return null;
  const str = String(timeOrDt).trim();
  if (str.includes("T") || str.includes(" ")) {
    return str.replace("T", " ").replace("Z", "").slice(0, 19);
  }
  const timePart = str.length === 5 ? `${str}:00` : str;
  return `${String(dateStr).slice(0, 10)} ${timePart}`;
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

    if (!slot_id || !session_date) {
      return res.status(400).json({
        success: false,
        message: "slot_id and session_date are required",
      });
    }

    // Check slot
    const [slots] = await pool.query(
      `
      SELECT slot_id, section_id, faculty_id, classroom_id, start_time, end_time, is_active
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

    const slot = slots[0];
    let resolvedFacultyId = faculty_id;

    // If caller is FACULTY, enforce authenticated faculty identity and slot ownership
    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec) {
        return res.status(403).json({
          success: false,
          message: "Faculty profile not found or account is not linked to a faculty member",
        });
      }

      if (slot.faculty_id !== facultyRec.faculty_id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to create a session for another faculty member's timetable slot",
        });
      }

      resolvedFacultyId = facultyRec.faculty_id;
    }

    const resolvedClassroomId = classroom_id || slot.classroom_id;
    const resolvedScheduledStart = formatDateTime(session_date, scheduled_start || slot.start_time);
    const resolvedScheduledEnd = formatDateTime(session_date, scheduled_end || slot.end_time);

    if (
      !resolvedFacultyId ||
      !resolvedClassroomId ||
      !resolvedScheduledStart ||
      !resolvedScheduledEnd
    ) {
      return res.status(400).json({
        success: false,
        message:
          "slot_id, session_date, faculty_id, classroom_id, scheduled_start and scheduled_end are required",
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
      [resolvedFacultyId],
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
      [resolvedClassroomId],
    );

    if (classrooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid classroom_id",
      });
    }

    // Prevent duplicate session for same slot and scheduled start time
    const [existingSession] = await pool.query(
      `
      SELECT session_id
      FROM class_sessions
      WHERE slot_id = ?
        AND scheduled_start = ?
      LIMIT 1
      `,
      [slot_id, resolvedScheduledStart],
    );

    if (existingSession.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Attendance session already exists for this slot and scheduled start time",
      });
    }

    const resolvedPresentUntil = present_until
      ? formatDateTime(session_date, present_until)
      : resolvedScheduledStart;
    const resolvedLateUntil = late_until
      ? formatDateTime(session_date, late_until)
      : resolvedScheduledEnd;

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
        resolvedFacultyId,
        resolvedClassroomId,
        resolvedScheduledStart,
        resolvedScheduledEnd,
        resolvedPresentUntil,
        resolvedLateUntil,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Attendance session created successfully",
      data: {
        session_id: result.insertId,
        slot_id,
        session_date,
        faculty_id: resolvedFacultyId,
        classroom_id: resolvedClassroomId,
        scheduled_start: resolvedScheduledStart,
        scheduled_end: resolvedScheduledEnd,
        present_until: resolvedPresentUntil,
        late_until: resolvedLateUntil,
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
          faculty_id,
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

    // Ownership check for FACULTY role
    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec || session.faculty_id !== facultyRec.faculty_id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to start another faculty member's attendance session",
        });
      }
    }

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
        faculty_id,
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

    // Ownership check for FACULTY role
    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec || session.faculty_id !== facultyRec.faculty_id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to finalize another faculty member's attendance session",
        });
      }
    }

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

    // Auto-record unmarked enrolled students as ABSENT (source: SYSTEM_CLOSE)
    await pool.query(
      `
      INSERT INTO attendance_records (
        session_id,
        enrollment_id,
        status,
        source,
        marked_at
      )
      SELECT
        ?,
        e.enrollment_id,
        'ABSENT',
        'SYSTEM_CLOSE',
        NOW(3)
      FROM timetable_slots ts
      JOIN class_sessions cs ON cs.slot_id = ts.slot_id
      JOIN enrollments e ON e.section_id = ts.section_id AND e.status = 'REGISTERED'
      LEFT JOIN attendance_records ar ON ar.session_id = cs.session_id AND ar.enrollment_id = e.enrollment_id
      WHERE cs.session_id = ?
        AND ar.attendance_id IS NULL
      `,
      [id, id],
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

const getAttendanceSessionPresencePool = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check whether the attendance session exists
    const [sessions] = await pool.query(
      `
      SELECT
        session_id,
        slot_id,
        session_date,
        faculty_id,
        classroom_id,
        status
      FROM class_sessions
      WHERE session_id = ?
      LIMIT 1
      `,
      [sessionId],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Get attendance pool statistics
    const [poolStats] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT e.enrollment_id) AS total_members,

        COUNT(
          DISTINCT CASE
            WHEN ar.status = 'PRESENT'
            THEN e.enrollment_id
          END
        ) AS present_count,

        COUNT(
          DISTINCT CASE
            WHEN ar.status = 'LATE'
            THEN e.enrollment_id
          END
        ) AS late_count,

        COUNT(
          DISTINCT CASE
            WHEN ar.status = 'ABSENT'
            THEN e.enrollment_id
          END
        ) AS absent_count

      FROM enrollments e

      LEFT JOIN attendance_records ar
        ON ar.enrollment_id = e.enrollment_id
        AND ar.session_id = ?

      WHERE e.section_id = (
        SELECT ts.section_id
        FROM timetable_slots ts
        WHERE ts.slot_id = ?
        LIMIT 1
      )

      AND e.status = 'REGISTERED'
      `,
      [sessionId, session.slot_id],
    );

    const stats = poolStats[0];

    return res.status(200).json({
      success: true,
      message: "Attendance session presence pool retrieved successfully",
      data: {
        session_id: session.session_id,
        session_status: session.status,
        total_members: Number(stats.total_members),
        present_count: Number(stats.present_count),
        late_count: Number(stats.late_count),
        absent_count: Number(stats.absent_count),
      },
    });
  } catch (error) {
    console.error("Get attendance session presence pool error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAttendanceSessionPresencePoolMembers = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check whether session exists
    const [sessions] = await pool.query(
      `
      SELECT
        session_id,
        slot_id,
        status
      FROM class_sessions
      WHERE session_id = ?
      LIMIT 1
      `,
      [sessionId],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    const [members] = await pool.query(
      `
      SELECT
        e.enrollment_id,
        s.student_id,
        s.register_no,
        s.full_name,
        s.email,
        e.status AS enrollment_status,

        COALESCE(ar.status, 'ABSENT') AS attendance_status,

        ar.source,
        ar.rfid_card_id,
        ar.fingerprint_template_id,
        ar.device_id,
        ar.marked_at

      FROM timetable_slots ts

      INNER JOIN enrollments e
        ON e.section_id = ts.section_id

      INNER JOIN students s
        ON s.student_id = e.student_id

      LEFT JOIN attendance_records ar
        ON ar.enrollment_id = e.enrollment_id
        AND ar.session_id = ?

      WHERE ts.slot_id = ?
        AND e.status = 'REGISTERED'

      ORDER BY s.student_id
      `,
      [sessionId, session.slot_id],
    );

    return res.status(200).json({
      success: true,
      message:
        "Attendance session presence pool members retrieved successfully",
      data: {
        session_id: session.session_id,
        session_status: session.status,
        total_members: members.length,
        members,
      },
    });
  } catch (error) {
    console.error("Get attendance session presence pool members error:", error);

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
  getAttendanceSessionStatus,
  getAttendanceSessionPresencePool,
  getAttendanceSessionPresencePoolMembers,
};
