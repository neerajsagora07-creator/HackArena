const express = require("express");
const Announcement = require("../models/announcement");
const nodemailer = require("nodemailer");
const Team = require("../models/Team");
const User = require("../models/User");

const requireOrganizer = require("../middleware/requireOrganizer");
const requireParticipant = require("../middleware/requireParticipant");
const requireJudge = require("../middleware/requireJudge");

const router = express.Router();

const announcementTransporter = nodemailer.createTransport({

    host: process.env.SMTP_HOST,

    port: Number(process.env.SMTP_PORT || 587),

    secure: Number(process.env.SMTP_PORT || 587) === 465,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }

});

async function sendAnnouncementEmails(announcement) {

    const recipients = new Set();

    if (
        announcement.audience === "all" ||
        announcement.audience === "participants"
    ) {

        const teams = await Team.find({
            emailVerified: true
        }).select("leaderEmail");

        teams.forEach(team => {
            if (team.leaderEmail) {
                recipients.add(team.leaderEmail);
            }
        });
    }

    if (
        announcement.audience === "all" ||
        announcement.audience === "judges"
    ) {

        const judges = await User.find({
            role: "judge"
        }).select("email");

        judges.forEach(judge => {
            if (judge.email) {
                recipients.add(judge.email);
            }
        });
    }

    let sent = 0;
    let failed = 0;

    for (const email of recipients) {

        try {

            await announcementTransporter.sendMail({

                from: process.env.SMTP_FROM ||
                      process.env.SMTP_USER,

                to: email,

                subject:
                    "[HackArena] " +
                    announcement.priority.toUpperCase() +
                    " - " + announcement.title,

                text:
                    "HACKARENA - OFFICIAL ANNOUNCEMENT\n\n" +
                    "Title: " + announcement.title + "\n\n" +
                    announcement.message + "\n\n" +
                    "Priority: " +
                    announcement.priority.toUpperCase() +
                    "\n\nRegards,\nHackArena Organizer\nTeam Nexora"

            });

            sent++;

        } catch (error) {

            failed++;

            console.error(
                "Announcement Email Error:",
                error.message
            );
        }
    }

    return {
        total: recipients.size,
        sent,
        failed
    };
}

router.post("/", requireOrganizer, async (req, res) => {

    try {

        const { title, message, priority, audience } = req.body;

        if (
            typeof title !== "string" ||
            typeof message !== "string" ||
            !title.trim() ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Title and message are required."
            });
        }

        const announcement = await Announcement.create({
            title,
            message,
            priority: priority || "normal",
            audience: audience || "all"
        });

        let emailStatus = "";

try {

    const emailResult =
        await sendAnnouncementEmails(announcement);

    emailStatus =
        "Emails sent: " + emailResult.sent +
        " | Failed: " + emailResult.failed +
        " | Total recipients: " + emailResult.total;

} catch (emailError) {

    console.error(
        "Announcement Email Error:",
        emailError.message
    );

    emailStatus =
        "Announcement published, but email delivery failed.";
}

res.status(201).json({
    success: true,
    message: "Announcement published successfully.",
    announcement,
    emailStatus
});

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Unable to publish announcement."
        });
    }
});

router.get("/", requireOrganizer, async (req, res) => {

    try {

        const announcements = await Announcement.find()
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            announcements
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Unable to load announcements."
        });
    }
});

router.get("/participant", requireParticipant, async (req, res) => {

    try {

        const announcements = await Announcement.find({
            audience: { $in: ["all", "participants"] }
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            announcements
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Unable to load announcements."
        });
    }
});

router.get("/judge", requireJudge, async (req, res) => {

    try {

        const announcements = await Announcement.find({
            audience: { $in: ["all", "judges"] }
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            announcements
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Unable to load announcements."
        });
    }
});

router.delete("/:id", requireOrganizer, async (req, res) => {

    try {

        const announcement = await Announcement.findByIdAndDelete(
            req.params.id
        );

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found."
            });
        }

        res.json({
            success: true,
            message: "Announcement deleted successfully."
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Unable to delete announcement."
        });
    }
});

router.sendAnnouncementEmails =
 sendAnnouncementEmails;
module.exports = router;