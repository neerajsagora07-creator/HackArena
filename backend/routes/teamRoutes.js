
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");

const Team = require("../models/Team");
const Event = require("../models/event");

const router = express.Router();

// =====================================
// SECURITY - LIMIT REQUESTS
// =====================================

const registerLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Try again later."
    }
});

const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many attempts. Try again later."
    }
});

// =====================================
// EMAIL CONFIGURATION
// =====================================

function createMailTransport() {

    const port = Number(process.env.SMTP_PORT || 587);

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });
}

// =====================================
// OTP HASH
// =====================================

function hashOtp(email, otp) {

    return crypto
        .createHmac("sha256", process.env.JWT_SECRET)
        .update(email + ":" + otp)
        .digest("hex");
}

// =====================================
// REGISTER TEAM
// POST /api/teams/register
// =====================================

router.post("/register", registerLimit, async (req, res) => {

    try {

        const {
            teamName,
            leaderName,
            leaderEmail,
            memberNames = [],
            password
        } = req.body;

        // Required field validation

        if (
            typeof teamName !== "string" ||
            typeof leaderName !== "string" ||
            typeof leaderEmail !== "string" ||
            typeof password !== "string" ||
            !Array.isArray(memberNames)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid registration details."
            });
        }

        const name = teamName.trim();
        const leader = leaderName.trim();
        const email = leaderEmail.trim().toLowerCase();

        if (
            name.length < 2 ||
            name.length > 100 ||
            leader.length < 2 ||
            leader.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            email.length > 254 ||
            password.length < 8 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter valid team, leader, email and password details."
            });
        }

        // Check actual team member names

        const members = memberNames.map((member) =>
            typeof member === "string" ? member.trim() : ""
        );

        if (
            members.some((member) =>
                member.length < 2 || member.length > 100
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter valid member names."
            });
        }

        // Get organizer's event settings

        const event = await Event.findOne();

        const maximumMembers = event?.maximumMembers || 4;
        const maximumTeams = event?.maximumTeams || 60;

        if (members.length + 1 > maximumMembers) {
            return res.status(400).json({
                success: false,
                message: "Team member limit exceeded."
            });
        }

        const registeredTeams = await Team.countDocuments({
            emailVerified: true
        });

        if (registeredTeams >= maximumTeams) {
            return res.status(409).json({
                success: false,
                message: "Team registration capacity is full."
            });
        }

        // Check duplicate leader email

        const existingTeam = await Team.findOne({
            leaderEmail: email
        });

        if (existingTeam) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        // Real email service is required

        if (
            !process.env.SMTP_HOST ||
            !process.env.SMTP_USER ||
            !process.env.SMTP_PASSWORD
        ) {
            return res.status(503).json({
                success: false,
                message: "Email verification service is not configured."
            });
        }

        // Secure password hash

        const passwordHash = await bcrypt.hash(password, 12);

        // Generate a 6-digit OTP

        const otp = crypto.randomInt(
            100000,
            1000000
        ).toString();

        const verificationOtpHash = hashOtp(email, otp);

        const verificationExpiresAt = new Date(
            Date.now() + 10 * 60 * 1000
        );

        // Save pending team in MongoDB

        const team = await Team.create({
            teamName: name,
            leaderName: leader,
            leaderEmail: email,
            memberNames: members,
            passwordHash,
            emailVerified: false,
            verificationOtpHash,
            verificationExpiresAt
        });

        // Send OTP email

        try {

            const transporter = createMailTransport();

            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: email,
                subject: "HackArena - Verify Your Team",
                text:
                    "Your HackArena verification code is: " +
                    otp +
                    "\n\nThis code expires in 10 minutes." +
                    "\nDo not share this code."
            });

        } catch (mailError) {

            console.error("Email Error:", mailError.message);

            // Do not leave a pending record if sending fails
            await Team.deleteOne({
                _id: team._id,
                emailVerified: false
            });

            return res.status(503).json({
                success: false,
                message: "Could not send verification email."
            });
        }

        res.status(201).json({
            success: true,
            message: "Verification OTP sent to team leader's email."
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        console.error("Team Registration Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Team registration failed."
        });
    }
});

// =====================================
// VERIFY EMAIL OTP
// POST /api/teams/verify-email
// =====================================

