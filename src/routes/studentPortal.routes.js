const express = require("express");

const {
  getMyProfile,
  getMyAttendance,
  getMyAttendanceSummary,
  getStudentDashboard,
  getMyTimetable,
  getMyCourses,
} = require("../controllers/studentPortal.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/student-portal/me
router.get("/me", authenticateToken, authorizeRoles("STUDENT"), getMyProfile);

// GET /api/v1/student-portal/me/attendance
router.get(
  "/me/attendance",
  authenticateToken,
  authorizeRoles("STUDENT"),
  getMyAttendance,
);

// GET /api/v1/student-portal/me/attendance/summary
router.get(
  "/me/attendance/summary",
  authenticateToken,
  authorizeRoles("STUDENT"),
  getMyAttendanceSummary,
);

// GET /api/v1/student-portal/me/dashboard
router.get(
  "/me/dashboard",
  authenticateToken,
  authorizeRoles("STUDENT"),
  getStudentDashboard,
);

router.get(
  "/me/timetable",
  authenticateToken,
  authorizeRoles("STUDENT"),
  getMyTimetable,
);

router.get(
  "/me/courses",
  authenticateToken,
  authorizeRoles("STUDENT"),
  getMyCourses,
);

module.exports = router;
