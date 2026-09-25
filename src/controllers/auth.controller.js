const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
                email,
                password_hash,
                role,
                faculty_id,
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
    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
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
        email: user.email,
        role: user.role,
        faculty_id: user.faculty_id,
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
const getMe = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "User authenticated successfully",
            data: req.user
        });
    } catch (error) {
        console.error("Get user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
module.exports = {
  login,
  getMe
};
