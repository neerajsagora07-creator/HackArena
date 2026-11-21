
const express = require("express");
const Problem = require("../models/Problem");
const requireOrganizer = require("../middleware/requireOrganizer");

const router = express.Router();

// ====================================
// GET ALL PUBLISHED PROBLEMS
// GET /api/problems
// Participants can see published problems only
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
        console.error("Problem Fetch Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to load problems."
        });
    }
});


// ====================================
// GET ALL PROBLEMS FOR ORGANIZER
// GET /api/problems/organizer/all
// Includes Draft and Published
// ====================================

router.get(
    "/organizer/all",
    requireOrganizer,
    async (req, res) => {
        try {
            const problems = await Problem.find()
                .sort({ createdAt: -1 });

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
                        : "Available",
                    isPublished: problem.isPublished
                };
            });

            res.json({
                success: true,
                problems: problemList
            });

        } catch (error) {
            console.error(
                "Organizer Problem Fetch Error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Failed to load organizer problems."
            });
        }
    }
);


// ====================================
// CREATE PROBLEM STATEMENT
// POST /api/problems
// Only Organizer
// ====================================

router.post(
    "/",
    requireOrganizer,
    async (req, res) => {
        try {
            const {
                code,
                title,
                statement,
                capacity,
                isPublished
            } = req.body || {};

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

            if (!/^[A-Z0-9_-]{2,20}$/.test(problemCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Problem Code must contain 2-20 letters, numbers, - or _."
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
                    message: "Enter a valid Problem Title and Description."
                });
            }

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

            if (
                isPublished !== undefined &&
                typeof isPublished !== "boolean"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid publish status."
                });
            }

            const problem = await Problem.create({
                code: problemCode,
                title: problemTitle,
                statement: problemStatement,
                capacity: capacity,
                selectedTeams: [],
                isPublished: isPublished !== undefined
                    ? isPublished
                    : true
            });

            res.status(201).json({
                success: true,
                message: problem.isPublished
                    ? "Problem Published Successfully!"
                    : "Problem Saved as Draft Successfully!",
                problem: {
                    id: problem._id,
                    code: problem.code,
                    title: problem.title,
                    statement: problem.statement,
                    capacity: problem.capacity,
                    occupied: 0,
                    status: "Available",
                    isPublished: problem.isPublished
                }
            });

        } catch (error) {
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
// PUBLISH / UNPUBLISH PROBLEM
// PATCH /api/problems/:id/publish
// Only Organizer
// ====================================

router.patch(
    "/:id/publish",
    requireOrganizer,
    async (req, res) => {
        try {
            const { isPublished } = req.body || {};

            if (typeof isPublished !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "Publish status must be true or false."
                });
            }

            const problem = await Problem.findById(req.params.id);

            if (!problem) {
                return res.status(404).json({
                    success: false,
                    message: "Problem Statement not found."
                });
            }

            problem.isPublished = isPublished;
            await problem.save();

            res.json({
                success: true,
                message: isPublished
                    ? "Problem Published Successfully!"
                    : "Problem Unpublished Successfully!",
                problem: {
                    id: problem._id,
                    code: problem.code,
                    title: problem.title,
                    isPublished: problem.isPublished
                }
            });

        } catch (error) {
            if (error.name === "CastError") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
                });
            }

            console.error("Problem Publish Error:", error.message);

            res.status(500).json({
                success: false,
                message: "Failed to update publish status."
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
    requireOrganizer,
    async (req, res) => {
        try {
            const {
                code,
                title,
                statement,
                capacity
            } = req.body || {};

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

            if (
                !Number.isSafeInteger(capacity) ||
                capacity < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Team Capacity."
                });
            }

            const problem = await Problem.findById(req.params.id);

            if (!problem) {
                return res.status(404).json({
                    success: false,
                    message: "Problem Statement not found."
                });
            }

            const occupied = problem.selectedTeams.length;

            if (capacity < occupied) {
                return res.status(400).json({
                    success: false,
                    message: "Capacity cannot be less than occupied teams."
                });
            }

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
                    occupied: problem.selectedTeams.length,
                    isPublished: problem.isPublished
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


// ====================================
// DELETE PROBLEM STATEMENT
// DELETE /api/problems/:id
// Only Organizer
// ====================================

router.delete(
    "/:id",
    requireOrganizer,
    async (req, res) => {
        try {
            const problem = await Problem.findById(req.params.id);

            if (!problem) {
                return res.status(404).json({
                    success: false,
                    message: "Problem Statement not found."
                });
            }

            if (problem.selectedTeams.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Cannot delete this Problem. Teams have already selected it."
                });
            }

            const deletedProblem = await Problem.findOneAndDelete({
                _id: req.params.id,
                "selectedTeams.0": { $exists: false }
            });

            if (!deletedProblem) {
                return res.status(409).json({
                    success: false,
                    message: "Problem could not be deleted. Refresh and try again."
                });
            }

            res.json({
                success: true,
                message: "Problem Statement Deleted Successfully!",
                deletedId: deletedProblem._id.toString()
            });

        } catch (error) {
            if (error.name === "CastError") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
                });
            }

            console.error("Problem Delete Error:", error.message);

            res.status(500).json({
                success: false,
                message: "Failed to delete Problem Statement."
            });
        }
    }
);

module.exports = router;
