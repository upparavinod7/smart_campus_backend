const express = require("express");

const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} = require("../controllers/student.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/students
// ADMIN only
router.get("/", authenticateToken, authorizeRoles("ADMIN"), getStudents);

// GET /api/v1/students/:id
// ADMIN only
router.get("/:id", authenticateToken, authorizeRoles("ADMIN"), getStudentById);

// POST /api/v1/students
// ADMIN only
router.post("/", authenticateToken, authorizeRoles("ADMIN"), createStudent);

// PUT /api/v1/students/:id
// ADMIN only
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateStudent);

// DELETE /api/v1/students/:id
// ADMIN only
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteStudent,
);

module.exports = router;
