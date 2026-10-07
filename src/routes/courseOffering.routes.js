const express = require("express");

const {
  getCourseOfferings,
  getCourseOfferingById,
  createCourseOffering,
  updateCourseOffering,
  deleteCourseOffering,
} = require("../controllers/courseOffering.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/course-offerings - Authenticated (all roles)
router.get("/", authenticateToken, getCourseOfferings);

// GET /api/v1/course-offerings/:id - Authenticated (all roles)
router.get("/:id", authenticateToken, getCourseOfferingById);

// POST /api/v1/course-offerings - Admin only
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  createCourseOffering,
);

// PUT /api/v1/course-offerings/:id - Admin only
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  updateCourseOffering,
);

// DELETE /api/v1/course-offerings/:id - Admin only
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteCourseOffering,
);

module.exports = router;
