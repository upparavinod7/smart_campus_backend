const express = require("express");
const {
  getEnrollments,
  getEnrollmentById,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
} = require("../controllers/enrollment.controller");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/enrollments
router.get("/", authenticateToken, getEnrollments);

// GET /api/v1/enrollments/:id
router.get("/:id", authenticateToken, getEnrollmentById);

// POST /api/v1/enrollments (ADMIN only)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  createEnrollment,
);

// PUT /api/v1/enrollments/:id (ADMIN only)
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  updateEnrollment,
);

// DELETE /api/v1/enrollments/:id (ADMIN only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteEnrollment,
);

module.exports = router;
