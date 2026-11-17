# Joy University Smart Campus ERP — MySQL Database Architecture & Setup Guide

This document describes the relational database structure, schema migration lifecycle, reference data catalogs, demo seeding, and backup/recovery procedures for the Joy University Smart Campus ERP backend.

---

## 1. Relational Database Overview

- **Engine:** MySQL 8.0+ / InnoDB
- **Default Character Set:** `utf8mb4`
- **Default Collation:** `utf8mb4_unicode_ci`
- **Connection Layer:** Node.js `mysql2/promise` connection pool
- **Primary Source of Truth:** MySQL is the authoritative database for all institutional identity, academic hierarchy, course offerings, enrollments, timetables, class sessions, and attendance state records.

---

## 2. Directory Layout

```text
database/mysql/
├── 00_create_database.sql          # Creates smart_campus database with utf8mb4 encoding
├── schema.sql                     # Full relational schema (44 tables with FKs and indexes)
├── data_dump.sql                  # Complete database snapshot (schema + all current live records)
├── data_insert_queries.sql        # Standalone INSERT IGNORE statements for team sharing without dropping tables
├── migrations/                    # Ordered, deterministic incremental migrations
│   ├── 001_create_revoked_tokens.sql
│   ├── 002_add_batch_id_to_sections.sql
│   ├── 003_allow_multiple_sessions_per_date.sql
│   ├── 004_add_full_name_to_users.sql
│   ├── 005_add_profile_demographics.sql
│   ├── 006_remove_demographic_defaults.sql
│   ├── 007_create_academic_module.sql
│   └── 008_fix_academic_fk_and_settings.sql
├── seeds/                         # Environment seeds
│   ├── reference_data.sql         # Institutional reference catalogs & academic permission matrix
│   └── demo_data.sql              # Dev/QA test fixtures (Admin, Faculty, Student demo accounts)
└── README.md                      # This database guide
```

---

## 3. Database Workflows

### A. Initializing a Brand New Database (Fresh Install)

To create the database and all 44 relational tables from scratch:

```bash
# Using npm script:
npm run db:init

# Or manually using MySQL client:
mysql -u root -p < database/mysql/00_create_database.sql
mysql -u root -p smart_campus < database/mysql/schema.sql
```

The initialization script:
1. Creates the `smart_campus` database if it does not already exist.
2. Applies the complete schema DDL with foreign key dependencies resolved.
3. Automatically baselines existing migrations into the `schema_migrations` tracking table so they are not re-executed.

---

### B. Safe Incremental Migrations (Existing Database Upgrades)

To apply new, unexecuted migrations to an existing database:

```bash
npm run db:migrate
```

The migration runner:
- Inspects the `schema_migrations` table.
- Identifies new `.sql` migration files in `database/mysql/migrations/`.
- Executes pending migrations deterministically in alphabetical/numerical order.
- Records the executed version in `schema_migrations`.
- Stops immediately with exit code `1` if any migration fails.

#### Notable Migrations:
- **007_create_academic_module.sql:** Deploys core Academic Module schema (13 tables) covering Topics, Materials, Material Versions & Progress, Question Bank, Quizzes, Attempts, Answers, Score Corrections, ML Jobs, and Audit Ledger.
- **008_fix_academic_fk_and_settings.sql:** 
  1. Replaces `ON DELETE CASCADE` with `ON DELETE RESTRICT` on `academic_attempt_answers.fk_ans_question` to prevent physical destruction of historical question answers and score records.
  2. Drops `fk_ledger_person` cascade constraint from `academic_audit_ledger` to guarantee permanent compliance retention of academic audit logs even when accounts are purged, snapshotting `actor_role` and `actor_username`.
  3. Adds `questions_to_draw INT UNSIGNED NULL` to `academic_quizzes` for configurable random question pooling.
  4. Adds `ml_enabled TINYINT(1) NOT NULL DEFAULT 1` to `subjects` for granular administrative and departmental AI question generation control.

---

### C. Seeding Official Reference Data (Production & Staging)

Populates official university catalogs (Degrees, Course Categories, Faculty Designations, Schools, Departments, Academic Years, Academic Terms, System Settings):

