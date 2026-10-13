const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function seedReferenceData() {
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
      throw new Error("Missing mandatory database configuration in environment.");
    }

    connection = await mysql.createConnection(dbConfig);

    const seedFile = path.join(__dirname, "../../database/mysql/seeds/reference_data.sql");
    if (!fs.existsSync(seedFile)) {
      throw new Error(`Reference seed file not found at ${seedFile}`);
    }

    console.log(`[SEED-REF] Applying official reference data catalogs...`);
    const sql = fs.readFileSync(seedFile, "utf8");
    const startTime = Date.now();
    await connection.query(sql);
    console.log(`[SEED-REF] ✓ Reference data successfully seeded (${Date.now() - startTime}ms).`);
    process.exit(0);
  } catch (err) {
    console.error("[SEED-REF] ✗ Reference data seeding failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seedReferenceData();
