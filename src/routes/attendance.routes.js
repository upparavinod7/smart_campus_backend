const express = require("express");

const {
  getAttendanceRecords,
  getAttendanceById,
  getStudentAttendance,
  getStudentAttendanceSummary,
  getSessionAttendance,
  getFacultyAttendance,
  createAttendance,
  overrideAttendance,
} = require("../controllers/attendance.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/attendance
router.get("/", authenticateToken, getAttendanceRecords);

// Student attendance
router.get("/student/:studentId", authenticateToken, getStudentAttendance);
router.get(
  "/student/:studentId/summary",
  authenticateToken,
  getStudentAttendanceSummary,
);

// Session roster attendance
router.get("/session/:sessionId", authenticateToken, getSessionAttendance);

// Faculty attendance
router.get("/staf/t/:facultyId", authenticateToken, getFacultyAttendance);
router.get("/staff/:facultyId", authenticateToken, getFacultyAttendance);

// Attendance record detail
router.get("/records/:id", authenticateToken, getAttendanceById);
router.get("/:id", authenticateToken, getAttendanceById);

// Create attendance record
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  createAttendance,
);

router.post(
  "/session/:sessionId/records",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  createAttendance,
);

// Override / update attendance record
router.post(
  "/:id/override",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  overrideAttendance,
);

router.put(
  "/records/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  overrideAttendance,
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  overrideAttendance,
);

module.exports = router;
