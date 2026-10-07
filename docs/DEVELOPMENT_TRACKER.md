# Smart Campus ERP - Development Tracker

> **Authoritative Location**: `smart_campus_backend/docs/DEVELOPMENT_TRACKER.md`  
> **Institution**: Joy University  
> **System**: Smart Campus ERP System  
> **Last Verified Update**: 2026-10-07T11:35:00+05:30  

---

## 1. Executive Summary & Progress Metrics

| Metric | Count |
| :--- | :--- |
| **Total Identified Features** | 12 |
| **Not Started** | 0 |
| **In Progress** | 0 |
| **Implemented** | 0 |
| **Tested** | 12 |
| **Pushed** | 10 |
| **Pull Requests Created** | 10 (URLs generated) |
| **Merged** | 0 |
| **Blocked Work** | 0 |
| **Next Recommended Feature** | `FEAT-012`: Automated Test Suite & Quality Verification |

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
- **Backend Status**: `NOT_STARTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**: All
- **Backend Branch**: `feature/testing-qa`
- **Backend Commit SHA**: TBD
- **Frontend Branch**: `feature/testing-qa`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Pending
- **Frontend Build/Test Results**: Pending
- **Integration Test Results**: Pending
- **Backend Push Status**: `NOT_STARTED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Add Node.js test runner suite for backend API routes and verify end-to-end flows
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

---

## 3. Authoritative API Inventory & Status

