# Joy University Smart Campus ERP — Backend API

Enterprise backend service for the Joy University Smart Campus Enterprise Resource Planning (ERP) platform. Built with **Node.js**, **Express**, and **MySQL**, providing high-integrity academic hierarchy management, timetable conflict resolution, biometric attendance workflows, and role-based portal endpoints.

---

## 1. System Architecture & Tech Stack

- **Runtime:** Node.js (v20+ / v22 LTS)
- **Framework:** Express.js REST API
- **Primary Database:** MySQL 8.0+ / InnoDB (Authoritative relational store)
- **Secondary Database:** MongoDB (Document-level attendance audit trails)
- **Authentication:** Stateless JSON Web Token (JWT) with server-side blacklist revocation (`revoked_tokens`)
- **Role-Based Access Control (RBAC):** `ADMIN`, `FACULTY`, `STUDENT`, `OPERATOR`, `VIEWER`
- **Security:** Helmet HTTP headers, explicit-origin CORS policy, parameterized SQL queries

### Academic Hierarchy Workflow:
```text
School
  └── Department
        └── Programme
              └── Batch
                    └── Academic Year
                          └── Academic Term (ODD / EVEN / SUMMER)
                                └── Course Offering
                                      └── Section (with capacity enforcement)
                                            ├── Student Enrollments & Roster
                                            └── Timetable Slots (conflict detection)
                                                  └── Class Sessions
                                                        └── Attendance Records
```

---

## 2. Prerequisites & Environment Setup

### Prerequisites
- Node.js `v20.x` or `v22.x`
- MySQL Server `8.0+`
- (Optional) MongoDB `7.0+` for attendance raw log archiving

### Configuration
1. Clone the repository and install dependencies:
   ```bash
   npm ci
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Configure your environment variables:
   ```ini
   PORT=5000
   NODE_ENV=production
   CLIENT_URL=http://localhost:5173
   
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=smart_campus_user
   DB_PASSWORD=your_secure_password
   DB_NAME=smart_campus
   
   JWT_SECRET=your_secure_random_64_character_hex_secret_here
   JWT_EXPIRES_IN=1d
   ```

---

## 3. Database Setup, Migrations & Disaster Recovery

### A. First-Time Database Initialization (Fresh Install)

To create the database and initialize all 31 relational tables from scratch:

```bash
# Automated setup (initializes schema, baselines migrations, seeds reference catalogs):
npm run db:setup
```

Or step-by-step:
```bash
# 1. Initialize schema and baseline tracking
npm run db:init

# 2. Seed official institutional reference catalogs
npm run db:seed:ref
```

### B. Safe Incremental Migrations (Existing Database Upgrades)

When deploying new features with database schema updates:

```bash
npm run db:migrate
```

- Inspects the `schema_migrations` table to determine pending files in `database/mysql/migrations/`.
- Executes pending migrations deterministically in alphabetical order.
- Records executed migrations in `schema_migrations` to prevent duplicate execution.
- Employs non-destructive DDL and safe `INFORMATION_SCHEMA` conditional execution.

### C. Seeding Development Demo Data (Local QA Only)

Populates sample classrooms, course offerings, sections, batches, and demo login accounts:

```bash
npm run db:seed:demo
```

> [!WARNING]
> Never execute `npm run db:seed:demo` on a production database. The script automatically aborts if `NODE_ENV=production`.

#### Pre-configured Demo Accounts:
- **System Admin:** `admin` / `Admin@123`
- **Faculty Member:** `FAC001` / `Faculty@123`
- **Student Portal:** `J26AIM001` / `Student@123`

### D. Production Backup & Disaster Recovery

#### Pre-Deployment Database Backup:
```bash
mysqldump -u <user> -p \
  --single-transaction \
  --routines \
  --triggers \
  --databases smart_campus > backup_smart_campus_$(date +%Y%m%d_%H%M%S).sql
```

#### Database Restoration:
```bash
mysql -u <user> -p smart_campus < backup_smart_campus_<timestamp>.sql
```

> [!IMPORTANT]
> **MySQL DDL Transaction Limitation**: In MySQL, DDL statements (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`) trigger an implicit transaction commit. Always perform a pre-deployment database backup before applying migrations in production.

For detailed table-by-table schema documentation, refer to [`database/mysql/README.md`](database/mysql/README.md).

---

## 4. Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## 5. Automated Testing & Code Quality

The backend test suite uses Node.js built-in test runner against the real database with strict rollbacks, deterministic fixtures, and relational isolation:

```bash
# Run all automated API and regression tests:
npm test

# Run tests with code coverage analysis:
npm run test:coverage
```

### Test Suite Highlights:
- **Total Tests:** 109 passing tests (0 failures, 0 skipped)
- **Line Coverage:** 79.28%
- **Function Coverage:** 92.00%
- **Branch Coverage:** 57.89%
- **Modules Covered:** Authentication, Token Revocation, RBAC, Academic Hierarchy (Schools, Depts, Programmes, Batches, Terms), Course Offerings, Sections, Enrollments & Rosters, Timetable Conflict Detection, Class Sessions, Biometric Attendance State Machine, Reconciliation, Student Portal, Faculty Portal, Admin Reports.

---

## 6. Production Security Best Practices

1. **Explicit CORS**: `CLIENT_URL` explicitly limits allowed frontend origins; wildcard origins are disallowed.
2. **Server-Side Token Revocation**: Logout immediately writes the token `jti` to `revoked_tokens`; revoked tokens are rejected across all endpoints.
3. **Capacity Constraints**: Section enrollments enforce `max_strength` server-side to prevent over-enrollment.
4. **Relational Deletion Protection**: Relational deletion safeguards prevent orphan records and data loss (e.g. academic terms with offerings, batches with students, sections with attendance).
5. **SQL Injection Resistance**: All SQL queries use parameterized queries (`?`) via `mysql2/promise`.

---

## 7. License

Proprietary — Joy University Smart Campus ERP. All rights reserved.

