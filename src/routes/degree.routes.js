const express = require("express");
const { getDegrees } = require("../controllers/degree.controller");
const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", authenticateToken, getDegrees);

module.exports = router;
