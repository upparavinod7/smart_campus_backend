const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

function formatInsertQueries(rawDumpPath, destPaths) {
  const pureSql = fs.readFileSync(rawDumpPath, "utf8");
  const lines = pureSql.split("\n").filter((l) => l.trim().startsWith("INSERT"));

  const tableMap = {};
  for (const line of lines) {
    const match = line.match(/INSERT\s+IGNORE\s+INTO\s+`([^`]+)`/i);
    if (match) {
      tableMap[match[1]] = line.trim();
    }
  }

  const tableOrder = [
    "system_settings",
    "degrees",
    "course_categories",
    "designations",
    "academic_years",
    "academic_terms",
    "schools",
    "departments",
    "blocks",
    "classrooms",
    "devices",
    "rfid_cards",
    "fingerprint_templates",
    "device_template_sync",
    "faculty",
    "programmes",
    "batches",
    "students",
    "users",
    "revoked_tokens",
    "subjects",
    "programme_subjects",
    "course_offerings",
    "sections",
    "enrollments",
    "timetable_slots",
    "class_sessions",
    "attendance_records",
    "attendance_corrections",
    "session_reconciliation",
    "schema_migrations",
  ];

  let output = `-- ==============================================================================
-- Joy University Smart Campus ERP - Complete Relational Data Insert Queries
-- Target Engine: MySQL 8.0+
-- Database: smart_campus
-- Generated: ${new Date().toISOString().slice(0, 10)}
-- Description:
--   Contains complete INSERT IGNORE statements for all existing university records.
--   Uses INSERT IGNORE and disables foreign key checks for safe, repeatable execution
--   against any local or staging database without wiping existing tables.
-- ==============================================================================

SET NAMES utf8mb4;
SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT;
SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS;
SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION;
SET @OLD_TIME_ZONE=@@TIME_ZONE;
SET TIME_ZONE="+00:00";
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE="NO_AUTO_VALUE_ON_ZERO";

`;

  for (const tableName of tableOrder) {
    if (tableMap[tableName]) {
      output += `-- ----------------------------------------------------------------------------\n`;
      output += `-- Table: ${tableName}\n`;
      output += `-- ----------------------------------------------------------------------------\n`;
      output += tableMap[tableName] + "\n\n";
    }
  }

  for (const [tableName, query] of Object.entries(tableMap)) {
    if (!tableOrder.includes(tableName)) {
      output += `-- ----------------------------------------------------------------------------\n`;
      output += `-- Table: ${tableName}\n`;
      output += `-- ----------------------------------------------------------------------------\n`;
      output += query + "\n\n";
    }
  }

  output += `-- ==============================================================================
-- Restore Environment State
-- ==============================================================================
SET TIME_ZONE=@OLD_TIME_ZONE;
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
`;

  for (const dest of destPaths) {
    fs.writeFileSync(dest, output, "utf8");
    const stats = fs.statSync(dest);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`[DUMP-DB] ✓ Insert queries generated: ${dest} (${sizeKB} KB)`);
  }
}

function dumpDatabase() {
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || "smartcampus";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "smart_campus";

  const fullDumpPath = path.join(__dirname, "../../database/mysql/data_dump.sql");
  const insertQueriesPath = path.join(__dirname, "../../database/mysql/data_insert_queries.sql");
  const rootQueriesPath = path.join(__dirname, "../../../database queries/data insert queries.sql");

  console.log(`[DUMP-DB] Exporting all data from '${database}' on ${host}:${port}...`);

  const passwordFlag = password ? `-p"${password}"` : "";

  // 1. Full database dump (schema + data)
  const fullDumpCmd = `mysqldump -h "${host}" -P ${port} -u "${user}" ${passwordFlag} \
    --single-transaction \
    --no-tablespaces \
    --routines \
    --triggers \
    --complete-insert \
    "${database}" > "${fullDumpPath}"`;

  // 2. Data-only inserts (INSERT IGNORE)
  const rawInsertsPath = path.join(__dirname, "../../database/mysql/.tmp_inserts.sql");
  const insertsCmd = `mysqldump -h "${host}" -P ${port} -u "${user}" ${passwordFlag} \
    --no-create-info \
    --skip-triggers \
    --single-transaction \
    --no-tablespaces \
    --complete-insert \
    --insert-ignore \
    --order-by-primary \
    --hex-blob \
    --skip-lock-tables \
    --compact \
    "${database}" > "${rawInsertsPath}"`;

  exec(fullDumpCmd, (error, stdout, stderr) => {
    if (error) {
      console.error("[DUMP-DB] ✖ Full database export failed:", error.message);
      process.exit(1);
    }

    if (fs.existsSync(fullDumpPath)) {
      const stats = fs.statSync(fullDumpPath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      console.log(`[DUMP-DB] ✓ Full schema + data dump saved: ${fullDumpPath} (${fileSizeKB} KB)`);
    }

    // Now export pure insert queries
    exec(insertsCmd, (err) => {
      if (err) {
        console.error("[DUMP-DB] ✖ Insert queries dump failed:", err.message);
        process.exit(1);
      }

      const destPaths = [insertQueriesPath];
      if (fs.existsSync(path.dirname(rootQueriesPath))) {
        destPaths.push(rootQueriesPath);
      }

      formatInsertQueries(rawInsertsPath, destPaths);

      if (fs.existsSync(rawInsertsPath)) {
        fs.unlinkSync(rawInsertsPath);
      }

      console.log("[DUMP-DB] ✓ All database data exported successfully for team usage!");
    });
  });
}

dumpDatabase();
