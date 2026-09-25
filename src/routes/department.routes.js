const express = require("express");

const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/department.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.get("/", authenticateToken, getDepartments);

router.get("/:id", authenticateToken, getDepartmentById);

router.post("/", authenticateToken, authorizeRoles("ADMIN"), createDepartment);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  updateDepartment,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteDepartment,
);

module.exports = router;