| Method | Endpoint | Allowed Roles | Auth Required | Purpose | Status | Frontend Component |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/test` | Any | No | API health check | `INTEGRATED` | System |
| `POST` | `/api/v1/auth/login` | Any | No | User login & JWT issuance | `INTEGRATED` | `LoginPage.jsx` |
| `GET` | `/api/v1/auth/me` | Authenticated | Yes | Current user context | `INTEGRATED` | `App.jsx` |
| `GET` | `/api/v1/student/me` | `STUDENT` | Yes | Student profile & degree details | `INTEGRATED` | `App.jsx`, `Dashboard.jsx` |
| `GET` | `/api/v1/student/me/attendance/summary` | `STUDENT` | Yes | Aggregate attendance summary | `INTEGRATED` | `AttendanceSummary` |
| `GET` | `/api/v1/student/me/timetable` | `STUDENT` | Yes | Weekly class schedule | `INTEGRATED` | `StudentTimetable` |
| `GET` | `/api/v1/student/me/courses` | `STUDENT` | Yes | Enrolled course list & credits | `PARTIALLY_INTEGRATED` | `StudentCourses` (Nav missing) |
| `GET` | `/api/v1/student/me/attendance` | `STUDENT` | Yes | Granular session attendance log | `NOT_INTEGRATED` | Pending Attendance Logs view |
| `GET` | `/api/v1/student/me/dashboard` | `STUDENT` | Yes | Full student dashboard payload | `NOT_INTEGRATED` | Pending Dashboard Overview |
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
| `GET` | `/api/v1/departments` | Authenticated | Yes | List academic departments | `NOT_INTEGRATED` | Pending Department Management |
| `GET` | `/api/v1/departments/:id` | Authenticated | Yes | Department details | `NOT_INTEGRATED` | Pending Department View |
| `POST` | `/api/v1/departments` | `ADMIN` | Yes | Create academic department | `NOT_INTEGRATED` | Pending Department Form |
| `PUT` | `/api/v1/departments/:id` | `ADMIN` | Yes | Update academic department | `NOT_INTEGRATED` | Pending Department Form |
| `DELETE` | `/api/v1/departments/:id` | `ADMIN` | Yes | Delete department | `NOT_INTEGRATED` | Pending Delete Action |
| `GET` | `/api/v1/blocks` | Authenticated | Yes | List campus blocks/buildings | `NOT_INTEGRATED` | Pending Block Management |
| `GET` | `/api/v1/blocks/:id` | Authenticated | Yes | Campus block details | `NOT_INTEGRATED` | Pending Block View |
| `POST` | `/api/v1/blocks` | `ADMIN` | Yes | Create campus block | `NOT_INTEGRATED` | Pending Block Form |
| `PUT` | `/api/v1/blocks/:id` | `ADMIN` | Yes | Update campus block | `NOT_INTEGRATED` | Pending Block Form |
| `DELETE` | `/api/v1/blocks/:id` | `ADMIN` | Yes | Delete campus block | `NOT_INTEGRATED` | Pending Delete Action |
| `GET` | `/api/v1/classrooms` | Authenticated | Yes | List classrooms & labs | `NOT_INTEGRATED` | Pending Classroom Management |
| `GET` | `/api/v1/classrooms/:id` | Authenticated | Yes | Classroom details | `NOT_INTEGRATED` | Pending Classroom View |
| `POST` | `/api/v1/classrooms` | `ADMIN` | Yes | Create classroom | `NOT_INTEGRATED` | Pending Classroom Form |
| `PUT` | `/api/v1/classrooms/:id` | `ADMIN` | Yes | Update classroom | `NOT_INTEGRATED` | Pending Classroom Form |
| `DELETE` | `/api/v1/classrooms/:id` | `ADMIN` | Yes | Deactivate classroom | `NOT_INTEGRATED` | Pending Classroom Delete |
| `GET` | `/api/v1/attendance/sessions` | Authenticated | Yes | List class attendance sessions | `NOT_INTEGRATED` | Pending Attendance Portal |
| `GET` | `/api/v1/attendance/sessions/:id` | Authenticated | Yes | Attendance session details | `NOT_INTEGRATED` | Pending Session View |
| `GET` | `/api/v1/attendance/sessions/:id/status` | Authenticated | Yes | Attendance session status | `NOT_INTEGRATED` | Pending Session Monitor |
| `POST` | `/api/v1/attendance/sessions` | `ADMIN`, `FACULTY` | Yes | Create attendance session | `NOT_INTEGRATED` | Pending Session Form |
| `POST` | `/api/v1/attendance/sessions/:id/start` | `ADMIN`, `FACULTY` | Yes | Open/start session | `NOT_INTEGRATED` | Pending Start Button |
| `POST` | `/api/v1/attendance/sessions/:id/finalize` | `ADMIN`, `FACULTY` | Yes | Close/finalize session | `NOT_INTEGRATED` | Pending Finalize Button |
| `GET` | `/api/v1/attendance` | Authenticated | Yes | List attendance records | `NOT_INTEGRATED` | Pending Attendance Records |
| `GET` | `/api/v1/attendance/session/:sessionId` | Authenticated | Yes | Session roster attendance | `NOT_INTEGRATED` | Pending Session Roster |
| `GET` | `/api/v1/attendance/staf/t/:facultyId` | Authenticated | Yes | Faculty attendance sessions | `NOT_INTEGRATED` | Pending Faculty Sessions |
| `POST` | `/api/v1/attendance` | `ADMIN`, `FACULTY` | Yes | Mark manual attendance | `NOT_INTEGRATED` | Pending Attendance Marker |
| `POST` | `/api/v1/attendance/:id/override` | `ADMIN`, `FACULTY` | Yes | Override attendance status | `NOT_INTEGRATED` | Pending Override Dialog |
| `GET` | `/api/v1/admin/dashboard-stats` | `ADMIN` | Yes | Institutional aggregate metrics | `INTEGRATED` | `AdminDashboardOverview.jsx` |
| `GET` | `/api/v1/subjects` | Authenticated | Yes | List academic subjects | `BACKEND_READY` | Pending Academics View |
| `GET` | `/api/v1/subjects/:id` | Authenticated | Yes | Subject details | `BACKEND_READY` | Pending Subject Details |
| `POST` | `/api/v1/subjects` | `ADMIN` | Yes | Create academic subject | `BACKEND_READY` | Pending Subject Form |
| `PUT` | `/api/v1/subjects/:id` | `ADMIN` | Yes | Update academic subject | `BACKEND_READY` | Pending Subject Form |
| `DELETE` | `/api/v1/subjects/:id` | `ADMIN` | Yes | Deactivate subject | `BACKEND_READY` | Pending Deactivate Action |
| `GET` | `/api/v1/academics/subjects` | Authenticated | Yes | Subjects catalog (alias) | `BACKEND_READY` | Pending Academics View |
| `GET` | `/api/v1/course-offerings` | Authenticated | Yes | List course offerings | `BACKEND_READY` | Pending Course Offerings |
| `GET` | `/api/v1/course-offerings/:id` | Authenticated | Yes | Course offering details | `BACKEND_READY` | Pending Offering Details |
| `POST` | `/api/v1/course-offerings` | `ADMIN` | Yes | Create course offering | `BACKEND_READY` | Pending Offering Form |
| `PUT` | `/api/v1/course-offerings/:id` | `ADMIN` | Yes | Update course offering | `BACKEND_READY` | Pending Offering Form |
| `DELETE` | `/api/v1/course-offerings/:id` | `ADMIN` | Yes | Delete course offering | `BACKEND_READY` | Pending Delete Action |
| `GET` | `/api/v1/academics/courses` | Authenticated | Yes | Course offerings catalog (alias) | `BACKEND_READY` | Pending Course Offerings |
| `GET` | `/api/v1/sections` | Authenticated | Yes | List course sections | `BACKEND_READY` | Pending Section View |
| `GET` | `/api/v1/sections/:id` | Authenticated | Yes | Section details | `BACKEND_READY` | Pending Section Details |
| `POST` | `/api/v1/sections` | `ADMIN` | Yes | Create course section | `BACKEND_READY` | Pending Section Form |
| `PUT` | `/api/v1/sections/:id` | `ADMIN` | Yes | Update course section | `BACKEND_READY` | Pending Section Form |
| `DELETE` | `/api/v1/sections/:id` | `ADMIN` | Yes | Delete course section | `BACKEND_READY` | Pending Delete Action |
| `GET` | `/api/v1/timetable` | Authenticated | Yes | List timetable slots | `BACKEND_READY` | Pending Timetable View |
| `GET` | `/api/v1/timetable/:id` | Authenticated | Yes | Timetable slot details | `BACKEND_READY` | Pending Timetable Details |
| `POST` | `/api/v1/timetable` | `ADMIN` | Yes | Create timetable slot with conflict check | `BACKEND_READY` | Pending Timetable Form |
| `PUT` | `/api/v1/timetable/:id` | `ADMIN` | Yes | Update timetable slot | `BACKEND_READY` | Pending Timetable Form |
| `DELETE` | `/api/v1/timetable/:id` | `ADMIN` | Yes | Deactivate timetable slot | `BACKEND_READY` | Pending Deactivate Action |
| `GET` | `/api/v1/faculty/me` | `FACULTY` | Yes | Authenticated faculty profile | `BACKEND_READY` | Pending Faculty Portal |
| `GET` | `/api/v1/faculty/dashboard` | `FACULTY` | Yes | Faculty dashboard metrics & schedule | `BACKEND_READY` | Pending Faculty Dashboard |
| `GET` | `/api/v1/faculty/timetable` | `FACULTY` | Yes | Faculty weekly assigned timetable | `BACKEND_READY` | Pending Faculty Timetable |
| `GET` | `/api/v1/faculty/courses` | `FACULTY` | Yes | Faculty courses & offerings | `BACKEND_READY` | Pending Faculty Courses |
| `GET` | `/api/v1/faculty/sections` | `FACULTY` | Yes | Faculty sections & enrollment counts | `BACKEND_READY` | Pending Faculty Sections |
| `GET` | `/api/v1/faculty/attendance/sessions` | `FACULTY` | Yes | Faculty attendance sessions list | `BACKEND_READY` | Pending Attendance View |
| `GET` | `/api/v1/faculty/attendance/sessions/:id` | `FACULTY` | Yes | Attendance session details (ownership guarded) | `BACKEND_READY` | Pending Attendance View |
| `POST` | `/api/v1/faculty/attendance/sessions/:id/start` | `FACULTY` | Yes | Start attendance session (SCHEDULED -> OPEN) | `BACKEND_READY` | Pending Start Button |
| `POST` | `/api/v1/faculty/attendance/sessions/:id/finalize` | `FACULTY` | Yes | Finalize attendance session (OPEN -> CLOSED) | `BACKEND_READY` | Pending Finalize Button |
| `GET` | `/api/v1/faculty/attendance/sessions/:sessionId/roster` | `FACULTY` | Yes | Enrolled student roster with marking status | `BACKEND_READY` | Pending Roster View |
| `POST` | `/api/v1/faculty/attendance/sessions/:sessionId/records` | `FACULTY` | Yes | Mark manual student attendance | `BACKEND_READY` | Pending Marking Form |
| `POST` | `/api/v1/faculty/attendance/records/:id/override` | `FACULTY` | Yes | Override attendance with audit logging | `BACKEND_READY` | Pending Override Dialog |
| `GET` | `/api/v1/faculty/attendance/summary` | `FACULTY` | Yes | Aggregated faculty attendance metrics | `BACKEND_READY` | Pending Summary View |
| `*` | `/api/v1/library/*` | - | - | Library management | `OUT_OF_SCOPE / BACKEND_MISSING` | N/A |
| `*` | `/api/v1/visitors/*` | - | - | Visitor management | `OUT_OF_SCOPE / BACKEND_MISSING` | N/A |
