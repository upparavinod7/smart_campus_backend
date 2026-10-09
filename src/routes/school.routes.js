const express = require("express");

const {
  getSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
} = require("../controllers/school.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get("/", authenticateToken, getSchools);

router.get("/:id", authenticateToken, getSchoolById);

router.post("/", authenticateToken, authorizeRoles("ADMIN"), createSchool);

router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateSchool);

router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteSchool);

module.exports = router;
