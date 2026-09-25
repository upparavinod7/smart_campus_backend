const express = require("express");

const {
  getAttendanceSessions,
  getAttendanceSessionById,
  createAttendanceSession,
  startAttendanceSession,
  finalizeAttendanceSession,
  getAttendanceSessionStatus
} = require("../controllers/attendanceSession.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /attendance/sessions
router.get("/", authenticateToken, getAttendanceSessions);

// GET /attendance/sessions/:id
router.get("/:id", authenticateToken, getAttendanceSessionById);

// POST /attendance/sessions
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  createAttendanceSession,
);

//POST /attedace/sessions/:id/start
router.post(
  "/:id/start",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  startAttendanceSession,
);
router.post(
  "/:id/finalize",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  finalizeAttendanceSession,
);

router.get(
    "/:id/status",
    authenticateToken,
    getAttendanceSessionStatus
)

module.exports = router;
