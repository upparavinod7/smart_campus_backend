const express = require("express");

const {
  getAttendanceRecords,
  getAttendanceById,
  getStudentAttendance,
  getStudentAttendanceSummary,
  getSessionAttendance,
  getFacultyAttendance,
  createAttendance,
  updateAttendance,
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
router.get("/faculty/:facultyId", authenticateToken, getFacultyAttendance);
router.get("/staff/:facultyId", authenticateToken, getFacultyAttendance);

router.get(
  "/student/:studentId/summary",
  authenticateToken,
  getStudentAttendanceSummary,
);

const { getAttendanceReport } = require("../controllers/admin.controller");
router.get(
  "/report",
  authenticateToken,
  authorizeRoles("ADMIN"),
  getAttendanceReport,
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

// PUT /attendance/:id (Update attendance during open session)
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  updateAttendance,
);

// POST /attendance/:id/override (Administrative corrections — ADMIN ONLY)
router.post(
  "/:id/override",
  authenticateToken,
  authorizeRoles("ADMIN"),
  overrideAttendance,
);
module.exports = router;
