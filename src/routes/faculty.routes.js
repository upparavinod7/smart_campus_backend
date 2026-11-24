const express = require("express");

const {
    getFaculty,
    getFacultyById,
    createFaculty,
    updateFaculty,
    deleteFaculty,
    uploadFacultyPhoto,
    deleteFacultyPhoto,
} = require("../controllers/faculty.controller");
const { handlePhotoUpload } = require("../utils/photoUpload");

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

// Upload faculty photo - ADMIN only
router.post(
    "/:id/photo",
    authenticateToken,
    authorizeRoles("ADMIN"),
    handlePhotoUpload,
    uploadFacultyPhoto
);

// Delete faculty photo - ADMIN only
router.delete(
    "/:id/photo",
    authenticateToken,
    authorizeRoles("ADMIN"),
    deleteFacultyPhoto
);

module.exports = router;