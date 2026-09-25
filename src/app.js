const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const apiRoutes = require("./routes/index");

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", apiRoutes);

module.exports = app;