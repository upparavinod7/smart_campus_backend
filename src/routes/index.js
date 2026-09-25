const express = require("express");

const authRoutes = require("./auth.routes");
const studentRoutes = require("./student.routes");

const router = express.Router();

router.get("/test", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is working"
    });
});

router.use("/auth", authRoutes);
router.use("/students", studentRoutes);

module.exports = router;