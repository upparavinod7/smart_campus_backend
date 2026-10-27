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
 * Resolves the authenticated faculty record from JWT/users.
 * Returns the faculty row or null.
 */
const resolveFacultyRecord = async (user) => {
  if (!user) return null;

  let facultyId = null;

  if (user.user_id) {
    const [u] = await pool.query(
      "SELECT faculty_id FROM users WHERE user_id = ? LIMIT 1",
      [user.user_id],
    );
    if (u.length > 0 && u[0].faculty_id) {
      facultyId = u[0].faculty_id;
    }
  }

  // Fallback to token claim if user_id is synthetic/mocked in tests
  if (!facultyId && user.faculty_id) {
    facultyId = user.faculty_id;
  }

  if (!facultyId) {
    return null;
  }

  const [facultyRows] = await pool.query(
    `
    SELECT
        f.faculty_id,
        f.employee_code,
        f.full_name,
        f.gender,
        f.date_of_birth,
        f.blood_group,
        f.joining_year,
        f.in_charge_class,
        f.phone,
        f.email,
        f.designation_id,
        des.name AS designation,
        f.school_id,
        sch.name AS school_name,
        f.department_id,
        d.name AS department_name,
        d.code AS department_code,
        f.is_active,
        f.created_at,
        f.updated_at
    FROM faculty f
    LEFT JOIN designations des ON f.designation_id = des.designation_id
    LEFT JOIN departments d ON f.department_id = d.department_id
    LEFT JOIN schools sch ON f.school_id = sch.school_id
    WHERE f.faculty_id = ?
    LIMIT 1
    `,
    [facultyId],
  );

  return facultyRows.length > 0 ? facultyRows[0] : null;
};

/**
 * GET /api/v1/faculty/me
 * Retrieves profile of the authenticated faculty member.
 */
