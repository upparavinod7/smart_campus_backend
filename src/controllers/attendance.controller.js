const pool = require("../config/mysql");

const ALLOWED_ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT"];
const ALLOWED_REASON_CODES = [
  "MEDICAL_LEAVE",
  "ON_DUTY_LEAVE",
  "DEVICE_FAILURE",
  "FACULTY_OVERRIDE",
  "DATA_ENTRY_ERROR",
  "OTHER",
];

/**
 * POST /api/v1/attendance
 * Records attendance for a student in an open session. ADMIN or assigned FACULTY.
 */
const createAttendance = async (req, res) => {
  try {
    const sessionIdParam = req.params.sessionId;
    const { session_id, enrollment_id, student_id, status } = req.body || {};

    const targetSessionId = sessionIdParam || session_id;

    // Validate required fields
    if (!targetSessionId || (!enrollment_id && !student_id) || !status) {
      return res.status(400).json({
        success: false,
        message: "session_id, status, and either enrollment_id or student_id are required",
      });
    }

    if (!ALLOWED_ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    // Check whether the session exists
    const [sessions] = await pool.query(
      `
      SELECT
          session_id,
          slot_id,
          faculty_id,
          status AS session_status
      FROM class_sessions
      WHERE session_id = ?
      LIMIT 1
      `,
      [targetSessionId],
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
        message: "Faculty cannot mark attendance for a session assigned to another faculty member",
      });
    }

    // Attendance can only be marked while session is OPEN
    if (session.session_status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Attendance cannot be marked because the session is ${session.session_status}`,
      });
    }

    // Resolve enrollment
    let targetEnrollmentId = enrollment_id;
    let enrollmentRecord = null;

    if (enrollment_id) {
      const [enrollmentRows] = await pool.query(
        `
        SELECT
            e.enrollment_id,
            e.student_id,
            e.section_id,
            e.status AS enrollment_status,
            s.register_no,
            s.full_name
        FROM enrollments e
        INNER JOIN students s ON s.student_id = e.student_id
        INNER JOIN timetable_slots ts ON ts.section_id = e.section_id
        WHERE e.enrollment_id = ?
          AND ts.slot_id = ?
        LIMIT 1
        `,
        [enrollment_id, session.slot_id],
      );

      if (enrollmentRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Student enrollment does not belong to this attendance session",
        });
      }

      enrollmentRecord = enrollmentRows[0];
    } else {
      const [enrollmentRows] = await pool.query(
        `
        SELECT
            e.enrollment_id,
            e.student_id,
            e.section_id,
            e.status AS enrollment_status,
            s.register_no,
            s.full_name
        FROM enrollments e
        INNER JOIN students s ON s.student_id = e.student_id
        INNER JOIN timetable_slots ts ON ts.section_id = e.section_id
        WHERE e.student_id = ?
          AND ts.slot_id = ?
        LIMIT 1
        `,
        [student_id, session.slot_id],
      );

      if (enrollmentRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Student enrollment does not belong to this attendance session",
        });
      }

      enrollmentRecord = enrollmentRows[0];
      targetEnrollmentId = enrollmentRecord.enrollment_id;
    }

    if (enrollmentRecord.enrollment_status !== "REGISTERED") {
      return res.status(400).json({
        success: false,
        message: "Student enrollment is not active",
      });
    }

    // Prevent duplicate attendance
    const [existingAttendance] = await pool.query(
      `
      SELECT
          attendance_id,
          status,
          source
      FROM attendance_records
      WHERE session_id = ?
        AND enrollment_id = ?
      LIMIT 1
      `,
      [targetSessionId, targetEnrollmentId],
    );

    if (existingAttendance.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Attendance has already been marked for this student",
        data: existingAttendance[0],
      });
    }

    // Insert manual attendance
    const [result] = await pool.query(
      `
      INSERT INTO attendance_records (
          session_id,
          enrollment_id,
          status,
          source,
          marked_at
      )
      VALUES (?, ?, ?, 'MANUAL', NOW())
      `,
      [targetSessionId, targetEnrollmentId, status],
    );

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: {
        attendance_id: result.insertId,
        session_id: Number(targetSessionId),
        enrollment_id: Number(targetEnrollmentId),
        student_id: enrollmentRecord.student_id,
        register_no: enrollmentRecord.register_no,
        full_name: enrollmentRecord.full_name,
        status,
        source: "MANUAL",
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Attendance has already been marked for this student",
      });
    }

    console.error("Create attendance error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/attendance
 * Retrieves attendance records with optional filtering.
 */
const getAttendanceRecords = async (req, res) => {
  try {
    const { session_id, student_id, status, source } = req.query;

    const conditions = [];
    const params = [];

    if (session_id) {
      conditions.push("ar.session_id = ?");
      params.push(Number(session_id));
    }

    if (student_id) {
      conditions.push("e.student_id = ?");
      params.push(Number(student_id));
    }

    if (status) {
      conditions.push("ar.status = ?");
      params.push(status);
    }

    if (source) {
      conditions.push("ar.source = ?");
      params.push(source);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [records] = await pool.query(
      `
      SELECT
          ar.attendance_id,
          ar.session_id,
          ar.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name,
          s.email,
          ar.status,
          ar.source,
          ar.rfid_card_id,
          ar.fingerprint_template_id,
          ar.device_id,
          ar.rfid_scanned_at,
          ar.fingerprint_verified_at,
          ar.scan_event_ref,
          ar.marked_at,
          cs.session_date,
          cs.faculty_id,
          f.full_name AS faculty_name,
          cs.classroom_id,
          c.room_no
      FROM attendance_records ar
      INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
      INNER JOIN students s ON s.student_id = e.student_id
      INNER JOIN class_sessions cs ON cs.session_id = ar.session_id
      INNER JOIN faculty f ON f.faculty_id = cs.faculty_id
      INNER JOIN classrooms c ON c.classroom_id = cs.classroom_id
      ${whereClause}
      ORDER BY ar.attendance_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Attendance records retrieved successfully",
      data: records,
    });
  } catch (error) {
    console.error("Get attendance records error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/attendance/:id
 * Retrieves an individual attendance record by ID.
 */
const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    const [records] = await pool.query(
      `
      SELECT
          ar.attendance_id,
          ar.session_id,
          ar.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name,
          s.email,
          ar.status,
          ar.source,
          ar.rfid_card_id,
          ar.fingerprint_template_id,
          ar.device_id,
          ar.rfid_scanned_at,
          ar.fingerprint_verified_at,
          ar.scan_event_ref,
          ar.marked_at,
          cs.session_date,
          cs.faculty_id,
          f.full_name AS faculty_name,
          cs.classroom_id,
          c.room_no
      FROM attendance_records ar
      INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
      INNER JOIN students s ON s.student_id = e.student_id
      INNER JOIN class_sessions cs ON cs.session_id = ar.session_id
      INNER JOIN faculty f ON f.faculty_id = cs.faculty_id
      INNER JOIN classrooms c ON c.classroom_id = cs.classroom_id
      WHERE ar.attendance_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record retrieved successfully",
      data: records[0],
    });
  } catch (error) {
    console.error("Get attendance by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/attendance/student/:studentId
 * Retrieves attendance records for a student. Enforces student privacy.
 */
const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Student privacy: STUDENT role can only view their own records
    if (req.user.role === "STUDENT") {
      let effectiveStudentId = req.user.student_id;
      if (!effectiveStudentId && req.user.user_id) {
        const [u] = await pool.query(
          "SELECT student_id FROM users WHERE user_id = ? LIMIT 1",
          [req.user.user_id],
        );
        if (u.length > 0 && u[0].student_id) {
          effectiveStudentId = u[0].student_id;
        }
      }
      if (!effectiveStudentId || effectiveStudentId !== Number(studentId)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access another student's attendance",
        });
      }
    }

    // Verify student exists
    const [students] = await pool.query(
      `SELECT student_id, register_no, full_name FROM students WHERE student_id = ? LIMIT 1`,
      [studentId],
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const [records] = await pool.query(
      `
      SELECT
          ar.attendance_id,
          ar.session_id,
          ar.enrollment_id,
          s.student_id,
          s.register_no,
          s.full_name,
          ar.status,
          ar.source,
          ar.marked_at,
          cs.session_date,
          cs.faculty_id,
          f.full_name AS faculty_name,
          cs.classroom_id,
          c.room_no
      FROM attendance_records ar
      INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
      INNER JOIN students s ON s.student_id = e.student_id
      INNER JOIN class_sessions cs ON cs.session_id = ar.session_id
      INNER JOIN faculty f ON f.faculty_id = cs.faculty_id
      INNER JOIN classrooms c ON c.classroom_id = cs.classroom_id
      WHERE s.student_id = ?
      ORDER BY cs.session_date DESC, ar.attendance_id DESC
      `,
      [studentId],
    );

    return res.status(200).json({
      success: true,
      message: "Student attendance retrieved successfully",
      data: records,
    });
  } catch (error) {
    console.error("Get student attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/attendance/session/:sessionId
 * Retrieves roster attendance for a session.
 */
const getSessionAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [sessions] = await pool.query(
      `
      SELECT
          session_id,
          status,
          session_date,
          faculty_id,
          classroom_id
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

    const [records] = await pool.query(
      `
      SELECT
          ar.attendance_id,
          ar.session_id,
          ar.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name,
          s.email,
          e.status AS enrollment_status,
          ar.status AS attendance_status,
          ar.source,
          ar.marked_at
      FROM attendance_records ar
      INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
      INNER JOIN students s ON s.student_id = e.student_id
      WHERE ar.session_id = ?
      ORDER BY e.enrollment_id ASC
      `,
      [sessionId],
    );

    return res.status(200).json({
      success: true,
      message: "Session attendance retrieved successfully",
      data: {
        session_id: session.session_id,
        session_status: session.status,
        session_date: session.session_date,
        faculty_id: session.faculty_id,
        classroom_id: session.classroom_id,
        total_records: records.length,
        records,
      },
    });
  } catch (error) {
    console.error("Get session attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/attendance/staff/:facultyId
 */
const getFacultyAttendance = async (req, res) => {
  try {
    const { facultyId } = req.params;

    const [faculty] = await pool.query(
      `
      SELECT
          faculty_id,
          employee_code,
          full_name,
          email,
          is_active
      FROM faculty
      WHERE faculty_id = ?
      LIMIT 1
      `,
      [facultyId],
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    const [records] = await pool.query(
      `
      SELECT
          ar.attendance_id,
          ar.session_id,
          ar.enrollment_id,
          e.student_id,
          s.register_no,
          s.full_name AS student_name,
          ar.status AS attendance_status,
          ar.source,
          ar.marked_at,
          cs.session_date,
          cs.status AS session_status,
          cs.classroom_id,
          c.room_no
      FROM attendance_records ar
      INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
      INNER JOIN students s ON s.student_id = e.student_id
      INNER JOIN class_sessions cs ON cs.session_id = ar.session_id
      INNER JOIN classrooms c ON c.classroom_id = cs.classroom_id
      WHERE cs.faculty_id = ?
      ORDER BY cs.session_date DESC, ar.attendance_id DESC
      `,
      [facultyId],
    );

    return res.status(200).json({
      success: true,
      message: "Faculty attendance retrieved successfully",
      data: {
        faculty: faculty[0],
        total_records: records.length,
        records,
      },
    });
  } catch (error) {
    console.error("Get faculty attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/attendance/student/:studentId/summary
 */
const getStudentAttendanceSummary = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Student privacy: STUDENT role can only view their own records
    if (req.user.role === "STUDENT") {
      let effectiveStudentId = req.user.student_id;
      if (!effectiveStudentId && req.user.user_id) {
        const [u] = await pool.query(
          "SELECT student_id FROM users WHERE user_id = ? LIMIT 1",
          [req.user.user_id],
        );
        if (u.length > 0 && u[0].student_id) {
          effectiveStudentId = u[0].student_id;
        }
      }
      if (!effectiveStudentId || effectiveStudentId !== Number(studentId)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access another student's attendance summary",
        });
      }
    }

    const [students] = await pool.query(
      `
      SELECT
          student_id,
          register_no,
          full_name,
          email
      FROM students
      WHERE student_id = ?
      LIMIT 1
      `,
      [studentId],
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = students[0];

    const [summaryRows] = await pool.query(
      `
      SELECT
          COUNT(*) AS total_classes,
          SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN ar.status = 'LATE' THEN 1 ELSE 0 END) AS late,
          SUM(CASE WHEN ar.status = 'ABSENT' THEN 1 ELSE 0 END) AS absent
      FROM attendance_records ar
      INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
      WHERE e.student_id = ?
      `,
      [studentId],
    );

    const summary = summaryRows[0];
    const totalClasses = Number(summary.total_classes) || 0;
    const present = Number(summary.present) || 0;
    const late = Number(summary.late) || 0;
    const absent = Number(summary.absent) || 0;
    const attended = present + late;
    const attendancePercentage = totalClasses > 0 ? Number(((attended / totalClasses) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      message: "Student attendance summary retrieved successfully",
      data: {
        student: {
          student_id: student.student_id,
          register_no: student.register_no,
          full_name: student.full_name,
          email: student.email,
        },
        summary: {
          total_classes: totalClasses,
          present,
          late,
          absent,
          attended,
          attendance_percentage: attendancePercentage,
        },
      },
    });
  } catch (error) {
    console.error("Get student attendance summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/attendance/records/:id or POST /api/v1/attendance/:id/override
 * Overrides / corrects an attendance record with audit trail. ADMIN or assigned FACULTY.
 */
const overrideAttendance = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { new_status, reason_code, reason_note, supporting_ref, status } = req.body || {};

    const targetStatus = new_status || status;
    const targetReason = reason_code || "FACULTY_OVERRIDE";

    if (!targetStatus) {
      return res.status(400).json({
        success: false,
        message: "new_status or status is required",
      });
    }

    if (!ALLOWED_ATTENDANCE_STATUSES.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    if (!ALLOWED_REASON_CODES.includes(targetReason)) {
      return res.status(400).json({
        success: false,
        message: "Invalid correction reason",
      });
    }

    const [attendanceRows] = await connection.query(
      `
      SELECT
          ar.attendance_id,
          ar.session_id,
          ar.enrollment_id,
          ar.status,
          cs.faculty_id,
          cs.status AS session_status,
          e.student_id,
          s.register_no,
          s.full_name AS student_name
      FROM attendance_records ar
      INNER JOIN class_sessions cs ON cs.session_id = ar.session_id
      INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
      INNER JOIN students s ON s.student_id = e.student_id
      WHERE ar.attendance_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (attendanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const attendance = attendanceRows[0];

    // Ownership check for FACULTY
    if (req.user.role === "FACULTY" && req.user.faculty_id && req.user.faculty_id !== attendance.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "Faculty cannot override attendance for another faculty's session",
      });
    }

    if (attendance.status === targetStatus) {
      return res.status(400).json({
        success: false,
        message: "New attendance status is the same as the current status",
      });
    }

    const requestedBy = req.user.user_id;

    await connection.beginTransaction();

    const [correctionResult] = await connection.query(
      `
      INSERT INTO attendance_corrections (
          attendance_id,
          previous_status,
          new_status,
          reason_code,
          reason_note,
          supporting_ref,
          requested_by,
          approval_status,
          decided_by,
          decided_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, NOW())
      `,
      [
        attendance.attendance_id,
        attendance.status,
        targetStatus,
        targetReason,
        reason_note || null,
        supporting_ref || null,
        requestedBy,
        requestedBy,
      ],
    );

    await connection.query(
      `
      UPDATE attendance_records
      SET
          status = ?,
          source = 'CORRECTION',
          marked_at = NOW()
      WHERE attendance_id = ?
      `,
      [targetStatus, attendance.attendance_id],
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Attendance overridden successfully",
      data: {
        correction_id: correctionResult.insertId,
        attendance_id: attendance.attendance_id,
        student_id: attendance.student_id,
        register_no: attendance.register_no,
        student_name: attendance.student_name,
        previous_status: attendance.status,
        new_status: targetStatus,
        reason_code: targetReason,
        reason_note: reason_note || null,
        supporting_ref: supporting_ref || null,
        approval_status: "APPROVED",
        source: "CORRECTION",
        requested_by: requestedBy,
        decided_by: requestedBy,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Override attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  createAttendance,
  getAttendanceRecords,
  getAttendanceById,
  getStudentAttendance,
  getSessionAttendance,
  getFacultyAttendance,
  getStudentAttendanceSummary,
  overrideAttendance,
};
