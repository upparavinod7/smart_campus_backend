const express = require("express");

const {
  getMyFacultyProfile,
  getFacultyDashboard,
  getMyFacultyTimetable,
  getMyFacultyCourses,
  getMyFacultySections,
  getMyFacultyAttendanceSessions,
  getMyFacultyAttendanceSessionById,
  startMyFacultyAttendanceSession,
  finalizeMyFacultyAttendanceSession,
  getMyFacultyAttendanceRoster,
  markMyFacultyAttendance,
  overrideMyFacultyAttendanceRecord,
  getMyFacultyAttendanceSummary,
} = require("../controllers/facultyPortal.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// All faculty portal routes require authentication and FACULTY role
router.use(authenticateToken);
router.use(authorizeRoles("FACULTY"));

// Profile
// GET /api/v1/faculty/me
router.get("/me", getMyFacultyProfile);

// Dashboard
// GET /api/v1/faculty/dashboard
router.get("/dashboard", getFacultyDashboard);

// Timetable
// GET /api/v1/faculty/timetable
router.get("/timetable", getMyFacultyTimetable);

// Courses & Sections
// GET /api/v1/faculty/courses
router.get("/courses", getMyFacultyCourses);

// GET /api/v1/faculty/sections
router.get("/sections", getMyFacultySections);

// Attendance Sessions
// GET /api/v1/faculty/attendance/sessions
router.get("/attendance/sessions", getMyFacultyAttendanceSessions);

// GET /api/v1/faculty/attendance/sessions/:id
router.get("/attendance/sessions/:id", getMyFacultyAttendanceSessionById);

// POST /api/v1/faculty/attendance/sessions/:id/start
router.post("/attendance/sessions/:id/start", startMyFacultyAttendanceSession);

// POST /api/v1/faculty/attendance/sessions/:id/finalize
router.post("/attendance/sessions/:id/finalize", finalizeMyFacultyAttendanceSession);

// Attendance Roster
// GET /api/v1/faculty/attendance/sessions/:sessionId/roster
router.get("/attendance/sessions/:sessionId/roster", getMyFacultyAttendanceRoster);

// Attendance Recording
// POST /api/v1/faculty/attendance/sessions/:sessionId/records
router.post("/attendance/sessions/:sessionId/records", markMyFacultyAttendance);

// POST /api/v1/faculty/attendance/records
router.post("/attendance/records", markMyFacultyAttendance);

// Attendance Corrections / Overrides
// POST /api/v1/faculty/attendance/records/:id/override
router.post("/attendance/records/:id/override", overrideMyFacultyAttendanceRecord);

// POST /api/v1/faculty/attendance/override/:id
router.post("/attendance/override/:id", overrideMyFacultyAttendanceRecord);

// Attendance Summary
// GET /api/v1/faculty/attendance/summary
router.get("/attendance/summary", getMyFacultyAttendanceSummary);

// GET /api/v1/faculty/sections/:sectionId/attendance-summary
router.get("/sections/:sectionId/attendance-summary", getMyFacultyAttendanceSummary);

module.exports = router;
