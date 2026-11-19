const pool = require("../config/mysql");

/**
 * GET /api/v1/admin/dashboard-stats
 * Aggregates real-time campus statistics for administrative dashboards
 * Permitted role: ADMIN
 */
const getDashboardStats = async (req, res) => {
  try {
    const [
      studentsResult,
      facultyResult,
      departmentsResult,
      blocksResult,
      classroomsResult,
      sessionsResult,
      studentStatusResult,
      todayAttendanceResult,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM students"),
      pool.query("SELECT COUNT(*) AS count FROM faculty WHERE is_active = 1"),
      pool.query("SELECT COUNT(*) AS count FROM departments WHERE is_active = 1"),
      pool.query("SELECT COUNT(*) AS count FROM blocks WHERE is_active = 1"),
      pool.query("SELECT COUNT(*) AS count FROM classrooms WHERE is_active = 1"),
      pool.query(
        "SELECT COUNT(*) AS count FROM class_sessions WHERE status IN ('OPEN', 'SCHEDULED')",
      ),
      pool.query(
        "SELECT status, COUNT(*) AS count FROM students GROUP BY status",
      ),
      pool.query(
        "SELECT COUNT(*) AS count FROM attendance_records WHERE DATE(marked_at) = CURDATE()",
      ),
    ]);

    const stats = {
      students_count: Number(studentsResult[0][0]?.count || 0),
      faculty_count: Number(facultyResult[0][0]?.count || 0),
      departments_count: Number(departmentsResult[0][0]?.count || 0),
      blocks_count: Number(blocksResult[0][0]?.count || 0),
      classrooms_count: Number(classroomsResult[0][0]?.count || 0),
      active_sessions_count: Number(sessionsResult[0][0]?.count || 0),
      today_attendance_count: Number(todayAttendanceResult[0][0]?.count || 0),
      student_breakdown: studentStatusResult[0] || [],
    };

    return res.status(200).json({
      success: true,
      message: "Admin dashboard statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Get admin dashboard stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching dashboard statistics",
    });
  }
};

/**
 * GET /api/v1/admin/reports/attendance
 * Aggregates attendance statistics across semesters, terms, departments, programmes, batches, sections, and subjects.
 * Permitted role: ADMIN
 */
