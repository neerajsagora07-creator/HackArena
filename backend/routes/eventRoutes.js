
const express = require("express");
const router = express.Router();

const Event = require("../models/event");
const requireOrganizer = require("../middleware/requireOrganizer");

// GET EVENT INFORMATION
router.get("/", async (req, res) => {
    try {
        const event = await Event.findOne();

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "No event found"
            });
        }

        res.json({
            success: true,
            event: event
        });

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch event"
        });
    }
});

// SAVE EVENT INFORMATION
router.post("/", requireOrganizer, async (req, res) => {
    try {
        const {
            eventName,
            organization,
            logo,
            eventDate,
            eventEndDate,
            eventTime,
            eventVenue,
            eventDescription,
            maximumTeams,
            maximumMembers,
            defaultProblemCapacity,
            submissionDeadline
        } = req.body;

        if (
            typeof eventName !== "string" ||
            !eventName.trim() ||
            typeof organization !== "string" ||
            !organization.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Event name and organization are required"
            });
        }

        // Validate logo
        if (
            logo !== undefined &&
            (
                typeof logo !== "string" ||
                (
                    logo !== "" &&
                    !/^data:image\/(png|jpeg|webp);base64,/i.test(logo)
                ) ||
                logo.length > 1500000
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or oversized logo"
            });
        }

        const eventData = {
            eventName: eventName.trim(),
            organization: organization.trim()
        };

        const optionalFields = {
            logo,
            eventDate,
            eventEndDate,
            eventTime,
            eventVenue,
            eventDescription
        };

        for (const [key, value] of Object.entries(optionalFields)) {
            if (value !== undefined) {
                if (typeof value !== "string") {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid ${key}`
                    });
                }

                eventData[key] = value;
            }
        }

        // Validate capacities
        const capacities = {
            maximumTeams,
            maximumMembers,
            defaultProblemCapacity
        };

        for (const [key, value] of Object.entries(capacities)) {
            if (value !== undefined) {
                if (!Number.isSafeInteger(value) || value < 1) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid ${key}`
                    });
                }

                eventData[key] = value;
            }
        }

        // Validate submission deadline
        if (submissionDeadline !== undefined) {
            if (
                submissionDeadline === null ||
                submissionDeadline === ""
            ) {
                eventData.submissionDeadline = null;
            } else {
                const deadline = new Date(submissionDeadline);

                if (isNaN(deadline.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid submission deadline"
                    });
                }

                eventData.submissionDeadline = deadline;
            }
        }

        // Save active event
        const event = await Event.findOneAndUpdate(
            {},
            { $set: eventData },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        res.json({
            success: true,
            message: "Event saved successfully!",
            event: event
        });

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            success: false,
            message: "Failed to save event"
        });
    }
});

// SAVE DYNAMIC EVALUATION CRITERIA
router.put("/criteria", requireOrganizer, async (req, res) => {
    try {
        const { evaluationCriteria } = req.body;

        if (
            !Array.isArray(evaluationCriteria) ||
            evaluationCriteria.length === 0 ||
            evaluationCriteria.length > 30
        ) {
            return res.status(400).json({
                success: false,
                message: "Add between 1 and 30 evaluation criteria."
            });
        }

        const names = new Set();
        let total = 0;

        for (const criterion of evaluationCriteria) {
            if (
                !criterion ||
                typeof criterion.name !== "string" ||
                !criterion.name.trim() ||
                criterion.name.trim().length > 100 ||
                typeof criterion.maximum !== "number" ||
                !Number.isFinite(criterion.maximum) ||
                criterion.maximum <= 0 ||
                criterion.maximum > 10000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Each criterion needs a valid name and maximum marks."
                });
            }

            const normalizedName = criterion.name.trim().toLowerCase();

            if (names.has(normalizedName)) {
                return res.status(400).json({
                    success: false,
                    message: "Criterion names must be unique."
                });
            }

            names.add(normalizedName);
            total += criterion.maximum;
        }

        const event = await Event.findOneAndUpdate(
            {},
            {
                $set: {
                    evaluationCriteria: evaluationCriteria.map(item => ({
                        name: item.name.trim(),
                        maximum: item.maximum
                    }))
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Create and save Event Settings first."
            });
        }

        res.json({
            success: true,
            message: "Evaluation criteria saved successfully.",
            evaluationCriteria: event.evaluationCriteria,
            totalMarks: total
        });

    } catch (error) {
        console.error("Criteria Save Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to save evaluation criteria."
        });
    }
});

module.exports = router;
