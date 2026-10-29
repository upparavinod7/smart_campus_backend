const express = require("express");
const { getDesignations } = require("../controllers/designation.controller");
const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

// GET /api/v1/designations
router.get("/", authenticateToken, getDesignations);

module.exports = router;