const getAttendanceReport = async (req, res) => {
  try {
    const {
      school_id,
      department_id,
      programme_id,
      batch_id,
      section_id,
      subject_id,
      faculty_id,
      term_id,
      semester,
      academic_year_id,
      start_date,
      end_date,
    } = req.query;

    let enforcedDepartmentId = department_id;

    // HOD Scoping & Cross-Department Isolation
    if (req.user && req.user.role === "FACULTY") {
      const [facRows] = await pool.query(
        `SELECT f.faculty_id, f.department_id, d.name AS designation_name, f.employee_code
         FROM faculty f
         LEFT JOIN designations d ON f.designation_id = d.designation_id
         WHERE f.faculty_id = ? OR f.email = ? LIMIT 1`,
        [req.user.faculty_id || 0, req.user.email || ""]
      );

      if (facRows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Faculty profile not found.",
        });
      }

      const fac = facRows[0];
      const isHOD = Boolean(
        (fac.designation_name && (fac.designation_name.includes("Head of Department") || fac.designation_name.includes("HOD"))) ||
        (fac.employee_code && fac.employee_code.toUpperCase().includes("HOD")) ||
        (req.user.username && req.user.username.toUpperCase().includes("HOD"))
      );

      if (!isHOD) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only Administrators and Department Heads are authorized to view institutional attendance reports.",
        });
      }

      // If HOD explicitly requested another department, reject with 403
      if (department_id && Number(department_id) !== Number(fac.department_id)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. HOD is only authorized to view attendance records for their own department.",
        });
      }

      enforcedDepartmentId = fac.department_id;
    }

    const effectiveTermId = term_id || semester;
    const conditions = [];
    const params = [];

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    if (section_id) {
      conditions.push("sec.section_id = ?");
      params.push(Number(section_id));
    }

    if (subject_id) {
      conditions.push("co.subject_id = ?");
      params.push(Number(subject_id));
    }

    if (batch_id) {
      conditions.push("sec.batch_id = ?");
      params.push(Number(batch_id));
    }

    if (programme_id) {
      conditions.push("bt.programme_id = ?");
      params.push(Number(programme_id));
    }

    if (school_id) {
      conditions.push("p.school_id = ?");
      params.push(Number(school_id));
    }

    if (faculty_id) {
      conditions.push("(cs.faculty_id = ? OR ts.faculty_id = ?)");
      params.push(Number(faculty_id), Number(faculty_id));
    }

    if (enforcedDepartmentId) {
      conditions.push("p.department_id = ?");
      params.push(Number(enforcedDepartmentId));
    }

    if (start_date) {
      conditions.push("cs.session_date >= ?");
      params.push(start_date);
    }

    if (end_date) {
      conditions.push("cs.session_date <= ?");
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. Overall Aggregation
    const [overallRows] = await pool.query(
      `
      SELECT
          COUNT(DISTINCT cs.session_id) AS total_sessions,
          COUNT(DISTINCT CASE WHEN cs.status = 'CLOSED' THEN cs.session_id END) AS completed_sessions,
          COUNT(DISTINCT CASE WHEN cs.status = 'CANCELLED' THEN cs.session_id END) AS cancelled_sessions,
          COUNT(DISTINCT CASE WHEN cs.status = 'OPEN' THEN cs.session_id END) AS open_sessions,
          COUNT(DISTINCT ar.attendance_id) AS total_attendance_instances,
          COUNT(DISTINCT CASE WHEN ar.status = 'PRESENT' THEN ar.attendance_id END) AS present_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'LATE' THEN ar.attendance_id END) AS late_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'ABSENT' THEN ar.attendance_id END) AS absent_count
      FROM class_sessions cs
      JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      LEFT JOIN attendance_records ar ON ar.session_id = cs.session_id
      ${whereClause}
      `,
      params,
    );

    const s = overallRows[0] || {};
    const totalRecords = Number(s.total_attendance_instances || 0);
    const presentCount = Number(s.present_count || 0);
    const lateCount = Number(s.late_count || 0);
    const absentCount = Number(s.absent_count || 0);
    const attendedCount = presentCount + lateCount;
    const attendancePercentage = totalRecords > 0
      ? Number(((attendedCount / totalRecords) * 100).toFixed(2))
      : 0;

    // 2. Section Breakdown
    const [breakdownRows] = await pool.query(
      `
      SELECT
          sec.section_id,
          sec.section_code,
          sub.subject_id,
          sub.subject_code,
          sub.name AS subject_name,
          co.term_id,
          at.term_type,
          ay.label AS academic_year_label,
          bt.label AS batch_label,
          p.name AS programme_name,
          (
            SELECT COUNT(DISTINCT e.student_id)
            FROM enrollments e
            WHERE e.section_id = sec.section_id AND e.status = 'REGISTERED'
          ) AS total_enrolled,
          COUNT(DISTINCT cs.session_id) AS total_sessions,
          COUNT(DISTINCT CASE WHEN cs.status = 'CLOSED' THEN cs.session_id END) AS completed_sessions,
          COUNT(DISTINCT ar.attendance_id) AS total_marked,
          COUNT(DISTINCT CASE WHEN ar.status = 'PRESENT' THEN ar.attendance_id END) AS present_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'LATE' THEN ar.attendance_id END) AS late_count,
          COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN ar.attendance_id END) AS attended_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'ABSENT' THEN ar.attendance_id END) AS absent_count,
          GREATEST(
            0,
            ((SELECT COUNT(DISTINCT e.student_id) FROM enrollments e WHERE e.section_id = sec.section_id AND e.status = 'REGISTERED') * COUNT(DISTINCT CASE WHEN cs.status = 'CLOSED' THEN cs.session_id END)) - COUNT(DISTINCT ar.attendance_id)
          ) AS unmarked_count,
          ROUND(
            100.0 * COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN ar.attendance_id END)
            / NULLIF(COUNT(DISTINCT ar.attendance_id), 0),
            2
          ) AS section_attendance_percentage
      FROM class_sessions cs
      JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      LEFT JOIN attendance_records ar ON ar.session_id = cs.session_id
      ${whereClause}
      GROUP BY sec.section_id, sub.subject_id, co.term_id, at.term_type, ay.label, bt.label, p.name
      ORDER BY sub.subject_code ASC, sec.section_code ASC
      `,
      params,
    );

    // 3. Session Breakdown
    const [sessionRows] = await pool.query(
      `
      SELECT
          cs.session_id,
          cs.session_date,
          cs.scheduled_start,
          cs.scheduled_end,
          cs.status AS session_status,
          sec.section_id,
          sec.section_code,
          sub.subject_code,
          sub.name AS subject_name,
          f.faculty_id,
          f.full_name AS faculty_name,
          c.room_no,
          (
            SELECT COUNT(DISTINCT e.student_id)
            FROM enrollments e
            WHERE e.section_id = sec.section_id AND e.status = 'REGISTERED'
          ) AS total_enrolled,
          COUNT(DISTINCT CASE WHEN ar.status = 'PRESENT' THEN ar.attendance_id END) AS present_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'LATE' THEN ar.attendance_id END) AS late_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'ABSENT' THEN ar.attendance_id END) AS absent_count,
          COUNT(DISTINCT ar.attendance_id) AS total_marked,
          GREATEST(
            0,
            (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e WHERE e.section_id = sec.section_id AND e.status = 'REGISTERED') - COUNT(DISTINCT ar.attendance_id)
          ) AS unmarked_count,
          ROUND(
            100.0 * COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN ar.attendance_id END)
            / NULLIF(COUNT(DISTINCT ar.attendance_id), 0),
            2
          ) AS attendance_percentage
      FROM class_sessions cs
      JOIN timetable_slots ts ON cs.slot_id = ts.slot_id
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      LEFT JOIN faculty f ON cs.faculty_id = f.faculty_id
      LEFT JOIN classrooms c ON cs.classroom_id = c.classroom_id
      LEFT JOIN attendance_records ar ON ar.session_id = cs.session_id
      ${whereClause}
      GROUP BY cs.session_id, cs.session_date, cs.scheduled_start, cs.scheduled_end, cs.status, sec.section_id, sec.section_code, sub.subject_code, sub.name, f.faculty_id, f.full_name, c.room_no
      ORDER BY cs.session_date DESC, cs.session_id DESC
      LIMIT 100
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Attendance report retrieved successfully",
      data: {
        summary: {
          total_sessions: Number(s.total_sessions || 0),
          completed_sessions: Number(s.completed_sessions || 0),
          cancelled_sessions: Number(s.cancelled_sessions || 0),
          open_sessions: Number(s.open_sessions || 0),
          total_attendance_records: totalRecords,
          present_count: presentCount,
          late_count: lateCount,
          absent_count: absentCount,
          overall_attendance_percentage: attendancePercentage,
        },
        sections_breakdown: breakdownRows.map((r) => ({
          ...r,
          total_enrolled: Number(r.total_enrolled || 0),
          total_sessions: Number(r.total_sessions),
          completed_sessions: Number(r.completed_sessions),
          total_marked: Number(r.total_marked),
          present_count: Number(r.present_count || 0),
          late_count: Number(r.late_count || 0),
          attended_count: Number(r.attended_count),
          absent_count: Number(r.absent_count),
          unmarked_count: Number(r.unmarked_count || 0),
          section_attendance_percentage: r.section_attendance_percentage !== null
            ? Number(r.section_attendance_percentage)
            : null,
        })),
        sessions_breakdown: sessionRows.map((r) => ({
          ...r,
          total_enrolled: Number(r.total_enrolled || 0),
          present_count: Number(r.present_count || 0),
          late_count: Number(r.late_count || 0),
          absent_count: Number(r.absent_count || 0),
          total_marked: Number(r.total_marked || 0),
          unmarked_count: Number(r.unmarked_count || 0),
          attendance_percentage: r.attendance_percentage !== null
            ? Number(r.attendance_percentage)
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("Get attendance report error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getDashboardStats,
  getAttendanceReport,
};
