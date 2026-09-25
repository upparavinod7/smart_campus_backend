const express = require("express");

const authRoutes = require("./auth.routes");
const studentRoutes = require("./student.routes");
const staffRoutes = require("./staff.routes");
const departmentRoutes = require("./department.routes");
const blockRoutes = require("./block.routes");
const classroomRoutes = require("./classroom.routes")

const router = express.Router();

router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/staff", staffRoutes);
router.use("/departments", departmentRoutes);
router.use("/blocks", blockRoutes)
router.use('/classrooms', classroomRoutes)

module.exports = router;
