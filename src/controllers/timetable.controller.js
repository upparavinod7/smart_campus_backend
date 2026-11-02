const pool = require("../config/mysql");

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Helper to check timetable conflicts for faculty, classroom, and section.
 * Returns { conflict: true, type: string, message: string } or { conflict: false }.
 */
const checkTimetableConflicts = async ({
  faculty_id,
  classroom_id,
  section_id,
  day_of_week,
  start_time,
  end_time,
  effective_from,
  effective_to = null,
  exclude_slot_id = null,
}) => {
  const dateOverlapCondition = `
    (ts.effective_to IS NULL OR ? IS NULL OR ts.effective_to >= ?)
    AND
    (? IS NULL OR ts.effective_from <= ?)
  `;
  const dateParams = [
    effective_from,
    effective_from,
    effective_to,
    effective_to,
  ];

  // 1. Check Faculty Conflict
  let facultyQuery = `
    SELECT
        ts.slot_id,
        ts.start_time,
        ts.end_time,
        f.full_name AS faculty_name
    FROM timetable_slots ts
    JOIN faculty f ON ts.faculty_id = f.faculty_id
    WHERE ts.faculty_id = ?
      AND ts.day_of_week = ?
      AND ts.is_active = 1
      AND (ts.start_time < ? AND ts.end_time > ?)
      AND ${dateOverlapCondition}
  `;
  const facultyParams = [
    Number(faculty_id),
    Number(day_of_week),
    end_time,
    start_time,
    ...dateParams,
  ];

  if (exclude_slot_id) {
    facultyQuery += " AND ts.slot_id != ?";
    facultyParams.push(Number(exclude_slot_id));
  }
  facultyQuery += " LIMIT 1";

  const [facultyConflicts] = await pool.query(facultyQuery, facultyParams);
  if (facultyConflicts.length > 0) {
    const c = facultyConflicts[0];
    return {
      conflict: true,
      type: "FACULTY_CONFLICT",
      message: `Faculty schedule conflict: ${c.faculty_name} is already assigned to a timetable slot from ${c.start_time} to ${c.end_time} on day ${day_of_week}`,
    };
  }

  // 2. Check Classroom Conflict
  let roomQuery = `
    SELECT
        ts.slot_id,
        ts.start_time,
        ts.end_time,
        c.room_no
    FROM timetable_slots ts
    JOIN classrooms c ON ts.classroom_id = c.classroom_id
    WHERE ts.classroom_id = ?
      AND ts.day_of_week = ?
      AND ts.is_active = 1
      AND (ts.start_time < ? AND ts.end_time > ?)
      AND ${dateOverlapCondition}
  `;
  const roomParams = [
    Number(classroom_id),
    Number(day_of_week),
    end_time,
    start_time,
    ...dateParams,
  ];

  if (exclude_slot_id) {
    roomQuery += " AND ts.slot_id != ?";
    roomParams.push(Number(exclude_slot_id));
  }
  roomQuery += " LIMIT 1";

  const [roomConflicts] = await pool.query(roomQuery, roomParams);
  if (roomConflicts.length > 0) {
    const c = roomConflicts[0];
    return {
      conflict: true,
      type: "CLASSROOM_CONFLICT",
      message: `Classroom schedule conflict: Room ${c.room_no} is already booked from ${c.start_time} to ${c.end_time} on day ${day_of_week}`,
    };
  }

  // 3. Check Section Conflict
  let sectionQuery = `
    SELECT
        ts.slot_id,
        ts.start_time,
        ts.end_time,
        sec.section_code
    FROM timetable_slots ts
    JOIN sections sec ON ts.section_id = sec.section_id
    WHERE ts.section_id = ?
      AND ts.day_of_week = ?
      AND ts.is_active = 1
      AND (ts.start_time < ? AND ts.end_time > ?)
      AND ${dateOverlapCondition}
  `;
  const sectionParams = [
    Number(section_id),
    Number(day_of_week),
    end_time,
    start_time,
    ...dateParams,
  ];

  if (exclude_slot_id) {
    sectionQuery += " AND ts.slot_id != ?";
    sectionParams.push(Number(exclude_slot_id));
  }
  sectionQuery += " LIMIT 1";

  const [sectionConflicts] = await pool.query(sectionQuery, sectionParams);
  if (sectionConflicts.length > 0) {
    const c = sectionConflicts[0];
    return {
      conflict: true,
      type: "SECTION_CONFLICT",
      message: `Section schedule conflict: Section ${c.section_code} already has a class scheduled from ${c.start_time} to ${c.end_time} on day ${day_of_week}`,
    };
  }

  return { conflict: false };
};

