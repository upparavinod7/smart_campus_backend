# Smart Campus ERP - Development Tracker

> **Authoritative Location**: `smart_campus_backend/docs/DEVELOPMENT_TRACKER.md`  
> **Institution**: Joy University  
> **System**: Smart Campus ERP System  
> **Last Verified Update**: 2026-10-09T10:15:00+05:30  

---

## 1. Executive Summary & Progress Metrics

| Metric | Count |
| :--- | :--- |
| **Total Identified Features** | 16 Features + 1 Release Milestone |
| **Backend Feature Implementation** | 16 / 16 Completed |
| **Backend Regression Test Suite** | 109 / 109 Passing (0 failed, 0 skipped, duration ~3.2s) |
| **Backend Code Coverage** | Lines: 79.28% \| Functions: 92.06% \| Branches: 57.86% |
| **MySQL Database System** | Complete (31 tables in schema.sql, 00_create_database.sql, migrations runner with schema_migrations tracking, reference_data.sql & demo_data.sql seeds, database/mysql/README.md) |
| **Academic Hierarchy Implementation** | Complete (School ➔ Department ➔ Program ➔ Batch ➔ Academic Year/Term ➔ Course Offering ➔ Section ➔ Timetable ➔ Class Session ➔ Attendance Records, Section + Student ➔ Enrollment) |
| **Semester Workflows & Isolation** | Complete (FEAT-016: Academic Years & Terms APIs, Enrollments & Section Rosters, Semester-Isolated Timetable Engine, Student & Faculty Portal Term Filters, Admin Attendance Reports) |
| **UI Stabilization & Bug Resolution** | Complete (FEAT-014/FEAT-015: HTML error sanitization, 404 JSON fallback, ConfirmDialog modal, responsive layouts, CRUD verification) |
| **Backend Release Branch** | `release/v1.1.0-mvp` @ `ffbce24` |
| **Frontend Release Branch** | `release/v1.1.0-mvp` @ `a584063` |
| **Frontend Build & Lint Quality** | 0 lint errors, production Vite build passed (247ms) |
| **Cross-Role E2E Persona QA** | 100% Verified (Admin, Faculty, Student authentic workflows, 5-tier filtering & security barriers) |
| **Release Readiness Status** | Release Branches Verified & Complete — Ready for Review & Explicit Approval for `main` Merge |

---

## 2. Feature Matrix & Status Tracker

### `FEAT-001`: Core Authentication & Profile Handshake
- **Feature ID**: `FEAT-001`
- **Feature Name**: Core Authentication & Profile Handshake
- **Module**: Authentication & Session Management
- **Backend Status**: `TESTED`
- **Frontend Status**: `PUSHED`
- **API Endpoints**:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
  - `GET /api/v1/student/me`
- **Backend Branch**: `frontend/integration`
- **Backend Commit SHA**: `42e6192`
- **Frontend Branch**: `feature/student-portal-baseline`
- **Frontend Commit SHA**: `c8f408b02446ee9d28dbd6d35368a5c181512fd5`
- **Backend Test Results**: Tested with SQL & JWT verification
- **Frontend Build/Test Results**: Build succeeded (`vite build` passed)
- **Integration Test Results**: Verified login payload & JWT storage
- **Backend Push Status**: `PENDING`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/feature/student-portal-baseline`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge into integration branch
- **Last Verified Update**: 2026-09-28T19:50:00+05:30

---

### `FEAT-002`: Shared ERP Layout, Role Navigation & Centralized API Client
- **Feature ID**: `FEAT-002`
- **Feature Name**: Shared ERP Layout, Role Navigation & Centralized API Client
- **Module**: UI/UX Foundation & Navigation
- **Backend Status**: `IMPLEMENTED` (all role routes defined)
- **Frontend Status**: `PUSHED`
- **API Endpoints**:
  - `src/api/client.js`
  - `src/api/auth.js`
  - `src/api/student.js`
  - `src/api/admin.js`
  - `src/api/attendance.js`
- **Backend Branch**: `frontend/integration`
- **Backend Commit SHA**: `42e6192`
- **Frontend Branch**: `feature/shared-erp-layout-and-navigation`
- **Frontend Commit SHA**: `39ed67efb7f118c183ebb98f40d9595666fc031b`
- **Backend Test Results**: Controller routes and middleware verified
- **Frontend Build/Test Results**: `npm run lint` PASSED (0 errors, 0 warnings), `npm run build` PASSED (242ms production build)
- **Integration Test Results**: Verified sidebar links for Student, Admin, Faculty; restored "My Courses" quick link; connected unified layout
- **Backend Push Status**: `PENDING`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/feature/shared-erp-layout-and-navigation`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Implement backend institutional stats endpoint `GET /api/v1/admin/dashboard-stats`
- **Last Verified Update**: 2026-09-28T19:50:00+05:30

---

### `FEAT-003`: Student Portal (Dashboard, Attendance, Timetable, Courses)
- **Feature ID**: `FEAT-003`
- **Feature Name**: Complete Student Portal
- **Module**: Student Portal
- **Backend Status**: `TESTED`
- **Frontend Status**: `IMPLEMENTED`
- **API Endpoints**:
  - `GET /api/v1/student/me`
  - `GET /api/v1/student/me/attendance`
  - `GET /api/v1/student/me/attendance/summary`
  - `GET /api/v1/student/me/dashboard`
  - `GET /api/v1/student/me/timetable`
  - `GET /api/v1/student/me/courses`
- **Backend Branch**: `frontend/integration`
- **Backend Commit SHA**: `42e6192`
- **Frontend Branch**: `feature/student-portal`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Controller queries verified against database schema
- **Frontend Build/Test Results**: Verified with Vite build
- **Integration Test Results**: Verified attendance summary, timetable, courses render
- **Backend Push Status**: `PENDING`
- **Frontend Push Status**: `PENDING`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Connect `attendance` history and `dashboard` overview
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

---

### `FEAT-004`: Admin Dashboard & Institutional Analytics
- **Feature ID**: `FEAT-004`
- **Feature Name**: Admin Dashboard & Institutional Analytics
- **Module**: Administrative Dashboard
- **Backend Status**: `PUSHED`
- **Frontend Status**: `PUSHED`
- **API Endpoints**:
  - `GET /api/v1/admin/dashboard-stats`
- **Backend Branch**: `feature/admin-dashboard-stats`
- **Backend Commit SHA**: `5f86503`
- **Frontend Branch**: `feature/shared-erp-layout-and-navigation`
- **Frontend Commit SHA**: `39ed67efb7f118c183ebb98f40d9595666fc031b`
- **Backend Test Results**: `npm test` PASSED (5 integration tests passing)
- **Frontend Build/Test Results**: `npm run lint` & `npm run build` PASSED
- **Integration Test Results**: Verified metrics aggregation from MySQL queries and role-guarded access
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/admin-dashboard-stats`
  - Frontend: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/feature/shared-erp-layout-and-navigation`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user PR merge approval
- **Last Verified Update**: 2026-09-28T19:55:00+05:30

---

### `FEAT-005`: Student Information Management (CRUD)
- **Feature ID**: `FEAT-005`
- **Feature Name**: Student Information Management (CRUD)
- **Module**: Student Management
- **Backend Status**: `PUSHED`
- **Frontend Status**: `PUSHED`
- **API Endpoints**:
  - `GET /api/v1/students`
  - `GET /api/v1/students/:id`
  - `POST /api/v1/students`
  - `PUT /api/v1/students/:id`
  - `DELETE /api/v1/students/:id`
- **Backend Branch**: `feature/admin-student-management`
- **Backend Commit SHA**: `2154ed8`
- **Frontend Branch**: `feature/admin-student-management`
- **Frontend Commit SHA**: `fb0189b`
- **Backend Test Results**: `npm test` PASSED (12/12 integration tests passing including RBAC guards, payload validation, batch affiliation, duplicate check, and complete lifecycle)
- **Frontend Build/Test Results**: `npm run lint` & `npm run build` PASSED (0 errors, 0 warnings, production build succeeded in 216ms)
- **Integration Test Results**: Verified full admin CRUD workflows (directory table, interactive detail inspection modal, create student with batch cohort dropdown, edit profile, and delete confirmation with foreign key handling)
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/admin-student-management`
  - Frontend: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/feature/admin-student-management`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge; proceed to FEAT-006 (Faculty and Staff Management)
