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

module.exports = {
  getDashboardStats,
};
