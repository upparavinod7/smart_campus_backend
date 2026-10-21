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


// GET /api/v1/staff and /api/v1/staff/t
// List faculty
router.get("/", authenticateToken, getFaculty);
router.get("/t", authenticateToken, getFaculty);

// GET /api/v1/staff/:id and /api/v1/staff/t/:id
// Get one faculty profile
router.get("/:id", authenticateToken, getFacultyById);
router.get("/t/:id", authenticateToken, getFacultyById);

// POST /api/v1/staff and /api/v1/staff/t
// Create faculty profile
router.post("/", authenticateToken, authorizeRoles("ADMIN"), createFaculty);
router.post("/t", authenticateToken, authorizeRoles("ADMIN"), createFaculty);

// PUT /api/v1/staff/:id and /api/v1/staff/t/:id
// Update faculty profile
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateFaculty);
router.put("/t/:id", authenticateToken, authorizeRoles("ADMIN"), updateFaculty);

// DELETE /api/v1/staff/:id and /api/v1/staff/t/:id
// Deactivate faculty profile
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteFaculty);
router.delete("/t/:id", authenticateToken, authorizeRoles("ADMIN"), deleteFaculty);


module.exports = router;