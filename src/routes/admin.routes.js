const express = require("express");
const {
  getDashboardStats,
  getAttendanceReport,
} = require("../controllers/admin.controller");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/admin/dashboard-stats
// Authorized roles: ADMIN
router.get(
  "/dashboard-stats",
  authenticateToken,
  authorizeRoles("ADMIN"),
  getDashboardStats,
);

// GET /api/v1/admin/reports/attendance & /api/v1/admin/attendance-report
// Authorized roles: ADMIN, FACULTY (HOD scoped)
router.get(
  "/reports/attendance",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  getAttendanceReport,
);

router.get(
  "/attendance-report",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  getAttendanceReport,
);

module.exports = router;
