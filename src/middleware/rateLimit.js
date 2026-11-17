/**
 * In-Memory Sliding Window Rate Limiter
 * Zero external dependencies.
 */
function createRateLimiter({
  windowMs = 60 * 1000, // 1 minute window
  max = 10,             // limit each key to `max` requests per windowMs
  message = "Too many requests, please try again later",
  code = "RATE_LIMIT_EXCEEDED",
  keyGenerator = (req) => {
    if (req.user && req.user.user_id) {
      return `user_${req.user.user_id}`;
    }
    return req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown_ip";
  },
} = {}) {
  const hits = new Map(); // key -> array of timestamps

  // Periodically cleanup expired entries every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, 2 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const middleware = (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const timestamps = hits.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < windowMs);

    if (validTimestamps.length >= max) {
      const oldest = validTimestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        code,
        retry_after: retryAfterSeconds,
      });
    }

    validTimestamps.push(now);
    hits.set(key, validTimestamps);
    next();
  };

  middleware.reset = () => {
    hits.clear();
  };

  middleware.getHits = (key) => hits.get(key) || [];

  return middleware;
}

module.exports = {
  createRateLimiter,
};
