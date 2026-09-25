const express = require("express");

const {
  getBlocks,
  getBlockById,
  createBlock,
  updateBlock,
  deleteBlock,
} = require("../controllers/block.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get("/", authenticateToken, getBlocks);

router.get("/:id", authenticateToken, getBlockById);

router.post("/", authenticateToken, authorizeRoles("ADMIN"), createBlock);

router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateBlock);

router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteBlock);

module.exports = router;
