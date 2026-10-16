
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

// ====================================
// VERIFY ORGANIZER AUTHENTICATION
// ====================================

async function requireOrganizer(req, res, next) {

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Please login as Organizer first."
        });
    }

    const token = authorization.slice(7);

    try {

        // Verify login token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        // Only Organizer role is allowed
        if (
            decoded.role !== "organizer" ||
            !mongoose.isValidObjectId(decoded.id)
        ) {
            return res.status(403).json({
                success: false,
                message: "Only Organizer can perform this action."
            });
        }

        // Verify user role from MongoDB
        const user = await User.findById(decoded.id);

        if (!user || user.role !== "organizer") {
            return res.status(403).json({
                success: false,
                message: "Organizer access denied."
            });
        }

        req.organizer = user;

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

        console.error("Organizer Auth Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Authentication failed."
        });
    }
}

module.exports = requireOrganizer;
