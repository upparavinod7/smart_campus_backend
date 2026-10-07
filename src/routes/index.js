const express = require("express");

const authRoutes = require("./auth.routes");
const studentRoutes = require("./student.routes");
const staffRoutes = require("./staff.routes");
const departmentRoutes = require("./department.routes");
const blockRoutes = require("./block.routes");
const classroomRoutes = require("./classroom.routes");
const attendanceSessionRoutes = require("./attendanceSession.routes");
const attendanceRoutes = require("./attendance.routes");
const studentPortalRoutes = require("./studentPortal.routes");
const facultyPortalRoutes = require("./facultyPortal.routes");
const adminRoutes = require("./admin.routes");
const subjectRoutes = require("./subject.routes");
const courseOfferingRoutes = require("./courseOffering.routes");
const sectionRoutes = require("./section.routes");
const timetableRoutes = require("./timetable.routes");

const router = express.Router();

// API health check
router.get("/test", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "API is working",
  });
});

// Authentication
router.use("/auth", authRoutes);

// Admin dashboard & management
router.use("/admin", adminRoutes);

// Admin student management
router.use("/students", studentRoutes);

// Staff management
router.use("/staff", staffRoutes);

// Department management
router.use("/departments", departmentRoutes);

// Block management
router.use("/blocks", blockRoutes);

// Classroom management
router.use("/classrooms", classroomRoutes);

// Attendance sessions
router.use("/attendance/sessions", attendanceSessionRoutes);

// Attendance management
router.use("/attendance", attendanceRoutes);

// Student Portal
router.use("/student", studentPortalRoutes);

// Subject management
router.use("/subjects", subjectRoutes);
router.use("/academics/subjects", subjectRoutes);

// Course offerings / Academic offerings
router.use("/course-offerings", courseOfferingRoutes);
router.use("/academic-offerings", courseOfferingRoutes);
router.use("/academics/courses", courseOfferingRoutes);

// Section management
router.use("/sections", sectionRoutes);

// Timetable management
router.use("/timetable", timetableRoutes);
router.use("/timetable-slots", timetableRoutes);

// Faculty Portal
router.use("/faculty", facultyPortalRoutes);
router.use("/faculty-portal", facultyPortalRoutes);

module.exports = router;
