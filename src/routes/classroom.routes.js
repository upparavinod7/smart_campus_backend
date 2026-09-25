const express = require("express");

const {
  getClassrooms,
  getClassroomById,
  createClassroom,
  updateClassroom,
  deleteClassroom,
} = require("../controllers/classroom.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET all classrooms
router.get("/", authenticateToken, getClassrooms);

// GET classroom by ID
router.get("/:id", authenticateToken, getClassroomById);

// CREATE classroom
router.post("/", authenticateToken, authorizeRoles("ADMIN"), createClassroom);

// UPDATE classroom
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateClassroom);

// DEACTIVATE classroom
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteClassroom,
);

module.exports = router;