- **Last Verified Update**: 2026-09-29T09:15:00+05:30

---

### `FEAT-006`: Faculty and Staff Management (CRUD)
- **Feature ID**: `FEAT-006`
- **Feature Name**: Faculty and Staff Management (CRUD)
- **Module**: Faculty & Staff Management
- **Backend Status**: `TESTED`
- **Frontend Status**: `PUSHED`
- **API Endpoints**:
  - `GET /api/v1/staff/t`
  - `GET /api/v1/staff/t/:id`
  - `POST /api/v1/staff/t`
  - `PUT /api/v1/staff/t/:id`
  - `DELETE /api/v1/staff/t/:id`
  - `GET /api/v1/faculty` (and related `/faculty` aliases)
- **Backend Branch**: `feature/admin-faculty-staff-management`
- **Backend Commit SHA**: `6540fa0`
- **Frontend Branch**: `feature/admin-faculty-staff-management`
- **Frontend Commit SHA**: `1c160bf`
- **Backend Test Results**: Verified 22 automated integration tests passing (`node --test src/test/api.test.js`) covering RBAC (401/403 for unauthorized & STUDENT roles), validation (400 for required fields, invalid department_id, invalid designation_id), conflict handling (409 for duplicate employee_code and email), full CRUD lifecycle, joins for department & designation metadata, soft deactivation (`is_active = 0`), and repeat deactivation rejection (400)
- **Frontend Build/Test Results**: Verified `npm run lint` (0 errors) and production build `npm run build` (0 errors)
- **Integration Test Results**: Verified complete admin CRUD interface using shared `DataTable`, `Modal`, `Alert`, `Badge`, and `LoadingSpinner`. Includes staff directory with search & pagination, profile details modal, create & edit modals with department and designation dropdowns, and soft deactivation confirmation modal.
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/admin-faculty-staff-management`
  - Frontend: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/feature/admin-faculty-staff-management`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge; proceed to FEAT-007 (Department Management CRUD)
- **Last Verified Update**: 2026-09-29T09:40:00+05:30

---

### `FEAT-007`: Department Management (CRUD)
- **Feature ID**: `FEAT-007`
- **Feature Name**: Department Management (CRUD)
- **Module**: Department Management
- **Backend Status**: `TESTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/departments`
  - `GET /api/v1/departments/:id`
  - `POST /api/v1/departments`
  - `PUT /api/v1/departments/:id`
  - `DELETE /api/v1/departments/:id`
- **Backend Branch**: `feature/admin-department-management`
- **Backend Commit SHA**: `165af19`
- **Frontend Branch**: `feature/admin-department-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: `npm test` PASSED (32/32 integration tests passing including 9 dedicated department tests covering unauthenticated rejection 401, RBAC authorization guards 403 for STUDENT on mutations, required field validation 400, invalid foreign key `school_id` validation 400, non-existent entity handling 404, duplicate name per school conflict 409 `ER_DUP_ENTRY`, full CRUD lifecycle with school join `school_name` and `school_code`, search filtering, and soft deactivation `is_active = 0` with repeat deactivation rejection 400)
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Verified full backend lifecycle with MySQL `departments` table joined with `schools`
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/admin-department-management`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge; proceed to FEAT-008 (Campus Block & Classroom Management)
- **Last Verified Update**: 2026-09-30T14:48:00+05:30

---

### `FEAT-008`: Campus Block & Classroom Management (CRUD)
- **Feature ID**: `FEAT-008`
- **Feature Name**: Campus Block & Classroom Management (CRUD)
- **Module**: Infrastructure Management
- **Backend Status**: `TESTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/blocks`
  - `GET /api/v1/blocks/:id`
  - `POST /api/v1/blocks`
  - `PUT /api/v1/blocks/:id`
  - `DELETE /api/v1/blocks/:id`
  - `GET /api/v1/classrooms`
  - `GET /api/v1/classrooms/:id`
  - `POST /api/v1/classrooms`
  - `PUT /api/v1/classrooms/:id`
  - `DELETE /api/v1/classrooms/:id`
- **Backend Branch**: `feature/admin-block-classroom-management`
- **Backend Commit SHA**: `8db2cd3`
- **Frontend Branch**: `feature/admin-block-classroom-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: `npm test` PASSED (43/43 integration tests passing including 20 dedicated block & classroom tests covering unauthenticated rejection 401, RBAC authorization guards 403 for STUDENT role on mutations, required field validation 400 for code/name/room_no/block_id/department_id, foreign key validation 400 for invalid block_id and department_id, inactive block assignment rejection 400, capacity validation 400 for negative/zero/non-integer values, non-existent entity handling 404, duplicate constraint conflicts 409 for duplicate block code/name and duplicate room_no per block, classroom queries with relational joins to `blocks` (`block_name`, `block_code`) and `departments` (`department_name`, `department_code`), query filtering by block_id/department_id/search/is_active, and soft deactivation `is_active = 0` with repeat deactivation rejection 400)
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Verified full backend lifecycle with MySQL `blocks` and `classrooms` tables with `departments` foreign key migration (002)
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/admin-block-classroom-management`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge; proceed to FEAT-009 (Attendance Session & Record Management)
- **Last Verified Update**: 2026-09-30T15:15:00+05:30

---

### `FEAT-009`: Attendance Session & Record Management
- **Feature ID**: `FEAT-009`
- **Feature Name**: Attendance Session & Record Management
- **Module**: Attendance Management
- **Backend Status**: `TESTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/attendance/sessions`
  - `GET /api/v1/attendance/sessions/:id`
  - `POST /api/v1/attendance/sessions`
  - `PUT /api/v1/attendance/sessions/:id`
  - `POST /api/v1/attendance/sessions/:id/start`
  - `POST /api/v1/attendance/sessions/:id/finalize`
  - `POST /api/v1/attendance/sessions/:id/reconcile`
  - `GET /api/v1/attendance/sessions/:id/status`
  - `GET /api/v1/attendance/sessions/:id/presence-pool`
  - `GET /api/v1/attendance/sessions/:id/presence-pool/members`
  - `GET /api/v1/attendance`
  - `GET /api/v1/attendance/:id`
  - `POST /api/v1/attendance`
  - `GET /api/v1/attendance/session/:sessionId`
  - `GET /api/v1/attendance/student/:studentId`
  - `GET /api/v1/attendance/student/:studentId/summary`
  - `GET /api/v1/attendance/staff/:facultyId`
  - `POST /api/v1/attendance/:id/override`
- **Backend Branch**: `feature/attendance-session-record-management`
- **Backend Commit SHA**: `4d32bbe`
- **Frontend Branch**: `feature/attendance-session-record-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: `npm test` PASSED (38/38 integration tests passing, including 15 dedicated attendance session, marking, state machine, reconciliation, and audit override tests covering unauthenticated rejection 401, RBAC authorization guards 403 for STUDENT role, faculty ownership validation 403, student privacy protection 403, required field validation 400 for slot_id/session_date/faculty_id/classroom_id/scheduled_start/scheduled_end, foreign key validation 400 for non-existent slot/faculty/classroom, time validation 400 for scheduled_end <= scheduled_start, non-existent entity handling 404, duplicate slot/date conflict 409, scheduled marking prevention 400, lifecycle state transitions SCHEDULED -> OPEN -> CLOSED with duplicate start/finalize rejection 400, closed session modification rejection 400, closed session marking rejection 400, automated session reconciliation with enrolled vs attended headcounts and variance tolerance calculation, and administrative override audit trailing in `attendance_corrections`)
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Verified full lifecycle across `class_sessions`, `attendance_records`, `attendance_corrections`, and `session_reconciliation` tables with relational metadata joins (`faculty`, `classrooms`, `sections`, `subjects`)
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/attendance-session-record-management`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge; proceed to FEAT-010 (Academic Offerings, Subjects & Timetable Overview)
- **Last Verified Update**: 2026-10-07T09:15:00+05:30

