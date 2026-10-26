const express = require("express");

const {
  login,
  getMe,
  getProfile,
  updateProfile,
  logout,
} = require("../controllers/auth.controller");
const authorizeRoles = require("../middleware/role.middleware");

const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Public route
router.post("/login", login);

// Protected routes
router.get("/me", authenticateToken, getMe);
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/me", authenticateToken, updateProfile);
router.post("/logout", authenticateToken, logout);

module.exports = router;
