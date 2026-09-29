const express = require("express");

const { login, getMe, logout } = require("../controllers/auth.controller");
const authorizeRoles = require("../middleware/role.middleware");

const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Public route
router.post("/login", login);

// Protected routes
router.get("/me", authenticateToken, getMe);
router.post("/logout", authenticateToken, logout);

module.exports = router;
