const pool = require("../config/mysql");
const bcrypt = require("bcryptjs");

const ALLOWED_GENDERS = ["male", "female", "other"];

// GET /api/v1/faculty
const getFaculty = async (req, res) => {
  try {
    const { school_id, department_id, designation_id, is_active, search, q } = req.query || {};
    const searchTerm = search || q;

    const conditions = [];
    const params = [];

    if (school_id !== undefined && school_id !== "") {
      conditions.push("f.school_id = ?");
      params.push(Number(school_id));
    }

    if (department_id !== undefined && department_id !== "") {
      conditions.push("f.department_id = ?");
      params.push(Number(department_id));
    }

    if (designation_id !== undefined && designation_id !== "") {
      conditions.push("f.designation_id = ?");
      params.push(Number(designation_id));
    }

    if (is_active !== undefined && is_active !== "") {
      const activeVal = is_active === "true" || is_active === "1" ? 1 : 0;
      conditions.push("f.is_active = ?");
      params.push(activeVal);
    }

    if (searchTerm) {
      conditions.push("(f.full_name LIKE ? OR f.employee_code LIKE ? OR f.email LIKE ? OR dept.name LIKE ?)");
      const pattern = `%${searchTerm.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [faculty] = await pool.query(
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
          COALESCE(f.profile_image, u.profile_image) AS profile_image,
          COALESCE(f.profile_image, u.profile_image) AS photo_url,
          f.designation_id,
          d.name AS designation_name,
          f.school_id,
          s.code AS school_code,
          s.name AS school_name,
          f.department_id,
          dept.name AS department_name,
          dept.code AS department_code,
          f.is_active,
          f.created_at,
          f.updated_at
      FROM faculty f
      LEFT JOIN users u ON u.faculty_id = f.faculty_id
      LEFT JOIN designations d ON f.designation_id = d.designation_id
      LEFT JOIN schools s ON f.school_id = s.school_id
      LEFT JOIN departments dept ON f.department_id = dept.department_id
      ${whereClause}
      ORDER BY f.faculty_id ASC
      `,
      params,
    );

    return res.status(200).json({
      success: true,
      message: "Faculty retrieved successfully",
      count: faculty.length,
      data: faculty,
    });
  } catch (error) {
    console.error("Get faculty error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/v1/faculty/:id
const getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;

    const [faculty] = await pool.query(
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
          COALESCE(f.profile_image, u.profile_image) AS profile_image,
          COALESCE(f.profile_image, u.profile_image) AS photo_url,
          f.designation_id,
          d.name AS designation_name,
          f.school_id,
          s.code AS school_code,
          s.name AS school_name,
          f.department_id,
          dept.name AS department_name,
          dept.code AS department_code,
          f.is_active,
          f.created_at,
          f.updated_at
      FROM faculty f
      LEFT JOIN users u ON u.faculty_id = f.faculty_id
      LEFT JOIN designations d ON f.designation_id = d.designation_id
      LEFT JOIN schools s ON f.school_id = s.school_id
      LEFT JOIN departments dept ON f.department_id = dept.department_id
      WHERE f.faculty_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Faculty member retrieved successfully",
      data: faculty[0],
    });
  } catch (error) {
    console.error("Get faculty member error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// POST /api/v1/faculty
const createFaculty = async (req, res) => {
  let connection;
  try {
    const {
      employee_code,
      full_name,
      email,
      phone,
      gender,
      date_of_birth,
      blood_group,
      joining_year,
      in_charge_class,
      designation_id,
      school_id,
      department_id,
      is_active,
      username,
      password,
      profile_image,
      photo,
      avatar_url,
      profile_photo,
      image,
    } = req.body;

    if (!employee_code || !full_name || !school_id) {
      return res.status(400).json({
        success: false,
        message: "employee_code, full_name and school_id are required",
      });
    }

    const trimmedEmpCode = String(employee_code).trim();
    const trimmedFullName = String(full_name).trim();
    const trimmedEmail = email ? String(email).trim() : null;
    const trimmedPhone = phone ? String(phone).trim() : null;

    // Check duplicate employee code
    const [existingEmployee] = await pool.query(
      `
      SELECT faculty_id
      FROM faculty
      WHERE employee_code = ?
      LIMIT 1
      `,
      [trimmedEmpCode],
    );

    if (existingEmployee.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Employee code already exists",
      });
    }

    // Check duplicate email if provided
    if (trimmedEmail) {
      const [existingEmail] = await pool.query(
        `
        SELECT faculty_id
        FROM faculty
        WHERE email = ?
        LIMIT 1
        `,
        [trimmedEmail],
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Check school
    const [school] = await pool.query(
      `
      SELECT school_id
      FROM schools
      WHERE school_id = ?
      LIMIT 1
      `,
      [Number(school_id)],
    );

    if (school.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid school_id",
      });
    }

    // Check designation if provided
    if (designation_id) {
      const [designation] = await pool.query(
        `
        SELECT designation_id
        FROM designations
        WHERE designation_id = ?
        LIMIT 1
        `,
        [Number(designation_id)],
      );

      if (designation.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid designation_id",
        });
      }
    }

    // Check department if provided
    if (department_id) {
      const [department] = await pool.query(
        `
        SELECT department_id, school_id
        FROM departments
        WHERE department_id = ?
        LIMIT 1
        `,
        [Number(department_id)],
      );

      if (department.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id",
        });
      }

      if (Number(department[0].school_id) !== Number(school_id)) {
        return res.status(400).json({
          success: false,
          message: "Selected department does not belong to the selected school",
        });
      }
    }

    // Gender validation
    let normalizedGender = null;
    if (gender) {
      const lowerGender = String(gender).toLowerCase().trim();
      if (!ALLOWED_GENDERS.includes(lowerGender)) {
        return res.status(400).json({
          success: false,
          message: `gender must be one of: ${ALLOWED_GENDERS.join(", ")}`,
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
    const activeStatus = is_active === undefined ? 1 : (is_active ? 1 : 0);
    const parsedJoiningYear = joining_year ? Number(joining_year) : null;
    const formattedInCharge = in_charge_class ? String(in_charge_class).trim() : null;

    // Prepare linked user credentials
    const targetUsername = username ? String(username).trim() : trimmedEmpCode;
    const targetEmail = trimmedEmail || `${targetUsername.toLowerCase()}@faculty.smartcampus.local`;

    // Check if user already exists
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

    const rawPassword = password || "Faculty@123";
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const profileImageValue = profile_image || photo || avatar_url || profile_photo || image || null;

    // Atomic transaction: Faculty + User
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      INSERT INTO faculty
          (
              employee_code,
              full_name,
              gender,
              date_of_birth,
              blood_group,
              joining_year,
              in_charge_class,
              phone,
              email,
              profile_image,
              designation_id,
              school_id,
              department_id,
              is_active
          )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        trimmedEmpCode,
        trimmedFullName,
        normalizedGender,
        formattedDob,
        formattedBloodGroup,
        parsedJoiningYear,
        formattedInCharge,
        trimmedPhone,
        trimmedEmail,
        profileImageValue,
        designation_id ? Number(designation_id) : null,
        Number(school_id),
        department_id ? Number(department_id) : null,
        activeStatus,
      ],
    );

    const newFacultyId = result.insertId;

    // Create linked user account
    await connection.query(
      `
      INSERT INTO users
          (
              username,
              full_name,
              gender,
              date_of_birth,
              blood_group,
              joining_year,
              employee_id,
              email,
              password_hash,
              role,
              faculty_id,
              profile_image,
              is_active
          )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FACULTY', ?, ?, ?)
      `,
      [
        targetUsername,
        trimmedFullName,
        normalizedGender,
        formattedDob,
        formattedBloodGroup,
        parsedJoiningYear,
        trimmedEmpCode,
        targetEmail,
        passwordHash,
        newFacultyId,
        profileImageValue,
        activeStatus,
      ],
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Faculty member created successfully",
      data: {
        faculty_id: newFacultyId,
        employee_code: trimmedEmpCode,
        full_name: trimmedFullName,
        gender: normalizedGender,
        date_of_birth: formattedDob,
        blood_group: formattedBloodGroup,
        joining_year: parsedJoiningYear,
        in_charge_class: formattedInCharge,
        phone: trimmedPhone,
        email: trimmedEmail,
        designation_id: designation_id ? Number(designation_id) : null,
        school_id: Number(school_id),
        department_id: department_id ? Number(department_id) : null,
        is_active: activeStatus,
        username: targetUsername,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Create faculty error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A faculty member with these unique details already exists",
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

// PUT /api/v1/faculty/:id
const updateFaculty = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const {
      employee_code,
      full_name,
      email,
      phone,
      gender,
      date_of_birth,
      blood_group,
      joining_year,
      in_charge_class,
      designation_id,
      school_id,
      department_id,
      is_active,
      username,
      profile_image,
      photo,
      avatar_url,
      profile_photo,
      image,
    } = req.body;

    const [existingFaculty] = await pool.query(
      `
      SELECT *
      FROM faculty
      WHERE faculty_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    const faculty = existingFaculty[0];

    const targetSchoolId = school_id !== undefined ? Number(school_id) : faculty.school_id;
    if (school_id !== undefined) {
      const [school] = await pool.query(
        `SELECT school_id FROM schools WHERE school_id = ? LIMIT 1`,
        [targetSchoolId],
      );

      if (school.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid school_id",
        });
      }
    }

    if (designation_id !== undefined && designation_id !== null && designation_id !== "") {
      const [designation] = await pool.query(
        `SELECT designation_id FROM designations WHERE designation_id = ? LIMIT 1`,
        [Number(designation_id)],
      );

      if (designation.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid designation_id",
        });
      }
    }

    const targetDeptId = department_id !== undefined
      ? (department_id ? Number(department_id) : null)
      : faculty.department_id;

    if (targetDeptId) {
      const [department] = await pool.query(
        `SELECT department_id, school_id FROM departments WHERE department_id = ? LIMIT 1`,
        [targetDeptId],
      );

      if (department.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid department_id",
        });
      }

      if (Number(department[0].school_id) !== targetSchoolId) {
        return res.status(400).json({
          success: false,
          message: "Selected department does not belong to the selected school",
        });
      }
    }

    // Gender validation
    let normalizedGender = faculty.gender;
    if (gender !== undefined) {
      if (gender === null || gender === "") {
        normalizedGender = null;
      } else {
        const lowerGender = String(gender).toLowerCase().trim();
        if (!ALLOWED_GENDERS.includes(lowerGender)) {
          return res.status(400).json({
            success: false,
            message: `gender must be one of: ${ALLOWED_GENDERS.join(", ")}`,
          });
        }
        normalizedGender = lowerGender;
      }
    }

    // Date of birth validation
    let formattedDob = faculty.date_of_birth;
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
      : faculty.blood_group;

    const incomingImage = profile_image !== undefined ? profile_image : (photo !== undefined ? photo : (avatar_url !== undefined ? avatar_url : (profile_photo !== undefined ? profile_photo : (image !== undefined ? image : undefined))));

    const updatedFaculty = {
      employee_code: employee_code !== undefined ? String(employee_code).trim() : faculty.employee_code,
      full_name: full_name !== undefined ? String(full_name).trim() : faculty.full_name,
      email: email !== undefined ? (email ? String(email).trim() : null) : faculty.email,
      phone: phone !== undefined ? (phone ? String(phone).trim() : null) : faculty.phone,
      profile_image: incomingImage !== undefined ? incomingImage : faculty.profile_image,
      gender: normalizedGender,
      date_of_birth: formattedDob,
      blood_group: formattedBloodGroup,
      joining_year: joining_year !== undefined ? (joining_year ? Number(joining_year) : null) : faculty.joining_year,
      in_charge_class: in_charge_class !== undefined ? (in_charge_class ? String(in_charge_class).trim() : null) : faculty.in_charge_class,
      designation_id: designation_id !== undefined ? (designation_id ? Number(designation_id) : null) : faculty.designation_id,
      school_id: targetSchoolId,
      department_id: targetDeptId,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : faculty.is_active,
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE faculty
      SET
          employee_code = ?,
          full_name = ?,
          gender = ?,
          date_of_birth = ?,
          blood_group = ?,
          joining_year = ?,
          in_charge_class = ?,
          phone = ?,
          email = ?,
          profile_image = ?,
          designation_id = ?,
          school_id = ?,
          department_id = ?,
          is_active = ?
      WHERE faculty_id = ?
      `,
      [
        updatedFaculty.employee_code,
        updatedFaculty.full_name,
        updatedFaculty.gender,
        updatedFaculty.date_of_birth,
        updatedFaculty.blood_group,
        updatedFaculty.joining_year,
        updatedFaculty.in_charge_class,
        updatedFaculty.phone,
        updatedFaculty.email,
        updatedFaculty.profile_image,
        updatedFaculty.designation_id,
        updatedFaculty.school_id,
        updatedFaculty.department_id,
        updatedFaculty.is_active,
        id,
      ],
    );

    // Synchronize linked users table
    const userUpdates = [
      "full_name = ?",
      "gender = ?",
      "date_of_birth = ?",
      "blood_group = ?",
      "joining_year = ?",
      "employee_id = ?",
      "is_active = ?",
    ];
    const userParams = [
      updatedFaculty.full_name,
      updatedFaculty.gender,
      updatedFaculty.date_of_birth,
      updatedFaculty.blood_group,
      updatedFaculty.joining_year,
      updatedFaculty.employee_code,
      updatedFaculty.is_active,
    ];

    if (updatedFaculty.email) {
      userUpdates.push("email = ?");
      userParams.push(updatedFaculty.email);
    }

    if (incomingImage !== undefined) {
      userUpdates.push("profile_image = ?");
      userParams.push(incomingImage);
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
      WHERE faculty_id = ?
      `,
      userParams,
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Faculty member updated successfully",
      data: {
        faculty_id: Number(id),
        ...updatedFaculty,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Update faculty error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A faculty member with these unique details already exists",
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

// DELETE /api/v1/faculty/:id
// DELETE /api/v1/staff/t/:id
const deleteFaculty = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const [existingFaculty] = await pool.query(
      `
      SELECT faculty_id, is_active
      FROM faculty
      WHERE faculty_id = ?
      LIMIT 1
      `,
      [id],
    );

    if (existingFaculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE faculty
      SET is_active = 0
      WHERE faculty_id = ?
      `,
      [id],
    );

    await connection.query(
      `
      UPDATE users
      SET is_active = 0
      WHERE faculty_id = ?
      `,
      [id],
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Faculty member deactivated successfully",
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Deactivate faculty error:", error);

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

// POST /api/v1/faculty/:id/photo
// POST /api/v1/staff/t/:id/photo
const uploadFacultyPhoto = async (req, res) => {
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

    const [faculty] = await pool.query(
      "SELECT faculty_id FROM faculty WHERE faculty_id = ? LIMIT 1",
      [id]
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      "UPDATE faculty SET profile_image = ? WHERE faculty_id = ?",
      [photoData, id]
    );

    await connection.query(
      "UPDATE users SET profile_image = ? WHERE faculty_id = ?",
      [photoData, id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Faculty photo uploaded successfully",
      data: {
        faculty_id: Number(id),
        profile_image: photoData,
        photo_url: photoData,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Upload faculty photo error:", error);
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

// DELETE /api/v1/faculty/:id/photo
const deleteFacultyPhoto = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const [faculty] = await pool.query(
      "SELECT faculty_id FROM faculty WHERE faculty_id = ? LIMIT 1",
      [id]
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faculty member not found",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      "UPDATE faculty SET profile_image = NULL WHERE faculty_id = ?",
      [id]
    );

    await connection.query(
      "UPDATE users SET profile_image = NULL WHERE faculty_id = ?",
      [id]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Faculty photo removed successfully",
      data: {
        faculty_id: Number(id),
        profile_image: null,
        photo_url: null,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("Delete faculty photo error:", error);
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
  getFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  uploadFacultyPhoto,
  deleteFacultyPhoto,
};
