const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const apiRoutes = require("./routes/index");

const app = express();

const rawClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const configuredOrigins = rawClientUrl.split(",").map((u) => u.trim().replace(/\/$/, ""));
const defaultDevOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultDevOrigins]));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://checkout.razorpay.com"],
      "connect-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      "img-src": ["'self'", "data:", "https://*.razorpay.com"],
    },
  },
}));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, test suites)
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Serve static uploaded photos
app.use("/uploads", express.static(path.resolve(__dirname, "../storage/uploads")));

app.use("/api/v1", apiRoutes);

// Fallback 404 handler returning JSON instead of HTML
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler returning standard JSON
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

module.exports = app;