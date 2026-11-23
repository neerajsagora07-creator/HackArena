
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

// ====================================
// VERIFY JUDGE AUTHENTICATION
// ====================================

async function requireJudge(req, res, next) {

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Please login as Judge first."
        });
    }

    const token = authorization.slice(7);

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        if (
            decoded.role !== "judge" ||
            !mongoose.isValidObjectId(decoded.id)
        ) {
            return res.status(403).json({
                success: false,
                message: "Only Judge can perform this action."
            });
        }

        const user = await User.findById(decoded.id);

        if (!user || user.role !== "judge") {
            return res.status(403).json({
                success: false,
                message: "Judge access denied."
            });
        }

        req.judge = user;

        next();

    } catch (error) {

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired login session."
            });
        }

        console.error("Judge Auth Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Authentication failed."
        });
    }
}

module.exports = requireJudge;
