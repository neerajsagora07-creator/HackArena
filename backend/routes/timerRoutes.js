const express = require("express");
const Event = require("../models/event");
const Team = require("../models/Team");
const requireOrganizer = require("../middleware/requireOrganizer");

const router = express.Router();

function getTimer(event) {
    let status = event.timerStatus || "idle";
    let remaining = event.timerRemaining || 0;

    if (status === "running") {
        remaining = Math.max(
            0,
            Math.ceil(
                (new Date(event.timerEndAt).getTime() - Date.now()) / 1000
            )
        );

        if (remaining === 0) {
            status = "finished";
        }
    }

    return {
        status: status,
        duration: event.timerDuration || 0,
        remaining: remaining,
        endAt: event.timerEndAt,
        serverTime: Date.now(),
        submissionDeadline: event.submissionDeadline
    };
}

// GET LIVE TIMER

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
            timer: getTimer(event)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load timer."
        });
    }
});

// ORGANIZER TIMER CONTROLS

router.post("/", requireOrganizer, async (req, res) => {
    try {
        const event = await Event.findOne();

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Configure the event first."
            });
        }

        const { action, hours = 0, minutes = 0 } = req.body;

        const h = Number(hours);
        const m = Number(minutes);

        const duration = h * 3600 + m * 60;

        const timer = getTimer(event);

        if (action === "start" || action === "extend") {
            if (
                !Number.isInteger(h) ||
                !Number.isInteger(m) ||
                h < 0 ||
                m < 0 ||
                m > 59 ||
                duration <= 0 ||
                duration > 2592000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid duration."
                });
            }
        }

        switch (action) {

            case "start":

                if (timer.status !== "idle") {
                    return res.status(400).json({
                        success: false,
                        message: "Reset the timer before starting again."
                    });
                }

                event.timerStatus = "running";
                event.timerDuration = duration;
                event.timerRemaining = duration;

                event.timerEndAt = new Date(
                    Date.now() + duration * 1000
                );

                break;

            case "pause":

                if (timer.status !== "running") {
                    return res.status(400).json({
                        success: false,
                        message: "Timer is not running."
                    });
                }

                event.timerStatus = "paused";
                event.timerRemaining = timer.remaining;
                event.timerEndAt = null;

                break;

            case "resume":

                if (timer.status !== "paused") {
                    return res.status(400).json({
                        success: false,
                        message: "Timer is not paused."
                    });
                }

                event.timerStatus = "running";

                event.timerEndAt = new Date(
                    Date.now() + timer.remaining * 1000
                );

                break;

            case "stop":

                event.timerStatus = "finished";
                event.timerRemaining = 0;
                event.timerEndAt = null;

                break;

            case "reset":

                event.timerStatus = "idle";
                event.timerDuration = 0;
                event.timerRemaining = 0;
                event.timerEndAt = null;

                break;

            case "extend":

                if (
                    timer.status !== "running" &&
                    timer.status !== "paused"
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Start the timer first."
                    });
                }

                event.timerDuration += duration;

                event.timerRemaining =
                    timer.remaining + duration;

                if (timer.status === "running") {
                    event.timerEndAt = new Date(
                        Date.now() +
                        event.timerRemaining * 1000
                    );
                }

                break;

            default:

                return res.status(400).json({
                    success: false,
                    message: "Invalid timer action."
                });
        }

        await event.save();

        res.json({
            success: true,
            message: "Timer updated successfully.",
            timer: getTimer(event)
        });

    } catch (error) {
        console.error("Timer Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update timer."
        });
    }
});

// SUBMISSION DEADLINE EXTENSION

router.post("/extra-time", requireOrganizer, async (req, res) => {
    try {
        const {
            scope,
            teamId,
            hours = 0,
            minutes = 0
        } = req.body;

        const h = Number(hours);
        const m = Number(minutes);

        const extraSeconds = h * 3600 + m * 60;

        if (
            !Number.isInteger(h) ||
            !Number.isInteger(m) ||
            h < 0 ||
            m < 0 ||
            m > 59 ||
            extraSeconds <= 0 ||
            extraSeconds > 2592000
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter valid extra time."
            });
        }

        const event = await Event.findOne();
        if (event?.resultsPublished) {

    return res.status(403).json({

        success: false,

        message: "Official results have been published. Submission deadline extensions are locked."

    });

}

        if (!event || !event.submissionDeadline) {
            return res.status(400).json({
                success: false,
                message: "Configure submission deadline first."
            });
        }

        const baseDeadline = new Date(
            event.submissionDeadline
        ).getTime();

        if (scope === "event") {

            event.submissionDeadline = new Date(
                Math.max(baseDeadline, Date.now()) +
                extraSeconds * 1000
            );

        } else if (scope === "team") {

            const team = await Team.findOne({
                teamId: String(teamId || "").trim().toUpperCase(),
                emailVerified: true
            });

            if (!team) {
                return res.status(404).json({
                    success: false,
                    message: "Registered team not found."
                });
            }

            const key = String(team._id);

            if (!event.teamExtraTime) {
                event.teamExtraTime = new Map();
            }

            const previousExtra = Number(
                event.teamExtraTime.get(key) || 0
            );

            const currentDeadline =
                baseDeadline + previousExtra * 1000;

            const newDeadline =
                Math.max(currentDeadline, Date.now()) +
                extraSeconds * 1000;

            event.teamExtraTime.set(
                key,
                Math.ceil(
                    (newDeadline - baseDeadline) / 1000
                )
            );

        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid extension scope."
            });
        }

        await event.save();

        res.json({
            success: true,
            message: "Extra submission time granted successfully."
        });

    } catch (error) {
        console.error("Extra Time Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to grant extra time."
        });
    }
});
module.exports = router;