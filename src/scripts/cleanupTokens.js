const { cleanupExpiredTokens } = require("../utils/tokenCleanup");
const pool = require("../config/mysql");

(async () => {
  try {
    const deletedCount = await cleanupExpiredTokens();
    console.log(`[Token Cleanup] Purged ${deletedCount} expired revoked tokens.`);
    process.exit(0);
  } catch (err) {
    console.error("[Token Cleanup Error]", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
