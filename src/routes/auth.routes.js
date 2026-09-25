const express = require("express");

const {
    login,
    getMe
} = require("../controllers/auth.controller");
const authorizeRoles = require("../middleware/role.middleware");

const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Public route
router.post("/login", login);

// Protected route
router.get("/me", authenticateToken, getMe);


module.exports = router;