const pool = require("../config/mysql");

/**
 * Academic Audit Ledger Utility
 * Implements the Four-Field Event Contract:
 * - person_id (maps to user_id)
 * - location_id (e.g. ACAD-SUBJ-{code}, ACAD-TOPIC-{id}, ACAD-QUIZ-{id})
 * - timestamp (ISO string or SQL DATETIME)
 * - event_type (Standardized action event)
 * Plus optional payload (JSON metadata) and reason_code (for overrides/corrections)
 */
async function logAcademicEvent({
  personId,
  locationId,
  eventType,
  payload = null,
  reasonCode = null,
  connection = null,
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
    const [result] = await queryRunner.query(
      `INSERT INTO academic_audit_ledger 
        (person_id, location_id, timestamp, event_type, payload, reason_code)
       VALUES (?, ?, NOW(), ?, ?, ?)`,
      [personId, locationId, eventType, payloadJson, reasonCode],
    );

    return result.insertId;
  } catch (err) {
    console.error("[AcademicLedger] Failed to write event:", err.message);
    // Audit write failures should be reported or logged without necessarily blocking read transactions
    return null;
  }
}

module.exports = {
  logAcademicEvent,
};

