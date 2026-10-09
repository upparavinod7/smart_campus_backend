const express = require("express");
const {
  getAcademicTerms,
  getAcademicTermById,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
} = require("../controllers/academicTerm.controller");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/academic-terms
router.get("/", authenticateToken, getAcademicTerms);

// GET /api/v1/academic-terms/:id
router.get("/:id", authenticateToken, getAcademicTermById);

// POST /api/v1/academic-terms (ADMIN only)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  createAcademicTerm,
);

// PUT /api/v1/academic-terms/:id (ADMIN only)
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  updateAcademicTerm,
);

// DELETE /api/v1/academic-terms/:id (ADMIN only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteAcademicTerm,
);

module.exports = router;
