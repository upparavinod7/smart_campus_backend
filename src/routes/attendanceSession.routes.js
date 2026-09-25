const express = require("express");

const {
  getAttendanceSessions,
  getAttendanceSessionById,
  createAttendanceSession,
  startAttendanceSession,
  finalizeAttendanceSession,
  getAttendanceSessionStatus,
  getAttendanceSessionPresencePool,
  getAttendanceSessionPresencePoolMembers,
} = require("../controllers/attendanceSession.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /attendance/sessions
router.get("/", authenticateToken, getAttendanceSessions);

// GET /attendance/sessions/:id/status
router.get("/:id/status", authenticateToken, getAttendanceSessionStatus);

// GET /attendance/sessions/:sessionId/presence-pool
router.get(
  "/:sessionId/presence-pool",
  authenticateToken,
  getAttendanceSessionPresencePool,
);

// GET /attendance/sessions/:sessionId/presence-pool/members
router.get(
  "/:sessionId/presence-pool/members",
  authenticateToken,
  getAttendanceSessionPresencePoolMembers,
);

// GET /attendance/sessions/:id
router.get("/:id", authenticateToken, getAttendanceSessionById);

// POST /attendance/sessions
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  createAttendanceSession,
);

// POST /attendance/sessions/:id/start
router.post(
  "/:id/start",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  startAttendanceSession,
);

// POST /attendance/sessions/:id/finalize
router.post(
  "/:id/finalize",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  finalizeAttendanceSession,
);

module.exports = router;
