const express = require("express");

const {
  getAttendanceSessions,
  getAttendanceSessionById,
  createAttendanceSession,
  updateAttendanceSession,
  startAttendanceSession,
  finalizeAttendanceSession,
  reconcileAttendanceSession,
  getAttendanceSessionStatus,
  getAttendanceSessionPresencePool,
  getAttendanceSessionPresencePoolMembers,
} = require("../controllers/attendanceSession.controller");

const { getSessionAttendance } = require("../controllers/attendance.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /attendance/sessions
// GET /api/v1/attendance/sessions
router.get("/", authenticateToken, getAttendanceSessions);

// GET /attendance/sessions/:id/status
// GET /api/v1/attendance/sessions/:id/status
router.get("/:id/status", authenticateToken, getAttendanceSessionStatus);

// GET /attendance/sessions/:sessionId/presence-pool
// GET /api/v1/attendance/sessions/:sessionId/presence-pool
router.get(
  "/:sessionId/presence-pool",
  authenticateToken,
  getAttendanceSessionPresencePool,
);

// GET /attendance/sessions/:sessionId/presence-pool/members
// GET /api/v1/attendance/sessions/:sessionId/presence-pool/members
router.get(
  "/:sessionId/presence-pool/members",
  authenticateToken,
  getAttendanceSessionPresencePoolMembers,
);

// GET /attendance/sessions/:id
// GET /api/v1/attendance/sessions/:id/records (or :sessionId/records)
router.get("/:sessionId/records", authenticateToken, getSessionAttendance);

// GET /api/v1/attendance/sessions/:id
router.get("/:id", authenticateToken, getAttendanceSessionById);

// POST /attendance/sessions
// POST /api/v1/attendance/sessions
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  createAttendanceSession,
);

// POST /attendance/sessions/:id/start
// PUT /api/v1/attendance/sessions/:id
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  updateAttendanceSession,
);

// POST /api/v1/attendance/sessions/:id/start
router.post(
  "/:id/start",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  startAttendanceSession,
);

// POST /attendance/sessions/:id/finalize
// POST /api/v1/attendance/sessions/:id/finalize
router.post(
  "/:id/finalize",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  finalizeAttendanceSession,
);

// POST /api/v1/attendance/sessions/:id/reconcile
router.post(
  "/:id/reconcile",
  authenticateToken,
  authorizeRoles("ADMIN", "FACULTY"),
  reconcileAttendanceSession,
);

module.exports = router;
