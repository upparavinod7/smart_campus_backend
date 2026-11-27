const { isConfigured } = require("./razorpay.service");

async function getCreditConfiguration(connection) {
  const [settingsRows] = await connection.query(
    `SELECT setting_key, setting_value
     FROM credit_settings
     WHERE setting_key IN (
       'INITIAL_CREDITS',
       'AI_GENERATION_COST',
       'REQUEST_MIN_AMOUNT',
       'REQUEST_MAX_AMOUNT',
       'REQUEST_DEFAULT_AMOUNT',
       'PRICE_PER_CREDIT',
       'RAZORPAY_ENABLED'
     )`,
  );
  const settings = Object.fromEntries(
    settingsRows.map((row) => [row.setting_key, row.setting_value]),
  );
  const [policyRows] = await connection.query(
    `SELECT mode FROM credit_policies
     WHERE scope_type = 'GLOBAL' AND scope_id IS NULL
     ORDER BY policy_id DESC LIMIT 1`,
  );

  const numberSetting = (key, fallback) => {
    const value = Number(settings[key]);
    return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  };
  const price = Number(settings.PRICE_PER_CREDIT || 0);

  return {
    acquisitionMode: policyRows[0]?.mode || "REQUEST_OR_PAY",
    initialCredits: numberSetting("INITIAL_CREDITS", 100),
    generationCost: numberSetting("AI_GENERATION_COST", 20),
    requestMinAmount: numberSetting("REQUEST_MIN_AMOUNT", 1),
    requestMaxAmount: numberSetting("REQUEST_MAX_AMOUNT", 500),
    requestDefaultAmount: numberSetting("REQUEST_DEFAULT_AMOUNT", 20),
    pricePerCredit: Number.isFinite(price) && price >= 0 ? price : 0,
    razorpayEnabled: settings.RAZORPAY_ENABLED === "1",
    razorpayConfigured: isConfigured(),
    razorpayTestMode: process.env.RAZORPAY_KEY_ID?.trim().startsWith("rzp_test_") || false,
  };
}

async function ensureCreditWallet(connection, { userId, facultyId, actorUserId = null }) {
  const [existingRows] = await connection.query(
    `SELECT wallet_id, user_id, faculty_id, balance, held, version, last_activity_at
     FROM credit_wallets
     WHERE faculty_id = ?
     LIMIT 1`,
    [facultyId],
  );
  if (existingRows.length > 0) return existingRows[0];

  const config = await getCreditConfiguration(connection);
  let result;
  try {
    [result] = await connection.query(
      `INSERT INTO credit_wallets (user_id, faculty_id, balance, held, last_activity_at)
       VALUES (?, ?, ?, 0, NOW())`,
      [userId, facultyId, config.initialCredits],
    );
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") throw error;
    const [concurrentRows] = await connection.query(
      `SELECT wallet_id, user_id, faculty_id, balance, held, version, last_activity_at
       FROM credit_wallets
       WHERE faculty_id = ? OR user_id = ?
       LIMIT 1`,
      [facultyId, userId],
    );
    if (concurrentRows.length === 0) throw error;
    return concurrentRows[0];
  }

  await connection.query(
    `INSERT INTO credit_ledger
      (wallet_id, type, amount, balance_after, held_after, reference_type,
       reference_id, idempotency_key, actor_id, reason)
     VALUES (?, 'INITIAL_GRANT', ?, ?, 0, 'FACULTY_REGISTRATION', ?, ?, ?, ?)`,
    [
      result.insertId,
      config.initialCredits,
      config.initialCredits,
      String(facultyId),
      `INITIAL_GRANT:${facultyId}`,
      actorUserId,
      "Initial faculty credit allocation",
    ],
  );

  return {
    wallet_id: result.insertId,
    user_id: userId,
    faculty_id: facultyId,
    balance: config.initialCredits,
    held: 0,
    version: 1,
    last_activity_at: new Date(),
  };
}

module.exports = { ensureCreditWallet, getCreditConfiguration };
