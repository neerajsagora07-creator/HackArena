
const express = require("express");
const Problem = require("../models/Problem");

const router = express.Router();

// ====================================
// GET ALL PUBLISHED PROBLEMS
// ====================================

router.get("/", async (req, res) => {

    try {

        const problems = await Problem.find({
            isPublished: true
        }).sort({ code: 1 });

        const problemList = problems.map((problem) => {

            const occupied = problem.selectedTeams.length;

            return {
                id: problem._id,
                code: problem.code,
                title: problem.title,
                statement: problem.statement,
                capacity: problem.capacity,
                occupied: occupied,
                availableSlots: Math.max(
                    0,
                    problem.capacity - occupied
                ),
                status: occupied >= problem.capacity
                    ? "Full"
                    : "Available"
            };

        });

        res.json({
            success: true,
            problems: problemList
        });

    } catch (error) {

        console.error(
            "Problem Fetch Error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Failed to load problems."
        });

    }

});

 // ====================================
 // CREATE PROBLEM STATEMENT
 // POST /api/problems
 // Only Organizer can create problems
 // ====================================

router.post(
    "/",
    require("../middleware/requireOrganizer"),
    async (req, res) => {

        try {

            const { code, title, statement, capacity } = req.body || {};

            // Validate text fields
            if (
                typeof code !== "string" ||
                typeof title !== "string" ||
                typeof statement !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please fill all problem details."
                });
            }

            const problemCode = code.trim().toUpperCase();
            const problemTitle = title.trim();
            const problemStatement = statement.trim();

            // Validate Problem Code
            if (!/^[A-Z0-9_-]{2,20}$/.test(problemCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Problem Code must contain 2-20 letters, numbers, - or _."
                });
            }

            // Validate Title and Description
            if (
                problemTitle.length < 3 ||
                problemTitle.length > 150 ||
                problemStatement.length < 10 ||
                problemStatement.length > 10000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid Problem Title and Description."
                });
            }

            // Validate Team Capacity
            if (
                typeof capacity !== "number" ||
                !Number.isSafeInteger(capacity) ||
                capacity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Team Capacity must be a positive whole number."
                });
            }

            // Save Problem in MongoDB
            const problem = await Problem.create({
                code: problemCode,
                title: problemTitle,
                statement: problemStatement,
                capacity: capacity,
                selectedTeams: [],
                isPublished: true
            });

            res.status(201).json({
                success: true,
                message: "Problem Statement Created Successfully!",
                problem: {
                    id: problem._id,
                    code: problem.code,
                    title: problem.title,
                    statement: problem.statement,
                    capacity: problem.capacity,
                    occupied: 0,
                    status: "Available"
                }
            });

        } catch (error) {

            // Duplicate Problem Code
            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "This Problem Code already exists."
                });
            }

            console.error("Problem Create Error:", error.message);

            res.status(500).json({
                success: false,
                message: "Failed to create Problem Statement."
            });

        }

    }
);

 // ====================================
 // EDIT PROBLEM STATEMENT
 // PUT /api/problems/:id
 // ====================================

router.put(
    "/:id",
    require("../middleware/requireOrganizer"),
    async (req, res) => {

        try {

            const { code, title, statement, capacity } = req.body || {};

            if (
                typeof code !== "string" ||
                typeof title !== "string" ||
                typeof statement !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "All problem details are required."
                });
            }

            const problemCode = code.trim().toUpperCase();
            const problemTitle = title.trim();
            const problemStatement = statement.trim();

            if (!/^[A-Z0-9_-]{2,20}$/.test(problemCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem Code."
                });
            }

            if (
                problemTitle.length < 3 ||
                problemTitle.length > 150 ||
                problemStatement.length < 10 ||
                problemStatement.length > 10000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Enter valid Title and Description."
                });
            }

            if (!Number.isSafeInteger(capacity) || capacity < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Team Capacity."
                });
            }

            // Find existing problem
            const problem = await Problem.findById(req.params.id);

            if (!problem) {
                return res.status(404).json({
                    success: false,
                    message: "Problem Statement not found."
                });
            }

            // Capacity cannot be lower than selected teams
            const occupied = problem.selectedTeams.length;

            if (capacity < occupied) {
                return res.status(400).json({
                    success: false,
                    message: "Capacity cannot be less than occupied teams."
                });
            }

            // Update details
            problem.code = problemCode;
            problem.title = problemTitle;
            problem.statement = problemStatement;
            problem.capacity = capacity;

            await problem.save();

            res.json({
                success: true,
                message: "Problem Statement Updated Successfully!",
                problem: {
                    id: problem._id,
                    code: problem.code,
                    title: problem.title,
                    statement: problem.statement,
                    capacity: problem.capacity,
                    occupied: problem.selectedTeams.length
                }
            });

        } catch (error) {

            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "Problem Code already exists."
                });
            }

            if (error.name === "CastError") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
                });
            }

            console.error("Problem Update Error:", error.message);

            res.status(500).json({
                success: false,
                message: "Failed to update Problem Statement."
            });

        }

    }
);


module.exports = router;
