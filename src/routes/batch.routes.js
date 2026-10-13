const express = require("express");

const {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} = require("../controllers/batch.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get("/", authenticateToken, getBatches);

router.get("/:id", authenticateToken, getBatchById);

router.post("/", authenticateToken, authorizeRoles("ADMIN"), createBatch);

router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateBatch);

router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteBatch);

module.exports = router;
