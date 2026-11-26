const express = require("express");
const Event = require("../models/event");
const Submission = require("../models/submission");
const Announcement = require("../models/announcement");
const { sendAnnouncementEmails } = require("./announcementRoutes");
const requireOrganizer = require("../middleware/requireOrganizer");
const { generateLeaderboard } = require("./leaderboardRoutes");

const router = express.Router();

router.get("/", async (req, res) => {

    try {

        const event = await Event.findOne();

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not configured."
            });
        }

        res.json({
            success: true,
            resultsPublished: event.resultsPublished || false,
            resultsPublishedAt: event.resultsPublishedAt || null
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Unable to load results status."
        });

    }

});

router.post("/publish", requireOrganizer, async (req, res) => {

    try {

        const event = await Event.findOne();

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not configured."
            });
        }

        if (event.resultsPublished) {
            return res.status(400).json({
                success: false,
                message: "Results are already published."
            });
        }

        if (!event.submissionDeadline) {
            return res.status(400).json({
                success: false,
                message: "Configure submission deadline first."
            });
        }

        const baseDeadline =
            new Date(event.submissionDeadline).getTime();

        const extensions = event.teamExtraTime
            ? Array.from(event.teamExtraTime.values())
            : [];

        const latestDeadline = baseDeadline +
            Math.max(0, ...extensions) * 1000;

        if (Date.now() < latestDeadline) {
            return res.status(400).json({
                success: false,
                message: "Submission window is still open."
            });
        }

        const pendingEvaluations = await Submission.countDocuments({
            status: "submitted"
        });

        if (pendingEvaluations > 0) {
            return res.status(400).json({
                success: false,
                message: pendingEvaluations +
                    " project(s) are still pending evaluation."
            });
        }

        const evaluatedProjects = await Submission.countDocuments({
            status: "evaluated"
        });

        if (evaluatedProjects === 0) {
            return res.status(400).json({
                success: false,
                message: "No evaluated projects available."
            });
        }

    const finalLeaderboard = await generateLeaderboard();

if (finalLeaderboard.length === 0) {
    return res.status(400).json({
        success: false,
        message: "No valid leaderboard rankings available."
    });
}

const publishedEvent = await Event.findOneAndUpdate(
    {
        _id: event._id,
        resultsPublished: { $ne: true }
    },
    {
        $set: {
            resultsPublished: true,
            resultsPublishedAt: new Date(),
            finalLeaderboard: finalLeaderboard
        }
    },
    { new: true }
);

        if (!publishedEvent) {
            return res.status(400).json({
                success: false,
                message: "Results are already published."
            });
        }

        let announcementPublished = true;
let emailStatus = "Emails not sent.";

try {

    const announcement = await Announcement.create({
        title: "Official Hackathon Results Published",
        message: "The official HackArena results have been published. Visit the leaderboard to view the final rankings. Congratulations to all participating teams!",
        priority: "important",
        audience: "all"
    });

    try {

        const emailResult =
            await sendAnnouncementEmails(announcement);

        emailStatus =
            "Emails sent: " + emailResult.sent +
            " | Failed: " + emailResult.failed +
            " | Total recipients: " + emailResult.total;

    } catch (error) {

        emailStatus = "Unable to send results emails.";

        console.error("Results Email Error:", error);

    }

} catch (error) {

    announcementPublished = false;

    console.error("Results Announcement Error:", error);

}

        res.json({
            success: true,
            message: announcementPublished
                ? "Official results published successfully."
                : "Results published, but announcement could not be created.",
            resultsPublished: true,
            resultsPublishedAt: publishedEvent.resultsPublishedAt,
            evaluatedProjects,
            announcementPublished,
            emailStatus
        });

    } catch (error) {

        console.error("Results Publication Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to publish results."
        });

    }

});

module.exports = router;