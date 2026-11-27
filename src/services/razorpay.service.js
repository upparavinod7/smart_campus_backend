const crypto = require("node:crypto");

const API_BASE_URL = "https://api.razorpay.com/v1";

class RazorpayApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "RazorpayApiError";
    this.statusCode = 502;
  }
}

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new RazorpayApiError("Razorpay credentials are not configured on the server");
  }
  return { keyId, keySecret };
}

function isConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
    process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

async function razorpayRequest(path, { method = "GET", body } = {}) {
  const { keyId, keySecret } = getCredentials();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new RazorpayApiError("Unable to reach Razorpay");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new RazorpayApiError("Razorpay returned an invalid response");
  }
  if (!response.ok) {
    throw new RazorpayApiError(`Razorpay request failed with status ${response.status}`);
  }
  return result;
}

async function createOrder({ amountPaise, receipt, notes }) {
  return razorpayRequest("/orders", {
    method: "POST",
    body: {
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes,
    },
  });
}

function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { keySecret } = getCredentials();
  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

async function verifyCapturedPayment({ paymentId, orderId, amountPaise }) {
  let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if (
    payment.order_id !== orderId ||
    Number(payment.amount) !== amountPaise ||
    payment.currency !== "INR"
  ) {
    throw new RazorpayApiError("Razorpay payment details do not match the credit order");
  }

  if (payment.status === "authorized") {
    payment = await razorpayRequest(
      `/payments/${encodeURIComponent(paymentId)}/capture`,
      {
        method: "POST",
        body: { amount: amountPaise, currency: "INR" },
      },
    );
  }

  if (
    payment.order_id !== orderId ||
    Number(payment.amount) !== amountPaise ||
    payment.currency !== "INR" ||
    payment.status !== "captured" ||
    payment.captured !== true
  ) {
    throw new RazorpayApiError("Razorpay payment has not been captured");
  }
}

module.exports = {
  RazorpayApiError,
  createOrder,
  isConfigured,
  verifyCapturedPayment,
  verifyCheckoutSignature,
};
