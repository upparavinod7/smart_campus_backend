const express = require("express");

const authRoutes = require("./auth.routes");
const studentRoutes = require("./student.routes");
const staffRoutes = require("./staff.routes");
const schoolRoutes = require("./school.routes");
const departmentRoutes = require("./department.routes");
const programmeRoutes = require("./programme.routes");
const batchRoutes = require("./batch.routes");
const degreeRoutes = require("./degree.routes");
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
const academicYearRoutes = require("./academicYear.routes");
const academicTermRoutes = require("./academicTerm.routes");
const enrollmentRoutes = require("./enrollment.routes");
const designationRoutes = require("./designation.routes");
const academicRoutes = require("./academic.routes");
const creditsRoutes = require("./credits.routes");

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

// Staff management & reference catalogs
router.use("/designations", designationRoutes);
router.use("/staff/designations", designationRoutes);
router.use("/staff", staffRoutes);

// Academic Hierarchy: School -> Department -> Program -> Batch -> Section
router.use("/schools", schoolRoutes);
router.use("/academics/schools", schoolRoutes);

router.use("/departments", departmentRoutes);
router.use("/academics/departments", departmentRoutes);

router.use("/programmes", programmeRoutes);
router.use("/programs", programmeRoutes);
router.use("/academics/programs", programmeRoutes);
router.use("/academics/programmes", programmeRoutes);

router.use("/batches", batchRoutes);
router.use("/academics/batches", batchRoutes);

router.use("/academic-years", academicYearRoutes);
router.use("/academics/years", academicYearRoutes);
router.use("/academics/academic-years", academicYearRoutes);

router.use("/academic-terms", academicTermRoutes);
router.use("/academics/terms", academicTermRoutes);
router.use("/academics/academic-terms", academicTermRoutes);

router.use("/enrollments", enrollmentRoutes);
router.use("/academics/enrollments", enrollmentRoutes);

router.use("/degrees", degreeRoutes);
router.use("/academics/degrees", degreeRoutes);

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
router.use("/student-portal", studentPortalRoutes);

// Subject management
router.use("/subjects", subjectRoutes);
router.use("/academics/subjects", subjectRoutes);

// Course offerings / Academic offerings
router.use("/course-offerings", courseOfferingRoutes);
router.use("/academic-offerings", courseOfferingRoutes);
router.use("/academics/courses", courseOfferingRoutes);

// Section management
router.use("/sections", sectionRoutes);
router.use("/academics/sections", sectionRoutes);

// Timetable management
router.use("/timetable", timetableRoutes);
router.use("/timetable-slots", timetableRoutes);
router.use("/timetable_slots", timetableRoutes);
router.use("/academics/timetable", timetableRoutes);

// Faculty Portal
router.use("/faculty", facultyPortalRoutes);
router.use("/faculty-portal", facultyPortalRoutes);

// Academic Module (Study Materials, Question Bank, Quizzes & Attempts)
router.use("/academic", academicRoutes);
router.use("/credits", creditsRoutes);

// Fallback for unmatched /api/v1 routes - ensures API returns JSON, never HTML
router.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

module.exports = router;
