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

// GET /attendance
router.get("/", authenticateToken, getAttendanceRecords);

router.get("/student/:studentId", authenticateToken, getStudentAttendance);

router.get("/session/:sessionId", authenticateToken, getSessionAttendance);

router.get("/staf/t/:facultyId", authenticateToken, getFacultyAttendance);

router.get(
  "/student/:studentId/summary",
  authenticateToken,
  getStudentAttendanceSummary,
);

// GET /attendance/:id
router.get("/:id", authenticateToken, getAttendanceById);

// POST /attendance
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  createAttendance,
);

router.post(
  "/:id/override",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  overrideAttendance,
);
module.exports = router;
