const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function runMigrations() {
  let connection;
  try {
    const dbConfig = {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    };

    if (!dbConfig.user || !dbConfig.database) {
      throw new Error("Missing mandatory database configuration (DB_USER or DB_NAME) in environment.");
    }

    connection = await mysql.createConnection(dbConfig);

    // 1. Ensure migrations tracking table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Query executed migrations
    const [appliedRows] = await connection.query("SELECT version FROM schema_migrations");
    const appliedSet = new Set(appliedRows.map((r) => r.version));

    // 3. Locate migration files in database/mysql/migrations
    const migrationsDir = path.join(__dirname, "../../database/mysql/migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log(`[MIGRATE] Migrations directory not found at ${migrationsDir}`);
      process.exit(0);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const pending = files.filter((file) => !appliedSet.has(file));

    if (pending.length === 0) {
      console.log(`[MIGRATE] Database is up to date (${appliedSet.size} migrations applied). No pending migrations.`);
      process.exit(0);
    }

    console.log(`[MIGRATE] Found ${pending.length} pending migration(s) out of ${files.length} total.`);

    // 4. Deterministically apply each pending migration
    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");
      console.log(`[MIGRATE] Applying migration: ${file}...`);

      const startTime = Date.now();
      await connection.query(sql);
      await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
      const durationMs = Date.now() - startTime;

      console.log(`[MIGRATE] ✓ Applied: ${file} (${durationMs}ms)`);
    }

    console.log("[MIGRATE] All pending migrations executed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("[MIGRATE] ✗ Migration execution failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigrations();
