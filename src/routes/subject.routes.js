const express = require("express");

const {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} = require("../controllers/subject.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/subjects - Authenticated (all roles)
router.get("/", authenticateToken, getSubjects);

// GET /api/v1/subjects/:id - Authenticated (all roles)
router.get("/:id", authenticateToken, getSubjectById);

// POST /api/v1/subjects - Admin only
router.post("/", authenticateToken, authorizeRoles("ADMIN"), createSubject);

// PUT /api/v1/subjects/:id - Admin only
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateSubject);

// DELETE /api/v1/subjects/:id - Admin only
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteSubject);

module.exports = router;