```bash
npm run db:seed:ref

# Or manually:
mysql -u <user> -p smart_campus < database/mysql/seeds/reference_data.sql
```

> [!NOTE]
> All reference statements use `INSERT IGNORE` and are completely safe to re-run without duplicating records or corrupting existing relational links.

---

### D. Seeding Development Demo Data (Local Dev / QA Only)

Populates sample campus infrastructure, course offerings, sections, batches, and demo login accounts:

```bash
npm run db:seed:demo
```

To populate dummy data for the **Academic Module (Topics, Study Materials, Question Bank, Quizzes, Progress & Attempts)**:

```bash
npm run db:seed:academic

# Reset and re-seed academic dummy data:
npm run db:seed:academic:reset
```

> [!WARNING]
> Never run `npm run db:seed:demo` or `npm run db:seed:academic` in production. Both scripts automatically abort if `NODE_ENV=production`.

#### Pre-configured Demo Accounts:
- **System Administrator:** `admin` / `Admin@123` (`ADMIN` role)
- **Faculty:** `FAC001` / `Faculty@123` (`FACULTY` role), `FAC002` / `Faculty@123` (Co-Teacher)
- **Students:** `J26AIM001` / `Student@123`, `JU26AIML002` / `Student@123`, `JU26AIML003` / `Student@123` (`STUDENT` role)

---

### E. Exporting Live Database Snapshot (Complete Data Dump)

To export all current live database records, tables, triggers, and routines into `database/mysql/data_dump.sql`:

```bash
npm run db:dump
```

This exports all relational data using `--complete-insert` and `--single-transaction`, ready for instant environment setup or disaster recovery.

---

### F. Team Data Synchronization (Safe Insert Queries)

To populate team members' local databases with the exact current data without dropping or recreating existing tables:

```bash
mysql -u <user> -p smart_campus < database/mysql/data_insert_queries.sql
```

> [!TIP]
> `data_insert_queries.sql` uses `INSERT IGNORE` and disables foreign key checks during execution. It inserts all records without deleting or modifying any existing developer data or schemas.

---

### G. Complete Fresh Setup in One Step

```bash
npm run db:setup
```

Executes `db:init` ➔ `db:migrate` ➔ `db:seed:ref`.

---

## 4. MySQL DDL & Transaction Limitations

> [!IMPORTANT]
> In MySQL, Data Definition Language (DDL) statements (such as `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`) cause an **implicit commit**. They cannot be rolled back inside an explicit transaction block (`START TRANSACTION` / `ROLLBACK`).

**Best Practices for Production Migrations:**
1. Always write migrations with idempotent checks where possible (e.g. `CREATE TABLE IF NOT EXISTS`, conditional column/index checks via `INFORMATION_SCHEMA`).
2. Always perform a verified database backup before applying migrations in production.
3. Test every migration against a staging replica before running on production.

---

## 5. Backup & Disaster Recovery Procedures

### Creating a Database Snapshot / Backup

Export a complete snapshot using the integrated npm script:

```bash
npm run db:dump
```

Or manually with routines, triggers, and transactions:

```bash
mysqldump -u <user> -p \
  --single-transaction \
  --no-tablespaces \
  --routines \
  --triggers \
  --complete-insert \
  smart_campus > database/mysql/data_dump.sql
```

### Restoring from Database Snapshot

To restore the complete database state from `data_dump.sql`:

```bash
mysql -u <user> -p smart_campus < database/mysql/data_dump.sql
```

---

## 6. Table Relational Hierarchy

```text
schools (1) ────< departments (N)
                      │
                      ├───< faculty (N) ────< users (1:1)
                      ├───< programmes (N) ───< batches (N) ───< students (N) ────< users (1:1)
                      └───< classrooms (N) ───< devices (N)

academic_years (1) ────< academic_terms (N) ────< course_offerings (N)
                                                        │
                                                        └───< sections (N)
                                                                 │
                                                                 ├───< enrollments (N)
                                                                 └───< timetable_slots (N)
                                                                            │
                                                                            └───< class_sessions (N)
                                                                                      │
                                                                                      ├───< attendance_records (N)
                                                                                      └───< session_reconciliation (1)
```

