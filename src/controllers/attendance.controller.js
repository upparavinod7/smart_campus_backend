const pool = require("../config/mysql");
const { resolveFacultyRecord } = require("./facultyPortal.controller");

const createAttendance = async (req, res) => {
  try {
    const { session_id, enrollment_id, status } = req.body;

    // Validate required fields
    if (!session_id || !enrollment_id || !status) {
      return res.status(400).json({
        success: false,
        message: "session_id, enrollment_id and status are required",
      });
    }

    // Validate attendance status
    const allowedStatuses = ["PRESENT", "LATE", "ABSENT"];

    if (!allowedStatuses.includes(status)) {
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
      [session_id],
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance session not found",
      });
    }

    const session = sessions[0];

    // Ownership check if caller is FACULTY
    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec || session.faculty_id !== facultyRec.faculty_id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to mark attendance for another faculty member's session",
        });
      }
    }

    // Attendance can only be marked
    // while the session is OPEN
    if (session.session_status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Attendance cannot be marked because the session is ${session.session_status}`,
      });
    }

    // Check whether the enrollment belongs
    // to the section associated with this session
    const [enrollments] = await pool.query(
      `
            SELECT
                e.enrollment_id,
                e.student_id,
                e.section_id,
                e.status AS enrollment_status,
                s.register_no,
                s.full_name
            FROM enrollments e

            INNER JOIN students s
                ON s.student_id = e.student_id

            INNER JOIN timetable_slots ts
                ON ts.section_id = e.section_id

            WHERE e.enrollment_id = ?
              AND ts.slot_id = ?

            LIMIT 1
            `,
      [enrollment_id, session.slot_id],
    );

    if (enrollments.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Student enrollment does not belong to this attendance session",
      });
    }

    const enrollment = enrollments[0];

    // Make sure the student is currently registered
    if (enrollment.enrollment_status !== "REGISTERED") {
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
      [session_id, enrollment_id],
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
      [session_id, enrollment_id, status],
    );

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: {
        attendance_id: result.insertId,
        session_id: Number(session_id),
        enrollment_id: Number(enrollment_id),
        student_id: enrollment.student_id,
        register_no: enrollment.register_no,
        full_name: enrollment.full_name,
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

const getAttendanceRecords = async (req, res) => {
  try {
    if (req.user && req.user.role === "STUDENT") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Students are not authorized to view global attendance records.",
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

            INNER JOIN enrollments e
                ON e.enrollment_id = ar.enrollment_id

            INNER JOIN students s
                ON s.student_id = e.student_id

            INNER JOIN class_sessions cs
                ON cs.session_id = ar.session_id

            INNER JOIN faculty f
                ON f.faculty_id = cs.faculty_id

            INNER JOIN classrooms c
                ON c.classroom_id = cs.classroom_id

            ORDER BY ar.attendance_id
            `,
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

            INNER JOIN enrollments e
                ON e.enrollment_id = ar.enrollment_id

            INNER JOIN students s
                ON s.student_id = e.student_id

            INNER JOIN class_sessions cs
                ON cs.session_id = ar.session_id

            INNER JOIN faculty f
                ON f.faculty_id = cs.faculty_id

            INNER JOIN classrooms c
                ON c.classroom_id = cs.classroom_id

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

const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Student privacy enforcement: Students may only access their own attendance
    if (req.user && req.user.role === "STUDENT") {
      if (Number(req.user.student_id) !== Number(studentId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own attendance records.",
        });
      }
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

            INNER JOIN enrollments e
                ON e.enrollment_id = ar.enrollment_id

            INNER JOIN students s
                ON s.student_id = e.student_id

            INNER JOIN class_sessions cs
                ON cs.session_id = ar.session_id

            INNER JOIN faculty f
                ON f.faculty_id = cs.faculty_id

            INNER JOIN classrooms c
                ON c.classroom_id = cs.classroom_id

            WHERE s.student_id = ?

            ORDER BY cs.session_date DESC, ar.attendance_id DESC
            `,
      [studentId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No attendance records found for this student",
      });
    }

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

const getSessionAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check whether session exists
    const [sessions] = await pool.query(
      `
            SELECT
                session_id,
                slot_id,
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

    let records = [];

    if (session.slot_id) {
      const [rosterRows] = await pool.query(
        `
        SELECT
            ar.attendance_id,
            ? AS session_id,
            e.enrollment_id,
            e.student_id,
            s.register_no,
            s.full_name,
            s.email,
            e.status AS enrollment_status,
            COALESCE(ar.status, 'UNMARKED') AS attendance_status,
            COALESCE(ar.status, 'UNMARKED') AS status,
            ar.source,
            ar.marked_at
        FROM timetable_slots ts
        JOIN enrollments e
            ON e.section_id = ts.section_id AND e.status = 'REGISTERED'
        JOIN students s
            ON s.student_id = e.student_id
        LEFT JOIN attendance_records ar
            ON ar.enrollment_id = e.enrollment_id AND ar.session_id = ?
        WHERE ts.slot_id = ?
        ORDER BY s.register_no ASC
        `,
        [sessionId, sessionId, session.slot_id],
      );
      records = rosterRows;
    }

    if (records.length === 0) {
      const [directRecords] = await pool.query(
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
            ar.status AS status,
            ar.source,
            ar.marked_at
        FROM attendance_records ar
        INNER JOIN enrollments e
            ON e.enrollment_id = ar.enrollment_id
        INNER JOIN students s
            ON s.student_id = e.student_id
        WHERE ar.session_id = ?
        ORDER BY e.enrollment_id
        `,
        [sessionId],
      );
      records = directRecords;
    }

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
        roster: records,
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

const getFacultyAttendance = async (req, res) => {
  try {
    const { facultyId } = req.params;

    // Faculty isolation: Faculty can only access attendance records for their own profile
    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec || Number(facultyRec.faculty_id) !== Number(facultyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance records for your own faculty profile.",
        });
      }
    }

    // Check whether faculty exists
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

            INNER JOIN enrollments e
                ON e.enrollment_id = ar.enrollment_id

            INNER JOIN students s
                ON s.student_id = e.student_id

            INNER JOIN class_sessions cs
                ON cs.session_id = ar.session_id

            INNER JOIN classrooms c
                ON c.classroom_id = cs.classroom_id

            WHERE cs.faculty_id = ?

            ORDER BY
                cs.session_date DESC,
                ar.attendance_id DESC
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

const getStudentAttendanceSummary = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Student privacy enforcement: Students may only access their own attendance summary
    if (req.user && req.user.role === "STUDENT") {
      if (Number(req.user.student_id) !== Number(studentId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own attendance summary.",
        });
      }
    }

    // Check whether student exists
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
    const { term_id, semester, academic_year_id } = req.query;
    const effectiveTermId = term_id || semester;

    const conditions = ["e.student_id = ?"];
    const params = [studentId];

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Calculate attendance summary
    const [summaryRows] = await pool.query(
      `
            SELECT
                COUNT(*) AS total_classes,

                SUM(
                    CASE
                        WHEN ar.status = 'PRESENT' THEN 1
                        ELSE 0
                    END
                ) AS present,

                SUM(
                    CASE
                        WHEN ar.status = 'LATE' THEN 1
                        ELSE 0
                    END
                ) AS late,

                SUM(
                    CASE
                        WHEN ar.status = 'ABSENT' THEN 1
                        ELSE 0
                    END
                ) AS absent

            FROM attendance_records ar
            INNER JOIN enrollments e ON e.enrollment_id = ar.enrollment_id
            JOIN sections sec ON sec.section_id = e.section_id
            JOIN course_offerings co ON co.offering_id = sec.offering_id
            JOIN academic_terms at ON co.term_id = at.term_id
            JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
            ${whereClause}
            `,
      params,
    );

    const summary = summaryRows[0];

    const totalClasses = Number(summary.total_classes) || 0;
    const present = Number(summary.present) || 0;
    const late = Number(summary.late) || 0;
    const absent = Number(summary.absent) || 0;

    const attended = present + late;

    const attendancePercentage =
      totalClasses > 0
        ? Number(((attended / totalClasses) * 100).toFixed(2))
        : 0;

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

const overrideAttendance = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    const { new_status, reason_code, reason_note, supporting_ref } = req.body;

    // Validate required fields
    if (!new_status || !reason_code) {
      return res.status(400).json({
        success: false,
        message: "new_status and reason_code are required",
      });
    }

    // Validate attendance status
    const allowedStatuses = ["PRESENT", "LATE", "ABSENT"];

    if (!allowedStatuses.includes(new_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid new attendance status",
      });
    }

    // Validate correction reason
    const allowedReasons = [
      "MEDICAL_LEAVE",
      "ON_DUTY_LEAVE",
      "DEVICE_FAILURE",
      "FACULTY_OVERRIDE",
      "DATA_ENTRY_ERROR",
      "OTHER",
    ];

    if (!allowedReasons.includes(reason_code)) {
      return res.status(400).json({
        success: false,
        message: "Invalid correction reason",
      });
    }

    // Get existing attendance record
    let attendance = null;

    if (!isNaN(id) && Number(id) > 0) {
      const [attendanceRows] = await connection.query(
        `
              SELECT
                  ar.attendance_id,
                  ar.session_id,
                  ar.enrollment_id,
                  ar.status,
                  e.student_id,
                  s.register_no,
                  s.full_name AS student_name
              FROM attendance_records ar

              INNER JOIN enrollments e
                  ON e.enrollment_id = ar.enrollment_id

              INNER JOIN students s
                  ON s.student_id = e.student_id

              WHERE ar.attendance_id = ?

              LIMIT 1
              `,
        [id],
      );

      if (attendanceRows.length > 0) {
        attendance = attendanceRows[0];
      }
    }

    // Support administrative correction by session_id and enrollment_id if record has not been initialized yet
    if (!attendance && req.body.session_id && req.body.enrollment_id) {
      const [enrollmentRows] = await connection.query(
        `
        SELECT
            e.enrollment_id,
            e.student_id,
            s.register_no,
            s.full_name AS student_name
        FROM enrollments e
        INNER JOIN students s ON s.student_id = e.student_id
        WHERE e.enrollment_id = ?
        LIMIT 1
        `,
        [req.body.enrollment_id],
      );

      if (enrollmentRows.length > 0) {
        const enr = enrollmentRows[0];
        const [existingRecs] = await connection.query(
          `SELECT attendance_id, status FROM attendance_records WHERE session_id = ? AND enrollment_id = ? LIMIT 1`,
          [req.body.session_id, req.body.enrollment_id],
        );

        if (existingRecs.length > 0) {
          attendance = {
            attendance_id: existingRecs[0].attendance_id,
            session_id: req.body.session_id,
            enrollment_id: req.body.enrollment_id,
            status: existingRecs[0].status,
            student_id: enr.student_id,
            register_no: enr.register_no,
            student_name: enr.student_name,
          };
        } else {
          // Initialize attendance record so administrative correction can be recorded
          const initialStatus = new_status === "PRESENT" ? "ABSENT" : "PRESENT";
          const [insertRes] = await connection.query(
            `
            INSERT INTO attendance_records (session_id, enrollment_id, status, source, marked_at)
            VALUES (?, ?, ?, 'MANUAL', NOW())
            `,
            [req.body.session_id, req.body.enrollment_id, initialStatus],
          );
          attendance = {
            attendance_id: insertRes.insertId,
            session_id: req.body.session_id,
            enrollment_id: req.body.enrollment_id,
            status: initialStatus,
            student_id: enr.student_id,
            register_no: enr.register_no,
            student_name: enr.student_name,
          };
        }
      }
    }

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Prevent unnecessary correction
    if (attendance.status === new_status) {
      return res.status(400).json({
        success: false,
        message: "New attendance status is the same as the current status",
      });
    }

    // Get current authenticated user
    const requestedBy = req.user.user_id;

    await connection.beginTransaction();

    // Insert correction history
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
        new_status,
        reason_code,
        reason_note || null,
        supporting_ref || null,
        requestedBy,
        requestedBy,
      ],
    );

    // Update attendance record
    await connection.query(
      `
            UPDATE attendance_records
            SET
                status = ?,
                source = 'CORRECTION',
                marked_at = NOW()
            WHERE attendance_id = ?
            `,
      [new_status, attendance.attendance_id],
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
        new_status,
        reason_code,
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

const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    const allowedStatuses = ["PRESENT", "LATE", "ABSENT"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    const [attendanceRows] = await pool.query(
      `
      SELECT
        ar.attendance_id,
        ar.session_id,
        ar.enrollment_id,
        ar.status,
        cs.faculty_id,
        cs.status AS session_status
      FROM attendance_records ar
      JOIN class_sessions cs ON ar.session_id = cs.session_id
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

    const record = attendanceRows[0];

    if (req.user && req.user.role === "FACULTY") {
      const facultyRec = await resolveFacultyRecord(req.user);
      if (!facultyRec || record.faculty_id !== facultyRec.faculty_id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to update attendance for another faculty member's session",
        });
      }
    }

    if (record.session_status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Attendance cannot be updated because the session is ${record.session_status}. Session must be OPEN`,
      });
    }

    await pool.query(
      `
      UPDATE attendance_records
      SET status = ?, source = 'MANUAL', marked_at = NOW()
      WHERE attendance_id = ?
      `,
      [status, id],
    );

    return res.status(200).json({
      success: true,
      message: "Attendance record updated successfully",
      data: {
        attendance_id: Number(id),
        session_id: record.session_id,
        enrollment_id: record.enrollment_id,
        status,
        source: "MANUAL",
      },
    });
  } catch (error) {
    console.error("Update attendance error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAttendanceRecords,
  getAttendanceById,
  getStudentAttendance,
  getStudentAttendanceSummary,
  getSessionAttendance,
  getFacultyAttendance,
  createAttendance,
  updateAttendance,
  overrideAttendance,
};
