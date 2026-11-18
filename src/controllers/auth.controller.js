const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const pool = require("../config/mysql");

const login = async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body);

    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const [users] = await pool.query(
      `SELECT
      user_id,
      username,
      full_name,
      email,
      password_hash,
      role,
      faculty_id,
      student_id,
      is_active
      FROM users
      WHERE username = ?
      LIMIT 1`,
      [username],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }
    const jti = crypto.randomUUID();

    const token = jwt.sign(
      {
        jti,
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        faculty_id: user.faculty_id,
        student_id: user.student_id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    );
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user_id: user.user_id,
        username: user.username,
        name: user.full_name || user.username,
        full_name: user.full_name || user.username,
        email: user.email,
        role: user.role,
        faculty_id: user.faculty_id,
        student_id: user.student_id,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const trimmedIdentifier = String(username).trim();

    const [users] = await pool.query(
      `SELECT
      user_id,
      username,
      full_name,
      email,
      password_hash,
      role,
      faculty_id,
      student_id,
      is_active
      FROM users
      WHERE username = ? OR email = ?
      LIMIT 1`,
      [trimmedIdentifier, trimmedIdentifier],
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid administrator credentials",
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Administrator account is inactive",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid administrator credentials",
      });
    }

    // Strict role check: only ADMIN role is permitted
    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access restricted: only administrators may log in through the Administrator Portal",
      });
    }

    const jti = crypto.randomUUID();

    const token = jwt.sign(
      {
        jti,
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        faculty_id: user.faculty_id,
        student_id: user.student_id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    );

    return res.status(200).json({
      success: true,
      message: "Administrator authenticated successfully",
      data: {
        user_id: user.user_id,
        username: user.username,
        name: user.full_name || user.username,
        full_name: user.full_name || user.username,
        email: user.email,
        role: user.role,
        faculty_id: user.faculty_id,
        student_id: user.student_id,
      },
      token,
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
const getMe = async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT
        user_id,
        username,
        full_name,
        gender,
        date_of_birth,
        blood_group,
        joining_year,
        employee_id,
        email,
        role,
        faculty_id,
        student_id,
        is_active
      FROM users
      WHERE user_id = ?
      LIMIT 1`,
      [req.user.user_id],
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({
        success: false,
        message: "User account is invalid or inactive",
      });
    }

    const user = users[0];

    return res.status(200).json({
      success: true,
      message: "User authenticated successfully",
      data: {
        user_id: user.user_id,
        username: user.username,
        name: user.full_name || user.username,
        full_name: user.full_name || user.username,
        gender: user.gender,
        date_of_birth: user.date_of_birth,
        blood_group: user.blood_group,
        joining_year: user.joining_year,
        employee_id: user.employee_id,
        email: user.email,
        role: user.role,
        faculty_id: user.faculty_id,
        student_id: user.student_id,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [users] = await pool.query(
      `SELECT
        user_id,
        username,
        full_name,
        gender,
        date_of_birth,
        blood_group,
        joining_year,
        employee_id,
        email,
        role,
        faculty_id,
        student_id,
        is_active,
        created_at,
        last_login_at
      FROM users
      WHERE user_id = ?
      LIMIT 1`,
      [userId],
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(404).json({
        success: false,
        message: "User account is invalid or inactive",
      });
    }

    const user = users[0];
    let profileData = {
      user_id: user.user_id,
      username: user.username,
      name: user.full_name || user.username,
      full_name: user.full_name || user.username,
      employee_id: user.employee_id,
      gender: user.gender,
      date_of_birth: user.date_of_birth,
      blood_group: user.blood_group,
      joining_year: user.joining_year,
      email: user.email,
      role: user.role,
      status: user.is_active ? "ACTIVE" : "INACTIVE",
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    };

    if (user.role === "STUDENT" && user.student_id) {
      const [students] = await pool.query(
        `SELECT
          s.student_id,
          s.register_no,
          s.full_name,
          s.gender,
          s.date_of_birth,
          s.blood_group,
          s.email,
          s.phone,
          s.status AS student_status,
          b.label AS batch_label,
          p.programme_code,
          p.name AS programme_name,
          dept.name AS department_name,
          d.name AS degree_name,
          d.level AS degree_level,
          ay.label AS academic_year_label,
          (
            SELECT sec.section_code
            FROM enrollments e
            JOIN sections sec ON sec.section_id = e.section_id
            WHERE e.student_id = s.student_id
            LIMIT 1
          ) AS section_code
        FROM students s
        LEFT JOIN batches b ON b.batch_id = s.batch_id
        LEFT JOIN programmes p ON p.programme_id = b.programme_id
        LEFT JOIN departments dept ON dept.department_id = p.department_id
        LEFT JOIN degrees d ON d.degree_id = p.degree_id
        LEFT JOIN academic_years ay ON ay.academic_year_id = b.start_year_id
        WHERE s.student_id = ?
        LIMIT 1`,
        [user.student_id],
      );
      if (students.length > 0) {
        const s = students[0];
        profileData = {
          ...profileData,
          student_id: s.student_id,
          register_no: s.register_no,
          name: s.full_name,
          full_name: s.full_name,
          gender: s.gender || profileData.gender,
          date_of_birth: s.date_of_birth || profileData.date_of_birth,
          blood_group: s.blood_group || profileData.blood_group,
          email: s.email || profileData.email,
          phone: s.phone,
          student_status: s.student_status,
          batch_label: s.batch_label,
          batch: s.batch_label,
          programme_name: s.programme_name,
          programme: s.programme_name,
          programme_code: s.programme_code,
          department_name: s.department_name,
          department: s.department_name,
          degree_name: s.degree_name,
          degree_level: s.degree_level,
          academic_year_label: s.academic_year_label,
          section_code: s.section_code || null,
          section: s.section_code || null,
        };
      }
    } else if (user.role === "FACULTY" && user.faculty_id) {
      const [faculties] = await pool.query(
        `SELECT
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
          des.name AS designation,
          d.name AS department_name,
          d.code AS department_code,
          sch.name AS school_name
        FROM faculty f
        LEFT JOIN designations des ON f.designation_id = des.designation_id
        LEFT JOIN departments d ON f.department_id = d.department_id
        LEFT JOIN schools sch ON f.school_id = sch.school_id
        WHERE f.faculty_id = ?
        LIMIT 1`,
        [user.faculty_id],
      );
      if (faculties.length > 0) {
        const f = faculties[0];
        profileData = {
          ...profileData,
          faculty_id: f.faculty_id,
          employee_code: f.employee_code,
          employeeId: f.employee_code,
          name: f.full_name,
          full_name: f.full_name,
          gender: f.gender || profileData.gender,
          date_of_birth: f.date_of_birth || profileData.date_of_birth,
          blood_group: f.blood_group || profileData.blood_group,
          joining_year: f.joining_year || profileData.joining_year,
          in_charge_class: f.in_charge_class || null,
          inChargeClass: f.in_charge_class || null,
          phone: f.phone,
          email: f.email || profileData.email,
          designation: f.designation,
          department_name: f.department_name,
          department: f.department_name,
          department_code: f.department_code,
          school_name: f.school_name,
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: profileData,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching profile",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { user_id, role } = req.user;

    // RBAC: If the profile viewer is admin he can change their things,
    // whereas remaining roles can only view their details.
    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Profile modification is restricted to administrators. Remaining roles can view institutional records only.",
      });
    }

    const {
      full_name,
      name,
      email,
      username,
      password,
      gender,
      date_of_birth,
      dateOfBirth,
      blood_group,
      bloodGroup,
      joining_year,
      joiningYear,
      employee_id,
      employeeId,
    } = req.body || {};

    const resolvedFullName = full_name || name;
    const resolvedDob = date_of_birth || dateOfBirth;
    const resolvedBloodGroup = blood_group || bloodGroup;
    const resolvedJoiningYear = joining_year || joiningYear;
    const resolvedEmployeeId = employee_id || employeeId;

    if (
      !resolvedFullName &&
      !email &&
      !username &&
      !password &&
      !gender &&
      !resolvedDob &&
      !resolvedBloodGroup &&
      !resolvedJoiningYear &&
      !resolvedEmployeeId
    ) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update.",
      });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address.",
        });
      }

      const [existingEmail] = await pool.query(
        "SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1",
        [email.trim().toLowerCase(), user_id],
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email address is already in use by another account.",
        });
      }
    }

    if (username) {
      if (username.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Username must be at least 3 characters long.",
        });
      }

      const [existingUser] = await pool.query(
        "SELECT user_id FROM users WHERE username = ? AND user_id != ? LIMIT 1",
        [username.trim(), user_id],
      );
      if (existingUser.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Username is already taken by another account.",
        });
      }
    }

    const updates = [];
    const values = [];

    if (resolvedFullName !== undefined && resolvedFullName.trim()) {
      updates.push("full_name = ?");
      values.push(resolvedFullName.trim());
    }

    if (email) {
      updates.push("email = ?");
      values.push(email.trim().toLowerCase());
    }

    if (username) {
      updates.push("username = ?");
      values.push(username.trim());
    }

    if (gender) {
      updates.push("gender = ?");
      values.push(gender.toLowerCase());
    }

    if (resolvedDob !== undefined) {
      let formattedDob = null;
      if (resolvedDob) {
        const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(resolvedDob).trim());
        if (match) {
          formattedDob = match[1];
        } else {
          const d = new Date(resolvedDob);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            formattedDob = `${yyyy}-${mm}-${dd}`;
          }
        }
      }
      updates.push("date_of_birth = ?");
      values.push(formattedDob);
    }

    if (resolvedBloodGroup !== undefined) {
      updates.push("blood_group = ?");
      values.push(resolvedBloodGroup || null);
    }

    if (resolvedJoiningYear !== undefined) {
      updates.push("joining_year = ?");
      values.push(resolvedJoiningYear ? Number(resolvedJoiningYear) : null);
    }

    if (resolvedEmployeeId !== undefined) {
      updates.push("employee_id = ?");
      values.push(resolvedEmployeeId || null);
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long.",
        });
      }
      const hash = await bcrypt.hash(password, 10);
      updates.push("password_hash = ?");
      values.push(hash);
    }

    if (updates.length > 0) {
      values.push(user_id);
      await pool.query(
        `UPDATE users SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        values,
      );
    }

    // Retrieve and return the updated user profile
    const [updatedRows] = await pool.query(
      `SELECT
        user_id,
        username,
        full_name,
        gender,
        date_of_birth,
        blood_group,
        joining_year,
        employee_id,
        email,
        role,
        faculty_id,
        student_id,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE user_id = ?
      LIMIT 1`,
      [user_id],
    );

    const updatedUser = updatedRows[0];

    return res.status(200).json({
      success: true,
      message: "Admin profile updated successfully.",
      data: {
        user_id: updatedUser.user_id,
        username: updatedUser.username,
        name: updatedUser.full_name || updatedUser.username,
        full_name: updatedUser.full_name || updatedUser.username,
        gender: updatedUser.gender,
        date_of_birth: updatedUser.date_of_birth,
        blood_group: updatedUser.blood_group,
        joining_year: updatedUser.joining_year,
        employee_id: updatedUser.employee_id,
        email: updatedUser.email,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
      },
    });


  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating profile",
    });
  }
};

const logout = async (req, res) => {
  try {
    const { jti, user_id, exp } = req.user || {};

    if (!jti || !user_id || !exp) {
      return res.status(400).json({
        success: false,
        message: "Token cannot be revoked: missing token identifier",
      });
    }

    const expiresAt = new Date(exp * 1000);

    await pool.query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE revoked_at = CURRENT_TIMESTAMP`,
      [jti, user_id, expiresAt],
    );

    return res.status(200).json({
      success: true,
      message: "Logout successful and token revoked",
    });
  } catch (error) {
    console.error("Logout error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to revoke session",
    });
  }
};
module.exports = {
  login,
  adminLogin,
  getMe,
  getProfile,
  updateProfile,
  logout,
};
