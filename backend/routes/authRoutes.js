
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

// ====================================
// PARTICIPANT REGISTRATION
// ====================================

router.post("/register", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        // Check input fields

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (
            cleanName.length < 2 ||
            cleanName.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
            cleanEmail.length > 254 ||
            password.length < 8 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid name, email and password (8 to 72 bytes)"
            });
        }

        // Check existing participant

        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Hash password securely

        const hashedPassword = await bcrypt.hash(
            password,
            12
        );

        // Save participant in MongoDB

        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            passwordHash: hashedPassword,
            role: "participant"
        });

        res.status(201).json({
            success: true,
            message: "Participant registered successfully!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        console.error("Registration Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });

    }

});

// ====================================
// PARTICIPANT LOGIN
// ====================================

router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user in MongoDB

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        }).select("+passwordHash");

        if (!user || user.role !== "participant") {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Verify hashed password

        const isMatch = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // JWT secret must be configured

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        // Generate login token

        const token = jwt.sign(
            {
                id: user._id.toString(),
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        res.json({
            success: true,
            message: "Login successful!",
            token: token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {

        console.error("Login Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });

    }

});

 // ====================================
 // ORGANIZER LOGIN API
 // POST /api/auth/organizer/login
 // ====================================

const organizerLoginLimit = require("express-rate-limit")({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Try again later."
    }
});

router.post("/organizer/login", organizerLoginLimit, async (req, res) => {

    try {

        const { email, password } = req.body;

        // Validate input
        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and Password are required."
            });
        }

        // Find Organizer in MongoDB
        const organizer = await User.findOne({
            email: email.trim().toLowerCase(),
            role: "organizer"
        }).select("+passwordHash");

        if (!organizer) {
            return res.status(401).json({
                success: false,
                message: "Invalid Email or Password."
            });
        }

        // Verify Password
        const passwordMatch = await bcrypt.compare(
            password,
            organizer.passwordHash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid Email or Password."
            });
        }

        // Generate JWT Token
        const token = jwt.sign(
            {
                id: organizer._id.toString(),
                role: "organizer"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        res.json({
            success: true,
            message: "Organizer Login Successful!",
            token,
            organizer: {
                id: organizer._id,
                name: organizer.name,
                email: organizer.email,
                role: organizer.role
            }
        });

    } catch (error) {

        console.error(
            "Organizer Login Error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Organizer Login Failed."
        });

    }

});


module.exports = router;

 // ====================================
 // VERIFY ORGANIZER LOGIN
 // GET /api/auth/organizer/me
 // ====================================

router.get(
    "/organizer/me",
    require("../middleware/requireOrganizer"),
    (req, res) => {

        res.json({
            success: true,
            message: "Organizer Authenticated Successfully!",
            organizer: {
                id: req.organizer._id,
                name: req.organizer.name,
                email: req.organizer.email,
                role: req.organizer.role
            }
        });

    }
);