router.post("/verify-email", loginLimit, async (req, res) => {

    try {

        const { leaderEmail, otp } = req.body;

        if (
            typeof leaderEmail !== "string" ||
            typeof otp !== "string" ||
            !/^\d{6}$/.test(otp)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid email and 6-digit OTP are required."
            });
        }

        const email = leaderEmail.trim().toLowerCase();

        const team = await Team.findOne({
            leaderEmail: email
        }).select(
            "+verificationOtpHash +verificationExpiresAt"
        );

        if (!team || team.emailVerified) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification request."
            });
        }

        if (
            !team.verificationExpiresAt ||
            team.verificationExpiresAt < new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "OTP expired. Please register again later."
            });
        }

        const enteredHash = hashOtp(email, otp);

        const expectedHash = Buffer.from(
            team.verificationOtpHash || "",
            "hex"
        );

        const actualHash = Buffer.from(enteredHash, "hex");

        if (
            expectedHash.length !== actualHash.length ||
            !crypto.timingSafeEqual(expectedHash, actualHash)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification OTP."
            });
        }

        // Capacity check before activating team

        const event = await Event.findOne();
        const maximumTeams = event?.maximumTeams || 60;

        const registeredTeams = await Team.countDocuments({
            emailVerified: true
        });

        if (registeredTeams >= maximumTeams) {
            return res.status(409).json({
                success: false,
                message: "Team registration capacity is full."
            });
        }

        // Generate unique Team ID

        let saved = false;

        for (let attempt = 0; attempt < 5; attempt++) {

           const randomId = crypto.randomInt(10000, 100000).toString();

            team.teamId = "HA-" + randomId;
            team.emailVerified = true;
            team.verificationOtpHash = undefined;
            team.verificationExpiresAt = undefined;

            try {

                await team.save();
                saved = true;
                break;

            } catch (error) {

                if (error.code !== 11000) {
                    throw error;
                }
            }
        }

        if (!saved) {
            throw new Error("Could not generate unique Team ID.");
        }

        res.json({
            success: true,
            message: "Team verified successfully!",
            teamId: team.teamId,
            teamName: team.teamName
        });

    } catch (error) {

        console.error("Verification Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Email verification failed."
        });
    }
});

// =====================================
// TEAM LOGIN
// POST /api/teams/login
// =====================================

router.post("/login", loginLimit, async (req, res) => {

    try {

        const { teamId, password } = req.body;

        if (
            typeof teamId !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Team ID and Password are required."
            });
        }

        const team = await Team.findOne({
            teamId: teamId.trim().toUpperCase(),
            emailVerified: true
        }).select("+passwordHash");

        if (!team) {
            return res.status(401).json({
                success: false,
                message: "Invalid Team ID or Password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            team.passwordHash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid Team ID or Password."
            });
        }

        const token = jwt.sign(
            {
                id: team._id.toString(),
                teamId: team.teamId,
                role: "participant"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        res.json({
            success: true,
            message: "Team Login Successful!",
            token,
            team: {
                teamId: team.teamId,
                teamName: team.teamName,
                leaderName: team.leaderName,
                memberNames: team.memberNames
            }
        });

    } catch (error) {

        console.error("Team Login Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Team login failed."
        });
    }
});

 // ====================================
 // VERIFY PARTICIPANT LOGIN
 // GET /api/teams/me
 // ====================================

router.get("/me", async (req, res) => {

    try {

        // Get JWT token from request
        const authorization = req.headers.authorization;

        if (
            !authorization ||
            !authorization.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const token = authorization.slice(7);

        // Verify JWT token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (
            decoded.role !== "participant" ||
            !decoded.teamId
        ) {
            return res.status(403).json({
                success: false,
                message: "Access denied."
            });
        }

        // Get actual team from MongoDB
        const team = await Team.findById(decoded.id);

        if (
            !team ||
            !team.emailVerified ||
            team.teamId !== decoded.teamId
        ) {
            return res.status(401).json({
                success: false,
                message: "Team account not found."
            });
        }

        // Return verified team details
        res.json({
            success: true,
            message: "Participant authenticated successfully.",
            team: {
                teamId: team.teamId,
                teamName: team.teamName,
                leaderName: team.leaderName,
                leaderEmail: team.leaderEmail,
                memberNames: team.memberNames
            }
        });

    } catch (error) {

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Session expired or invalid. Please login again."
            });
        }

        console.error("Team Authentication Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Authentication check failed."
        });

    }

});

module.exports = router;