const getMyFacultyProfile = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found or account is not linked to a faculty member",
      });
    }

    if (!faculty.is_active) {
      return res.status(403).json({
        success: false,
        message: "Faculty account is inactive",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Faculty profile retrieved successfully",
      data: faculty,
    });
  } catch (error) {
    console.error("Get faculty profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/faculty/dashboard
 * Aggregated dashboard metrics for the authenticated faculty member.
 */
const getFacultyDashboard = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const facultyId = faculty.faculty_id;

    // 1. Today's timetable slots (ISO day of week: Monday=1 ... Sunday=7)
    const [todaySlots] = await pool.query(
      `
      SELECT
          ts.slot_id,
          ts.day_of_week,
          ts.start_time,
          ts.end_time,
          sub.subject_code,
          sub.name AS subject_name,
          sec.section_code,
          c.room_no,
          b.name AS block_name
      FROM timetable_slots ts
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN classrooms c ON ts.classroom_id = c.classroom_id
      LEFT JOIN blocks b ON c.block_id = b.block_id
      WHERE ts.faculty_id = ?
        AND ts.is_active = 1
        AND ts.day_of_week = ((WEEKDAY(CURDATE()) + 1))
        AND (ts.effective_from <= CURDATE())
        AND (ts.effective_to IS NULL OR ts.effective_to >= CURDATE())
      ORDER BY ts.start_time ASC
      `,
      [facultyId],
    );

    // 2. Active (OPEN) sessions
    const [activeSessions] = await pool.query(
      `
      SELECT
          cs.session_id,
          cs.session_date,
          cs.status,
          cs.scheduled_start,
          cs.scheduled_end,
          cs.opened_at,
          sub.subject_code,
          sub.name AS subject_name,
          sec.section_code,
          c.room_no
      FROM class_sessions cs
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      LEFT JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      LEFT JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN subjects sub ON co.subject_id = sub.subject_id
      WHERE cs.faculty_id = ? AND cs.status = 'OPEN'
      ORDER BY cs.session_date DESC, cs.session_id DESC
      `,
      [facultyId],
    );

    // 3. Upcoming (SCHEDULED) sessions
    const [upcomingSessions] = await pool.query(
      `
      SELECT
          cs.session_id,
          cs.session_date,
          cs.status,
          cs.scheduled_start,
          cs.scheduled_end,
          sub.subject_code,
          sub.name AS subject_name,
          sec.section_code,
          c.room_no
      FROM class_sessions cs
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      LEFT JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      LEFT JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN subjects sub ON co.subject_id = sub.subject_id
      WHERE cs.faculty_id = ? AND cs.status = 'SCHEDULED'
      ORDER BY cs.session_date ASC, cs.scheduled_start ASC
      LIMIT 5
      `,
      [facultyId],
    );

    // 4. Recently closed sessions
    const [recentSessions] = await pool.query(
      `
      SELECT
          cs.session_id,
          cs.session_date,
          cs.status,
          cs.closed_at,
          sub.subject_code,
          sub.name AS subject_name,
          sec.section_code,
          c.room_no,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = cs.session_id) AS total_attendance_marked
      FROM class_sessions cs
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      LEFT JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      LEFT JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN subjects sub ON co.subject_id = sub.subject_id
      WHERE cs.faculty_id = ? AND cs.status = 'CLOSED'
      ORDER BY cs.session_date DESC, cs.closed_at DESC
      LIMIT 5
      `,
      [facultyId],
    );

    // 5. Overall statistics
    const [statsRows] = await pool.query(
      `
      SELECT
          COUNT(DISTINCT cs.session_id) AS total_sessions,
          COUNT(DISTINCT CASE WHEN cs.status = 'CLOSED' THEN cs.session_id END) AS completed_sessions,
          COUNT(DISTINCT ar.attendance_id) AS total_records_marked,
          COUNT(DISTINCT CASE WHEN ar.status = 'PRESENT' THEN ar.attendance_id END) AS present_count
      FROM class_sessions cs
      LEFT JOIN attendance_records ar ON ar.session_id = cs.session_id
      WHERE cs.faculty_id = ?
      `,
      [facultyId],
    );

    const stats = statsRows[0] || {};
    const totalRecords = Number(stats.total_records_marked || 0);
    const presentCount = Number(stats.present_count || 0);
    const overallPercentage = totalRecords > 0 ? Number(((presentCount / totalRecords) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      message: "Faculty dashboard retrieved successfully",
      data: {
        faculty: {
          faculty_id: faculty.faculty_id,
          full_name: faculty.full_name,
          employee_code: faculty.employee_code,
          department_name: faculty.department_name,
          designation: faculty.designation,
        },
        today_timetable: todaySlots,
        active_sessions: activeSessions,
        upcoming_sessions: upcomingSessions,
        recent_sessions: recentSessions,
        metrics: {
          total_sessions: Number(stats.total_sessions || 0),
          completed_sessions: Number(stats.completed_sessions || 0),
          total_records_marked: totalRecords,
          present_count: presentCount,
          attendance_percentage: overallPercentage,
        },
      },
    });
  } catch (error) {
    console.error("Get faculty dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/faculty/timetable
 * Retrieves timetable slots assigned exclusively to the authenticated faculty member.
 */
const getMyFacultyTimetable = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const {
      day_of_week,
      classroom_id,
      section_id,
      subject_id,
      term_id,
      semester,
      academic_year_id,
    } = req.query;

    const effectiveTermId = term_id || semester;
    const conditions = ["ts.faculty_id = ?", "ts.is_active = 1"];
    const params = [faculty.faculty_id];

    if (day_of_week !== undefined && day_of_week !== "") {
      conditions.push("ts.day_of_week = ?");
      params.push(Number(day_of_week));
    }

    if (classroom_id) {
      conditions.push("ts.classroom_id = ?");
      params.push(Number(classroom_id));
    }

    if (section_id) {
      conditions.push("ts.section_id = ?");
      params.push(Number(section_id));
    }

    if (subject_id) {
      conditions.push("co.subject_id = ?");
      params.push(Number(subject_id));
    }

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [slots] = await pool.query(
      `
      SELECT
          ts.slot_id,
          ts.section_id,
          sec.section_code,
          co.offering_id,
          co.term_id,
          at.term_type,
          at.academic_year_id,
          ay.label AS academic_year_label,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          ts.faculty_id,
          f.full_name AS faculty_name,
          f.employee_code,
          ts.classroom_id,
          c.room_no,
          c.room_type,
          b.block_id,
          b.name AS block_name,
          b.code AS block_code,
          ts.day_of_week,
          ts.start_time,
          ts.end_time,
          ts.effective_from,
          ts.effective_to,
          ts.is_active,
          ts.created_at,
          ts.updated_at
      FROM timetable_slots ts
      JOIN faculty f ON ts.faculty_id = f.faculty_id
      JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN academic_terms at ON co.term_id = at.term_id
      LEFT JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN subjects sub ON co.subject_id = sub.subject_id
      LEFT JOIN classrooms c ON ts.classroom_id = c.classroom_id
      LEFT JOIN blocks b ON c.block_id = b.block_id
      ${whereClause}
      ORDER BY ts.day_of_week ASC, ts.start_time ASC, ts.slot_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Faculty timetable retrieved successfully",
      count: slots.length,
      data: slots,
    });
  } catch (error) {
    console.error("Get faculty timetable error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/faculty/courses
 * Retrieves courses/offerings coordinated by or taught by the authenticated faculty member.
 */
const getMyFacultyCourses = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const facultyId = faculty.faculty_id;
    const { term_id, semester, academic_year_id } = req.query;
    const effectiveTermId = term_id || semester;

    const conditions = ["(co.coordinator_faculty_id = ? OR ts.faculty_id = ?)"];
    const params = [facultyId, facultyId, facultyId];

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [courses] = await pool.query(
      `
      SELECT DISTINCT
          co.offering_id,
          co.term_id,
          at.term_type,
          at.start_date AS term_start_date,
          at.end_date AS term_end_date,
          ay.label AS academic_year_label,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          sub.credits,
          sub.delivery_type,
          CASE WHEN co.coordinator_faculty_id = ? THEN 1 ELSE 0 END AS is_coordinator,
          (SELECT COUNT(*) FROM sections s WHERE s.offering_id = co.offering_id) AS total_sections
      FROM course_offerings co
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      LEFT JOIN sections sec ON sec.offering_id = co.offering_id
      LEFT JOIN timetable_slots ts ON ts.section_id = sec.section_id AND ts.is_active = 1
      ${whereClause}
      ORDER BY sub.subject_code ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Faculty courses retrieved successfully",
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Get faculty courses error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/faculty/sections
 * Retrieves sections taught by or coordinated by the authenticated faculty member.
 */
const getMyFacultySections = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const facultyId = faculty.faculty_id;
    const { term_id, semester, academic_year_id } = req.query;
    const effectiveTermId = term_id || semester;

    const conditions = ["(ts.faculty_id = ? OR co.coordinator_faculty_id = ?)"];
    const params = [facultyId, facultyId];

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [sections] = await pool.query(
      `
      SELECT DISTINCT
          sec.section_id,
          sec.offering_id,
          co.term_id,
          at.term_type,
          ay.label AS academic_year_label,
          sec.section_code,
          sec.max_strength,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = sec.section_id) AS enrolled_students_count
      FROM sections sec
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN timetable_slots ts ON ts.section_id = sec.section_id AND ts.is_active = 1
      ${whereClause}
      ORDER BY sub.subject_code ASC, sec.section_code ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Faculty sections retrieved successfully",
      count: sections.length,
      data: sections,
    });
  } catch (error) {
    console.error("Get faculty sections error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/faculty/attendance/sessions
 * List attendance sessions belonging exclusively to the authenticated faculty member.
 */
const getMyFacultyAttendanceSessions = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const {
      session_date,
      status,
      slot_id,
      term_id,
      semester,
      academic_year_id,
    } = req.query;

    const effectiveTermId = term_id || semester;
    const conditions = ["cs.faculty_id = ?"];
    const params = [faculty.faculty_id];

    if (session_date) {
      conditions.push("cs.session_date = ?");
      params.push(session_date);
    }

    if (status) {
      conditions.push("cs.status = ?");
      params.push(status);
    }

    if (slot_id) {
      conditions.push("cs.slot_id = ?");
      params.push(Number(slot_id));
    }

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

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
          sec.section_code,
          co.term_id,
          at.term_type,
          ay.label AS academic_year_label,
          sub.name AS subject_name,
          sub.subject_code,
          cs.scheduled_start,
          cs.scheduled_end,
          cs.present_until,
          cs.late_until,
          cs.status,
          cs.opened_at,
          cs.closed_at,
          cs.closed_by_user,
          cs.cancel_reason,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = cs.session_id) AS total_marked,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = cs.session_id AND ar.status = 'PRESENT') AS present_count,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = cs.session_id AND ar.status = 'ABSENT') AS absent_count,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = cs.session_id AND ar.status = 'LATE') AS late_count,
          cs.created_at,
          cs.updated_at
      FROM class_sessions cs
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      LEFT JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      LEFT JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN academic_terms at ON co.term_id = at.term_id
      LEFT JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN subjects sub ON co.subject_id = sub.subject_id
      ${whereClause}
      ORDER BY cs.session_date DESC, cs.session_id DESC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Faculty attendance sessions retrieved successfully",
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    console.error("Get faculty attendance sessions error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/faculty/attendance/sessions/:id
 * Retrieve a single attendance session, enforcing faculty ownership.
 */
const getMyFacultyAttendanceSessionById = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

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
          sec.section_code,
          sub.name AS subject_name,
          sub.subject_code,
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

    const session = sessions[0];

    // Enforce faculty ownership
    if (session.faculty_id !== faculty.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access another faculty member's attendance session",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance session retrieved successfully",
      data: session,
    });
  } catch (error) {
    console.error("Get faculty session by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/faculty/attendance/sessions/:id/start
 * Starts an attendance session (SCHEDULED -> OPEN). Enforces faculty ownership.
 */
const startMyFacultyAttendanceSession = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const { id } = req.params;

    const [sessions] = await pool.query(
      "SELECT session_id, faculty_id, status FROM class_sessions WHERE session_id = ? LIMIT 1",
      [id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Ownership check
    if (session.faculty_id !== faculty.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to start another faculty member's session",
      });
    }

    if (session.status === "OPEN") {
      return res.status(400).json({
        success: false,
        message: "Attendance session is already OPEN",
      });
    }

    if (session.status === "CLOSED" || session.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: `Cannot start session with status ${session.status}`,
      });
    }

    await pool.query(
      `
      UPDATE class_sessions
      SET status = 'OPEN', opened_at = NOW(), updated_at = NOW()
      WHERE session_id = ?
      `,
      [id],
    );

    const [updatedRows] = await pool.query(
      "SELECT session_id, status, opened_at, updated_at FROM class_sessions WHERE session_id = ? LIMIT 1",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance session opened successfully",
      data: updatedRows[0],
    });
  } catch (error) {
    console.error("Start faculty session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/faculty/attendance/sessions/:id/finalize
 * Finalizes an attendance session (OPEN -> CLOSED). Enforces faculty ownership.
 */
const finalizeMyFacultyAttendanceSession = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const { id } = req.params;

    const [sessions] = await pool.query(
      "SELECT session_id, faculty_id, status FROM class_sessions WHERE session_id = ? LIMIT 1",
      [id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Ownership check
    if (session.faculty_id !== faculty.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to finalize another faculty member's session",
      });
    }

    if (session.status === "CLOSED") {
      return res.status(400).json({
        success: false,
        message: "Attendance session is already CLOSED",
      });
    }

    if (session.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Cannot finalize session with status ${session.status}`,
      });
    }

    await pool.query(
      `
      UPDATE class_sessions
      SET status = 'CLOSED', closed_at = NOW(), closed_by_user = ?, updated_at = NOW()
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

    const [updatedRows] = await pool.query(
      "SELECT session_id, status, closed_at, closed_by_user, updated_at FROM class_sessions WHERE session_id = ? LIMIT 1",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance session finalized successfully",
      data: updatedRows[0],
    });
  } catch (error) {
    console.error("Finalize faculty session error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/faculty/attendance/sessions/:sessionId/roster
 * Retrieves enrolled student roster and marking status. Enforces faculty ownership.
 */
const getMyFacultyAttendanceRoster = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const { sessionId } = req.params;

    const [sessions] = await pool.query(
      "SELECT session_id, slot_id, faculty_id, status FROM class_sessions WHERE session_id = ? LIMIT 1",
      [sessionId],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Ownership check
    if (session.faculty_id !== faculty.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view roster for another faculty member's session",
      });
    }

    const [roster] = await pool.query(
      `
      SELECT
          e.enrollment_id,
          s.student_id,
          s.register_no,
          s.full_name,
          s.email,
          COALESCE(ar.status, 'ABSENT') AS attendance_status,
          COALESCE(ar.status, 'ABSENT') AS status,
          ar.attendance_id,
          ar.source,
          ar.marked_at
      FROM timetable_slots ts
      JOIN enrollments e ON e.section_id = ts.section_id AND e.status = 'REGISTERED'
      JOIN students s ON s.student_id = e.student_id
      LEFT JOIN attendance_records ar ON ar.enrollment_id = e.enrollment_id AND ar.session_id = ?
      WHERE ts.slot_id = ?
      ORDER BY s.register_no ASC
      `,
      [sessionId, session.slot_id],
    );

    return res.status(200).json({
      success: true,
      message: "Session roster retrieved successfully",
      data: {
        session_id: session.session_id,
        session_status: session.status,
        total_enrolled: roster.length,
        roster,
        members: roster,
      },
    });
  } catch (error) {
    console.error("Get faculty roster error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/faculty/attendance/sessions/:sessionId/records
 * Marks manual attendance for a student in an open session. Enforces faculty ownership.
 */
const markMyFacultyAttendance = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const sessionIdParam = req.params.sessionId;
    const { session_id, student_id, enrollment_id, status } = req.body || {};
    const targetSessionId = sessionIdParam || session_id;

    if (!targetSessionId || (!student_id && !enrollment_id) || !status) {
      return res.status(400).json({
        success: false,
        message: "session_id, status, and either student_id or enrollment_id are required",
      });
    }

    if (!ALLOWED_ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${ALLOWED_ATTENDANCE_STATUSES.join(", ")}`,
      });
    }

    const [sessions] = await pool.query(
      "SELECT session_id, slot_id, faculty_id, status FROM class_sessions WHERE session_id = ? LIMIT 1",
      [targetSessionId],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Ownership check
    if (session.faculty_id !== faculty.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to mark attendance for another faculty member's session",
      });
    }

    if (session.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Cannot record attendance for session with status ${session.status}. Session must be OPEN`,
      });
    }

    // Resolve enrollment
    let enrollmentRows;
    if (enrollment_id) {
      [enrollmentRows] = await pool.query(
        `
        SELECT e.enrollment_id, e.student_id, s.register_no, s.full_name
        FROM enrollments e
        JOIN students s ON e.student_id = s.student_id
        WHERE e.enrollment_id = ? AND e.status = 'REGISTERED'
          AND e.section_id = (SELECT section_id FROM timetable_slots WHERE slot_id = ? LIMIT 1)
        LIMIT 1
        `,
        [Number(enrollment_id), session.slot_id],
      );
    } else {
      [enrollmentRows] = await pool.query(
        `
        SELECT e.enrollment_id, e.student_id, s.register_no, s.full_name
        FROM enrollments e
        JOIN students s ON e.student_id = s.student_id
        WHERE e.student_id = ? AND e.status = 'REGISTERED'
          AND e.section_id = (SELECT section_id FROM timetable_slots WHERE slot_id = ? LIMIT 1)
        LIMIT 1
        `,
        [Number(student_id), session.slot_id],
      );
    }

    if (enrollmentRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Student is not enrolled in the section scheduled for this session",
      });
    }

    const resolvedEnrollment = enrollmentRows[0];

    // Duplicate check
    const [existingRecord] = await pool.query(
      "SELECT attendance_id FROM attendance_records WHERE session_id = ? AND enrollment_id = ? LIMIT 1",
      [targetSessionId, resolvedEnrollment.enrollment_id],
    );

    if (existingRecord.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Attendance record already exists for this student in this session",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO attendance_records (session_id, enrollment_id, status, source, marked_at)
      VALUES (?, ?, ?, 'MANUAL', NOW())
      `,
      [targetSessionId, resolvedEnrollment.enrollment_id, status],
    );

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: {
        attendance_id: result.insertId,
        session_id: Number(targetSessionId),
        enrollment_id: resolvedEnrollment.enrollment_id,
        student_id: resolvedEnrollment.student_id,
        register_no: resolvedEnrollment.register_no,
        full_name: resolvedEnrollment.full_name,
        status,
        source: "MANUAL",
      },
    });
  } catch (error) {
    console.error("Mark faculty attendance error:", error);

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

/**
 * POST /api/v1/faculty/attendance/sessions
 * Creates a class session for an assigned timetable slot. Enforces faculty ownership.
 */
const createMyFacultyAttendanceSession = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found or account is not linked to a faculty member",
      });
    }

    const {
      slot_id,
      session_date,
      classroom_id,
      scheduled_start,
      scheduled_end,
      present_until,
      late_until,
    } = req.body || {};

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

    // Enforce faculty ownership of the slot
    if (slot.faculty_id !== faculty.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create a session for another faculty member's timetable slot",
      });
    }

    const resolvedClassroomId = classroom_id || slot.classroom_id;
    const resolvedScheduledStart = formatDateTime(session_date, scheduled_start || slot.start_time);
    const resolvedScheduledEnd = formatDateTime(session_date, scheduled_end || slot.end_time);
    const resolvedPresentUntil = present_until
      ? formatDateTime(session_date, present_until)
      : resolvedScheduledStart;
    const resolvedLateUntil = late_until
      ? formatDateTime(session_date, late_until)
      : resolvedScheduledEnd;

    // Prevent duplicate session for same slot and scheduled start time
    const [existingSession] = await pool.query(
      `
      SELECT session_id
      FROM class_sessions
      WHERE slot_id = ? AND scheduled_start = ?
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
        faculty.faculty_id,
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
        faculty_id: faculty.faculty_id,
        classroom_id: resolvedClassroomId,
        scheduled_start: resolvedScheduledStart,
        scheduled_end: resolvedScheduledEnd,
        present_until: resolvedPresentUntil,
        late_until: resolvedLateUntil,
        status: "SCHEDULED",
      },
    });
  } catch (error) {
    console.error("Create faculty session error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT/PATCH /api/v1/faculty/attendance/sessions/:sessionId/records/:recordId
 * or /api/v1/faculty/attendance/records/:recordId
 * Updates attendance for an enrolled student while the session is OPEN. Enforces faculty ownership.
 */
const updateMyFacultyAttendanceRecord = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const recordId = req.params.recordId || req.params.id;
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    if (!ALLOWED_ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${ALLOWED_ATTENDANCE_STATUSES.join(", ")}`,
      });
    }

    // Look up attendance record
    const [records] = await pool.query(
      `
      SELECT
        ar.attendance_id,
        ar.session_id,
        ar.enrollment_id,
        ar.status,
        cs.faculty_id,
        cs.status AS session_status,
        cs.slot_id,
        e.student_id,
        s.register_no,
        s.full_name
      FROM attendance_records ar
      JOIN class_sessions cs ON ar.session_id = cs.session_id
      JOIN enrollments e ON ar.enrollment_id = e.enrollment_id
      JOIN students s ON e.student_id = s.student_id
      WHERE ar.attendance_id = ?
      LIMIT 1
      `,
      [recordId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const record = records[0];

    // Ownership check
    if (record.faculty_id !== faculty.faculty_id) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update attendance for another faculty member's session",
      });
    }

    // Session status check: can only update when OPEN
    if (record.session_status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Cannot update attendance for session with status ${record.session_status}. Attendance can only be updated while the session is OPEN`,
      });
    }

    await pool.query(
      `
      UPDATE attendance_records
      SET status = ?, source = 'MANUAL', marked_at = NOW()
      WHERE attendance_id = ?
      `,
      [status, recordId],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance record updated successfully",
      data: {
        attendance_id: Number(recordId),
        session_id: record.session_id,
        enrollment_id: record.enrollment_id,
        student_id: record.student_id,
        register_no: record.register_no,
        full_name: record.full_name,
        status,
        source: "MANUAL",
      },
    });
  } catch (error) {
    console.error("Update faculty attendance error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Attendance corrections and overrides are strictly prohibited for faculty.
 * Restricted exclusively to administrators.
 */
const overrideMyFacultyAttendanceRecord = async (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      "Faculty members are not permitted to access, create, or modify attendance corrections. Attendance corrections are restricted to administrators.",
  });
};

/**
 * GET /api/v1/faculty/attendance/summary
 * Aggregated attendance summary across all sessions conducted by this faculty member.
 */
const getMyFacultyAttendanceSummary = async (req, res) => {
  try {
    const faculty = await resolveFacultyRecord(req.user);

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty profile not found",
      });
    }

    const facultyId = faculty.faculty_id;
    const { term_id, semester, academic_year_id } = req.query;
    const effectiveTermId = term_id || semester;

    const conditions = ["cs.faculty_id = ?"];
    const params = [facultyId];

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [summaryRows] = await pool.query(
      `
      SELECT
          COUNT(DISTINCT cs.session_id) AS total_sessions,
          COUNT(DISTINCT CASE WHEN cs.status = 'CLOSED' THEN cs.session_id END) AS completed_sessions,
          COUNT(DISTINCT ar.attendance_id) AS total_attendance_instances,
          COUNT(DISTINCT CASE WHEN ar.status = 'PRESENT' THEN ar.attendance_id END) AS present_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'LATE' THEN ar.attendance_id END) AS late_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'ABSENT' THEN ar.attendance_id END) AS absent_count
      FROM class_sessions cs
      LEFT JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      LEFT JOIN sections sec ON ts.section_id = sec.section_id
      LEFT JOIN course_offerings co ON sec.offering_id = co.offering_id
      LEFT JOIN academic_terms at ON co.term_id = at.term_id
      LEFT JOIN attendance_records ar ON ar.session_id = cs.session_id
      ${whereClause}
      `,
      params,
    );

    const s = summaryRows[0] || {};
    const totalAttendance = Number(s.total_attendance_instances || 0);
    const presentCount = Number(s.present_count || 0);
    const lateCount = Number(s.late_count || 0);
    const absentCount = Number(s.absent_count || 0);
    const attendancePct = totalAttendance > 0 ? Number(((presentCount / totalAttendance) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      message: "Faculty attendance summary retrieved successfully",
      data: {
        faculty_id: faculty.faculty_id,
        full_name: faculty.full_name,
        employee_code: faculty.employee_code,
        summary: {
          total_sessions: Number(s.total_sessions || 0),
          completed_sessions: Number(s.completed_sessions || 0),
          total_attendance_instances: totalAttendance,
          present_count: presentCount,
          late_count: lateCount,
          absent_count: absentCount,
          attendance_percentage: attendancePct,
          overall_attendance_percentage: attendancePct,
        },
      },
    });
  } catch (error) {
    console.error("Get faculty attendance summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  resolveFacultyRecord,
  getMyFacultyProfile,
  getFacultyDashboard,
  getMyFacultyTimetable,
  getMyFacultyCourses,
  getMyFacultySections,
  getMyFacultyAttendanceSessions,
  getMyFacultyAttendanceSessionById,
  createMyFacultyAttendanceSession,
  startMyFacultyAttendanceSession,
  finalizeMyFacultyAttendanceSession,
  getMyFacultyAttendanceRoster,
  markMyFacultyAttendance,
  updateMyFacultyAttendanceRecord,
  overrideMyFacultyAttendanceRecord,
  getMyFacultyAttendanceSummary,
};
