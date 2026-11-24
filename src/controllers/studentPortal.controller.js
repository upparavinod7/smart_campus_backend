const pool = require("../config/mysql");

// GET /api/v1/student-portal/me
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [rows] = await pool.query(
      `
      SELECT
        s.student_id,
        s.register_no,
        s.full_name,
        s.gender,
        s.date_of_birth,
        s.blood_group,
        s.email,
        s.phone,
        s.profile_image,
        s.status AS student_status,

        b.batch_id,
        b.label AS batch_label,

        p.programme_id,
        p.programme_code,
        p.name AS programme_name,
        p.duration_years,

        dept.name AS department_name,

        d.degree_id,
        d.code AS degree_code,
        d.name AS degree_name,
        d.level AS degree_level,

        ay.academic_year_id,
        ay.label AS academic_year_label,
        ay.start_date AS academic_year_start,
        ay.end_date AS academic_year_end,

        (
          SELECT sec.section_code
          FROM enrollments e
          JOIN sections sec ON sec.section_id = e.section_id
          WHERE e.student_id = s.student_id
          LIMIT 1
        ) AS section_code

      FROM users u
      INNER JOIN students s
        ON s.student_id = u.student_id
      LEFT JOIN batches b
        ON b.batch_id = s.batch_id
      LEFT JOIN programmes p
        ON p.programme_id = b.programme_id
      LEFT JOIN departments dept
        ON dept.department_id = p.department_id
      LEFT JOIN degrees d
        ON d.degree_id = p.degree_id
      LEFT JOIN academic_years ay
        ON ay.academic_year_id = b.start_year_id

      WHERE u.user_id = ?
        AND u.role = 'STUDENT'
        AND u.is_active = 1

      LIMIT 1
      `,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Student profile not found or no student record is linked to this account",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student profile retrieved successfully",
      data: rows[0],
    });
  } catch (error) {
    console.error("Get student profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/v1/student-portal/me/attendance
const getMyAttendance = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { term_id, semester, academic_year_id, subject_id } = req.query;
    const effectiveTermId = term_id || semester;

    const conditions = [
      "u.user_id = ?",
      "u.role = 'STUDENT'",
      "u.is_active = 1",
    ];
    const params = [userId];

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    if (subject_id) {
      conditions.push("co.subject_id = ?");
      params.push(Number(subject_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.query(
      `
      SELECT
        ar.attendance_id,
        cs.session_id,
        sub.subject_code,
        sub.name AS subject_name,
        co.term_id,
        at.term_type,
        ay.academic_year_id,
        ay.label AS academic_year_label,
        cs.session_date,
        ar.status,
        ar.source,
        ar.marked_at

      FROM users u
      JOIN enrollments e
        ON e.student_id = u.student_id
      JOIN attendance_records ar
        ON ar.enrollment_id = e.enrollment_id
      JOIN class_sessions cs
        ON cs.session_id = ar.session_id
      JOIN timetable_slots ts
        ON ts.slot_id = cs.slot_id
      JOIN sections sec
        ON sec.section_id = ts.section_id
      LEFT JOIN course_offerings co
        ON co.offering_id = sec.offering_id
      LEFT JOIN academic_terms at
        ON co.term_id = at.term_id
      LEFT JOIN academic_years ay
        ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN subjects sub
        ON sub.subject_id = co.subject_id

      ${whereClause}

      ORDER BY cs.session_date DESC, ar.marked_at DESC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Student attendance retrieved successfully",
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get student attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve student attendance",
    });
  }
};

// GET /api/v1/student-portal/me/attendance/summary
const getMyAttendanceSummary = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { term_id, semester, academic_year_id } = req.query;
    const effectiveTermId = term_id || semester;

    const conditions = [
      "u.user_id = ?",
      "u.role = 'STUDENT'",
      "u.is_active = 1",
    ];
    const params = [userId];

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.query(
      `
      SELECT
        sub.subject_id,
        sub.subject_code,
        sub.name AS subject_name,
        co.term_id,
        at.term_type,

        COUNT(ar.attendance_id) AS total_classes,

        SUM(
          CASE
            WHEN ar.status IN ('PRESENT', 'LATE')
            THEN 1 ELSE 0
          END
        ) AS attended_classes,

        SUM(
          CASE
            WHEN ar.status = 'ABSENT'
            THEN 1 ELSE 0
          END
        ) AS absent_classes,

        ROUND(
          100.0 * SUM(
            CASE
              WHEN ar.status IN ('PRESENT', 'LATE')
              THEN 1 ELSE 0
            END
          ) / NULLIF(COUNT(ar.attendance_id), 0),
          2
        ) AS attendance_percentage

      FROM users u
      JOIN enrollments e
        ON e.student_id = u.student_id
      JOIN attendance_records ar
        ON ar.enrollment_id = e.enrollment_id
      JOIN class_sessions cs
        ON cs.session_id = ar.session_id
      JOIN timetable_slots ts
        ON ts.slot_id = cs.slot_id
      JOIN sections sec
        ON sec.section_id = ts.section_id
      LEFT JOIN course_offerings co
        ON co.offering_id = sec.offering_id
      LEFT JOIN academic_terms at
        ON co.term_id = at.term_id
      LEFT JOIN academic_years ay
        ON at.academic_year_id = ay.academic_year_id
      LEFT JOIN subjects sub
        ON sub.subject_id = co.subject_id

      ${whereClause}

      GROUP BY
        sub.subject_id,
        sub.subject_code,
        sub.name,
        co.term_id,
        at.term_type

      ORDER BY sub.subject_code
      `,
      params,
    );

    const data = rows.map((row) => ({
      ...row,
      total_classes: Number(row.total_classes),
      attended_classes: Number(row.attended_classes),
      absent_classes: Number(row.absent_classes),
      attendance_percentage:
        row.attendance_percentage === null
          ? null
          : Number(row.attendance_percentage),
    }));

    return res.status(200).json({
      success: true,
      message: "Attendance summary retrieved successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Get attendance summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve attendance summary",
    });
  }
};

// GET /api/v1/student-portal/me/dashboard
const getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { term_id, semester } = req.query;
    const effectiveTermId = term_id || semester;

    const overallQuery = effectiveTermId
      ? `
        SELECT
          COUNT(ar.attendance_id) AS total_classes,
          COALESCE(SUM(CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END), 0) AS attended_classes,
          COALESCE(SUM(CASE WHEN ar.status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS absent_classes,
          COALESCE(
            ROUND(100.0 * SUM(CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) / NULLIF(COUNT(ar.attendance_id), 0), 2),
            0
          ) AS attendance_percentage
        FROM users u
        JOIN enrollments e ON e.student_id = u.student_id
        JOIN sections sec ON sec.section_id = e.section_id
        JOIN course_offerings co ON co.offering_id = sec.offering_id
        JOIN attendance_records ar ON ar.enrollment_id = e.enrollment_id
        WHERE u.user_id = ? AND u.role = 'STUDENT' AND u.is_active = 1 AND co.term_id = ?
        `
      : `
        SELECT
          COUNT(ar.attendance_id) AS total_classes,
          COALESCE(SUM(CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END), 0) AS attended_classes,
          COALESCE(SUM(CASE WHEN ar.status = 'ABSENT' THEN 1 ELSE 0 END), 0) AS absent_classes,
          COALESCE(
            ROUND(100.0 * SUM(CASE WHEN ar.status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) / NULLIF(COUNT(ar.attendance_id), 0), 2),
            0
          ) AS attendance_percentage
        FROM users u
        JOIN enrollments e ON e.student_id = u.student_id
        JOIN attendance_records ar ON ar.enrollment_id = e.enrollment_id
        WHERE u.user_id = ? AND u.role = 'STUDENT' AND u.is_active = 1
        `;

    const overallParams = effectiveTermId ? [userId, Number(effectiveTermId)] : [userId];

    const subjectQuery = `
      SELECT
        sub.subject_id,
        sub.subject_code,
        sub.name AS subject_name,
        co.term_id,

        COUNT(ar.attendance_id) AS total_classes,

        SUM(
          CASE
            WHEN ar.status IN ('PRESENT', 'LATE')
            THEN 1 ELSE 0
          END
        ) AS attended_classes,

        SUM(
          CASE
            WHEN ar.status = 'ABSENT'
            THEN 1 ELSE 0
          END
        ) AS absent_classes,

        ROUND(
          100.0 * SUM(
            CASE
              WHEN ar.status IN ('PRESENT', 'LATE')
              THEN 1 ELSE 0
            END
          ) / NULLIF(COUNT(ar.attendance_id), 0),
          2
        ) AS attendance_percentage

      FROM users u
      JOIN enrollments e ON e.student_id = u.student_id
      JOIN attendance_records ar ON ar.enrollment_id = e.enrollment_id
      JOIN class_sessions cs ON cs.session_id = ar.session_id
      JOIN timetable_slots ts ON ts.slot_id = cs.slot_id
      JOIN sections sec ON sec.section_id = ts.section_id
      JOIN course_offerings co ON co.offering_id = sec.offering_id
      JOIN subjects sub ON sub.subject_id = co.subject_id

      WHERE u.user_id = ?
        AND u.role = 'STUDENT'
        AND u.is_active = 1
        ${effectiveTermId ? "AND co.term_id = ?" : ""}

      GROUP BY
        sub.subject_id,
        sub.subject_code,
        sub.name,
        co.term_id

      ORDER BY sub.subject_code
    `;

    const subjectParams = effectiveTermId ? [userId, Number(effectiveTermId)] : [userId];

    const [profileResult, overallResult, subjectResult] = await Promise.all([
      // 1. Student profile
      pool.execute(
        `
          SELECT
            s.student_id,
            s.register_no,
            s.full_name,
            s.email,
            s.phone,
            s.profile_image,
            s.status AS student_status,
            b.batch_id,
            b.label AS batch_label,
            p.programme_code,
            p.name AS programme_name,
            d.name AS degree_name,
            ay.label AS academic_year_label

          FROM users u
          JOIN students s
            ON s.student_id = u.student_id
          LEFT JOIN batches b
            ON b.batch_id = s.batch_id
          LEFT JOIN programmes p
            ON p.programme_id = b.programme_id
          LEFT JOIN degrees d
            ON d.degree_id = p.degree_id
          LEFT JOIN academic_years ay
            ON ay.academic_year_id = b.start_year_id

          WHERE u.user_id = ?
            AND u.role = 'STUDENT'
            AND u.is_active = 1

          LIMIT 1
          `,
        [userId],
      ),

      // 2. Overall attendance
      pool.query(overallQuery, overallParams),

      // 3. Subject-wise attendance
      pool.query(subjectQuery, subjectParams),
    ]);

    const [profiles] = profileResult;
    const [overallRows] = overallResult;
    const [subjects] = subjectResult;

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found or account is not linked",
      });
    }

    const stats = overallRows[0] || {};

    const subjectWiseAttendance = subjects.map((subject) => ({
      ...subject,
      total_classes: Number(subject.total_classes),
      attended_classes: Number(subject.attended_classes),
      absent_classes: Number(subject.absent_classes),
      attendance_percentage:
        subject.attendance_percentage === null
          ? null
          : Number(subject.attendance_percentage),
    }));

    return res.status(200).json({
      success: true,
      message: "Student dashboard retrieved successfully",
      data: {
        profile: profiles[0],
        attendance: {
          total_classes: Number(stats.total_classes || 0),
          attended_classes: Number(stats.attended_classes || 0),
          absent_classes: Number(stats.absent_classes || 0),
          attendance_percentage: Number(stats.attendance_percentage || 0),
        },
        subject_wise_attendance: subjectWiseAttendance,
      },
    });
  } catch (error) {
    console.error("Get student dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve student dashboard",
    });
  }
};

const getMyTimetable = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { term_id, semester, term_type, academic_year_id, day_of_week } = req.query;

    const conditions = [
      "u.user_id = ?",
      "u.role = 'STUDENT'",
      "u.is_active = 1",
      "e.status = 'REGISTERED'",
      "ts.is_active = 1",
    ];
    const params = [userId];

    if (term_id) {
      conditions.push("co.term_id = ?");
      params.push(Number(term_id));
    }

    if (term_type) {
      conditions.push("at.term_type = ?");
      params.push(String(term_type).toUpperCase());
    }

    if (semester) {
      conditions.push("ps.semester_no = ?");
      params.push(Number(semester));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    if (day_of_week !== undefined && day_of_week !== "") {
      conditions.push("ts.day_of_week = ?");
      params.push(Number(day_of_week));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [timetable] = await pool.query(
      `
      SELECT
        ts.slot_id,
        ts.day_of_week,
        ts.start_time,
        ts.end_time,
        ts.effective_from,
        ts.effective_to,

        sub.subject_id,
        sub.subject_code,
        sub.name AS subject_name,
        sub.delivery_type,

        co.offering_id,
        co.term_id,
        at.term_type,
        at.academic_year_id,
        ay.label AS academic_year_label,

        ps.semester_no AS semester,
        ps.year_no AS year,

        sec.section_id,
        sec.section_code,

        f.full_name AS faculty_name,
        c.room_no AS classroom,

        e.status AS enrollment_status

      FROM users u

      JOIN enrollments e
        ON e.student_id = u.student_id

      JOIN sections sec
        ON sec.section_id = e.section_id

      LEFT JOIN course_offerings co
        ON co.offering_id = sec.offering_id

      LEFT JOIN academic_terms at
        ON co.term_id = at.term_id

      LEFT JOIN academic_years ay
        ON at.academic_year_id = ay.academic_year_id

      LEFT JOIN subjects sub
        ON sub.subject_id = co.subject_id

      LEFT JOIN (
        SELECT subject_id, MIN(semester_no) AS semester_no, MIN(year_no) AS year_no
        FROM programme_subjects
        GROUP BY subject_id
      ) ps ON co.subject_id = ps.subject_id

      JOIN timetable_slots ts
        ON ts.section_id = sec.section_id

      LEFT JOIN faculty f
        ON f.faculty_id = ts.faculty_id

      LEFT JOIN classrooms c
        ON c.classroom_id = ts.classroom_id

      ${whereClause}

      ORDER BY
        ts.day_of_week ASC,
        ts.start_time ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Student timetable retrieved successfully",
      count: timetable.length,
      data: timetable,
    });
  } catch (error) {
    console.error("Get student timetable error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve student timetable",
    });
  }
};

const getMyCourses = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { term_id, semester, term_type, academic_year_id } = req.query;

    const conditions = [
      "u.user_id = ?",
      "u.role = 'STUDENT'",
      "u.is_active = 1",
      "e.status = 'REGISTERED'",
    ];
    const params = [userId];

    if (term_id) {
      conditions.push("co.term_id = ?");
      params.push(Number(term_id));
    }

    if (term_type) {
      conditions.push("at.term_type = ?");
      params.push(String(term_type).toUpperCase());
    }

    if (semester) {
      conditions.push("ps.semester_no = ?");
      params.push(Number(semester));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [courses] = await pool.query(
      `
      SELECT
        e.enrollment_id,
        e.registration_type,
        e.status AS enrollment_status,
        e.registered_on,

        sub.subject_id,
        sub.subject_code,
        sub.name AS subject_name,
        sub.credits,
        sub.delivery_type,

        co.offering_id,
        co.term_id,
        at.term_type,
        at.academic_year_id,
        ay.label AS academic_year_label,

        ps.semester_no AS semester,
        ps.year_no AS year,

        sec.section_id,
        sec.section_code

      FROM users u

      JOIN enrollments e
        ON e.student_id = u.student_id

      JOIN sections sec
        ON sec.section_id = e.section_id

      LEFT JOIN course_offerings co
        ON co.offering_id = sec.offering_id

      LEFT JOIN academic_terms at
        ON co.term_id = at.term_id

      LEFT JOIN academic_years ay
        ON at.academic_year_id = ay.academic_year_id

      LEFT JOIN subjects sub
        ON sub.subject_id = co.subject_id

      LEFT JOIN (
        SELECT subject_id, MIN(semester_no) AS semester_no, MIN(year_no) AS year_no
        FROM programme_subjects
        GROUP BY subject_id
      ) ps ON co.subject_id = ps.subject_id

      ${whereClause}

      ORDER BY sub.subject_code ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Student courses retrieved successfully",
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Get student courses error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve student courses",
    });
  }
};
module.exports = {
  getMyProfile,
  getMyAttendance,
  getMyAttendanceSummary,
  getStudentDashboard,
  getMyTimetable,
  getMyCourses,
};
