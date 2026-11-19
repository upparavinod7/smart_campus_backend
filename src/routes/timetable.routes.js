const express = require("express");

const {
  getTimetableSlots,
  getTimetableSlotById,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  syncSlotSessions,
} = require("../controllers/timetable.controller");

const authenticateToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

// GET /api/v1/timetable - Authenticated (all roles)
router.get("/", authenticateToken, getTimetableSlots);

// GET /api/v1/timetable/:id - Authenticated (all roles)
router.get("/:id", authenticateToken, getTimetableSlotById);

// POST /api/v1/timetable - Admin only
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  createTimetableSlot,
);

// PUT /api/v1/timetable/:id - Admin only
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  updateTimetableSlot,
);

// POST /api/v1/timetable/:id/sync-sessions - Admin only
router.post(
  "/:id/sync-sessions",
  authenticateToken,
  authorizeRoles("ADMIN"),
  syncSlotSessions,
);

// DELETE /api/v1/timetable/:id - Admin only
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("ADMIN"),
  deleteTimetableSlot,
);

module.exports = router;
