require("dotenv").config();

// Validate mandatory environment configuration before startup
const mandatoryEnv = ["DB_USER", "DB_NAME", "JWT_SECRET"];
const missing = mandatoryEnv.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`[CONFIG ERROR] Missing mandatory environment variables: ${missing.join(", ")}`);
  console.error("Please configure them in your .env file. Refer to .env.example for template.");
  process.exit(1);
}

const app = require("./app");

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

app.listen(PORT, () => {
  console.log(`[SERVER] Joy University Smart Campus ERP Backend running on port ${PORT} [${NODE_ENV}]`);
});

