const express = require("express");

const {
    getFaculty,
    getFacultyById,
    createFaculty,
    updateFaculty,
    deleteFaculty
} = require("../controllers/faculty.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();


// Get all faculty
router.get(
    "/",
    authenticateToken,
    getFaculty
);


// Get faculty by ID
router.get(
    "/:id",
    authenticateToken,
    getFacultyById
);


// Create faculty - ADMIN only
router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN"),
    createFaculty
);


// Update faculty - ADMIN only
router.put(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN"),
    updateFaculty
);


// Delete faculty - ADMIN only
router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN"),
    deleteFaculty
);

module.exports = router;