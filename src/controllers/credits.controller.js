const crypto = require("crypto");
const pool = require("../config/mysql");
const { ensureCreditWallet, getCreditConfiguration } = require("../services/creditWallet.service");
const { allocateFromCreditPool, getCreditPool } = require("../services/creditPool.service");
const {
  RazorpayApiError,
  createOrder,
  isConfigured,
  verifyCapturedPayment,
  verifyCheckoutSignature,
} = require("../services/razorpay.service");

const MAX_CREDIT_AMOUNT = 1000000;
const MAX_RAZORPAY_ORDER_PAISE = 50000000;

function parseCreditAmount(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_CREDIT_AMOUNT
    ? amount
    : null;
}

function isDuplicate(error) {
  return error.code === "ER_DUP_ENTRY";
}

async function getWallet(req, res) {
  let connection;
  try {
    if (!req.user.faculty_id) {
      return res.status(403).json({ success: false, message: "Faculty account is not linked to a faculty profile" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const wallet = await ensureCreditWallet(connection, {
      userId: req.user.user_id,
      facultyId: req.user.faculty_id,
      actorUserId: req.user.user_id,
    });
    const config = await getCreditConfiguration(connection);
    const [requestRows] = await connection.query(
      `SELECT request_id, requested_amount AS amount, reason, status, note,
              created_at, decided_at
       FROM credit_requests
       WHERE faculty_id = ?
       ORDER BY created_at DESC, request_id DESC
       LIMIT 20`,
      [req.user.faculty_id],
    );
    const [newCreditRows] = await connection.query(
      `SELECT ledger_id, amount, balance_after, reason, created_at
       FROM credit_ledger
       WHERE wallet_id = ? AND faculty_notified_at IS NULL
         AND type IN ('INITIAL_GRANT', 'ADMIN_TOPUP', 'REQUEST_APPROVED', 'PURCHASE', 'BULK_TOPUP')
       ORDER BY ledger_id ASC
       LIMIT 20`,
      [wallet.wallet_id],
    );
    await connection.commit();
    return res.status(200).json({
      success: true,
      data: {
        wallet,
        settings: {
          acquisition_mode: config.acquisitionMode,
          generation_cost: config.generationCost,
          price_per_credit: config.pricePerCredit,
          razorpay_enabled: config.razorpayEnabled,
          razorpay_configured: config.razorpayConfigured,
          razorpay_test_mode: config.razorpayTestMode,
          request_min_amount: config.requestMinAmount,
          request_max_amount: config.requestMaxAmount,
          request_default_amount: config.requestDefaultAmount,
        },
        requests: requestRows,
        new_credits: newCreditRows,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("[Credits] getWallet error:", error);
    return res.status(500).json({ success: false, message: "Unable to load faculty credit wallet" });
  } finally {
    if (connection) connection.release();
  }
}

async function createCreditRequest(req, res) {
  const amount = parseCreditAmount(req.body?.amount);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!amount || !reason || reason.length > 200) {
    return res.status(400).json({
      success: false,
      message: "A positive whole-number amount and a reason of 1 to 200 characters are required",
    });
  }
  if (!req.user.faculty_id) {
    return res.status(403).json({ success: false, message: "Faculty account is not linked to a faculty profile" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [facultyRows] = await connection.query(
      "SELECT faculty_id FROM faculty WHERE faculty_id = ? AND is_active = 1 FOR UPDATE",
      [req.user.faculty_id],
    );
    if (facultyRows.length === 0) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Active faculty profile not found" });
    }
    await ensureCreditWallet(connection, {
      userId: req.user.user_id,
      facultyId: req.user.faculty_id,
      actorUserId: req.user.user_id,
    });
    const config = await getCreditConfiguration(connection);
    if (!["REQUEST_ONLY", "REQUEST_OR_PAY"].includes(config.acquisitionMode)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        code: "CREDIT_REQUEST_DISABLED",
        message: "Credit requests are disabled by the administrator.",
      });
    }
    if (amount < config.requestMinAmount || amount > config.requestMaxAmount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Credit requests must be between ${config.requestMinAmount} and ${config.requestMaxAmount} credits`,
      });
    }

    const [result] = await connection.query(
      "INSERT INTO credit_requests (faculty_id, requested_amount, reason) VALUES (?, ?, ?)",
      [req.user.faculty_id, amount, reason],
    );
    await connection.commit();
    return res.status(201).json({
      success: true,
      message: "Credit request submitted for administrator approval",
      data: { request_id: result.insertId, amount, status: "PENDING" },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (isDuplicate(error)) {
      return res.status(409).json({
        success: false,
        code: "CREDIT_REQUEST_PENDING",
        message: "You already have a pending credit request",
      });
    }
    console.error("[Credits] createCreditRequest error:", error);
    return res.status(500).json({ success: false, message: "Unable to submit credit request" });
  } finally {
    if (connection) connection.release();
  }
}

async function getAdminOverview(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const config = await getCreditConfiguration(connection);
    const poolBalance = await getCreditPool(connection);
    const [walletRows] = await connection.query(
      `SELECT w.wallet_id, w.faculty_id, w.balance, w.held,
              f.employee_code, f.full_name, f.email, f.is_active
       FROM credit_wallets w
       JOIN faculty f ON f.faculty_id = w.faculty_id
       ORDER BY f.full_name`,
    );
    const [requestRows] = await connection.query(
      `SELECT r.request_id, r.faculty_id, r.requested_amount AS amount, r.reason,
              r.status, r.created_at, f.employee_code, f.full_name, f.email
       FROM credit_requests r
       JOIN faculty f ON f.faculty_id = r.faculty_id
       WHERE r.status = 'PENDING'
       ORDER BY r.created_at ASC, r.request_id ASC`,
    );

    return res.status(200).json({
      success: true,
      data: {
        settings: {
          acquisition_mode: config.acquisitionMode,
          initial_credits: config.initialCredits,
          generation_cost: config.generationCost,
          price_per_credit: config.pricePerCredit,
          razorpay_enabled: config.razorpayEnabled,
          razorpay_configured: config.razorpayConfigured,
          razorpay_test_mode: config.razorpayTestMode,
          credit_pool_balance: poolBalance,
          request_min_amount: config.requestMinAmount,
          request_max_amount: config.requestMaxAmount,
        },
        wallets: walletRows,
        pending_requests: requestRows,
      },
    });
  } catch (error) {
    console.error("[Credits] getAdminOverview error:", error);
    return res.status(500).json({ success: false, message: "Unable to load credit management data" });
  } finally {
    if (connection) connection.release();
  }
}

async function updateSettings(req, res) {
  const {
    acquisition_mode,
    initial_credits,
    generation_cost,
    price_per_credit,
    razorpay_enabled: razorpayEnabled,
  } = req.body || {};
  const initialCredits = Number(initial_credits);
  const generationCost = Number(generation_cost);
  const parsedPrice = price_per_credit === null || price_per_credit === ""
    ? 0
    : Number(price_per_credit);
  const supportedModes = ["REQUEST_ONLY", "PAY_ONLY", "REQUEST_OR_PAY"];

  if (
    !supportedModes.includes(acquisition_mode) ||
    !Number.isSafeInteger(initialCredits) ||
    initialCredits < 0 ||
    initialCredits > MAX_CREDIT_AMOUNT ||
    !Number.isSafeInteger(generationCost) ||
    generationCost < 1 ||
    generationCost > MAX_CREDIT_AMOUNT ||
    !Number.isFinite(parsedPrice) ||
    parsedPrice < 0 ||
    parsedPrice > 1000000 ||
    Number(parsedPrice.toFixed(2)) !== parsedPrice ||
    typeof razorpayEnabled !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a supported acquisition mode, valid credit amounts, and a non-negative price per credit",
    });
  }
  if (razorpayEnabled && !isConfigured()) {
    return res.status(400).json({
      success: false,
      message: "Configure Razorpay credentials in the backend environment before enabling payments",
    });
  }
  if (acquisition_mode === "PAY_ONLY" && (!razorpayEnabled || parsedPrice <= 0)) {
    return res.status(400).json({
      success: false,
      message: "Pay-only mode requires Razorpay to be enabled and a positive price per credit",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const settings = [
      ["INITIAL_CREDITS", String(initialCredits)],
      ["AI_GENERATION_COST", String(generationCost)],
      ["PRICE_PER_CREDIT", parsedPrice.toFixed(2)],
      ["RAZORPAY_ENABLED", razorpayEnabled ? "1" : "0"],
    ];
    for (const [key, value] of settings) {
      await connection.query(
        `INSERT INTO credit_settings (setting_key, setting_value, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
                                 updated_by = VALUES(updated_by),
                                 updated_at = NOW()`,
        [key, value, req.user.user_id],
      );
    }
    const [policyRows] = await connection.query(
      `SELECT policy_id FROM credit_policies
       WHERE scope_type = 'GLOBAL' AND scope_id IS NULL
       ORDER BY policy_id DESC LIMIT 1 FOR UPDATE`,
    );
    if (policyRows.length === 0) {
      await connection.query(
        "INSERT INTO credit_policies (scope_type, scope_id, mode, updated_by) VALUES ('GLOBAL', NULL, ?, ?)",
        [acquisition_mode, req.user.user_id],
      );
    } else {
      await connection.query(
        "UPDATE credit_policies SET mode = ?, updated_by = ?, updated_at = NOW() WHERE scope_type = 'GLOBAL' AND scope_id IS NULL",
        [acquisition_mode, req.user.user_id],
      );
    }
    await connection.commit();
    return res.status(200).json({ success: true, message: "Credit settings updated successfully" });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("[Credits] updateSettings error:", error);
    return res.status(500).json({ success: false, message: "Unable to update credit settings" });
  } finally {
    if (connection) connection.release();
  }
}

async function createCreditPaymentOrder(req, res) {
  const amount = parseCreditAmount(req.body?.amount);
  if (!amount || !req.user.faculty_id) {
    return res.status(400).json({ success: false, message: "A valid whole-number credit amount is required" });
  }

  let connection;
  let transactionOpen = false;
  try {
    connection = await pool.getConnection();
    const config = await getCreditConfiguration(connection);
    if (!["PAY_ONLY", "REQUEST_OR_PAY"].includes(config.acquisitionMode)) {
      return res.status(409).json({
        success: false,
        code: "CREDIT_PURCHASE_DISABLED",
        message: "Credit purchases are disabled by the administrator.",
      });
    }
    if (!config.razorpayEnabled || !config.razorpayConfigured || config.pricePerCredit <= 0) {
      return res.status(503).json({
        success: false,
        code: "RAZORPAY_NOT_READY",
        message: "Razorpay payments are not enabled or configured by the administrator.",
      });
    }
    if (amount < config.requestMinAmount || amount > config.requestMaxAmount) {
      return res.status(400).json({
        success: false,
        message: `Purchases must be between ${config.requestMinAmount} and ${config.requestMaxAmount} credits`,
      });
    }

    const amountPaise = Math.round(config.pricePerCredit * 100) * amount;
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1 || amountPaise > MAX_RAZORPAY_ORDER_PAISE) {
      return res.status(400).json({
        success: false,
        message: "The purchase total exceeds the supported payment amount",
      });
    }

    await connection.beginTransaction();
    transactionOpen = true;
    const [facultyRows] = await connection.query(
      `SELECT f.faculty_id
       FROM faculty f
       JOIN users u ON u.faculty_id = f.faculty_id AND u.user_id = ? AND u.role = 'FACULTY'
       WHERE f.faculty_id = ? AND f.is_active = 1
       FOR UPDATE`,
      [req.user.user_id, req.user.faculty_id],
    );
    if (facultyRows.length === 0) {
      await connection.rollback();
      transactionOpen = false;
      return res.status(403).json({ success: false, message: "Active faculty profile not found" });
    }
    const wallet = await ensureCreditWallet(connection, {
      userId: req.user.user_id,
      facultyId: req.user.faculty_id,
      actorUserId: req.user.user_id,
    });
    const [walletRows] = await connection.query(
      "SELECT balance FROM credit_wallets WHERE wallet_id = ? FOR UPDATE",
      [wallet.wallet_id],
    );
    if (Number(walletRows[0].balance) + amount > MAX_CREDIT_AMOUNT) {
      await connection.rollback();
      transactionOpen = false;
      return res.status(400).json({ success: false, message: "Credit balance exceeds the supported maximum" });
    }
    await connection.commit();
    transactionOpen = false;

    const receipt = `cr_${crypto.randomUUID().replace(/-/g, "")}`;
    const order = await createOrder({
      amountPaise,
      receipt,
      notes: {
        credit_amount: String(amount),
        faculty_id: String(req.user.faculty_id),
        user_id: String(req.user.user_id),
      },
    });
    if (
      typeof order.id !== "string" ||
      Number(order.amount) !== amountPaise ||
      order.currency !== "INR"
    ) {
      throw new RazorpayApiError("Razorpay returned an invalid order");
    }

    const paymentReference = crypto.randomUUID();
    await connection.query(
      `INSERT INTO credit_payments
        (payment_id, user_id, faculty_id, credits, amount_paise, currency, provider_order_id, status)
       VALUES (?, ?, ?, ?, ?, 'INR', ?, 'PENDING')`,
      [
        paymentReference,
        req.user.user_id,
        req.user.faculty_id,
        amount,
        amountPaise,
        order.id,
      ],
    );

    return res.status(201).json({
      success: true,
      data: {
        key_id: process.env.RAZORPAY_KEY_ID.trim(),
        order_id: order.id,
        amount: amountPaise,
        currency: "INR",
        credits: amount,
        test_mode: config.razorpayTestMode,
      },
    });
  } catch (error) {
    if (connection && transactionOpen) await connection.rollback().catch(() => {});
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "A duplicate payment order was rejected" });
    }
    if (error instanceof RazorpayApiError) {
      console.error("[Credits] Razorpay order error:", error.message);
      return res.status(error.statusCode).json({ success: false, message: "Unable to create a Razorpay order" });
    }
    console.error("[Credits] createCreditPaymentOrder error:", error);
    return res.status(500).json({ success: false, message: "Unable to create a credit payment order" });
  } finally {
    if (connection) connection.release();
  }
}

async function verifyCreditPayment(req, res) {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body || {};
  if (
    typeof orderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    typeof paymentId !== "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
    typeof signature !== "string"
  ) {
    return res.status(400).json({ success: false, message: "Valid Razorpay payment details are required" });
  }
  if (!isConfigured() || !verifyCheckoutSignature(orderId, paymentId, signature)) {
    return res.status(400).json({ success: false, message: "Razorpay payment signature is invalid" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [existingRows] = await connection.query(
      `SELECT p.payment_id, p.faculty_id, p.credits AS credit_amount, p.amount_paise,
              p.provider_payment_id AS razorpay_payment_id, p.status
       FROM credit_payments p
       WHERE p.provider_order_id = ? AND p.user_id = ?`,
      [orderId, req.user.user_id],
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: "Credit payment order not found" });
    }

    const existing = existingRows[0];
    if (existing.status === "SUCCEEDED") {
      if (existing.razorpay_payment_id !== paymentId) {
        return res.status(409).json({ success: false, message: "This order was completed with another payment" });
      }
      const [walletRows] = await connection.query(
        "SELECT balance FROM credit_wallets WHERE faculty_id = ? AND user_id = ?",
        [existing.faculty_id, req.user.user_id],
      );
      return res.status(200).json({
        success: true,
        message: "Payment was already verified",
        data: { credits_added: Number(existing.credit_amount), balance: Number(walletRows[0].balance) },
      });
    }
    if (existing.razorpay_payment_id && existing.razorpay_payment_id !== paymentId) {
      return res.status(409).json({ success: false, message: "This order is linked to another payment" });
    }
    if (existing.status !== "PENDING") {
      return res.status(409).json({ success: false, message: "This credit payment is no longer pending" });
    }

    await verifyCapturedPayment({
      paymentId,
      orderId,
      amountPaise: Number(existing.amount_paise),
    });

    await connection.beginTransaction();
    const [paymentRows] = await connection.query(
      `SELECT payment_id, faculty_id, credits AS credit_amount,
              provider_payment_id AS razorpay_payment_id, status
       FROM credit_payments WHERE payment_id = ? FOR UPDATE`,
      [existing.payment_id],
    );
    const payment = paymentRows[0];
    if (payment.status === "SUCCEEDED") {
      if (payment.razorpay_payment_id !== paymentId) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "This order was completed with another payment" });
      }
      const [walletRows] = await connection.query(
        "SELECT balance FROM credit_wallets WHERE faculty_id = ? AND user_id = ?",
        [payment.faculty_id, req.user.user_id],
      );
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: "Payment was already verified",
        data: { credits_added: Number(payment.credit_amount), balance: Number(walletRows[0].balance) },
      });
    }
    if (payment.status !== "PENDING") {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "This credit payment is no longer pending" });
    }
    const [walletRows] = await connection.query(
      "SELECT wallet_id, balance, held FROM credit_wallets WHERE faculty_id = ? AND user_id = ? FOR UPDATE",
      [payment.faculty_id, req.user.user_id],
    );
    if (walletRows.length === 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Payment wallet is no longer available" });
    }

    const creditsAdded = Number(payment.credit_amount);
    const newBalance = Number(walletRows[0].balance) + creditsAdded;
    if (!Number.isSafeInteger(creditsAdded) || newBalance > MAX_CREDIT_AMOUNT) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Credit balance exceeds the supported maximum" });
    }
    await connection.query(
      `UPDATE credit_wallets
       SET balance = ?, version = version + 1, last_activity_at = NOW(), updated_at = NOW()
       WHERE wallet_id = ?`,
      [newBalance, walletRows[0].wallet_id],
    );
    await connection.query(
      `INSERT INTO credit_ledger
        (wallet_id, type, amount, balance_after, held_after, reference_type,
         reference_id, idempotency_key, actor_id, reason)
       VALUES (?, 'PURCHASE', ?, ?, ?, 'RAZORPAY_ORDER', ?, ?, ?, ?)`,
      [
        walletRows[0].wallet_id,
        creditsAdded,
        newBalance,
        walletRows[0].held,
        orderId,
        `RAZORPAY_PURCHASE:${orderId}`,
        req.user.user_id,
        `Purchased ${creditsAdded} credits through Razorpay`,
      ],
    );
    await connection.query(
      `UPDATE credit_payments
       SET status = 'SUCCEEDED', provider_payment_id = ?
       WHERE payment_id = ? AND status = 'PENDING'`,
      [paymentId, payment.payment_id],
    );
    await connection.commit();
    return res.status(200).json({
      success: true,
      message: "Payment verified and credits added",
      data: { credits_added: creditsAdded, balance: newBalance },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error instanceof RazorpayApiError) {
      console.error("[Credits] Razorpay verification error:", error.message);
      return res.status(error.statusCode).json({ success: false, message: "Unable to verify the Razorpay payment" });
    }
    console.error("[Credits] verifyCreditPayment error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify the credit payment" });
  } finally {
    if (connection) connection.release();
  }
}

async function acknowledgeCredits(req, res) {
  const ledgerIds = req.body?.ledger_ids;
  if (
    !Array.isArray(ledgerIds) ||
    ledgerIds.length < 1 ||
    ledgerIds.length > 20 ||
    ledgerIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) < 1)
  ) {
    return res.status(400).json({ success: false, message: "Provide valid credit notification IDs" });
  }
  if (!req.user.faculty_id) {
    return res.status(403).json({ success: false, message: "Faculty account is not linked to a faculty profile" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [walletRows] = await connection.query(
      "SELECT wallet_id FROM credit_wallets WHERE faculty_id = ? AND user_id = ?",
      [req.user.faculty_id, req.user.user_id],
    );
    if (walletRows.length === 0) {
      return res.status(404).json({ success: false, message: "Faculty credit wallet not found" });
    }
    const normalizedIds = Array.from(new Set(ledgerIds.map(Number)));
    await connection.query(
      `UPDATE credit_ledger
       SET faculty_notified_at = NOW()
       WHERE wallet_id = ? AND ledger_id IN (?) AND faculty_notified_at IS NULL`,
      [walletRows[0].wallet_id, normalizedIds],
    );
    return res.status(200).json({ success: true, message: "Credit notifications acknowledged" });
  } catch (error) {
    console.error("[Credits] acknowledgeCredits error:", error);
    return res.status(500).json({ success: false, message: "Unable to acknowledge credit notifications" });
  } finally {
    if (connection) connection.release();
  }
}

async function createCreditPoolPaymentOrder(req, res) {
  const amount = parseCreditAmount(req.body?.amount);
  if (!amount) {
    return res.status(400).json({ success: false, message: "A valid whole-number credit amount is required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const config = await getCreditConfiguration(connection);
    if (!config.razorpayEnabled || !config.razorpayConfigured || config.pricePerCredit <= 0) {
      return res.status(503).json({
        success: false,
        code: "RAZORPAY_NOT_READY",
        message: "Razorpay payments are not enabled or configured by the administrator.",
      });
    }
    if (amount < config.requestMinAmount || amount > config.requestMaxAmount) {
      return res.status(400).json({
        success: false,
        message: `Purchases must be between ${config.requestMinAmount} and ${config.requestMaxAmount} credits`,
      });
    }

    const amountPaise = Math.round(config.pricePerCredit * 100) * amount;
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1 || amountPaise > MAX_RAZORPAY_ORDER_PAISE) {
      return res.status(400).json({ success: false, message: "The purchase total exceeds the supported payment amount" });
    }

    const order = await createOrder({
      amountPaise,
      receipt: `cp_${crypto.randomUUID().replace(/-/g, "")}`,
      notes: {
        credit_amount: String(amount),
        admin_id: String(req.user.user_id),
        purpose: "faculty_credit_pool",
      },
    });
    if (
      typeof order.id !== "string" ||
      Number(order.amount) !== amountPaise ||
      order.currency !== "INR"
    ) {
      throw new RazorpayApiError("Razorpay returned an invalid order");
    }

    await connection.query(
      `INSERT INTO credit_pool_payments
        (payment_id, admin_id, credits, amount_paise, currency, provider_order_id, status)
       VALUES (?, ?, ?, ?, 'INR', ?, 'PENDING')`,
      [crypto.randomUUID(), req.user.user_id, amount, amountPaise, order.id],
    );
    return res.status(201).json({
      success: true,
      data: {
        key_id: process.env.RAZORPAY_KEY_ID.trim(),
        order_id: order.id,
        amount: amountPaise,
        currency: "INR",
        credits: amount,
        test_mode: config.razorpayTestMode,
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "A duplicate pool payment order was rejected" });
    }
    if (error instanceof RazorpayApiError) {
      console.error("[Credits] Razorpay pool order error:", error.message);
      return res.status(error.statusCode).json({ success: false, message: "Unable to create the Razorpay order" });
    }
    console.error("[Credits] createCreditPoolPaymentOrder error:", error);
    return res.status(500).json({ success: false, message: "Unable to create a credit pool payment order" });
  } finally {
    if (connection) connection.release();
  }
}

async function verifyCreditPoolPayment(req, res) {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body || {};
  if (
    typeof orderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    typeof paymentId !== "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
    typeof signature !== "string"
  ) {
    return res.status(400).json({ success: false, message: "Valid Razorpay payment details are required" });
  }
  if (!isConfigured() || !verifyCheckoutSignature(orderId, paymentId, signature)) {
    return res.status(400).json({ success: false, message: "Razorpay payment signature is invalid" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [paymentRows] = await connection.query(
      `SELECT payment_id, credits, amount_paise, provider_payment_id, status
       FROM credit_pool_payments
       WHERE provider_order_id = ? AND admin_id = ?`,
      [orderId, req.user.user_id],
    );
    if (paymentRows.length === 0) {
      return res.status(404).json({ success: false, message: "Credit pool payment order not found" });
    }
    const payment = paymentRows[0];
    if (payment.status === "SUCCEEDED") {
      if (payment.provider_payment_id !== paymentId) {
        return res.status(409).json({ success: false, message: "This order was completed with another payment" });
      }
      return res.status(200).json({
        success: true,
        message: "Payment was already verified",
        data: { credits_added: Number(payment.credits), pool_balance: await getCreditPool(connection) },
      });
    }
    if (payment.status !== "PENDING" || (payment.provider_payment_id && payment.provider_payment_id !== paymentId)) {
      return res.status(409).json({ success: false, message: "This credit pool payment is no longer pending" });
    }
    await verifyCapturedPayment({
      paymentId,
      orderId,
      amountPaise: Number(payment.amount_paise),
    });

    await connection.beginTransaction();
    const [lockedRows] = await connection.query(
      `SELECT payment_id, credits, provider_payment_id, status
       FROM credit_pool_payments WHERE payment_id = ? FOR UPDATE`,
      [payment.payment_id],
    );
    const lockedPayment = lockedRows[0];
    if (lockedPayment.status === "SUCCEEDED") {
      if (lockedPayment.provider_payment_id !== paymentId) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: "This order was completed with another payment" });
      }
      const poolBalance = await getCreditPool(connection);
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: "Payment was already verified",
        data: { credits_added: Number(lockedPayment.credits), pool_balance: poolBalance },
      });
    }
    if (lockedPayment.status !== "PENDING") {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "This credit pool payment is no longer pending" });
    }

    const currentBalance = await getCreditPool(connection, { lock: true });
    const creditsAdded = Number(lockedPayment.credits);
    const newBalance = currentBalance + creditsAdded;
    if (!Number.isSafeInteger(creditsAdded) || newBalance > MAX_CREDIT_AMOUNT) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Credit pool exceeds the supported maximum" });
    }
    await connection.query(
      "UPDATE credit_pool SET balance = ?, updated_at = NOW() WHERE pool_id = 1",
      [newBalance],
    );
    await connection.query(
      `INSERT INTO credit_pool_ledger
        (type, amount, balance_after, reference_type, reference_id,
         idempotency_key, actor_id, reason)
       VALUES ('PURCHASE', ?, ?, 'RAZORPAY_ORDER', ?, ?, ?, ?)`,
      [
        creditsAdded,
        newBalance,
        orderId,
        `POOL_PURCHASE:${orderId}`,
        req.user.user_id,
        `Purchased ${creditsAdded} credits for faculty distribution`,
      ],
    );
    await connection.query(
      `UPDATE credit_pool_payments
       SET status = 'SUCCEEDED', provider_payment_id = ?
       WHERE payment_id = ? AND status = 'PENDING'`,
      [paymentId, lockedPayment.payment_id],
    );
    await connection.commit();
    return res.status(200).json({
      success: true,
      message: "Payment verified and credits added to the distribution pool",
      data: { credits_added: creditsAdded, pool_balance: newBalance },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error instanceof RazorpayApiError) {
      console.error("[Credits] Razorpay pool verification error:", error.message);
      return res.status(error.statusCode).json({ success: false, message: "Unable to verify the Razorpay payment" });
    }
    console.error("[Credits] verifyCreditPoolPayment error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify the credit pool payment" });
  } finally {
    if (connection) connection.release();
  }
}

async function grantCredits(req, res) {
  const facultyId = Number(req.params.facultyId);
  const amount = parseCreditAmount(req.body?.amount);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!Number.isSafeInteger(facultyId) || facultyId < 1 || !amount || !reason || reason.length > 500) {
    return res.status(400).json({
      success: false,
      message: "A valid faculty ID, positive whole-number amount, and reason of 1 to 500 characters are required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [facultyRows] = await connection.query(
      `SELECT f.faculty_id, u.user_id
       FROM faculty f
       JOIN users u ON u.faculty_id = f.faculty_id AND u.role = 'FACULTY'
       WHERE f.faculty_id = ?
       ORDER BY u.user_id LIMIT 1 FOR UPDATE`,
      [facultyId],
    );
    if (facultyRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Faculty member not found" });
    }
    const wallet = await ensureCreditWallet(connection, {
      userId: facultyRows[0].user_id,
      facultyId,
      actorUserId: req.user.user_id,
    });
    const [walletRows] = await connection.query(
      "SELECT balance, held FROM credit_wallets WHERE wallet_id = ? FOR UPDATE",
      [wallet.wallet_id],
    );
    const newBalance = Number(walletRows[0].balance) + amount;
    if (newBalance > MAX_CREDIT_AMOUNT) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Credit balance exceeds the supported maximum" });
    }
    const allocation = await allocateFromCreditPool(connection, {
      amount,
      actorId: req.user.user_id,
      reason,
      referenceId: `grant:${crypto.randomUUID()}`,
    });
    if (allocation.insufficient) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        code: "CREDIT_POOL_INSUFFICIENT",
        message: `Only ${allocation.balance} paid credits are available to distribute. Purchase credits for the pool first.`,
      });
    }
    await connection.query(
      `UPDATE credit_wallets
       SET balance = ?, version = version + 1, last_activity_at = NOW(), updated_at = NOW()
       WHERE wallet_id = ?`,
      [newBalance, wallet.wallet_id],
    );
    await connection.query(
      `INSERT INTO credit_ledger
        (wallet_id, type, amount, balance_after, held_after, reference_type,
         reference_id, idempotency_key, actor_id, reason)
       VALUES (?, 'ADMIN_TOPUP', ?, ?, ?, 'ADMIN_GRANT', ?, ?, ?, ?)`,
      [
        wallet.wallet_id,
        amount,
        newBalance,
        walletRows[0].held,
        crypto.randomUUID(),
        crypto.randomUUID(),
        req.user.user_id,
        reason,
      ],
    );
    await connection.commit();
    return res.status(200).json({
      success: true,
      message: "Credits granted successfully",
      data: { faculty_id: facultyId, balance: newBalance },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("[Credits] grantCredits error:", error);
    return res.status(500).json({ success: false, message: "Unable to grant credits" });
  } finally {
    if (connection) connection.release();
  }
}

async function decideCreditRequest(req, res) {
  const requestId = Number(req.params.requestId);
  const { decision, decision_note } = req.body || {};
  const note = typeof decision_note === "string" ? decision_note.trim() : "";
  if (
    !Number.isSafeInteger(requestId) ||
    requestId < 1 ||
    !["APPROVED", "REJECTED"].includes(decision) ||
    note.length > 500
  ) {
    return res.status(400).json({ success: false, message: "A valid request ID and APPROVED or REJECTED decision are required" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [requestRows] = await connection.query(
      `SELECT request_id, faculty_id, requested_amount, status
       FROM credit_requests WHERE request_id = ? FOR UPDATE`,
      [requestId],
    );
    if (requestRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Credit request not found" });
    }
    const request = requestRows[0];
    if (request.status !== "PENDING") {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        code: "CREDIT_REQUEST_ALREADY_DECIDED",
        message: "This credit request has already been decided",
      });
    }

    if (decision === "APPROVED") {
      const [facultyRows] = await connection.query(
        `SELECT f.faculty_id, u.user_id
         FROM faculty f
         JOIN users u ON u.faculty_id = f.faculty_id AND u.role = 'FACULTY'
         WHERE f.faculty_id = ?
         ORDER BY u.user_id LIMIT 1 FOR UPDATE`,
        [request.faculty_id],
      );
      if (facultyRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: "Faculty member not found" });
      }
      const wallet = await ensureCreditWallet(connection, {
        userId: facultyRows[0].user_id,
        facultyId: request.faculty_id,
        actorUserId: req.user.user_id,
      });
      const [walletRows] = await connection.query(
        "SELECT balance, held FROM credit_wallets WHERE wallet_id = ? FOR UPDATE",
        [wallet.wallet_id],
      );
      const approvedAmount = Number(request.requested_amount);
      const newBalance = Number(walletRows[0].balance) + approvedAmount;
      if (newBalance > MAX_CREDIT_AMOUNT) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Credit balance exceeds the supported maximum" });
      }
      const allocation = await allocateFromCreditPool(connection, {
        amount: approvedAmount,
        actorId: req.user.user_id,
        reason: `Approved credit request #${requestId}`,
        referenceId: `request:${requestId}`,
      });
      if (allocation.insufficient) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          code: "CREDIT_POOL_INSUFFICIENT",
          message: `Only ${allocation.balance} paid credits are available. Purchase credits for the pool before approving this request.`,
        });
      }
      await connection.query(
        `UPDATE credit_wallets
         SET balance = ?, version = version + 1, last_activity_at = NOW(), updated_at = NOW()
         WHERE wallet_id = ?`,
        [newBalance, wallet.wallet_id],
      );
      await connection.query(
        `INSERT INTO credit_ledger
          (wallet_id, type, amount, balance_after, held_after, reference_type,
           reference_id, idempotency_key, actor_id, reason)
         VALUES (?, 'REQUEST_APPROVED', ?, ?, ?, 'CREDIT_REQUEST', ?, ?, ?, ?)`,
        [
          wallet.wallet_id,
          approvedAmount,
          newBalance,
          walletRows[0].held,
          String(requestId),
          `REQUEST_APPROVED:${requestId}`,
          req.user.user_id,
          `Approved credit request #${requestId}`,
        ],
      );
      await connection.query(
        `UPDATE credit_requests
         SET status = 'APPROVED', approved_amount = ?, approver_id = ?,
             note = ?, decided_at = NOW()
         WHERE request_id = ?`,
        [approvedAmount, req.user.user_id, note || null, requestId],
      );
    } else {
      await connection.query(
        `UPDATE credit_requests
         SET status = 'REJECTED', approver_id = ?, note = ?, decided_at = NOW()
         WHERE request_id = ?`,
        [req.user.user_id, note || null, requestId],
      );
    }

    await connection.commit();
    return res.status(200).json({
      success: true,
      message: `Credit request ${decision.toLowerCase()}`,
      data: { request_id: requestId, status: decision },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("[Credits] decideCreditRequest error:", error);
    return res.status(500).json({ success: false, message: "Unable to decide credit request" });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getWallet,
  createCreditRequest,
  acknowledgeCredits,
  getAdminOverview,
  updateSettings,
  createCreditPaymentOrder,
  verifyCreditPayment,
  createCreditPoolPaymentOrder,
  verifyCreditPoolPayment,
  grantCredits,
  decideCreditRequest,
};
