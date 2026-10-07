const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/mysql");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = parts[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      console.error("JWT verification error:", jwtErr.message);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const tokenIdentifier =
      decoded.jti || crypto.createHash("sha256").update(token).digest("hex");

    const [revoked] = await pool.query(
      "SELECT 1 FROM revoked_tokens WHERE jti = ? LIMIT 1",
      [tokenIdentifier],
    );

    if (revoked && revoked.length > 0) {
      return res.status(401).json({
        success: false,
        message: "Token has been revoked",
      });
    }

    req.user = {
      ...decoded,
      jti: tokenIdentifier,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal authentication error",
    });
  }
};

module.exports = authenticateToken;
