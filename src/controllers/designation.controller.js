const pool = require("../config/mysql");

/**
 * GET /api/v1/designations
 * Retrieves all academic and institutional faculty designations from the database.
 */
const getDesignations = async (req, res) => {
  try {
    const [designations] = await pool.query(`
      SELECT
        designation_id,
        name
      FROM designations
      ORDER BY designation_id ASC
    `);

    return res.status(200).json({
      success: true,
      message: "Designations retrieved successfully",
      count: designations.length,
      data: designations,
    });
  } catch (error) {
    console.error("Get designations error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching designations",
    });
  }
};

module.exports = {
  getDesignations,
};

