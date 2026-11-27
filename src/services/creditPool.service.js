async function getCreditPool(connection, { lock = false } = {}) {
  const [rows] = await connection.query(
    `SELECT balance FROM credit_pool WHERE pool_id = 1${lock ? " FOR UPDATE" : ""}`,
  );
  if (rows.length === 0) {
    throw new Error("Credit distribution pool is not initialized");
  }
  return Number(rows[0].balance);
}

async function allocateFromCreditPool(connection, { amount, actorId, reason, referenceId }) {
  const balance = await getCreditPool(connection, { lock: true });
  if (balance < amount) return { insufficient: true, balance };

  const newBalance = balance - amount;
  await connection.query(
    "UPDATE credit_pool SET balance = ?, updated_at = NOW() WHERE pool_id = 1",
    [newBalance],
  );
  await connection.query(
    `INSERT INTO credit_pool_ledger
      (type, amount, balance_after, reference_type, reference_id,
       idempotency_key, actor_id, reason)
     VALUES ('ALLOCATION', ?, ?, 'FACULTY_ALLOCATION', ?, ?, ?, ?)`,
    [
      amount,
      newBalance,
      String(referenceId),
      `POOL_ALLOCATION:${referenceId}`,
      actorId,
      reason,
    ],
  );
  return { insufficient: false, balance: newBalance };
}

module.exports = { allocateFromCreditPool, getCreditPool };
