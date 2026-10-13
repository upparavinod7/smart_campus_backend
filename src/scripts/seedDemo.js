const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function seedDemoData() {
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

    if (process.env.NODE_ENV === "production") {
      console.error("[SEED-DEMO] ✗ Refusing to run demo seed script in production environment.");
      process.exit(1);
    }

    connection = await mysql.createConnection(dbConfig);

    const seedFile = path.join(__dirname, "../../database/mysql/seeds/demo_data.sql");
    if (!fs.existsSync(seedFile)) {
      throw new Error(`Demo seed file not found at ${seedFile}`);
    }

    console.log(`[SEED-DEMO] Applying development/testing demo fixtures...`);
    const sql = fs.readFileSync(seedFile, "utf8");
    const startTime = Date.now();
    await connection.query(sql);
    console.log(`[SEED-DEMO] ✓ Demo data fixtures successfully seeded (${Date.now() - startTime}ms).`);
    console.log(`[SEED-DEMO] Demo credentials:`);
    console.log(`  - Admin:   admin / Admin@123`);
    console.log(`  - Faculty: FAC001 / Faculty@123`);
    console.log(`  - Student: J26AIM001 / Student@123`);
    process.exit(0);
  } catch (err) {
    console.error("[SEED-DEMO] ✗ Demo data seeding failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seedDemoData();

