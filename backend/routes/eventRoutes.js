
const express = require("express");
const router = express.Router();

// Import Event Model
const Event = require("../models/event");

// =====================================
// GET EVENT INFORMATION
// =====================================

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

// =====================================
// SAVE EVENT INFORMATION
// =====================================

// Local development only.
// Organizer authentication will be added later.

router.post("/", async (req, res) => {
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
            defaultProblemCapacity
        } = req.body;

        // Validate required fields
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

        // Validate logo if provided
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

        // Prepare event information
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

        // Save one active event for the initial demo
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

module.exports = router;
