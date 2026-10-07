const express = require("express");
const { getDashboardStats } = require("../controllers/admin.controller");
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

module.exports = router;