---

### `FEAT-010`: Academic Offerings, Subjects & Timetable Overview
- **Feature ID**: `FEAT-010`
- **Feature Name**: Academic Offerings, Subjects & Timetable Overview
- **Module**: Academics Management
- **Backend Status**: `TESTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/subjects`
  - `GET /api/v1/subjects/:id`
  - `POST /api/v1/subjects`
  - `PUT /api/v1/subjects/:id`
  - `DELETE /api/v1/subjects/:id`
  - `GET /api/v1/academics/subjects`
  - `GET /api/v1/course-offerings`
  - `GET /api/v1/course-offerings/:id`
  - `POST /api/v1/course-offerings`
  - `PUT /api/v1/course-offerings/:id`
  - `DELETE /api/v1/course-offerings/:id`
  - `GET /api/v1/academics/courses`
  - `GET /api/v1/sections`
  - `GET /api/v1/sections/:id`
  - `POST /api/v1/sections`
  - `PUT /api/v1/sections/:id`
  - `DELETE /api/v1/sections/:id`
  - `GET /api/v1/timetable`
  - `GET /api/v1/timetable/:id`
  - `POST /api/v1/timetable`
  - `PUT /api/v1/timetable/:id`
  - `DELETE /api/v1/timetable/:id`
- **Backend Branch**: `feature/academic-offerings-subjects-timetable`
- **Backend Commit SHA**: `c8b7d23`
- **Frontend Branch**: `feature/academic-offerings-subjects-timetable`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: `npm test` PASSED (50/50 tests passing including 27 dedicated academics tests covering subjects CRUD, soft deactivation, duplicate code rejection 409, course offerings CRUD, unique constraint (term_id, subject_id) 409, sections CRUD, unique constraint (offering_id, section_code) 409, timetable CRUD, schedule conflict detection across faculty, classroom, and section 409, boundary abutting slots handling 201, self-exclusion during update, and academics aliases)
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Verified full lifecycle across `subjects`, `course_offerings`, `sections`, and `timetable_slots` with relational joins to `departments`, `schools`, `academic_terms`, `academic_years`, `faculty`, `classrooms`, and `blocks`
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/academic-offerings-subjects-timetable`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge; proceed to FEAT-011 (Faculty Portal Workflows)
- **Last Verified Update**: 2026-10-07T10:20:00+05:30

---

### `FEAT-011`: Faculty Portal Workflows
- **Feature ID**: `FEAT-011`
- **Feature Name**: Faculty Portal Workflows
- **Module**: Faculty Portal
- **Backend Status**: `TESTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/faculty/me`
  - `GET /api/v1/faculty/dashboard`
  - `GET /api/v1/faculty/timetable`
  - `GET /api/v1/faculty/courses`
  - `GET /api/v1/faculty/sections`
  - `GET /api/v1/faculty/attendance/sessions`
  - `GET /api/v1/faculty/attendance/sessions/:id`
  - `POST /api/v1/faculty/attendance/sessions/:id/start`
  - `POST /api/v1/faculty/attendance/sessions/:id/finalize`
  - `GET /api/v1/faculty/attendance/sessions/:sessionId/roster`
  - `POST /api/v1/faculty/attendance/sessions/:sessionId/records`
  - `POST /api/v1/faculty/attendance/records/:id/override`
  - `GET /api/v1/faculty/attendance/summary`
- **Backend Branch**: `feature/faculty-portal-workflows`
- **Backend Commit SHA**: `16dd4cc`
- **Frontend Branch**: `feature/faculty-portal`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: 50/50 tests passed (`node --test src/test/api.test.js`)
- **Frontend Build/Test Results**: Pending
- **Integration Test Results**: Verified faculty auth, RBAC isolation (STUDENT/VIEWER/OPERATOR 403), cross-faculty ownership enforcement, session state machine, roster inspection, manual marking, duplicate checks, override audit logging, and attendance summary
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/faculty-portal-workflows`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Awaiting user approval to merge; proceed to FEAT-012 (Automated Test Suite & Quality Verification)
- **Last Verified Update**: 2026-10-07T11:35:00+05:30

---

