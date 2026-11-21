const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Team = require("../models/Team");

async function requireParticipant(req, res, next) {

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Please login as a participant first."
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
            decoded.role !== "participant" ||
            !mongoose.isValidObjectId(decoded.id) ||
            !decoded.teamId
        ) {
            return res.status(403).json({
                success: false,
                message: "Participant access denied."
            });
        }

        const team = await Team.findById(decoded.id);

        if (
            !team ||
            !team.emailVerified ||
            team.teamId !== decoded.teamId
        ) {
            return res.status(401).json({
                success: false,
                message: "Team account not found or not verified."
            });
        }

        req.team = team;

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

        console.error("Participant Auth Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Participant authentication failed."
        });
    }
}

module.exports = requireParticipant;