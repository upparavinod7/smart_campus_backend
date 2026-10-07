const pool = require("../config/mysql");

/**
 * GET /api/v1/attendance/sessions
 * List attendance sessions with relational metadata joins and filters.
 */
const getAttendanceSessions = async (req, res) => {
  try {
    const { session_date, status, faculty_id, classroom_id, slot_id } = req.query;

    const conditions = [];
    const params = [];

    if (session_date) {
      conditions.push("cs.session_date = ?");
      params.push(session_date);
    }

    if (status) {
      conditions.push("cs.status = ?");
      params.push(status);
    }

    if (faculty_id) {
      conditions.push("cs.faculty_id = ?");
      params.push(Number(faculty_id));
    }

    if (classroom_id) {
      conditions.push("cs.classroom_id = ?");
      params.push(Number(classroom_id));
    }

    if (slot_id) {
      conditions.push("cs.slot_id = ?");
      params.push(Number(slot_id));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [sessions] = await pool.query(
      `
      SELECT
          cs.session_id,
          cs.slot_id,
          cs.session_date,
          cs.faculty_id,
          f.full_name AS faculty_name,
          f.employee_code,
          cs.classroom_id,
          c.room_no,
          c.room_type,
          sec.section_code AS section_name,
          sub.name AS subject_name,
          sub.subject_code AS subject_code,
          cs.scheduled_start,
          cs.scheduled_end,
          cs.present_until,
          cs.late_until,
          cs.status,
          cs.opened_at,
          cs.closed_at,
          cs.closed_by_user,
          cs.cancel_reason,
          cs.created_at,
          cs.updated_at
      FROM class_sessions cs
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      LEFT JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      LEFT JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN subjects sub ON co.subject_id = sub.subject_id
      ${whereClause}
      ORDER BY cs.session_date DESC, cs.session_id DESC
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

/**
 * GET /api/v1/attendance/sessions/:id
 * Retrieve single attendance session by ID with relational joins.
 */
const getAttendanceSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [sessions] = await pool.query(
      `
      SELECT
          cs.session_id,
          cs.slot_id,
          cs.session_date,
          cs.faculty_id,
          f.full_name AS faculty_name,
          f.employee_code,
          cs.classroom_id,
          c.room_no,
          c.room_type,
          sec.section_code AS section_name,
          sub.name AS subject_name,
          sub.subject_code AS subject_code,
          cs.scheduled_start,
          cs.scheduled_end,
          cs.present_until,
          cs.late_until,
          cs.status,
          cs.opened_at,
          cs.closed_at,
          cs.closed_by_user,
          cs.cancel_reason,
          cs.created_at,
          cs.updated_at
      FROM class_sessions cs
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      LEFT JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      LEFT JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN subjects sub ON co.subject_id = sub.subject_id
      WHERE cs.session_id = ?
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

/**
 * POST /api/v1/attendance/sessions
 * Creates an attendance session. ADMIN or assigned FACULTY.
 */
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
    } = req.body || {};

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

    // Role ownership check: FACULTY can only create sessions for themselves
    if (req.user.role === "FACULTY" && req.user.faculty_id && req.user.faculty_id !== Number(faculty_id)) {
      return res.status(403).json({
        success: false,
        message: "Faculty cannot create a session assigned to another faculty member",
      });
    }

    // Verify slot
    const [slots] = await pool.query(
      `SELECT slot_id, is_active FROM timetable_slots WHERE slot_id = ? LIMIT 1`,
      [slot_id],
    );

    if (slots.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid slot_id",
      });
    }

    // Verify faculty exists and is active
    const [faculty] = await pool.query(
      `SELECT faculty_id, is_active FROM faculty WHERE faculty_id = ? LIMIT 1`,
      [faculty_id],
    );

    if (faculty.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid faculty_id",
      });
    }

    if (!faculty[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign session to an inactive faculty member",
      });
    }

    // Verify classroom exists and is active
    const [classrooms] = await pool.query(
      `SELECT classroom_id, is_active FROM classrooms WHERE classroom_id = ? LIMIT 1`,
      [classroom_id],
    );

    if (classrooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid classroom_id",
      });
    }

    if (!classrooms[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign session to an inactive classroom",
      });
    }

    // Validate times
    const startTime = new Date(scheduled_start);
    const endTime = new Date(scheduled_end);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduled_start or scheduled_end datetime format",
      });
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        message: "scheduled_end must be greater than scheduled_start",
      });
    }

    // Calculate present_until and late_until if not supplied
    const resolvedPresentUntil = present_until
      ? new Date(present_until)
      : new Date(startTime.getTime() + 15 * 60000);

    const resolvedLateUntil = late_until
      ? new Date(late_until)
      : new Date(startTime.getTime() + 30 * 60000);

    if (resolvedLateUntil < resolvedPresentUntil) {
      return res.status(400).json({
        success: false,
        message: "late_until must be greater than or equal to present_until",
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
        resolvedPresentUntil,
        resolvedLateUntil,
      ],
    );

    const [created] = await pool.query(
      `
      SELECT
          cs.*,
          f.full_name AS faculty_name,
          f.employee_code,
          c.room_no
      FROM class_sessions cs
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      WHERE cs.session_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Attendance session created successfully",
      data: created[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Attendance session already exists for this slot and date",
      });
    }

    console.error("Create attendance session error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/attendance/sessions/:id
 * Updates an attendance session. ADMIN or assigned FACULTY.
 */
const updateAttendanceSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { classroom_id, scheduled_start, scheduled_end, cancel_reason } = req.body || {};

    const [sessions] = await pool.query(
      `SELECT * FROM class_sessions WHERE session_id = ? LIMIT 1`,
      [id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Ownership check for FACULTY
    if (req.user.role === "FACULTY" && req.user.faculty_id && req.user.faculty_id !== session.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to modify this attendance session",
      });
    }

    // Prohibit modifying closed or cancelled sessions
    if (session.status === "CLOSED" || session.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: `Cannot update attendance session because its status is ${session.status}`,
      });
    }

    let targetClassroomId = session.classroom_id;
    if (classroom_id !== undefined) {
      const [classrooms] = await pool.query(
        `SELECT classroom_id, is_active FROM classrooms WHERE classroom_id = ? LIMIT 1`,
        [classroom_id],
      );

      if (classrooms.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid classroom_id",
        });
      }

      if (!classrooms[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Cannot assign session to an inactive classroom",
        });
      }

      targetClassroomId = Number(classroom_id);
    }

    let targetStart = session.scheduled_start;
    let targetEnd = session.scheduled_end;

    if (scheduled_start !== undefined) targetStart = new Date(scheduled_start);
    if (scheduled_end !== undefined) targetEnd = new Date(scheduled_end);

    if (new Date(targetEnd) <= new Date(targetStart)) {
      return res.status(400).json({
        success: false,
        message: "scheduled_end must be greater than scheduled_start",
      });
    }

    await pool.query(
      `
      UPDATE class_sessions
      SET
          classroom_id = ?,
          scheduled_start = ?,
          scheduled_end = ?,
          cancel_reason = ?
      WHERE session_id = ?
      `,
      [targetClassroomId, targetStart, targetEnd, cancel_reason ?? session.cancel_reason, id],
    );

    const [updated] = await pool.query(
      `
      SELECT
          cs.*,
          f.full_name AS faculty_name,
          c.room_no
      FROM class_sessions cs
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      WHERE cs.session_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance session updated successfully",
      data: updated[0],
    });
  } catch (error) {
    console.error("Update attendance session error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/attendance/sessions/:id/start
 * Starts an eligible attendance session (SCHEDULED -> OPEN). ADMIN or assigned FACULTY.
 */
const startAttendanceSession = async (req, res) => {
  try {
    const { id } = req.params;

    const [sessions] = await pool.query(
      `
      SELECT
          session_id,
          faculty_id,
          status,
          opened_at
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

    // Ownership check for FACULTY
    if (req.user.role === "FACULTY" && req.user.faculty_id && req.user.faculty_id !== session.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to start this attendance session",
      });
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

    const [updatedSessions] = await pool.query(
      `
      SELECT
          cs.*,
          f.full_name AS faculty_name,
          c.room_no
      FROM class_sessions cs
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      WHERE cs.session_id = ?
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

/**
 * POST /api/v1/attendance/sessions/:id/finalize
 * Finalizes an open attendance session (OPEN -> CLOSED). ADMIN or assigned FACULTY.
 */
const finalizeAttendanceSession = async (req, res) => {
  try {
    const { id } = req.params;

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

    // Ownership check for FACULTY
    if (req.user.role === "FACULTY" && req.user.faculty_id && req.user.faculty_id !== session.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to finalize this attendance session",
      });
    }

    // Session can only be finalized when it is OPEN
    if (session.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Attendance session cannot be finalized because its current status is ${session.status}`,
      });
    }

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

    const [updatedSessions] = await pool.query(
      `
      SELECT
          cs.*,
          f.full_name AS faculty_name,
          c.room_no
      FROM class_sessions cs
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      WHERE cs.session_id = ?
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

/**
 * POST /api/v1/attendance/sessions/:id/reconcile
 * Reconciles attendance records and computes session headcount statistics. ADMIN or assigned FACULTY.
 */
const reconcileAttendanceSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { headcount, tolerance_pct } = req.body || {};

    const [sessions] = await pool.query(
      `
      SELECT
          session_id,
          slot_id,
          faculty_id,
          status
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

    // Ownership check for FACULTY
    if (req.user.role === "FACULTY" && req.user.faculty_id && req.user.faculty_id !== session.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reconcile this attendance session",
      });
    }

    // 1. Calculate enrolled count from timetable slot section
    const [enrolledRows] = await pool.query(
      `
      SELECT COUNT(DISTINCT e.enrollment_id) AS enrolled_count
      FROM timetable_slots ts
      INNER JOIN enrollments e ON e.section_id = ts.section_id
      WHERE ts.slot_id = ? AND e.status = 'REGISTERED'
      `,
      [session.slot_id],
    );
    const enrolledCount = Number(enrolledRows[0]?.enrolled_count || 0);

    // 2. Calculate attended count (PRESENT or LATE)
    const [attendedRows] = await pool.query(
      `
      SELECT COUNT(*) AS attended_count
      FROM attendance_records
      WHERE session_id = ? AND status IN ('PRESENT', 'LATE')
      `,
      [id],
    );
    const attendedCount = Number(attendedRows[0]?.attended_count || 0);

    const tolerance = tolerance_pct !== undefined ? Number(tolerance_pct) : 10.0;

    let resolvedHeadcount = null;
    let variance = null;
    let variancePct = null;
    let result = "NO_HEADCOUNT";
    let reviewStatus = "NOT_REQUIRED";

    if (headcount !== undefined && headcount !== null && headcount !== "") {
      const numHeadcount = Number(headcount);
      if (!Number.isInteger(numHeadcount) || numHeadcount < 0) {
        return res.status(400).json({
          success: false,
          message: "Headcount must be a non-negative integer",
        });
      }
      resolvedHeadcount = numHeadcount;
      variance = attendedCount - resolvedHeadcount;
      variancePct = enrolledCount > 0 ? Number(((Math.abs(variance) / enrolledCount) * 100).toFixed(2)) : 0;
      result = variancePct <= tolerance ? "MATCH" : "MISMATCH";
      reviewStatus = result === "MATCH" ? "NOT_REQUIRED" : "PENDING_REVIEW";
    }

    // Upsert reconciliation record
    await pool.query(
      `
      INSERT INTO session_reconciliation (
          session_id,
          enrolled_count,
          attended_count,
          headcount,
          snapshots_used,
          variance,
          variance_pct,
          tolerance_pct,
          result,
          review_status,
          computed_at
      )
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
          enrolled_count = VALUES(enrolled_count),
          attended_count = VALUES(attended_count),
          headcount = VALUES(headcount),
          variance = VALUES(variance),
          variance_pct = VALUES(variance_pct),
          tolerance_pct = VALUES(tolerance_pct),
          result = VALUES(result),
          review_status = VALUES(review_status),
          computed_at = NOW()
      `,
      [
        id,
        enrolledCount,
        attendedCount,
        resolvedHeadcount,
        variance,
        variancePct,
        tolerance,
        result,
        reviewStatus,
      ],
    );

    const [reconciliationRows] = await pool.query(
      `SELECT * FROM session_reconciliation WHERE session_id = ? LIMIT 1`,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance session reconciled successfully",
      data: reconciliationRows[0],
    });
  } catch (error) {
    console.error("Reconcile attendance session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/attendance/sessions/:id/status
 */
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

/**
 * GET /api/v1/attendance/sessions/:sessionId/presence-pool
 */
const getAttendanceSessionPresencePool = async (req, res) => {
  try {
    const { sessionId } = req.params;

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

    const [poolStats] = await pool.query(
      `
      SELECT
          COUNT(DISTINCT e.enrollment_id) AS total_members,
          COUNT(DISTINCT CASE WHEN ar.status = 'PRESENT' THEN e.enrollment_id END) AS present_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'LATE' THEN e.enrollment_id END) AS late_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'ABSENT' THEN e.enrollment_id END) AS absent_count
      FROM enrollments e
      LEFT JOIN attendance_records ar ON ar.enrollment_id = e.enrollment_id AND ar.session_id = ?
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

/**
 * GET /api/v1/attendance/sessions/:sessionId/presence-pool/members
 */
const getAttendanceSessionPresencePoolMembers = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [sessions] = await pool.query(
      `
      SELECT session_id, slot_id, status
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
      INNER JOIN enrollments e ON e.section_id = ts.section_id
      INNER JOIN students s ON s.student_id = e.student_id
      LEFT JOIN attendance_records ar ON ar.enrollment_id = e.enrollment_id AND ar.session_id = ?
      WHERE ts.slot_id = ?
        AND e.status = 'REGISTERED'
      ORDER BY s.student_id
      `,
      [sessionId, session.slot_id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance session presence pool members retrieved successfully",
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
  updateAttendanceSession,
  startAttendanceSession,
  finalizeAttendanceSession,
  reconcileAttendanceSession,
  getAttendanceSessionStatus,
  getAttendanceSessionPresencePool,
  getAttendanceSessionPresencePoolMembers,
};