### `FEAT-012`: Automated Test Suite & Quality Verification
- **Feature ID**: `FEAT-012`
- **Feature Name**: Automated Test Suite & Quality Verification
- **Module**: Testing & QA
- **Backend Status**: `TESTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**: All Backend REST Endpoints (`/auth/*`, `/admin/*`, `/students/*`, `/staff/t/*`, `/departments/*`, `/blocks/*`, `/classrooms/*`, `/attendance/*`, `/student/me/*`, `/subjects/*`, `/course-offerings/*`, `/sections/*`, `/timetable/*`, `/faculty/*`)
- **Backend Branch**: `feature/automated-test-suite-quality-verification`
- **Backend Commit SHA**: `a7318d0`
- **Frontend Branch**: `feature/testing-qa`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: 40/40 tests passed (`node --test src/test/api.test.js`, execution duration: ~1.95s, 0 failures, 0 skips, line coverage 72.46%, branch coverage 63.58%, function coverage 83.33%)
- **Frontend Build/Test Results**: Pending
- **Integration Test Results**: Verified 9 comprehensive verification suites: Extended Authentication & JWT Security, RBAC Security Matrix across 5 roles (ADMIN, FACULTY, STUDENT, VIEWER, OPERATOR), FEAT-006 Faculty Management CRUD lifecycle & constraints, FEAT-007 Department Management CRUD lifecycle & school constraints, FEAT-008 Block & Classroom Management CRUD & room constraints, FEAT-009 Attendance Session & Record Management lifecycle & override audit logging, Student Portal Workflows, Security Regression & SQL Injection resilience, Concurrency & Database Relational Integrity
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/automated-test-suite-quality-verification`
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Backend integration completed and verified with 94/94 passing tests
- **Last Verified Update**: 2026-10-07T12:16:00+05:30

---

### `INTEG-001`: Backend Master Integration & Regression Hardening
- **Feature ID**: `INTEG-001`
- **Feature Name**: Backend Master Integration & Regression Hardening
- **Module**: Core Backend Integration
- **Backend Status**: `TESTED`
- **Frontend Status**: `NOT_APPLICABLE`
- **API Endpoints**: Full Suite (`/auth/*`, `/admin/*`, `/students/*`, `/staff/t/*`, `/departments/*`, `/blocks/*`, `/classrooms/*`, `/attendance/*`, `/student/me/*`, `/subjects/*`, `/course-offerings/*`, `/sections/*`, `/timetable/*`, `/faculty/*`)
- **Backend Branch**: `feature/backend-integration`
- **Backend Commit SHA**: `32cf27f`
- **Frontend Branch**: N/A
- **Frontend Commit SHA**: N/A
- **Backend Test Results**: 94/94 integration tests passing (`npm test`, 0 failed, 0 skipped, line coverage 76.29%, branch coverage 60.16%, function coverage 90.26%)
- **Frontend Build/Test Results**: N/A
- **Integration Test Results**: Verified full consolidation of FEAT-005 through FEAT-012 with strict RBAC, database foreign key integrity, schedule conflict engine, token revocation, and faculty ownership isolation.
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: N/A
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/backend-integration`
- **Merge Status**: Ready for merge to `main`
- **Blockers**: None
- **Last Verified Update**: 2026-10-07T13:48:00+05:30

---

### `INTEG-002`: Frontend API Integration, Role-Based 403 Routing Resolution, Academics Management & Full QA
- **Feature ID**: `INTEG-002`
- **Feature Name**: Frontend API Integration, Role-Based 403 Routing Resolution, Academics Management & Full QA
- **Module**: Frontend Client & UI
- **Backend Status**: `TESTED`
- **Frontend Status**: `TESTED & PUSHED`
- **API Endpoints**: All Backend APIs wired to dedicated client modules (`src/api/auth.js`, `src/api/admin.js`, `src/api/student.js`, `src/api/faculty.js`, `src/api/academics.js`, `src/api/attendance.js`)
- **Backend Branch**: `feature/backend-integration`
- **Backend Commit SHA**: `32cf27f`
- **Frontend Branch**: `feature/frontend-integration`
- **Frontend Commit SHA**: `12d0e22`
- **Backend Test Results**: 94/94 passing tests
- **Frontend Build/Test Results**: ESLint 0 errors / 0 warnings (`npm run lint`), Vite production build succeeded in 269ms (`npm run build`)
- **Integration Test Results**: 
  - Complete multi-persona E2E test passed for Faculty (`FAC001`), Admin (`admin`), and Student (`J26AIM001`).
  - Resolved 403 Forbidden errors for Faculty by creating dedicated faculty views (`FacultyTimetableView`, `FacultySessionsView`, `FacultyAttendanceLogsView`, `FacultyDashboardOverview`) that call `/api/v1/faculty/*` endpoints rather than student/admin endpoints.
  - Implemented comprehensive Academics Management UI (`AcademicsManagementView.jsx`) with 4 tabs: Subjects, Course Offerings, Sections, and Timetable with schedule conflict alerts.
  - Verified cross-role security boundaries (RBAC 403 Forbidden enforced without weakening permissions).
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**:
  - Frontend: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/feature/frontend-integration`
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/backend-integration`
- **Merge Status**: Ready for merge to `main`
- **Blockers**: None
- **Last Verified Update**: 2026-10-07T15:00:00+05:30

---

### `FEAT-013`: Hierarchical Academic Structure & Timetable Integration
- **Feature ID**: `FEAT-013`
- **Feature Name**: Hierarchical Academic Structure & Timetable Integration
- **Module**: Academics, Curriculum & Timetable Architecture
- **Hierarchy Model**:
  ```text
  School ➔ Department ➔ Program ➔ Batch ➔ Section ➔ Timetable ➔ Class Session ➔ Attendance Records
  ```
- **Backend Status**: `TESTED & PUSHED`
- **Frontend Status**: `TESTED & PUSHED`
- **API Endpoints**:
  - `GET /api/v1/schools` (list schools with department counts, search filter)
  - `GET /api/v1/schools/:id` (school details with departments)
  - `POST /api/v1/schools` (create school, ADMIN only, code/name duplicate guarded)
  - `PUT /api/v1/schools/:id` (update school, ADMIN only)
  - `DELETE /api/v1/schools/:id` (soft deactivate school, ADMIN only)
  - `GET /api/v1/departments?school_id=:id` (departments filtered by school, joined with school metadata)
  - `GET /api/v1/programs` / `GET /api/v1/programmes` (list programs with school, department, degree metadata)
  - `GET /api/v1/programs/:id` (program details with batches array)
  - `POST /api/v1/programs` (create program, ADMIN only, school/degree/dept validation, duplicate identity 409)
  - `PUT /api/v1/programs/:id` (update program, ADMIN only)
  - `DELETE /api/v1/programs/:id` (soft deactivate program, ADMIN only)
  - `GET /api/v1/batches` (list batches with program, academic year, section/student counts)
  - `GET /api/v1/batches/:id` (batch details with sections list)
  - `POST /api/v1/batches` (create batch, ADMIN only, duplicate programme + year 409)
  - `PUT /api/v1/batches/:id` (update batch, ADMIN only)
  - `DELETE /api/v1/batches/:id` (delete batch with student and section dependency safeguards)
  - `GET /api/v1/degrees` (list academic degrees)
  - `GET /api/v1/sections?batch_id=:id` (sections joined with batch, program, department, and school)
  - `POST /api/v1/sections` (accepts batch_id, foreign key verified)
  - `GET /api/v1/timetable` (timetable slots joined with batch, program, department, and school, filtered by 5 tiers)
- **Database Schema Enhancements**:
  - Migration `database/mysql/002_add_batch_id_to_sections.sql`: Added `batch_id INT UNSIGNED NULL` to `sections` table with foreign key `fk_sec_batch` referencing `batches(batch_id) ON DELETE RESTRICT` and index `idx_sections_batch_id`. Seed sections backfilled to batch 4 (`2026-30`).
- **Backend Branch**: `feature/hierarchical-timetable-attendance`
- **Backend Commit SHA**: `291610c`
- **Frontend Branch**: `feature/hierarchical-timetable-attendance`
- **Frontend Commit SHA**: `70a4bd6`
- **Backend Test Results**: 99/99 passing tests (`npm test`, 0 failed, 0 skipped, duration ~2.9s, line coverage 77.17%, function coverage 91.24%)
- **Frontend Build/Test Results**: ESLint 0 errors / 0 warnings (`npm run lint`), Vite production build succeeded in 292ms (`npm run build`)
- **Integration Test Results**:
  - Full CRUD and RBAC verification on Schools, Programs, Batches, and hierarchical Sections.
  - Verification of department-school foreign key enforcement and rejection of cross-school department mismatches (400).
  - Verification of batch dependency protection preventing deletion of batches with active students or sections (400).
  - Verification of 5-tier filtering on timetable slots (`school_id`, `department_id`, `programme_id`, `batch_id`, `section_id`).
  - Strict preservation of timetable conflict engine: faculty, classroom, and section overlap checks (409) and boundary abutting slots (201).
  - Frontend Academics Management UI (`AcademicsManagementView.jsx`) equipped with 5-tier cascading dropdown filter, Academic Structure sub-management (Schools, Programs, Batches), batch-aware Section allocation, and program/batch tags in timetable cards.
  - Faculty Schedule (`FacultyTimetableView.jsx`) updated to display Program, Batch, and Section badges on assigned lectures.
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/hierarchical-timetable-attendance`
  - Frontend: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/feature/hierarchical-timetable-attendance`
- **Merge Status**: Open (Ready for user review and merge)
- **Blockers**: None
- **Last Verified Update**: 2026-10-09T10:15:00+05:30

---

### `FEAT-014`: Smart Campus ERP UI Stabilization, Error Resolution & Professional UI/UX Refinement
- **Feature ID**: `FEAT-014`
- **Feature Name**: Smart Campus ERP UI Stabilization, Error Resolution & Professional UI/UX Refinement
- **Module**: UI/UX Stabilization, Timetable Contract Alignment & Academic Hierarchy Filters
- **Backend Status**: `TESTED`
- **Frontend Status**: `PUSHED`
- **Issues Resolved & Root Cause Diagnostics**:
  1. **Timetable Slot Allocation Form 400 Error**:
     - *Root Cause*: Frontend `slotForm` state and Allocate Slot modal omitted the `effective_from` field, which is a strictly non-null `DATE` column in MySQL and required by the backend API.
     - *Resolution*: Exposed `effective_from` (defaulted to today `YYYY-MM-DD`) and optional `effective_to` in form state and modal; added date normalization and format validation on backend.
  2. **Cascading Filter Hierarchy Inconsistency**:
     - *Root Cause*: When `filterProgram` was `"ALL"`, batches from unrelated schools/departments leaked into the Batch dropdown. Similarly, when `filterBatch` was `"ALL"`, sections across other batches leaked into the Section dropdown.
     - *Resolution*: Scoped `filteredBatches` to only programs matching the active School/Dept filter, and scoped `filteredSections` to only batches matching active ancestor hierarchy.
  3. **Stacked Duplicate Headings & Redundant Subtitles**:
     - *Root Cause*: `AppLayout.jsx` rendered a static title/subtitle banner while child views (`AcademicsManagementView`, `DepartmentManagementView`, `FacultyTimetableView`, etc.) rendered redundant `<h2>` blocks with static subtitles.
     - *Resolution*: Standardized contextual page subtitles via `PAGE_SUBTITLES` in `Dashboard.jsx`, removed duplicate `<h2>` blocks from child views, and unified tab bars with primary action buttons.
  4. **Horizontally Scrolling Wide Timetable Tables**:
     - *Root Cause*: `DataTable.jsx` applied unconditional `whitespace-nowrap` on all table cells, forcing wide text columns to stretch beyond the viewport.
     - *Resolution*: Enhanced `DataTable.jsx` to support column-level text wrapping (`col.wrap`), styled long text cells to wrap naturally, and added empty state reset actions.
  5. **Cramped Modal Layout & Mobile Overflow**:
     - *Root Cause*: Allocate Slot modal used `max-w-md` for 7 inputs without grouping or scroll containers.
     - *Resolution*: Upgraded modal to `max-w-xl` with structured fieldsets (Academic Section, Faculty & Room, Weekly Schedule, Term Validity Window) and scrollable body (`max-h-[90vh] flex flex-col`).
- **Files Modified**:
  - Backend: `src/controllers/timetable.controller.js`, `src/test/api.test.js`
  - Frontend: `src/components/admin/AcademicsManagementView.jsx`, `src/components/admin/DepartmentManagementView.jsx`, `src/components/faculty/FacultyTimetableView.jsx`, `src/components/faculty/FacultySessionsView.jsx`, `src/components/faculty/FacultyAttendanceLogsView.jsx`, `src/components/common/DataTable.jsx`, `src/components/common/Modal.jsx`, `src/components/layout/AppLayout.jsx`, `src/components/Dashboard.jsx`
- **Backend Branch**: `fix/academic-timetable-ui-stabilization`
- **Backend Commit SHA**: `7bde9e0`
- **Frontend Branch**: `fix/academic-timetable-ui-stabilization`
- **Frontend Commit SHA**: `a91a934`
- **Backend Test Results**: 100 / 100 passing tests (`npm test`, 0 failed, 0 skipped, duration ~1.8s)
- **Frontend Build/Test Results**: ESLint 0 errors / 0 warnings (`npm run lint`), Vite production build succeeded in 209ms (`npm run build`)
- **Backend Push Status**: `PUSHED`
- **Frontend Push Status**: `PUSHED`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/fix/academic-timetable-ui-stabilization`
  - Frontend: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/fix/academic-timetable-ui-stabilization`
- **Merge Status**: Open (Ready for user review and PR merge)
- **Blockers**: None
- **Last Verified Update**: 2026-10-09T11:15:00+05:30

---

### `FEAT-015`: Smart Campus ERP Final UI Bug Fixes, CRUD Verification & Release Readiness
- **Feature ID**: `FEAT-015`
- **Feature Name**: Smart Campus ERP Final UI Bug Fixes, CRUD Verification & Release Readiness
- **Module**: Academic CRUD Operations, Error Sanitization, Application Confirmation Modals & Release Hardening
- **Backend Status**: `TESTED`
- **Frontend Status**: `TESTED`
- **Issues Resolved & Root Cause Diagnostics**:
  1. **Raw HTML Error Banners in UI (`Cannot DELETE /api/v1/...`)**:
     - *Root Cause*: Express default 404/500 handler returned HTML error documents (`<!DOCTYPE html><html lang="en">...<pre>Cannot DELETE /api/v1/course-offerings/3</pre>`) when endpoints were unhandled or routes mismatched. The frontend `apiClient` parsed non-JSON responses as `{ message: await response.text() }` and threw the entire raw HTML document as `error.message`, which was displayed in `<Alert>` banners.
     - *Resolution*:
       - **Backend**: Implemented 404 JSON fallback middleware in `src/routes/index.js` and global error handling middleware in `src/app.js` to ensure ALL errors and unhandled paths under `/api/v1` return structured JSON `{ success: false, message: ... }` with `Content-Type: application/json` (never raw HTML).
       - **Frontend**: Sanitized response parser in `src/api/client.js` to extract clean human-readable error text from `<pre>`/`<title>` tags, strip raw HTML, and provide helpful fallback messages based on HTTP status codes.
  2. **Route Aliases & Delete Lifecycle Coverage**:
     - *Root Cause*: Routes for `/timetable_slots`, `/academics/timetable`, `/academics/sections`, and `/course_offerings` lacked consistent aliases, and automated tests lacked comprehensive regression coverage for timetable deletion and unhandled 404 JSON responses.
     - *Resolution*: Expanded route aliases in `src/routes/index.js` and added automated test suite in `src/test/api.test.js` verifying RBAC (401/403), 404 JSON responses, and alias routing (101/101 tests passing).
  3. **Native `window.confirm()` Browser Popups**:
     - *Root Cause*: Academic CRUD operations (Schools, Programs, Batches, Subjects, Course Offerings, Sections, Timetable Slots) and attendance session finalization used native browser dialogs `window.confirm()`.
     - *Resolution*: Built reusable `ConfirmDialog.jsx` component with accessible keyboard navigation (Esc to cancel), item details card, distinct action variants (danger, warning, primary), and loading spinner. Replaced all 7 academic delete/deactivate confirmations in `AcademicsManagementView.jsx` and session finalization in `FacultySessionsView.jsx`.
  4. **Academic Tabs Horizontal Overflow & Crowded Header**:
     - *Root Cause*: Tabs navigation used overly verbose labels (e.g. `Academic Structure (1 Schools / 1 Programs / 1 Batches)` taking 65+ chars) and shared a non-wrapping flex row with the contextual action button, causing horizontal scrollbars and button clipping.
     - *Resolution*: Replaced verbose text with compact tab titles and pill count badges, wrapped tabs in a responsive scrollable `<nav>` container with `min-w-0 flex-1`, and aligned the primary contextual action button cleanly on the right with `shrink-0`.
- **Files Modified**:
  - Backend: `src/app.js`, `src/routes/index.js`, `src/test/api.test.js`
  - Frontend: `src/api/client.js`, `src/components/common/ConfirmDialog.jsx` (New), `src/components/admin/AcademicsManagementView.jsx`, `src/components/faculty/FacultySessionsView.jsx`
- **Backend Branch**: `fix/academic-crud-api-errors`
- **Backend Commit SHA**: `9e8563c`
- **Frontend Branch**: `fix/academic-crud-api-errors`
- **Frontend Commit SHA**: `2f72300`
- **Backend Test Results**: 101 / 101 passing tests (`npm test`, 0 failed, 0 skipped, duration ~2.5s)
- **Frontend Build/Test Results**: ESLint 0 errors / 0 warnings (`npm run lint`), Vite production build succeeded in 247ms (`npm run build`)
- **Backend Push Status**: `READY_TO_PUSH`
- **Frontend Push Status**: `READY_TO_PUSH`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/fix/academic-crud-api-errors`
  - Frontend: `https://github.com/sahayaglancy35-blip/smart_campus_frontend/pull/new/fix/academic-crud-api-errors`
- **Merge Status**: Open (Ready for user review and PR merge)
- **Blockers**: None
- **Last Verified Update**: 2026-10-09T12:10:00+05:30

---

### `FEAT-016`: Academic Hierarchy, Semester Timetable, Attendance, Faculty and Student Portals
- **Feature ID**: `FEAT-016`
- **Feature Name**: Academic Hierarchy, Semester Timetable, Attendance, Faculty and Student Portals Implementation
- **Module**: Academic Management, Semester Timetable Scheduling, Student Enrollments, Portal Isolation, and Administrative Reporting
- **Backend Status**: `TESTED`
- **Frontend Status**: `READY_FOR_INTEGRATION`
- **Architectural Scope & Technical Accomplishments**:
  1. **Academic Years (`academic_years`) Management**:
     - Full REST API with endpoints (`GET`, `GET :id`, `POST`, `PUT`, `DELETE /api/v1/academic-years`) and route aliases (`/academics/years`, `/academics/academic-years`).
     - Validation: `label` format, start/end dates integrity (`start_date < end_date`), unique constraint enforcement (409 Conflict).
     - Safeguards: Relational protection prevents deletion of academic years linked to academic terms or batches (409 Conflict).
  2. **Academic Terms (`academic_terms`) Management**:
     - Full REST API with endpoints (`GET`, `GET :id`, `POST`, `PUT`, `DELETE /api/v1/academic-terms`) and route aliases (`/academics/terms`, `/academics/academic-terms`).
     - Validation: parent `academic_year_id` existence, enum validation (`ODD`, `EVEN`, `SUMMER`), dates within valid range.
     - Uniqueness: composite constraint `(academic_year_id, term_type)` strictly enforced (409 Conflict).
     - Safeguards: Relational protection prevents deletion of terms referenced in active course offerings (409 Conflict).
  3. **Student Enrollments (`enrollments`) & Section Rosters**:
     - Full REST API with endpoints (`GET`, `GET :id`, `POST`, `PUT`, `DELETE /api/v1/enrollments`) and route aliases (`/academics/enrollments`).
     - Section Roster endpoints (`GET /api/v1/sections/:id/roster` and `GET /api/v1/sections/:id/students`) returning detailed student rosters with registration status and attendance totals.
     - Validation & Capacity: checks student & section validity, enforces unique enrollment per student/section (409 Conflict), and strictly guards section capacity (`max_strength`) to prevent over-enrollment (400 Bad Request).
     - Dropping & Safeguards: allows status transition to `DROPPED` with `dropped_on` audit timestamp, preventing deletion when attendance records are present (409 Conflict).
  4. **Semester-Specific Timetable Engine Upgrade**:
     - Relational derivation: Timetable slots derive terms without schema denormalization (`timetable_slots ➔ sections ➔ course_offerings ➔ academic_terms ➔ academic_years`).
     - Extended payload: All timetable queries now expose `term_id`, `term_type`, `academic_year_id`, `academic_year_label`, and term date ranges.
     - Cascading filters: Supported `term_id`/`semester`, `academic_year_id`, `term_type`, and student enrollment filtering (`student_id`).
     - Scheduling rules: Preserves conflict prevention (faculty, classroom, section double-booking checks) while supporting adjacent abutting slots.
  5. **Student Portal Semester Isolation**:
     - `/api/v1/student/me/courses`: filtered by `term_id`/`semester` and `academic_year_id`, returning active enrolled courses.
     - `/api/v1/student/me/timetable`: strictly isolates timetable slots to the queried semester/term.
     - `/api/v1/student/me/attendance`: filters session attendance logs to the queried term.
     - `/api/v1/student/me/attendance/summary` & `/dashboard`: computes overall and subject-wise attendance percentages scoped strictly to the semester.
  6. **Faculty Portal Term-Scoped Workflows**:
     - `/api/v1/faculty/timetable`: filters weekly assigned timetable by term/semester.
     - `/api/v1/faculty/courses` & `/sections`: scopes assigned courses and sections to the active term.
     - `/api/v1/faculty/attendance/sessions`: filters sessions by term/semester with strict ownership checks.
     - `/api/v1/faculty/attendance/summary`: computes aggregate faculty attendance metrics scoped by term.
  7. **Admin Semester-Wise Reports & Aggregations**:
     - `/api/v1/admin/reports/attendance` & `/api/v1/attendance/report`: high-performance parameterized SQL reporting across terms, years, departments, programmes, batches, sections, and subjects.
     - Exposes session counts (total, completed, cancelled, open), record totals, and percentage compliance with granular section breakdown.
- **Files Added / Modified**:
  - Controllers Created: `src/controllers/academicYear.controller.js`, `src/controllers/academicTerm.controller.js`, `src/controllers/enrollment.controller.js`
  - Routes Created: `src/routes/academicYear.routes.js`, `src/routes/academicTerm.routes.js`, `src/routes/enrollment.routes.js`
  - Controllers Updated: `src/controllers/timetable.controller.js`, `src/controllers/section.controller.js`, `src/controllers/studentPortal.controller.js`, `src/controllers/facultyPortal.controller.js`, `src/controllers/admin.controller.js`, `src/controllers/attendance.controller.js`
  - Routes Updated: `src/routes/index.js`, `src/routes/section.routes.js`, `src/routes/admin.routes.js`, `src/routes/attendance.routes.js`
  - Automated Tests: `src/test/api.test.js` (+8 new test suites, 109/109 tests passing)
- **Backend Branch**: `feature/academic-hierarchy-semester-workflows`
- **Backend Commit SHA**: `bc1a6dd`
- **Backend Test Results**: 109 / 109 passing tests (`npm test`, 0 failed, 0 skipped, duration ~2.4s)
- **Backend Code Coverage**: Lines: 79.28% | Functions: 92.00% | Branches: 57.89%
- **Backend Push Status**: `READY_TO_PUSH`
- **Pull Request URLs**:
  - Backend: `https://github.com/upparavinod7/smart_campus_backend/pull/new/feature/academic-hierarchy-semester-workflows`
- **Merge Status**: Open (Ready for user review and PR merge)
- **Blockers**: None
- **Last Verified Update**: 2026-10-09T15:20:00+05:30

---

### `RELEASE-001`: Production Readiness, Complete MySQL Setup System & Main Release Candidate
- **Milestone ID**: `RELEASE-001`
- **Milestone Name**: Production Readiness, Complete MySQL Setup System & Main Branch Release Preparation
- **Module**: Database Initialization, Migration Runner, Reference Seeds, Environment Security, and Release Branches
- **Backend Status**: `VERIFIED_RELEASE_READY`
- **Frontend Status**: `VERIFIED_RELEASE_READY`
- **Architectural Scope & Technical Accomplishments**:
  1. **Comprehensive MySQL Database Setup System**:
     - `database/mysql/00_create_database.sql`: Initializes `smart_campus` database with `utf8mb4` encoding and collation.
     - `database/mysql/schema.sql`: Authoritative ordered DDL for all 31 relational tables with strict foreign keys, indexes, checks, and InnoDB engine.
     - `database/mysql/migrations/`: Ordered migration history (`001_create_revoked_tokens.sql`, `002_add_batch_id_to_sections.sql`).
     - `src/scripts/migrate.js`: Upgraded migration runner tracking versions in `schema_migrations`, guaranteeing deterministic execution and idempotency.
     - `src/scripts/initDb.js`: Automates fresh database creation, schema loading, and baselining.
     - `src/scripts/seedRef.js`: Seeds official institutional catalogs (`degrees`, `course_categories`, `designations`, `schools`, `departments`, `academic_years`, `academic_terms`, `system_settings`).
     - `src/scripts/seedDemo.js`: Seeds development/staging fixtures (demo infrastructure, offerings, sections, batches, students, enrollments, users) with automatic production guard.
     - `database/mysql/README.md`: Comprehensive documentation covering setup, migrations, backups with `mysqldump`, and MySQL DDL transaction limitations.
     - `npm` scripts: Added `db:init`, `db:migrate`, `db:seed:ref`, `db:seed:demo`, and `db:setup`.
  2. **Environment & Security Hardening**:
     - Mandatory environment variable validation at startup (`DB_USER`, `DB_NAME`, `JWT_SECRET`) in `src/server.js`.
     - Explicit origin CORS policy in `src/app.js` using `CLIENT_URL` (no wildcard with credentials).
     - Cleaned up login page demo credential autofill in frontend.
     - Comprehensive `.env.example` templates in both backend and frontend without exposed secrets.
  3. **Release Branches Prepared**:
     - Backend: `release/v1.1.0-mvp` @ commit `ffbce24` (integrating all features FEAT-001 through FEAT-016 and DB setup system).
     - Frontend: `release/v1.1.0-mvp` @ commit `a584063` (integrating FEAT-014/015 UI stabilization, ConfirmDialog, and cleaned login).
- **Backend Test Suite**: 109 / 109 passing tests (`npm test`, 0 failed, 0 skipped, duration ~3.2s)
- **Backend Coverage**: Lines: 79.28% | Functions: 92.06% | Branches: 57.86%
- **Frontend Quality**: ESLint: 0 errors | Vite production build: succeeded (247ms)
- **Merge Status**: Release branches verified, clean working trees, awaiting explicit user approval before merging into `main`.
- **Blockers**: None
- **Last Verified Update**: 2026-10-13T23:30:00+05:30

---

## 3. Authoritative API Inventory & Status

| Method | Endpoint | Allowed Roles | Auth Required | Purpose | Status | Frontend Component |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/test` | Any | No | API health check | `INTEGRATED` | System |
| `POST` | `/api/v1/auth/login` | Any | No | User login & JWT issuance | `INTEGRATED` | `LoginPage.jsx` |
| `GET` | `/api/v1/auth/me` | Authenticated | Yes | Current user context | `INTEGRATED` | `App.jsx` |
| `POST` | `/api/v1/auth/logout` | Authenticated | Yes | Server-side JWT revocation | `INTEGRATED` | `App.jsx` |
| `GET` | `/api/v1/student/me` | `STUDENT` | Yes | Student profile & degree details | `INTEGRATED` | `App.jsx`, `StudentDashboardOverview.jsx` |
| `GET` | `/api/v1/student/me/attendance/summary` | `STUDENT` | Yes | Aggregate attendance summary | `INTEGRATED` | `AttendanceSummaryView.jsx` |
| `GET` | `/api/v1/student/me/timetable` | `STUDENT` | Yes | Weekly class schedule | `INTEGRATED` | `StudentTimetableView.jsx` |
| `GET` | `/api/v1/student/me/courses` | `STUDENT` | Yes | Enrolled course list & credits | `INTEGRATED` | `StudentCoursesView.jsx` |
| `GET` | `/api/v1/student/me/attendance` | `STUDENT` | Yes | Granular session attendance log | `INTEGRATED` | `AttendanceHistoryView.jsx` |
| `GET` | `/api/v1/student/me/dashboard` | `STUDENT` | Yes | Full student dashboard payload | `INTEGRATED` | `StudentDashboardOverview.jsx` |
| `GET` | `/api/v1/students` | `ADMIN` | Yes | List all students | `INTEGRATED` | `StudentManagementView.jsx` |
| `GET` | `/api/v1/students/:id` | `ADMIN` | Yes | Retrieve single student profile | `INTEGRATED` | `StudentManagementView.jsx` (Detail Modal) |
| `POST` | `/api/v1/students` | `ADMIN` | Yes | Create student record | `INTEGRATED` | `StudentManagementView.jsx` (Create Modal) |
| `PUT` | `/api/v1/students/:id` | `ADMIN` | Yes | Update student record | `INTEGRATED` | `StudentManagementView.jsx` (Edit Modal) |
| `DELETE` | `/api/v1/students/:id` | `ADMIN` | Yes | Delete student record | `INTEGRATED` | `StudentManagementView.jsx` (Delete Modal) |
| `GET` | `/api/v1/staff/t` | Authenticated | Yes | List faculty members | `INTEGRATED` | `FacultyManagementView.jsx` |
| `GET` | `/api/v1/staff/t/:id` | Authenticated | Yes | Faculty member details | `INTEGRATED` | `FacultyManagementView.jsx` (Detail Modal) |
| `POST` | `/api/v1/staff/t` | `ADMIN` | Yes | Create faculty profile | `INTEGRATED` | `FacultyManagementView.jsx` (Create Modal) |
| `PUT` | `/api/v1/staff/t/:id` | `ADMIN` | Yes | Update faculty profile | `INTEGRATED` | `FacultyManagementView.jsx` (Edit Modal) |
| `DELETE` | `/api/v1/staff/t/:id` | `ADMIN` | Yes | Deactivate faculty profile | `INTEGRATED` | `FacultyManagementView.jsx` (Deactivate Modal) |
| `GET` | `/api/v1/schools` | Authenticated | Yes | List constituent schools with dept counts | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/schools/:id` | Authenticated | Yes | School details with departments list | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `POST` | `/api/v1/schools` | `ADMIN` | Yes | Create constituent school | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `PUT` | `/api/v1/schools/:id` | `ADMIN` | Yes | Update constituent school | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `DELETE` | `/api/v1/schools/:id` | `ADMIN` | Yes | Deactivate constituent school | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/departments` | Authenticated | Yes | List academic departments (filterable by school_id) | `INTEGRATED` | `DepartmentManagementView.jsx`, `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/departments/:id` | Authenticated | Yes | Department details with school metadata | `INTEGRATED` | `DepartmentManagementView.jsx` |
| `POST` | `/api/v1/departments` | `ADMIN` | Yes | Create academic department | `INTEGRATED` | `DepartmentManagementView.jsx` |
| `PUT` | `/api/v1/departments/:id` | `ADMIN` | Yes | Update academic department | `INTEGRATED` | `DepartmentManagementView.jsx` |
| `DELETE` | `/api/v1/departments/:id` | `ADMIN` | Yes | Delete department | `INTEGRATED` | `DepartmentManagementView.jsx` |
| `GET` | `/api/v1/programs` | Authenticated | Yes | List academic programs (filterable by school, dept) | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/programs/:id` | Authenticated | Yes | Program details with batches array | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `POST` | `/api/v1/programs` | `ADMIN` | Yes | Create academic program | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `PUT` | `/api/v1/programs/:id` | `ADMIN` | Yes | Update academic program | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `DELETE` | `/api/v1/programs/:id` | `ADMIN` | Yes | Deactivate academic program | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/batches` | Authenticated | Yes | List academic batches with counts | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/batches/:id` | Authenticated | Yes | Batch details with sections array | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `POST` | `/api/v1/batches` | `ADMIN` | Yes | Create academic batch | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `PUT` | `/api/v1/batches/:id` | `ADMIN` | Yes | Update academic batch | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `DELETE` | `/api/v1/batches/:id` | `ADMIN` | Yes | Delete batch (student/section dependency guarded) | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/degrees` | Authenticated | Yes | List academic degrees | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/blocks` | Authenticated | Yes | List campus blocks/buildings | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `GET` | `/api/v1/blocks/:id` | Authenticated | Yes | Campus block details | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `POST` | `/api/v1/blocks` | `ADMIN` | Yes | Create campus block | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `PUT` | `/api/v1/blocks/:id` | `ADMIN` | Yes | Update campus block | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `DELETE` | `/api/v1/blocks/:id` | `ADMIN` | Yes | Delete campus block | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `GET` | `/api/v1/classrooms` | Authenticated | Yes | List classrooms & labs | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `GET` | `/api/v1/classrooms/:id` | Authenticated | Yes | Classroom details | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `POST` | `/api/v1/classrooms` | `ADMIN` | Yes | Create classroom | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `PUT` | `/api/v1/classrooms/:id` | `ADMIN` | Yes | Update classroom | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `DELETE` | `/api/v1/classrooms/:id` | `ADMIN` | Yes | Deactivate classroom | `INTEGRATED` | `InfrastructureManagementView.jsx` |
| `GET` | `/api/v1/attendance/sessions` | Authenticated | Yes | List class attendance sessions | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `GET` | `/api/v1/attendance/sessions/:id` | Authenticated | Yes | Attendance session details | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `GET` | `/api/v1/attendance/sessions/:id/status` | Authenticated | Yes | Attendance session status | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `POST` | `/api/v1/attendance/sessions` | `ADMIN`, `FACULTY` | Yes | Create attendance session | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `POST` | `/api/v1/attendance/sessions/:id/start` | `ADMIN`, `FACULTY` | Yes | Open/start session | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `POST` | `/api/v1/attendance/sessions/:id/finalize` | `ADMIN`, `FACULTY` | Yes | Close/finalize session | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `GET` | `/api/v1/attendance` | Authenticated | Yes | List attendance records | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `GET` | `/api/v1/attendance/session/:sessionId` | Authenticated | Yes | Session roster attendance | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `POST` | `/api/v1/attendance` | `ADMIN`, `FACULTY` | Yes | Mark manual attendance | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `POST` | `/api/v1/attendance/:id/override` | `ADMIN`, `FACULTY` | Yes | Override attendance status | `INTEGRATED` | `AttendanceSessionsView.jsx` |
| `GET` | `/api/v1/admin/dashboard-stats` | `ADMIN` | Yes | Institutional aggregate metrics | `INTEGRATED` | `AdminDashboardOverview.jsx` |
| `GET` | `/api/v1/subjects` | Authenticated | Yes | List academic subjects | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/subjects/:id` | Authenticated | Yes | Subject details | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `POST` | `/api/v1/subjects` | `ADMIN` | Yes | Create academic subject | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `PUT` | `/api/v1/subjects/:id` | `ADMIN` | Yes | Update academic subject | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `DELETE` | `/api/v1/subjects/:id` | `ADMIN` | Yes | Deactivate subject | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/academics/subjects` | Authenticated | Yes | Subjects catalog (alias) | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/course-offerings` | Authenticated | Yes | List course offerings | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/course-offerings/:id` | Authenticated | Yes | Course offering details | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `POST` | `/api/v1/course-offerings` | `ADMIN` | Yes | Create course offering | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `PUT` | `/api/v1/course-offerings/:id` | `ADMIN` | Yes | Update course offering | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `DELETE` | `/api/v1/course-offerings/:id` | `ADMIN` | Yes | Delete course offering | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/academics/courses` | Authenticated | Yes | Course offerings catalog (alias) | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/sections` | Authenticated | Yes | List course sections | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/sections/:id` | Authenticated | Yes | Section details | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `POST` | `/api/v1/sections` | `ADMIN` | Yes | Create course section | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `PUT` | `/api/v1/sections/:id` | `ADMIN` | Yes | Update course section | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `DELETE` | `/api/v1/sections/:id` | `ADMIN` | Yes | Delete course section | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/timetable` | Authenticated | Yes | List timetable slots | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/timetable/:id` | Authenticated | Yes | Timetable slot details | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `POST` | `/api/v1/timetable` | `ADMIN` | Yes | Create timetable slot with conflict check | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `PUT` | `/api/v1/timetable/:id` | `ADMIN` | Yes | Update timetable slot | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `DELETE` | `/api/v1/timetable/:id` | `ADMIN` | Yes | Deactivate timetable slot | `INTEGRATED` | `AcademicsManagementView.jsx` |
| `GET` | `/api/v1/faculty/me` | `FACULTY` | Yes | Authenticated faculty profile | `INTEGRATED` | `App.jsx`, `FacultyDashboardOverview.jsx` |
| `GET` | `/api/v1/faculty/dashboard` | `FACULTY` | Yes | Faculty dashboard metrics & schedule | `INTEGRATED` | `FacultyDashboardOverview.jsx` |
| `GET` | `/api/v1/faculty/timetable` | `FACULTY` | Yes | Faculty weekly assigned timetable | `INTEGRATED` | `FacultyTimetableView.jsx` |
| `GET` | `/api/v1/faculty/courses` | `FACULTY` | Yes | Faculty courses & offerings | `INTEGRATED` | `FacultyTimetableView.jsx` |
| `GET` | `/api/v1/faculty/sections` | `FACULTY` | Yes | Faculty sections & enrollment counts | `INTEGRATED` | `FacultySessionsView.jsx` |
| `GET` | `/api/v1/faculty/attendance/sessions` | `FACULTY` | Yes | Faculty attendance sessions list | `INTEGRATED` | `FacultySessionsView.jsx` |
| `GET` | `/api/v1/faculty/attendance/sessions/:id` | `FACULTY` | Yes | Attendance session details (ownership guarded) | `INTEGRATED` | `FacultySessionsView.jsx` |
| `POST` | `/api/v1/faculty/attendance/sessions/:id/start` | `FACULTY` | Yes | Start attendance session (SCHEDULED -> OPEN) | `INTEGRATED` | `FacultySessionsView.jsx` |
| `POST` | `/api/v1/faculty/attendance/sessions/:id/finalize` | `FACULTY` | Yes | Finalize attendance session (OPEN -> CLOSED) | `INTEGRATED` | `FacultySessionsView.jsx` |
| `GET` | `/api/v1/faculty/attendance/sessions/:sessionId/roster` | `FACULTY` | Yes | Enrolled student roster with marking status | `INTEGRATED` | `FacultySessionsView.jsx` |
| `POST` | `/api/v1/faculty/attendance/sessions/:sessionId/records` | `FACULTY` | Yes | Mark manual student attendance | `INTEGRATED` | `FacultySessionsView.jsx` |
| `PUT` | `/api/v1/faculty/attendance/sessions/:id/records/:recordId/override` | `FACULTY` | Yes | Override attendance with audit logging | `INTEGRATED` | `FacultySessionsView.jsx` |
| `GET` | `/api/v1/faculty/attendance/summary` | `FACULTY` | Yes | Aggregated faculty attendance metrics | `INTEGRATED` | `FacultyAttendanceLogsView.jsx` |
| `GET` | `/api/v1/academic-years` | Authenticated | Yes | List academic years with term/batch counts | `TESTED / READY` | Academic Management |
| `GET` | `/api/v1/academic-years/:id` | Authenticated | Yes | Academic year details with terms list | `TESTED / READY` | Academic Management |
| `POST` | `/api/v1/academic-years` | `ADMIN` | Yes | Create academic year with date validation | `TESTED / READY` | Academic Management |
| `PUT` | `/api/v1/academic-years/:id` | `ADMIN` | Yes | Update academic year | `TESTED / READY` | Academic Management |
| `DELETE` | `/api/v1/academic-years/:id` | `ADMIN` | Yes | Delete academic year (safeguarded) | `TESTED / READY` | Academic Management |
| `GET` | `/api/v1/academic-terms` | Authenticated | Yes | List academic terms (filterable by year, type) | `TESTED / READY` | Academic Management |
| `GET` | `/api/v1/academic-terms/:id` | Authenticated | Yes | Academic term details | `TESTED / READY` | Academic Management |
| `POST` | `/api/v1/academic-terms` | `ADMIN` | Yes | Create academic term with uniqueness checks | `TESTED / READY` | Academic Management |
| `PUT` | `/api/v1/academic-terms/:id` | `ADMIN` | Yes | Update academic term | `TESTED / READY` | Academic Management |
| `DELETE` | `/api/v1/academic-terms/:id` | `ADMIN` | Yes | Delete academic term (course offering guarded) | `TESTED / READY` | Academic Management |
| `GET` | `/api/v1/enrollments` | Authenticated | Yes | List enrollments (filterable by section, student, term, status) | `TESTED / READY` | Academic Management |
| `GET` | `/api/v1/enrollments/:id` | Authenticated | Yes | Enrollment record details | `TESTED / READY` | Academic Management |
| `POST` | `/api/v1/enrollments` | `ADMIN` | Yes | Enroll student in section with capacity checks | `TESTED / READY` | Academic Management |
| `PUT` | `/api/v1/enrollments/:id` | `ADMIN` | Yes | Update enrollment status / drop student | `TESTED / READY` | Academic Management |
| `DELETE` | `/api/v1/enrollments/:id` | `ADMIN` | Yes | Delete enrollment (attendance guarded) | `TESTED / READY` | Academic Management |
| `GET` | `/api/v1/sections/:id/roster` | Authenticated | Yes | Section student roster with enrollment stats | `TESTED / READY` | Academic Management |
| `GET` | `/api/v1/admin/reports/attendance` | `ADMIN` | Yes | Institutional semester attendance report | `TESTED / READY` | Admin Reports |
| `GET` | `/api/v1/attendance/report` | Authenticated | Yes | Attendance analytics report (alias) | `TESTED / READY` | Attendance Management |
| `GET` | `/api/v1/attendance/faculty/:facultyId` | Authenticated | Yes | Faculty session & summary attendance | `TESTED / READY` | Faculty Attendance |
| `*` | `/api/v1/library/*` | - | - | Library management | `OUT_OF_SCOPE / BACKEND_MISSING` | N/A |
| `*` | `/api/v1/visitors/*` | - | - | Visitor management | `OUT_OF_SCOPE / BACKEND_MISSING` | N/A |
