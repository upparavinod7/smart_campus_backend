const pool = require("../config/mysql");

/**
 * Academic Audit Ledger Utility
 * Implements the Four-Field Event Contract:
 * - person_id (maps to user_id)
 * - location_id (e.g. ACAD-SUBJ-{code}, ACAD-TOPIC-{id}, ACAD-QUIZ-{id})
 * - timestamp (ISO string or SQL DATETIME)
 * - event_type (Standardized action event)
 * Plus optional payload (JSON metadata), reason_code (for overrides/corrections),
 * and actor identity snapshots (actor_role, actor_username) for long-term retention safety.
 */
async function logAcademicEvent({
  personId,
  locationId,
  eventType,
  payload = null,
  reasonCode = null,
  connection = null,
  actorRole = null,
  actorUsername = null,
}) {
  if (!personId || !locationId || !eventType) {
    console.warn("[AcademicLedger] Missing required contract fields:", {
      personId,
      locationId,
      eventType,
    });
    return null;
  }

  const queryRunner = connection || pool;
  const payloadJson = payload ? JSON.stringify(payload) : null;

  try {
    try {
      // Attempt insert with actor snapshot columns (post migration 008)
      const [result] = await queryRunner.query(
        `INSERT INTO academic_audit_ledger 
          (person_id, actor_role, actor_username, location_id, timestamp, event_type, payload, reason_code)
         VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [personId, actorRole, actorUsername, locationId, eventType, payloadJson, reasonCode],
      );
      return result.insertId;
    } catch (insertErr) {
      // Graceful fallback to legacy 4-field schema if columns are not yet applied
      if (insertErr.code === "ER_BAD_FIELD_ERROR") {
        const [fallbackResult] = await queryRunner.query(
          `INSERT INTO academic_audit_ledger 
            (person_id, location_id, timestamp, event_type, payload, reason_code)
           VALUES (?, ?, NOW(), ?, ?, ?)`,
          [personId, locationId, eventType, payloadJson, reasonCode],
        );
        return fallbackResult.insertId;
      }
      throw insertErr;
    }
  } catch (err) {
    console.error("[AcademicLedger] Failed to write event:", err.message);
    // Audit write failures should be reported without silently failing uncaught
    return null;
  }
}

module.exports = {
  logAcademicEvent,
};