/**
 * GET /api/v1/timetable
 * List timetable slots with relational joins to sections, subjects, faculty, classrooms, and blocks.
 */
const getTimetableSlots = async (req, res) => {
  try {
    const {
      day_of_week,
      classroom_id,
      faculty_id,
      section_id,
      subject_id,
      offering_id,
      batch_id,
      programme_id,
      department_id,
      school_id,
      term_id,
      semester,
      academic_year_id,
      term_type,
      student_id,
      is_active,
    } = req.query;

    const conditions = [];
    const params = [];

    const effectiveTermId = term_id || semester;

    if (day_of_week !== undefined && day_of_week !== "") {
      conditions.push("ts.day_of_week = ?");
      params.push(Number(day_of_week));
    }

    if (classroom_id) {
      conditions.push("ts.classroom_id = ?");
      params.push(Number(classroom_id));
    }

    if (faculty_id) {
      conditions.push("ts.faculty_id = ?");
      params.push(Number(faculty_id));
    }

    if (section_id) {
      conditions.push("ts.section_id = ?");
      params.push(Number(section_id));
    }

    if (subject_id) {
      conditions.push("co.subject_id = ?");
      params.push(Number(subject_id));
    }

    if (offering_id) {
      conditions.push("sec.offering_id = ?");
      params.push(Number(offering_id));
    }

    if (effectiveTermId) {
      conditions.push("co.term_id = ?");
      params.push(Number(effectiveTermId));
    }

    if (academic_year_id) {
      conditions.push("at.academic_year_id = ?");
      params.push(Number(academic_year_id));
    }

    if (term_type) {
      conditions.push("at.term_type = ?");
      params.push(term_type.toUpperCase());
    }

    if (student_id) {
      conditions.push(
        "EXISTS (SELECT 1 FROM enrollments e WHERE e.section_id = ts.section_id AND e.student_id = ? AND e.status = 'REGISTERED')",
      );
      params.push(Number(student_id));
    }

    if (batch_id) {
      conditions.push("sec.batch_id = ?");
      params.push(Number(batch_id));
    }

    if (programme_id) {
      conditions.push("bt.programme_id = ?");
      params.push(Number(programme_id));
    }

    if (department_id) {
      conditions.push("p.department_id = ?");
      params.push(Number(department_id));
    }

    if (school_id) {
      conditions.push("p.school_id = ?");
      params.push(Number(school_id));
    }

    if (is_active !== undefined && is_active !== "") {
      const activeVal = is_active === "true" || is_active === "1" ? 1 : 0;
      conditions.push("ts.is_active = ?");
      params.push(activeVal);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [slots] = await pool.query(
      `
      SELECT
          ts.slot_id,
          ts.section_id,
          sec.section_code,
          sec.batch_id,
          bt.label AS batch_label,
          p.programme_id,
          p.name AS programme_name,
          p.programme_code,
          d.department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.school_id,
          s.name AS school_name,
          s.code AS school_code,
          co.offering_id,
          co.term_id,
          at.term_type,
          at.academic_year_id,
          ay.label AS academic_year_label,
          ay.start_date AS academic_year_start,
          ay.end_date AS academic_year_end,
          at.start_date AS term_start_date,
          at.end_date AS term_end_date,
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
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN faculty f ON ts.faculty_id = f.faculty_id
      JOIN classrooms c ON ts.classroom_id = c.classroom_id
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      LEFT JOIN schools s ON p.school_id = s.school_id
      ${whereClause}
      ORDER BY ts.day_of_week ASC, ts.start_time ASC, ts.slot_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Timetable slots retrieved successfully",
      count: slots.length,
      data: slots,
    });
  } catch (error) {
    console.error("Get timetable slots error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/timetable/:id
 * Retrieve a single timetable slot by ID.
 */
const getTimetableSlotById = async (req, res) => {
  try {
    const { id } = req.params;

    const [slots] = await pool.query(
      `
      SELECT
          ts.slot_id,
          ts.section_id,
          sec.section_code,
          sec.batch_id,
          bt.label AS batch_label,
          p.programme_id,
          p.name AS programme_name,
          p.programme_code,
          d.department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.school_id,
          s.name AS school_name,
          s.code AS school_code,
          co.offering_id,
          co.term_id,
          at.term_type,
          at.academic_year_id,
          ay.label AS academic_year_label,
          ay.start_date AS academic_year_start,
          ay.end_date AS academic_year_end,
          at.start_date AS term_start_date,
          at.end_date AS term_end_date,
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
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN academic_terms at ON co.term_id = at.term_id
      JOIN academic_years ay ON at.academic_year_id = ay.academic_year_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN faculty f ON ts.faculty_id = f.faculty_id
      JOIN classrooms c ON ts.classroom_id = c.classroom_id
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      LEFT JOIN schools s ON p.school_id = s.school_id
      WHERE ts.slot_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (slots.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Timetable slot not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Timetable slot retrieved successfully",
      data: slots[0],
    });
  } catch (error) {
    console.error("Get timetable slot by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/timetable
 * Create a new timetable slot with schedule conflict detection. ADMIN only.
 */
const createTimetableSlot = async (req, res) => {
  try {
    const {
      section_id,
      faculty_id,
      classroom_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to = null,
      is_active = 1,
    } = req.body || {};

    // Validate required fields
    if (
      !section_id ||
      !faculty_id ||
      !classroom_id ||
      day_of_week === undefined ||
      !start_time ||
      !end_time ||
      !effective_from
    ) {
      return res.status(400).json({
        success: false,
        message:
          "section_id, faculty_id, classroom_id, day_of_week, start_time, end_time, and effective_from are required",
      });
    }

    const secNum = Number(section_id);
    const facNum = Number(faculty_id);
    const roomNum = Number(classroom_id);
    const dowNum = Number(day_of_week);

    if (isNaN(secNum) || isNaN(facNum) || isNaN(roomNum) || isNaN(dowNum)) {
      return res.status(400).json({
        success: false,
        message: "IDs and day_of_week must be valid numbers",
      });
    }

    if (dowNum < 1 || dowNum > 7) {
      return res.status(400).json({
        success: false,
        message:
          "day_of_week must be an integer between 1 (Monday) and 7 (Sunday)",
      });
    }

    // Validate start_time and end_time
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return res.status(400).json({
        success: false,
        message: "start_time and end_time must be in HH:MM or HH:MM:SS format",
      });
    }

    const normStartTime =
      start_time.length === 5 ? `${start_time}:00` : start_time;
    const normEndTime = end_time.length === 5 ? `${end_time}:00` : end_time;

    if (normEndTime <= normStartTime) {
      return res.status(400).json({
        success: false,
        message: "end_time must be strictly greater than start_time",
      });
    }

    const normEffFrom = effective_from ? String(effective_from).trim() : null;
    const normEffTo =
      effective_to && String(effective_to).trim() !== ""
        ? String(effective_to).trim()
        : null;

    if (!normEffFrom || !dateRegex.test(normEffFrom)) {
      return res.status(400).json({
        success: false,
        message: "effective_from must be a valid date in YYYY-MM-DD format",
      });
    }

    if (normEffTo && !dateRegex.test(normEffTo)) {
      return res.status(400).json({
        success: false,
        message: "effective_to must be a valid date in YYYY-MM-DD format",
      });
    }

    // Validate effective_to >= effective_from if provided
    if (normEffTo && normEffTo < normEffFrom) {
      return res.status(400).json({
        success: false,
        message: "effective_to must be on or after effective_from",
      });
    }

    // Verify foreign keys and active statuses
    const [secRows] = await pool.query(
      "SELECT section_id FROM sections WHERE section_id = ? LIMIT 1",
      [secNum],
    );
    if (secRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid section_id: section does not exist",
      });
    }

    const [facRows] = await pool.query(
      "SELECT faculty_id, is_active FROM faculty WHERE faculty_id = ? LIMIT 1",
      [facNum],
    );
    if (facRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid faculty_id: faculty does not exist",
      });
    }
    if (!facRows[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Faculty member is inactive",
      });
    }

    const [roomRows] = await pool.query(
      "SELECT classroom_id, is_active FROM classrooms WHERE classroom_id = ? LIMIT 1",
      [roomNum],
    );
    if (roomRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid classroom_id: classroom does not exist",
      });
    }
    if (!roomRows[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Classroom is inactive",
      });
    }

    // Conflict detection
    const conflictResult = await checkTimetableConflicts({
      faculty_id: facNum,
      classroom_id: roomNum,
      section_id: secNum,
      day_of_week: dowNum,
      start_time: normStartTime,
      end_time: normEndTime,
      effective_from: normEffFrom,
      effective_to: normEffTo,
    });

    if (conflictResult.conflict) {
      return res.status(409).json({
        success: false,
        code: conflictResult.type,
        message: conflictResult.message,
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO timetable_slots (
          section_id,
          faculty_id,
          classroom_id,
          day_of_week,
          start_time,
          end_time,
          effective_from,
          effective_to,
          is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        secNum,
        facNum,
        roomNum,
        dowNum,
        normStartTime,
        normEndTime,
        normEffFrom,
        normEffTo,
        is_active ? 1 : 0,
      ],
    );

    const [createdRows] = await pool.query(
      `
      SELECT
          ts.slot_id,
          ts.section_id,
          sec.section_code,
          sec.batch_id,
          bt.label AS batch_label,
          p.programme_id,
          p.name AS programme_name,
          p.programme_code,
          d.department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.school_id,
          s.name AS school_name,
          s.code AS school_code,
          co.offering_id,
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
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN faculty f ON ts.faculty_id = f.faculty_id
      JOIN classrooms c ON ts.classroom_id = c.classroom_id
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      LEFT JOIN schools s ON p.school_id = s.school_id
      WHERE ts.slot_id = ?
      LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Timetable slot created successfully",
      data: createdRows[0],
    });
  } catch (error) {
    console.error("Create timetable slot error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/v1/timetable/:id
 * Update an existing timetable slot with schedule conflict detection (excluding current slot). ADMIN only.
 */
const updateTimetableSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      section_id,
      faculty_id,
      classroom_id,
      day_of_week,
      start_time,
      end_time,
      effective_from,
      effective_to,
      is_active,
    } = req.body || {};

    const [existingRows] = await pool.query(
      "SELECT * FROM timetable_slots WHERE slot_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Timetable slot not found",
      });
    }

    const current = existingRows[0];
    let newSec = current.section_id;
    let newFac = current.faculty_id;
    let newRoom = current.classroom_id;
    let newDow = current.day_of_week;
    let newStart = current.start_time;
    let newEnd = current.end_time;
    let newEffFrom = current.effective_from;
    let newEffTo = current.effective_to;
    let newActive = current.is_active;

    if (section_id !== undefined) {
      const secNum = Number(section_id);
      const [secRows] = await pool.query(
        "SELECT section_id FROM sections WHERE section_id = ? LIMIT 1",
        [secNum],
      );
      if (secRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid section_id: section does not exist",
        });
      }
      newSec = secNum;
    }

    if (faculty_id !== undefined) {
      const facNum = Number(faculty_id);
      const [facRows] = await pool.query(
        "SELECT faculty_id, is_active FROM faculty WHERE faculty_id = ? LIMIT 1",
        [facNum],
      );
      if (facRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid faculty_id: faculty does not exist",
        });
      }
      if (!facRows[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Faculty member is inactive",
        });
      }
      newFac = facNum;
    }

    if (classroom_id !== undefined) {
      const roomNum = Number(classroom_id);
      const [roomRows] = await pool.query(
        "SELECT classroom_id, is_active FROM classrooms WHERE classroom_id = ? LIMIT 1",
        [roomNum],
      );
      if (roomRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid classroom_id: classroom does not exist",
        });
      }
      if (!roomRows[0].is_active) {
        return res.status(400).json({
          success: false,
          message: "Classroom is inactive",
        });
      }
      newRoom = roomNum;
    }

    if (day_of_week !== undefined) {
      const dowNum = Number(day_of_week);
      if (dowNum < 1 || dowNum > 7) {
        return res.status(400).json({
          success: false,
          message: "day_of_week must be an integer between 1 and 7",
        });
      }
      newDow = dowNum;
    }

    if (start_time !== undefined) {
      if (!timeRegex.test(start_time)) {
        return res.status(400).json({
          success: false,
          message: "start_time must be in HH:MM or HH:MM:SS format",
        });
      }
      newStart = start_time.length === 5 ? `${start_time}:00` : start_time;
    }

    if (end_time !== undefined) {
      if (!timeRegex.test(end_time)) {
        return res.status(400).json({
          success: false,
          message: "end_time must be in HH:MM or HH:MM:SS format",
        });
      }
      newEnd = end_time.length === 5 ? `${end_time}:00` : end_time;
    }

    if (newEnd <= newStart) {
      return res.status(400).json({
        success: false,
        message: "end_time must be strictly greater than start_time",
      });
    }

    if (effective_from !== undefined) {
      const trimmedEffFrom = String(effective_from).trim();
      if (!dateRegex.test(trimmedEffFrom)) {
        return res.status(400).json({
          success: false,
          message: "effective_from must be a valid date in YYYY-MM-DD format",
        });
      }
      newEffFrom = trimmedEffFrom;
    }

    if (effective_to !== undefined) {
      const trimmedEffTo =
        effective_to && String(effective_to).trim() !== ""
          ? String(effective_to).trim()
          : null;
      if (trimmedEffTo && !dateRegex.test(trimmedEffTo)) {
        return res.status(400).json({
          success: false,
          message: "effective_to must be a valid date in YYYY-MM-DD format",
        });
      }
      newEffTo = trimmedEffTo;
    }

    if (newEffTo && newEffTo < newEffFrom) {
      return res.status(400).json({
        success: false,
        message: "effective_to must be on or after effective_from",
      });
    }

    if (is_active !== undefined) {
      newActive = is_active ? 1 : 0;
    }

    // Conflict detection excluding current slot
    if (newActive === 1) {
      const conflictResult = await checkTimetableConflicts({
        faculty_id: newFac,
        classroom_id: newRoom,
        section_id: newSec,
        day_of_week: newDow,
        start_time: newStart,
        end_time: newEnd,
        effective_from: newEffFrom,
        effective_to: newEffTo,
        exclude_slot_id: id,
      });

      if (conflictResult.conflict) {
        return res.status(409).json({
          success: false,
          code: conflictResult.type,
          message: conflictResult.message,
        });
      }
    }

    await pool.query(
      `
      UPDATE timetable_slots
      SET
          section_id = ?,
          faculty_id = ?,
          classroom_id = ?,
          day_of_week = ?,
          start_time = ?,
          end_time = ?,
          effective_from = ?,
          effective_to = ?,
          is_active = ?,
          updated_at = NOW()
      WHERE slot_id = ?
      `,
      [
        newSec,
        newFac,
        newRoom,
        newDow,
        newStart,
        newEnd,
        newEffFrom,
        newEffTo,
        newActive,
        id,
      ],
    );

    const [updatedRows] = await pool.query(
      `
      SELECT
          ts.slot_id,
          ts.section_id,
          sec.section_code,
          sec.batch_id,
          bt.label AS batch_label,
          p.programme_id,
          p.name AS programme_name,
          p.programme_code,
          d.department_id,
          d.name AS department_name,
          d.code AS department_code,
          s.school_id,
          s.name AS school_name,
          s.code AS school_code,
          co.offering_id,
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
      JOIN sections sec ON ts.section_id = sec.section_id
      JOIN course_offerings co ON sec.offering_id = co.offering_id
      JOIN subjects sub ON co.subject_id = sub.subject_id
      JOIN faculty f ON ts.faculty_id = f.faculty_id
      JOIN classrooms c ON ts.classroom_id = c.classroom_id
      LEFT JOIN blocks b ON c.block_id = b.block_id
      LEFT JOIN batches bt ON sec.batch_id = bt.batch_id
      LEFT JOIN programmes p ON bt.programme_id = p.programme_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      LEFT JOIN schools s ON p.school_id = s.school_id
      WHERE ts.slot_id = ?
      LIMIT 1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Timetable slot updated successfully",
      data: updatedRows[0],
    });
  } catch (error) {
    console.error("Update timetable slot error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * DELETE /api/v1/timetable/:id
 * Soft deactivates a timetable slot to preserve attendance integrity. ADMIN only.
 */
const deleteTimetableSlot = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingRows] = await pool.query(
      "SELECT slot_id, is_active FROM timetable_slots WHERE slot_id = ? LIMIT 1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Timetable slot not found",
      });
    }

    if (!existingRows[0].is_active) {
      return res.status(400).json({
        success: false,
        message: "Timetable slot is already inactive",
      });
    }

    await pool.query(
      "UPDATE timetable_slots SET is_active = 0, updated_at = NOW() WHERE slot_id = ?",
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Timetable slot deactivated successfully",
      data: {
        slot_id: Number(id),
        is_active: 0,
      },
    });
  } catch (error) {
    console.error("Delete timetable slot error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getTimetableSlots,
  getTimetableSlotById,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
};
