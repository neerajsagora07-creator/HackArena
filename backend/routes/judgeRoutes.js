
const express = require("express");
const crypto = require("crypto");
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

module.exports = router;
