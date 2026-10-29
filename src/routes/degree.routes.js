const express = require("express");
const {
  getDegrees,
  getDegreeById,
  createDegree,
  updateDegree,
  deleteDegree,
} = require("../controllers/degree.controller");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get("/", authenticateToken, getDegrees);
router.get("/:id", authenticateToken, getDegreeById);
router.post("/", authenticateToken, authorizeRoles("ADMIN"), createDegree);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateDegree);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteDegree);

module.exports = router;
