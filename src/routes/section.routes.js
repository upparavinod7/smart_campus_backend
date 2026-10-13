const express = require("express");

const {
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  getSectionRoster,
} = require("../controllers/section.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/sections - Authenticated (all roles)
router.get("/", authenticateToken, getSections);

// GET /api/v1/sections/:id - Authenticated (all roles)
router.get("/:id", authenticateToken, getSectionById);

// GET /api/v1/sections/:id/roster and /sections/:id/students - Authenticated
router.get("/:id/roster", authenticateToken, getSectionRoster);
router.get("/:id/students", authenticateToken, getSectionRoster);

// POST /api/v1/sections - Admin only
router.post("/", authenticateToken, authorizeRoles("ADMIN"), createSection);

// PUT /api/v1/sections/:id - Admin only
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateSection);

// DELETE /api/v1/sections/:id - Admin only
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteSection);

module.exports = router;
