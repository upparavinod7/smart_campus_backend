const pool = require("../config/mysql");

/**
 * GET /api/v1/degrees
 * List all academic degrees.
 */
const getDegrees = async (req, res) => {
  try {
    const [degrees] = await pool.query(
      `
      SELECT
          degree_id,
          code,
          name,
          level,
          created_at,
          updated_at
      FROM degrees
      ORDER BY degree_id ASC
      `,
    );

    return res.status(200).json({
      success: true,
      message: "Degrees retrieved successfully",
      count: degrees.length,
      data: degrees,
    });
  } catch (error) {
    console.error("Get degrees error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getDegrees,
};
