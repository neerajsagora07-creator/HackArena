
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const JudgeInvitation = require("../models/JudgeInvitation");
const User = require("../models/User");
const requireOrganizer = require("../middleware/requireOrganizer");

const router = express.Router();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// SEND JUDGE INVITATION
router.post("/invite", requireOrganizer, async (req, res) => {
    try {
        const { name, email } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            name.trim().length < 2 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid judge name and email are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        const existingInvitation = await JudgeInvitation.findOne({
            email: cleanEmail,
            status: "pending",
            expiresAt: { $gt: new Date() }
        });

        if (existingInvitation) {
            return res.status(409).json({
                success: false,
                message: "An active invitation already exists."
            });
        }

        const token = crypto.randomBytes(32).toString("hex");

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const invitation = await JudgeInvitation.create({
            name: name.trim(),
            email: cleanEmail,
            tokenHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            invitedBy: req.organizer._id
        });

        const invitationLink =
            `${process.env.FRONTEND_URL}/judge-accept.html?token=${token}`;

        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: cleanEmail,
                subject: "HackArena - Judge Invitation",
                html: `
                    <h2>Hello ${name.trim()},</h2>
                    <p>You have been invited to become a Judge at HackArena.</p>
                    <p>Click below to accept your invitation and create your password.</p>
                    <a href="${invitationLink}">Accept Invitation</a>
                    <p>This invitation expires in 24 hours.</p>
                `
            });
        } catch (mailError) {
            await JudgeInvitation.findByIdAndDelete(invitation._id);
            throw mailError;
        }

        res.status(201).json({
            success: true,
            message: "Judge invitation email sent successfully."
        });

    } catch (error) {
        console.error("Judge Invitation Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to send judge invitation."
        });
    }
});

// GET JUDGE INVITATIONS
router.get("/invitations", requireOrganizer, async (req, res) => {
    try {
        const invitations = await JudgeInvitation.find({
            invitedBy: req.organizer._id
        }).select("-tokenHash").sort({ createdAt: -1 });

        res.json({
            success: true,
            invitations
        });

    } catch (error) {
        console.error("Judge List Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load judge invitations."
        });
    }
});

// ACCEPT JUDGE INVITATION
router.post("/accept", async (req, res) => {
    try {
        const { token, password } = req.body;

        if (
            typeof token !== "string" ||
            typeof password !== "string" ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid invitation token and password of at least 8 characters are required."
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const invitation = await JudgeInvitation.findOne({
            tokenHash,
            status: "pending"
        });

        if (!invitation) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invitation link."
            });
        }

        if (invitation.expiresAt <= new Date()) {
            invitation.status = "expired";
            await invitation.save();

            return res.status(410).json({
                success: false,
                message: "This invitation has expired. Please contact the organizer."
            });
        }

        const existingUser = await User.findOne({
            email: invitation.email
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await User.create({
            name: invitation.name,
            email: invitation.email,
            passwordHash,
            role: "judge"
        });

        invitation.status = "accepted";
        await invitation.save();

        res.status(201).json({
            success: true,
            message: "Judge account created successfully. You can now log in."
        });

    } catch (error) {
        console.error("Judge Acceptance Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to accept judge invitation."
        });
    }
});

// DELETE JUDGE INVITATION
router.delete("/invitations/:id", requireOrganizer, async (req, res) => {
    try {
        const invitation = await JudgeInvitation.findOneAndDelete({
            _id: req.params.id,
            invitedBy: req.organizer._id
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Judge invitation not found."
            });
        }

        res.json({
            success: true,
            message: "Judge invitation deleted successfully."
        });

    } catch (error) {
        console.error("Judge Invitation Delete Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to delete judge invitation."
        });
    }
});

module.exports = router;
