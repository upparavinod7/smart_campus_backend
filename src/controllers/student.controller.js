const pool = require("../config/mysql");
const bcrypt = require("bcryptjs");

/**
 * GET /api/v1/students
 * ADMIN only
 * List students with complete academic hierarchy (School -> Department -> Degree -> Programme -> Batch -> Section)
 * and optional filtering by school_id, department_id, programme_id, batch_id, section_id, status, and search.
 */
const getStudents = async (req, res) => {
  try {
    const {
      school_id,
      department_id,
      programme_id,
      batch_id,
      section_id,
      status,
      search,
      q,
    } = req.query;

    const searchTerm = search || q;
    const conditions = [];
    const params = [];

    if (school_id !== undefined && school_id !== "") {
      conditions.push("p.school_id = ?");
      params.push(Number(school_id));
    }

    if (department_id !== undefined && department_id !== "") {
      conditions.push("p.department_id = ?");
      params.push(Number(department_id));
    }

    if (programme_id !== undefined && programme_id !== "") {
      conditions.push("b.programme_id = ?");
      params.push(Number(programme_id));
    }

    if (batch_id !== undefined && batch_id !== "") {
      conditions.push("s.batch_id = ?");
      params.push(Number(batch_id));
    }

    if (status !== undefined && status !== "") {
      conditions.push("s.status = ?");
      params.push(status);
    }

    if (section_id !== undefined && section_id !== "") {
      conditions.push(`EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.student_id = s.student_id
          AND e.section_id = ?
          AND e.status = 'REGISTERED'
      )`);
      params.push(Number(section_id));
    }

    if (searchTerm) {
      conditions.push("(s.full_name LIKE ? OR s.register_no LIKE ? OR s.email LIKE ? OR b.label LIKE ? OR p.name LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const pageNum = parseInt(req.query.page, 10);
    const limitNum = parseInt(req.query.limit, 10);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && pageNum > 0 && limitNum > 0;

    let totalCount = 0;
    let paginatedParams = [...params];
    let limitClause = "";

    if (usePagination) {
      const [countRows] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM students s
        LEFT JOIN batches b ON s.batch_id = b.batch_id
        LEFT JOIN programmes p ON b.programme_id = p.programme_id
        ${whereClause}
        `,
        params
      );
      totalCount = countRows[0]?.total || 0;
      const offset = (pageNum - 1) * limitNum;
      limitClause = "LIMIT ? OFFSET ?";
      paginatedParams.push(limitNum, offset);
    }

    const [students] = await pool.query(
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
        s.address,
        COALESCE(s.profile_image, u.profile_image) AS profile_image,
        COALESCE(s.profile_image, u.profile_image) AS photo_url,
        s.status,
        s.created_at,
        s.updated_at,

        -- Batch details
        s.batch_id,
        b.label AS batch_label,
        b.start_year_id,
        ay.label AS academic_year_label,

        -- Programme details
        b.programme_id,
        p.name AS programme_name,
        p.programme_code,
        p.duration_years,
        p.partner_track,

        -- Degree details
        p.degree_id,
        d.code AS degree_code,
        d.name AS degree_name,
        d.level AS degree_level,

        -- Department details
        p.department_id,
        dept.code AS department_code,
        dept.name AS department_name,

        -- School details
        p.school_id,
        sch.code AS school_code,
        sch.name AS school_name,

        -- Primary Section details
        (
          SELECT sec.section_id
          FROM enrollments e
          JOIN sections sec ON sec.section_id = e.section_id
          WHERE e.student_id = s.student_id AND e.status = 'REGISTERED'
          ORDER BY e.enrollment_id DESC
          LIMIT 1
        ) AS section_id,
        (
          SELECT sec.section_code
          FROM enrollments e
          JOIN sections sec ON sec.section_id = e.section_id
          WHERE e.student_id = s.student_id AND e.status = 'REGISTERED'
          ORDER BY e.enrollment_id DESC
          LIMIT 1
        ) AS section_code

      FROM students s
      LEFT JOIN users u ON u.student_id = s.student_id
      LEFT JOIN batches b ON s.batch_id = b.batch_id
      LEFT JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
      LEFT JOIN programmes p ON b.programme_id = p.programme_id
      LEFT JOIN degrees d ON p.degree_id = d.degree_id
      LEFT JOIN departments dept ON p.department_id = dept.department_id
      LEFT JOIN schools sch ON p.school_id = sch.school_id
      ${whereClause}
      ORDER BY s.student_id ASC
      ${limitClause}
      `,
      paginatedParams,
    );

    return res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      count: students.length,
      total: usePagination ? totalCount : students.length,
      page: usePagination ? pageNum : 1,
      limit: usePagination ? limitNum : students.length,
      totalPages: usePagination ? Math.ceil(totalCount / limitNum) || 1 : 1,
      data: students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/v1/students/:id
 * ADMIN only
 * Retrieve a single student with complete academic hierarchy and section details.
 */
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [students] = await pool.query(
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
        s.address,
        COALESCE(s.profile_image, u.profile_image) AS profile_image,
        COALESCE(s.profile_image, u.profile_image) AS photo_url,
        s.status,
        s.created_at,
        s.updated_at,

        -- Batch details
        s.batch_id,
        b.label AS batch_label,
        b.start_year_id,
        ay.label AS academic_year_label,

        -- Programme details
        b.programme_id,
        p.name AS programme_name,
        p.programme_code,
        p.duration_years,
        p.partner_track,

        -- Degree details
        p.degree_id,
        d.code AS degree_code,
        d.name AS degree_name,
        d.level AS degree_level,

        -- Department details
        p.department_id,
        dept.code AS department_code,
        dept.name AS department_name,

        -- School details
        p.school_id,
        sch.code AS school_code,
        sch.name AS school_name,

        -- Primary Section details
        (
          SELECT sec.section_id
          FROM enrollments e
          JOIN sections sec ON sec.section_id = e.section_id
          WHERE e.student_id = s.student_id AND e.status = 'REGISTERED'
          ORDER BY e.enrollment_id DESC
          LIMIT 1
        ) AS section_id,
        (
          SELECT sec.section_code
          FROM enrollments e
          JOIN sections sec ON sec.section_id = e.section_id
          WHERE e.student_id = s.student_id AND e.status = 'REGISTERED'
          ORDER BY e.enrollment_id DESC
          LIMIT 1
        ) AS section_code

      FROM students s
      LEFT JOIN users u ON u.student_id = s.student_id
      LEFT JOIN batches b ON s.batch_id = b.batch_id
      LEFT JOIN academic_years ay ON b.start_year_id = ay.academic_year_id
      LEFT JOIN programmes p ON b.programme_id = p.programme_id
      LEFT JOIN degrees d ON p.degree_id = d.degree_id
      LEFT JOIN departments dept ON p.department_id = dept.department_id
      LEFT JOIN schools sch ON p.school_id = sch.school_id
      WHERE s.student_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student retrieved successfully",
      data: students[0],
    });
  } catch (error) {
    console.error("Get student error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/v1/students
 * ADMIN only
 * Register student with complete academic hierarchy, optional section enrollment,
 * and automatic atomic creation of student user login account.
 */
const createStudent = async (req, res) => {
  let connection;
  try {
    const {
      register_no,
      full_name,
      email,
      phone,
      address,
      batch_id,
      status,
      // Demographics
      gender,
      date_of_birth,
      blood_group,
      // Academic hierarchy validation
      school_id,
      department_id,
      programme_id,
      section_id,
      // User account details
      username,
      password,
    } = req.body;

    if (!register_no || !full_name || !batch_id) {
      return res.status(400).json({
        success: false,
        message: "register_no, full_name and batch_id are required",
      });
    }

    const trimmedRegNo = String(register_no).trim();
    const trimmedFullName = String(full_name).trim();
    const trimmedEmail = email ? String(email).trim() : null;
    const trimmedPhone = phone ? String(phone).trim() : null;
    const trimmedAddress = address ? String(address).trim() : null;

    const allowedStatuses = [
      "ACTIVE",
      "SEMESTER_WITHDRAWAL",
      "INTERNSHIP_BREAK",
      "DISCIPLINARY_WITHDRAWAL",
      "TERMINATED",
      "GRADUATED",
    ];

    const studentStatus = status ? String(status).trim() : "ACTIVE";

    if (!allowedStatuses.includes(studentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student status",
      });
    }

    // Gender validation
    let normalizedGender = null;
    if (gender) {
      const lowerGender = String(gender).toLowerCase().trim();
      if (!["male", "female", "other"].includes(lowerGender)) {
        return res.status(400).json({
          success: false,
          message: "gender must be one of: male, female, other",
        });
      }
      normalizedGender = lowerGender;
    }

    // Date of birth validation
    let formattedDob = null;
    if (date_of_birth) {
      const parsedDate = new Date(date_of_birth);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date_of_birth format",
        });
      }
      formattedDob = date_of_birth;
    }

    const formattedBloodGroup = blood_group ? String(blood_group).trim().toUpperCase() : null;

    // Check duplicate register number in students
    const [existingRegister] = await pool.query(
      `SELECT student_id FROM students WHERE register_no = ? LIMIT 1`,
      [trimmedRegNo],
    );

    if (existingRegister.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Register number already exists",
      });
    }

    // Check duplicate email if provided
    if (trimmedEmail) {
      const [existingEmail] = await pool.query(
        `SELECT student_id FROM students WHERE email = ? LIMIT 1`,
        [trimmedEmail],
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already exists in student records",
        });
      }
    }

    // Fetch batch and verify hierarchy
    const [batchRows] = await pool.query(
      `
      SELECT
        b.batch_id,
        b.label AS batch_label,
        b.programme_id,
        p.department_id,
        p.school_id,
        p.name AS programme_name
      FROM batches b
      JOIN programmes p ON b.programme_id = p.programme_id
      WHERE b.batch_id = ?
      LIMIT 1
      `,
      [Number(batch_id)],
    );

    if (batchRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch_id",
      });
    }

    const batch = batchRows[0];

    // Hierarchy cross-validations
    if (programme_id !== undefined && programme_id !== null && programme_id !== "") {
      if (Number(programme_id) !== Number(batch.programme_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected batch does not belong to the selected programme",
        });
      }
    }

    if (department_id !== undefined && department_id !== null && department_id !== "") {
      if (Number(department_id) !== Number(batch.department_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected programme does not belong to the selected department",
        });
      }
    }

    if (school_id !== undefined && school_id !== null && school_id !== "") {
      if (Number(school_id) !== Number(batch.school_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected department or programme does not belong to the selected school",
        });
      }
    }

    // Section validation if provided
    let verifiedSectionId = null;
    let verifiedSectionCode = null;
    if (section_id !== undefined && section_id !== null && section_id !== "") {
      const [sectionRows] = await pool.query(
        `
        SELECT section_id, batch_id, section_code
        FROM sections
        WHERE section_id = ?
        LIMIT 1
        `,
        [Number(section_id)],
      );

      if (sectionRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid section_id",
        });
      }

      const sec = sectionRows[0];
      if (sec.batch_id && Number(sec.batch_id) !== Number(batch.batch_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected section does not belong to the selected batch",
        });
      }
      verifiedSectionId = sec.section_id;
      verifiedSectionCode = sec.section_code;
    }

    // Prepare user credentials
    const targetUsername = (username ? String(username).trim() : trimmedRegNo);
    const targetEmail = trimmedEmail || `${targetUsername.toLowerCase()}@student.smartcampus.local`;

    // Check duplicate username or email in users
    const [existingUser] = await pool.query(
      `SELECT user_id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1`,
      [targetUsername, targetEmail],
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: existingUser[0].username === targetUsername
          ? "A user account with this username already exists"
          : "A user account with this email already exists",
      });
    }

    const rawPassword = password || "Student@123";
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const isActiveUser = studentStatus === "ACTIVE" ? 1 : 0;

    // Begin database transaction for multi-table persistence
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Insert into students
    const [studentResult] = await connection.query(
      `
      INSERT INTO students
        (register_no, full_name, gender, date_of_birth, blood_group, email, phone, address, batch_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        trimmedRegNo,
        trimmedFullName,
        normalizedGender,
        formattedDob,
        formattedBloodGroup,
        trimmedEmail,
        trimmedPhone,
        trimmedAddress,
        batch.batch_id,
        studentStatus,
      ],
    );

    const newStudentId = studentResult.insertId;

    // 2. Insert into users
    await connection.query(
      `
      INSERT INTO users
        (username, full_name, gender, date_of_birth, blood_group, email, password_hash, role, student_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'STUDENT', ?, ?)
      `,
      [
        targetUsername,
        trimmedFullName,
        normalizedGender,
        formattedDob,
        formattedBloodGroup,
        targetEmail,
        passwordHash,
        newStudentId,
        isActiveUser,
      ],
    );

    // 3. Optional Section Enrollment
    if (verifiedSectionId) {
      await connection.query(
        `
        INSERT INTO enrollments
          (student_id, section_id, registration_type, status, registered_on)
        VALUES (?, ?, 'REGULAR', 'REGISTERED', CURDATE())
        `,
        [newStudentId, verifiedSectionId],
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: {
        student_id: newStudentId,
        register_no: trimmedRegNo,
        full_name: trimmedFullName,
        gender: normalizedGender,
        date_of_birth: formattedDob,
        blood_group: formattedBloodGroup,
        email: trimmedEmail,
        phone: trimmedPhone,
        batch_id: batch.batch_id,
        batch_label: batch.batch_label,
        programme_id: batch.programme_id,
        programme_name: batch.programme_name,
        section_id: verifiedSectionId,
        section_code: verifiedSectionCode,
        status: studentStatus,
        username: targetUsername,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Create student error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A student with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * PUT /api/v1/students/:id
 * ADMIN only
 * Update student record, synchronize linked user account, and update section enrollment.
 */
const updateStudent = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const {
      register_no,
      full_name,
      email,
      phone,
      address,
      batch_id,
      status,
      // Demographics
      gender,
      date_of_birth,
      blood_group,
      // Academic hierarchy validation
      school_id,
      department_id,
      programme_id,
      section_id,
      // Username if updating credentials
      username,
    } = req.body;

    const [existingStudent] = await pool.query(
      `
      SELECT *
      FROM students
      WHERE student_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existingStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = existingStudent[0];

    const allowedStatuses = [
      "ACTIVE",
      "SEMESTER_WITHDRAWAL",
      "INTERNSHIP_BREAK",
      "DISCIPLINARY_WITHDRAWAL",
      "TERMINATED",
      "GRADUATED",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student status",
      });
    }

    // Gender validation
    let normalizedGender = student.gender;
    if (gender !== undefined) {
      if (gender === null || gender === "") {
        normalizedGender = null;
      } else {
        const lowerGender = String(gender).toLowerCase().trim();
        if (!["male", "female", "other"].includes(lowerGender)) {
          return res.status(400).json({
            success: false,
            message: "gender must be one of: male, female, other",
          });
        }
        normalizedGender = lowerGender;
      }
    }

    // Date of birth validation
    let formattedDob = student.date_of_birth;
    if (date_of_birth !== undefined) {
      if (date_of_birth === null || date_of_birth === "") {
        formattedDob = null;
      } else {
        const parsedDate = new Date(date_of_birth);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid date_of_birth format",
          });
        }
        formattedDob = date_of_birth;
      }
    }

    const formattedBloodGroup = blood_group !== undefined
      ? (blood_group ? String(blood_group).trim().toUpperCase() : null)
      : student.blood_group;

    const targetBatchId = batch_id !== undefined && batch_id !== null ? Number(batch_id) : student.batch_id;

    const [batchRows] = await pool.query(
      `
      SELECT
        b.batch_id,
        b.label AS batch_label,
        b.programme_id,
        p.department_id,
        p.school_id,
        p.name AS programme_name
      FROM batches b
      JOIN programmes p ON b.programme_id = p.programme_id
      WHERE b.batch_id = ?
      LIMIT 1
      `,
      [targetBatchId],
    );

    if (batchRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch_id",
      });
    }

    const batch = batchRows[0];

    // Hierarchy cross-validations
    if (programme_id !== undefined && programme_id !== null && programme_id !== "") {
      if (Number(programme_id) !== Number(batch.programme_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected batch does not belong to the selected programme",
        });
      }
    }

    if (department_id !== undefined && department_id !== null && department_id !== "") {
      if (Number(department_id) !== Number(batch.department_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected programme does not belong to the selected department",
        });
      }
    }

    if (school_id !== undefined && school_id !== null && school_id !== "") {
      if (Number(school_id) !== Number(batch.school_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected department or programme does not belong to the selected school",
        });
      }
    }

    // Section validation if provided
    let verifiedSectionId = null;
    let verifiedSectionCode = null;
    if (section_id !== undefined && section_id !== null && section_id !== "") {
      const [sectionRows] = await pool.query(
        `
        SELECT section_id, batch_id, section_code
        FROM sections
        WHERE section_id = ?
        LIMIT 1
        `,
        [Number(section_id)],
      );

      if (sectionRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid section_id",
        });
      }

      const sec = sectionRows[0];
      if (sec.batch_id && Number(sec.batch_id) !== Number(batch.batch_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected section does not belong to the selected batch",
        });
      }
      verifiedSectionId = sec.section_id;
      verifiedSectionCode = sec.section_code;
    }

    const updatedStudent = {
      register_no: register_no !== undefined ? String(register_no).trim() : student.register_no,
      full_name: full_name !== undefined ? String(full_name).trim() : student.full_name,
      gender: normalizedGender,
      date_of_birth: formattedDob,
      blood_group: formattedBloodGroup,
      email: email !== undefined ? (email ? String(email).trim() : null) : student.email,
      phone: phone !== undefined ? (phone ? String(phone).trim() : null) : student.phone,
      address: address !== undefined ? (address ? String(address).trim() : null) : student.address,
      batch_id: targetBatchId,
      status: status !== undefined ? status : student.status,
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE students
      SET
        register_no = ?,
        full_name = ?,
        gender = ?,
        date_of_birth = ?,
        blood_group = ?,
        email = ?,
        phone = ?,
        address = ?,
        batch_id = ?,
        status = ?
      WHERE student_id = ?
      `,
      [
        updatedStudent.register_no,
        updatedStudent.full_name,
        updatedStudent.gender,
        updatedStudent.date_of_birth,
        updatedStudent.blood_group,
        updatedStudent.email,
        updatedStudent.phone,
        updatedStudent.address,
        updatedStudent.batch_id,
        updatedStudent.status,
        id,
      ],
    );

    // Synchronize linked users table
    const isActiveUser = updatedStudent.status === "ACTIVE" ? 1 : 0;
    const userUpdates = [
      "full_name = ?",
      "gender = ?",
      "date_of_birth = ?",
      "blood_group = ?",
      "is_active = ?",
    ];
    const userParams = [
      updatedStudent.full_name,
      updatedStudent.gender,
      updatedStudent.date_of_birth,
      updatedStudent.blood_group,
      isActiveUser,
    ];

    if (updatedStudent.email) {
      userUpdates.push("email = ?");
      userParams.push(updatedStudent.email);
    }

    if (username) {
      userUpdates.push("username = ?");
      userParams.push(String(username).trim());
    }

    userParams.push(id);

    await connection.query(
      `
      UPDATE users
      SET ${userUpdates.join(", ")}
      WHERE student_id = ?
      `,
      userParams,
    );

    // Manage section enrollment if section_id was provided
    let returnSectionId = verifiedSectionId;
    let returnSectionCode = verifiedSectionCode;

    if (verifiedSectionId) {
      // 1. Check if an enrollment already exists for this exact student and section
      const [existingTargetEnr] = await connection.query(
        `SELECT enrollment_id, status FROM enrollments WHERE student_id = ? AND section_id = ? LIMIT 1`,
        [id, verifiedSectionId],
      );

      if (existingTargetEnr.length > 0) {
        if (existingTargetEnr[0].status !== "REGISTERED") {
          await connection.query(
            `UPDATE enrollments SET status = 'REGISTERED', updated_at = NOW() WHERE enrollment_id = ?`,
            [existingTargetEnr[0].enrollment_id],
          );
        }
      } else {
        // 2. Student is not yet enrolled in verifiedSectionId.
        // Check if student is currently enrolled in another section of the same course offering
        const [targetSecRows] = await connection.query(
          `SELECT section_id, offering_id, batch_id FROM sections WHERE section_id = ? LIMIT 1`,
          [verifiedSectionId],
        );

        let replacedExisting = false;
        if (targetSecRows.length > 0 && targetSecRows[0].offering_id) {
          const [sameOfferingEnr] = await connection.query(
            `SELECT e.enrollment_id FROM enrollments e
             JOIN sections s ON e.section_id = s.section_id
             WHERE e.student_id = ? AND s.offering_id = ? AND e.section_id != ?
             LIMIT 1`,
            [id, targetSecRows[0].offering_id, verifiedSectionId],
          );

          if (sameOfferingEnr.length > 0) {
            await connection.query(
              `UPDATE enrollments SET section_id = ?, status = 'REGISTERED', updated_at = NOW() WHERE enrollment_id = ?`,
              [verifiedSectionId, sameOfferingEnr[0].enrollment_id],
            );
            replacedExisting = true;
          }
        }

        if (!replacedExisting) {
          await connection.query(
            `INSERT INTO enrollments (student_id, section_id, registration_type, status, registered_on)
             VALUES (?, ?, 'REGULAR', 'REGISTERED', CURDATE())`,
            [id, verifiedSectionId],
          );
        }
      }
    } else {
      // Section was not provided in update payload; fetch current primary section if any
      const [currentSec] = await connection.query(
        `SELECT sec.section_id, sec.section_code
         FROM enrollments e
         JOIN sections sec ON sec.section_id = e.section_id
         WHERE e.student_id = ? AND e.status = 'REGISTERED'
         ORDER BY e.enrollment_id DESC LIMIT 1`,
        [id],
      );
      if (currentSec.length > 0) {
        returnSectionId = currentSec[0].section_id;
        returnSectionCode = currentSec[0].section_code;
      }
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: {
        student_id: Number(id),
        ...updatedStudent,
        batch_label: batch.batch_label,
        programme_id: batch.programme_id,
        programme_name: batch.programme_name,
        section_id: returnSectionId,
        section_code: returnSectionCode,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Update student error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A student with these unique details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * DELETE /api/v1/students/:id
 * ADMIN only
 * Remove student and linked user authentication account.
 */
const deleteStudent = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const [existingStudent] = await pool.query(
      `
      SELECT student_id, full_name, register_no
      FROM students
      WHERE student_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existingStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // 1. Pre-check for dependent academic enrollments
    const [enrollmentRows] = await pool.query(
      `
      SELECT COUNT(*) AS total_enrollments
      FROM enrollments
      WHERE student_id = ?
      `,
      [id],
    );
    const enrollmentCount = enrollmentRows[0]?.total_enrollments || 0;

    // 2. Pre-check for attendance records linked to any enrollment of this student
    const [attendanceRows] = await pool.query(
      `
      SELECT COUNT(*) AS total_attendance
      FROM attendance_records ar
      JOIN enrollments e ON ar.enrollment_id = e.enrollment_id
      WHERE e.student_id = ?
      `,
      [id],
    );
    const attendanceCount = attendanceRows[0]?.total_attendance || 0;

    // If related academic records exist, prevent foreign key violation and return clean 409
    if (enrollmentCount > 0 || attendanceCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete this student because related records exist",
        details: {
          enrollments: enrollmentCount,
          attendance_records: attendanceCount,
          recommendation: "To preserve institutional records, update student status to INACTIVE or withdraw the student from their sections before deletion.",
        },
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Clean up cards / biometric templates if any
    await connection.query(`DELETE FROM rfid_cards WHERE student_id = ?`, [id]);
    await connection.query(`DELETE FROM fingerprint_templates WHERE student_id = ?`, [id]);

    // Remove user account if linked
    await connection.query(
      `DELETE FROM users WHERE student_id = ?`,
      [id],
    );

    // Delete student record
    await connection.query(
      `DELETE FROM students WHERE student_id = ?`,
      [id],
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    // Related records may prevent deletion through foreign keys fallback
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.errno === 1451) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete this student because related records exist",
      });
    }

    console.error("Delete student error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// POST /api/v1/students/:id/photo
const uploadStudentPhoto = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const photoData = req.photo?.url ||
      req.body?.profile_image ||
      req.body?.photo ||
      req.body?.avatar_url ||
      req.body?.profile_photo ||
      req.body?.image ||
      null;

    if (!photoData) {
      return res.status(400).json({
        success: false,
        message: "No photo data provided",
      });
    }

    const [student] = await pool.query(
      "SELECT student_id FROM students WHERE student_id = ? LIMIT 1",
      [id]
    );

    if (student.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      "UPDATE students SET profile_image = ? WHERE student_id = ?",
      [photoData, id]
    );

    await connection.query(
      "UPDATE users SET profile_image = ? WHERE student_id = ?",
      [photoData, id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Student photo uploaded successfully",
      data: {
        student_id: Number(id),
        profile_image: photoData,
        photo_url: photoData,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Upload student photo error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// DELETE /api/v1/students/:id/photo
const deleteStudentPhoto = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const [student] = await pool.query(
      "SELECT student_id FROM students WHERE student_id = ? LIMIT 1",
      [id]
    );

    if (student.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      "UPDATE students SET profile_image = NULL WHERE student_id = ?",
      [id]
    );

    await connection.query(
      "UPDATE users SET profile_image = NULL WHERE student_id = ?",
      [id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Student photo removed successfully",
      data: {
        student_id: Number(id),
        profile_image: null,
        photo_url: null,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Delete student photo error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadStudentPhoto,
  deleteStudentPhoto,
};
