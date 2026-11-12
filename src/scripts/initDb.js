const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function initDatabase() {
  let connection;
  try {
    const host = process.env.DB_HOST || "localhost";
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME || "smart_campus";

    if (!user) {
      throw new Error("Missing DB_USER in environment configuration.");
    }

    console.log(`[INIT-DB] Initializing database '${database}' on ${host}:${port}...`);

    // 1. Connect without selecting database to execute 00_create_database.sql
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });

    const createDbPath = path.join(__dirname, "../../database/mysql/00_create_database.sql");
    if (fs.existsSync(createDbPath)) {
      const createDbSql = fs.readFileSync(createDbPath, "utf8");
      await connection.query(createDbSql);
      console.log(`[INIT-DB] ✓ Verified database creation from 00_create_database.sql`);
    }

    await connection.end();

    // 2. Connect directly to target database to execute full schema
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
    });

    const schemaPath = path.join(__dirname, "../../database/mysql/schema.sql");
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    console.log(`[INIT-DB] Executing comprehensive relational schema (44 tables)...`);
    const startTime = Date.now();
    await connection.query(schemaSql);
    console.log(`[INIT-DB] ✓ Schema initialized successfully (${Date.now() - startTime}ms)`);

    // 3. Initialize schema_migrations tracking table and baseline existing migration files
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const migrationsDir = path.join(__dirname, "../../database/mysql/migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      for (const file of files) {
        await connection.query(
          "INSERT IGNORE INTO schema_migrations (version) VALUES (?)",
          [file]
        );
      }
      console.log(`[INIT-DB] ✓ Baselined ${files.length} migration(s) in schema_migrations.`);
    }

    console.log("[INIT-DB] Fresh database initialization completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("[INIT-DB] ✗ Database initialization failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();

