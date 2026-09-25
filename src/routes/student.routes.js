const express = require("express");

const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
} = require("../controllers/student.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();


// Get all students
router.get(
    "/",
    authenticateToken,
    getStudents
);


// Get student by ID
router.get(
    "/:id",
    authenticateToken,
    getStudentById
);


// Create student - ADMIN only
router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN"),
    createStudent
);


// Update student - ADMIN only
router.put(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN"),
    updateStudent
);


// Delete student - ADMIN only
router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN"),
    deleteStudent
);


module.exports = router;