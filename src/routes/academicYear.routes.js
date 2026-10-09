const express = require("express");
const {
  getAcademicYears,
  getAcademicYearById,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
} = require("../controllers/academicYear.controller");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/academic-years
router.get("/", authenticateToken, getAcademicYears);

// GET /api/v1/academic-years/:id
router.get("/:id", authenticateToken, getAcademicYearById);

// POST /api/v1/academic-years (ADMIN only)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  createAcademicYear,
);

// PUT /api/v1/academic-years/:id (ADMIN only)
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  updateAcademicYear,
);

// DELETE /api/v1/academic-years/:id (ADMIN only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteAcademicYear,
);

module.exports = router;
