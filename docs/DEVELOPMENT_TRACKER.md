# Smart Campus ERP - Development Tracker

> **Authoritative Location**: `smart_campus_backend/docs/DEVELOPMENT_TRACKER.md`  
> **Institution**: Joy University  
> **System**: Smart Campus ERP System  
> **Last Verified Update**: 2026-09-28T19:22:00+05:30  

---

## 1. Executive Summary & Progress Metrics

| Metric | Count |
| :--- | :--- |
| **Total Identified Features** | 12 |
| **Not Started** | 2 |
| **In Progress** | 0 |
| **Implemented** | 4 |
| **Tested** | 6 |
| **Pushed** | 4 |
| **Pull Requests Created** | 4 (URLs generated) |
| **Merged** | 0 |
| **Blocked Work** | 0 |
| **Next Recommended Feature** | `FEAT-006`: Faculty and Staff Management (CRUD) |

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
- **Module**: Faculty Management
- **Backend Status**: `IMPLEMENTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/staff/t`
  - `GET /api/v1/staff/t/:id`
  - `POST /api/v1/staff/t`
  - `PUT /api/v1/staff/t/:id`
  - `DELETE /api/v1/staff/t/:id`
- **Backend Branch**: `feature/admin-faculty-management`
- **Backend Commit SHA**: TBD
- **Frontend Branch**: `feature/admin-faculty-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Backend controller verified
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Pending
- **Backend Push Status**: `NOT_STARTED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Implement Faculty directory, Create/Edit forms with department & designation dropdowns
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

---

### `FEAT-007`: Department Management (CRUD)
- **Feature ID**: `FEAT-007`
- **Feature Name**: Department Management (CRUD)
- **Module**: Department Management
- **Backend Status**: `IMPLEMENTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/departments`
  - `GET /api/v1/departments/:id`
  - `POST /api/v1/departments`
  - `PUT /api/v1/departments/:id`
  - `DELETE /api/v1/departments/:id`
- **Backend Branch**: `feature/admin-department-management`
- **Backend Commit SHA**: TBD
- **Frontend Branch**: `feature/admin-department-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Backend controller verified
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Pending
- **Backend Push Status**: `NOT_STARTED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Build Department list, create and edit forms
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

---

### `FEAT-008`: Campus Block & Classroom Management (CRUD)
- **Feature ID**: `FEAT-008`
- **Feature Name**: Campus Block & Classroom Management (CRUD)
- **Module**: Infrastructure Management
- **Backend Status**: `IMPLEMENTED`
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
- **Backend Branch**: `feature/admin-infrastructure-management`
- **Backend Commit SHA**: TBD
- **Frontend Branch**: `feature/admin-infrastructure-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Backend controllers verified
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Pending
- **Backend Push Status**: `NOT_STARTED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Build Blocks and Classrooms management tabs with block relation dropdowns
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

---

### `FEAT-009`: Attendance Session & Record Management
- **Feature ID**: `FEAT-009`
- **Feature Name**: Attendance Session & Record Management
- **Module**: Attendance Management
- **Backend Status**: `IMPLEMENTED`
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/attendance/sessions`
  - `GET /api/v1/attendance/sessions/:id`
  - `POST /api/v1/attendance/sessions`
  - `POST /api/v1/attendance/sessions/:id/start`
  - `POST /api/v1/attendance/sessions/:id/finalize`
  - `GET /api/v1/attendance`
  - `GET /api/v1/attendance/session/:sessionId`
  - `POST /api/v1/attendance`
  - `POST /api/v1/attendance/:id/override`
- **Backend Branch**: `feature/attendance-management`
- **Backend Commit SHA**: TBD
- **Frontend Branch**: `feature/attendance-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Controller verified
- **Frontend Build/Test Results**: Pending UI implementation
- **Integration Test Results**: Pending
- **Backend Push Status**: `NOT_STARTED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Build session creator, active session monitor, and attendance marking roster
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

---

### `FEAT-010`: Academic Offerings, Subjects & Timetable Overview
- **Feature ID**: `FEAT-010`
- **Feature Name**: Academic Subjects & Course Offerings
- **Module**: Academics Management
- **Backend Status**: `NOT_STARTED` (Queries exist in studentPortal controller; Admin endpoints need standard routes)
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/academics/subjects`
  - `GET /api/v1/academics/courses`
- **Backend Branch**: `feature/academics-management`
- **Backend Commit SHA**: TBD
- **Frontend Branch**: `feature/academics-management`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Pending
- **Frontend Build/Test Results**: Pending
- **Integration Test Results**: Pending
- **Backend Push Status**: `NOT_STARTED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Provide admin read routes for subjects and course offerings
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

---

### `FEAT-011`: Faculty Portal Workflows
- **Feature ID**: `FEAT-011`
- **Feature Name**: Faculty Portal Workflows
- **Module**: Faculty Portal
- **Backend Status**: `IMPLEMENTED` (Session creation, attendance marking, faculty attendance history)
- **Frontend Status**: `NOT_STARTED`
- **API Endpoints**:
  - `GET /api/v1/attendance/staf/t/:facultyId`
  - `POST /api/v1/attendance/sessions`
  - `POST /api/v1/attendance/sessions/:id/start`
  - `POST /api/v1/attendance/sessions/:id/finalize`
- **Backend Branch**: `feature/faculty-portal`
- **Backend Commit SHA**: TBD
- **Frontend Branch**: `feature/faculty-portal`
- **Frontend Commit SHA**: TBD
- **Backend Test Results**: Controller verified
- **Frontend Build/Test Results**: Pending
- **Integration Test Results**: Pending
- **Backend Push Status**: `NOT_STARTED`
- **Frontend Push Status**: `NOT_STARTED`
- **Pull Request URLs**: N/A
- **Merge Status**: Open
- **Blockers**: None
- **Next Steps**: Render faculty specific views when role is FACULTY / Staff
- **Last Verified Update**: 2026-09-28T19:22:00+05:30

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
| `GET` | `/api/v1/staff/t` | Authenticated | Yes | List faculty members | `NOT_INTEGRATED` | Pending Faculty Management |
| `GET` | `/api/v1/staff/t/:id` | Authenticated | Yes | Faculty member details | `NOT_INTEGRATED` | Pending Faculty Profile |
| `POST` | `/api/v1/staff/t` | `ADMIN` | Yes | Create faculty profile | `NOT_INTEGRATED` | Pending Create Faculty Form |
| `PUT` | `/api/v1/staff/t/:id` | `ADMIN` | Yes | Update faculty profile | `NOT_INTEGRATED` | Pending Edit Faculty Form |
| `DELETE` | `/api/v1/staff/t/:id` | `ADMIN` | Yes | Deactivate faculty profile | `NOT_INTEGRATED` | Pending Deactivate Action |
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
| `GET` | `/api/v1/admin/dashboard-stats` | `ADMIN` | Yes | Institutional aggregate metrics | `BACKEND_MISSING` | Pending Admin Dashboard |
| `GET` | `/api/v1/academics/subjects` | Authenticated | Yes | Subjects catalog | `BACKEND_MISSING` | Pending Academics View |
| `GET` | `/api/v1/academics/courses` | Authenticated | Yes | Course offerings | `BACKEND_MISSING` | Pending Course Offerings |
| `*` | `/api/v1/library/*` | - | - | Library management | `OUT_OF_SCOPE / BACKEND_MISSING` | N/A |
| `*` | `/api/v1/visitors/*` | - | - | Visitor management | `OUT_OF_SCOPE / BACKEND_MISSING` | N/A |
