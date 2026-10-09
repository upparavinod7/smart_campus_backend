const express = require("express");

const {
  getProgrammes,
  getProgrammeById,
  createProgramme,
  updateProgramme,
  deleteProgramme,
} = require("../controllers/programme.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get("/", authenticateToken, getProgrammes);

router.get("/:id", authenticateToken, getProgrammeById);

router.post("/", authenticateToken, authorizeRoles("ADMIN"), createProgramme);

router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), updateProgramme);

router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), deleteProgramme);

module.exports = router;
