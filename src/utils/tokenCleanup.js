const pool = require("../config/mysql");

/**
 * Purges tokens that have naturally expired past their expires_at date.
 * Returns the number of affected rows.
 */
async function cleanupExpiredTokens() {
  try {
    const [result] = await pool.query(
      "DELETE FROM revoked_tokens WHERE expires_at < NOW()",
    );
    return result.affectedRows || 0;
  } catch (error) {
    console.error("Token cleanup error:", error.message);
    throw error;
  }
}

module.exports = {
  cleanupExpiredTokens,
};
