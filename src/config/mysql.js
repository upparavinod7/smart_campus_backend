const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Auto-ensure profile_image columns exist in database
async function ensureProfileColumns() {
    try {
        const tables = ["users", "students", "faculty"];
        for (const table of tables) {
            try {
                await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN profile_image MEDIUMTEXT NULL`);
            } catch (err) {
                // Ignore if column already exists (ER_DUP_FIELDNAME / 1060)
                if (err.errno !== 1060 && err.code !== "ER_DUP_FIELDNAME") {
                    // Silent catch for other non-fatal errors
                }
            }
        }
    } catch (_) {
        // Non-blocking initialization
    }
}

ensureProfileColumns();

module.exports = pool;
