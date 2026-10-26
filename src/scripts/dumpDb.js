const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

function dumpDatabase() {
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || "smartcampus";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "smart_campus";

  const outputPath = path.join(__dirname, "../../database/mysql/data_dump.sql");

  console.log(`[DUMP-DB] Exporting all data from '${database}' on ${host}:${port}...`);

  const passwordFlag = password ? `-p"${password}"` : "";
  const cmd = `mysqldump -h "${host}" -P ${port} -u "${user}" ${passwordFlag} \
    --single-transaction \
    --no-tablespaces \
    --routines \
    --triggers \
    --complete-insert \
    "${database}" > "${outputPath}"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("[DUMP-DB] ✖ Database export failed:", error.message);
      process.exit(1);
    }

    if (stderr && !stderr.includes("Using a password on the command line interface can be insecure")) {
      console.warn("[DUMP-DB] Warning during export:", stderr);
    }

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      console.log(`[DUMP-DB] ✓ Database export successful! Saved to: ${outputPath} (${fileSizeKB} KB)`);
    } else {
      console.error("[DUMP-DB] ✖ Export file was not created.");
      process.exit(1);
    }
  });
}

dumpDatabase();
