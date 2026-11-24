const express = require("express");

const {
  login,
  adminLogin,
  getMe,
  getProfile,
  updateProfile,
  logout,
  uploadAdminPhoto,
  deleteAdminPhoto,
} = require("../controllers/auth.controller");
const authorizeRoles = require("../middleware/role.middleware");
const { handlePhotoUpload } = require("../utils/photoUpload");

const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Public routes
router.post("/login", login);
router.post("/admin/login", adminLogin);
router.post("/admin-login", adminLogin);

// Protected routes
router.get("/me", authenticateToken, getMe);
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/me", authenticateToken, updateProfile);
router.post("/profile/photo", authenticateToken, authorizeRoles("ADMIN"), handlePhotoUpload, uploadAdminPhoto);
router.delete("/profile/photo", authenticateToken, authorizeRoles("ADMIN"), deleteAdminPhoto);
router.post("/logout", authenticateToken, logout);

module.exports = router;
