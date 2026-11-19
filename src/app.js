const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const apiRoutes = require("./routes/index");

const app = express();

const rawClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const configuredOrigins = rawClientUrl.split(",").map((u) => u.trim().replace(/\/$/, ""));
const defaultDevOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultDevOrigins]));

app.use(helmet());
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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