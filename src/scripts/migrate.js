const fs = require("fs");
const path = require("path");
const pool = require("../config/mysql");

async function runMigration() {
  try {
    const sqlPath = path.join(
      __dirname,
      "../../database/mysql/001_create_revoked_tokens.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    await pool.query(sql);
    console.log("Migration executed successfully: revoked_tokens table verified.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
