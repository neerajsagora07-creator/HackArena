
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const Problem = require("../models/Problem");
const Team = require("../models/Team");

const requireOrganizer = require("../middleware/requireOrganizer");
const requireParticipant = require("../middleware/requireParticipant");

const router = express.Router();

// ====================================
// PDF UPLOAD CONFIGURATION
// ====================================

const pdfUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {

        if (
            file.mimetype !== "application/pdf" &&
            !file.originalname.toLowerCase().endsWith(".pdf")
        ) {
            return cb(new Error("Only PDF files are allowed."));
        }

        cb(null, true);
    }
});


// ====================================
// PARTICIPANT CANCELS SELECTED PROBLEM
// POST /api/problems/:id/cancel
// Only Participant
// ====================================

router.post(
    "/:id/cancel",
    requireParticipant,
    async (req, res) => {

        const team = req.team;
        const problemId = req.params.id;
        let problemReleased = false;

        try {

            if (!mongoose.isValidObjectId(problemId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
                });
            }

            if (
                !team.selectedProblem ||
                team.selectedProblem.toString() !== problemId
            ) {
                return res.status(409).json({
                    success: false,
                    message: "Your team has not selected this problem."
                });
            }

            const problem = await Problem.findById(problemId);

            if (problem) {

                const releaseResult = await Problem.updateOne(
                    {
                        _id: problemId,
                        selectedTeams: team._id
                    },
                    {
                        $pull: {
                            selectedTeams: team._id
                        }
                    }
                );

                problemReleased = releaseResult.modifiedCount > 0;
            }

            const updatedTeam = await Team.findOneAndUpdate(
                {
                    _id: team._id,
                    selectedProblem: problemId
                },
                {
                    $set: {
                        selectedProblem: null
                    }
                },
                {
                    new: true
                }
            );

            if (!updatedTeam) {

                const latestTeam = await Team.findById(
                    team._id
                ).select("selectedProblem");

                if (
                    problemReleased &&
                    latestTeam &&
                    latestTeam.selectedProblem &&
                    latestTeam.selectedProblem.toString() === problemId
                ) {
                    await Problem.updateOne(
                        { _id: problemId },
                        {
                            $addToSet: {
                                selectedTeams: team._id
                            }
                        }
                    );
                }

                return res.status(409).json({
                    success: false,
                    message: "Selection has already changed. Please refresh."
                });
            }

            const updatedProblem = await Problem.findById(
                problemId
            ).select("code title capacity selectedTeams");

            res.json({
                success: true,
                message: "Problem selection cancelled successfully!",
                selectedProblem: null,
                problem: updatedProblem
                    ? {
                        id: updatedProblem._id,
                        code: updatedProblem.code,
                        title: updatedProblem.title,
                        capacity: updatedProblem.capacity,
                        occupied: updatedProblem.selectedTeams.length,
                        availableSlots: Math.max(
                            0,
                            updatedProblem.capacity -
                            updatedProblem.selectedTeams.length
                        )
                    }
                    : null
            });

        } catch (error) {

            if (problemReleased) {

                try {

                    const latestTeam = await Team.findById(
                        team._id
                    ).select("selectedProblem");

                    if (
                        latestTeam &&
                        latestTeam.selectedProblem &&
                        latestTeam.selectedProblem.toString() === problemId
                    ) {
                        await Problem.updateOne(
                            { _id: problemId },
                            {
                                $addToSet: {
                                    selectedTeams: team._id
                                }
                            }
                        );
                    }

                } catch (rollbackError) {

                    console.error(
                        "Problem Cancellation Rollback Error:",
                        rollbackError.message
                    );
                }
            }

            console.error(
                "Problem Cancellation Error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Could not cancel problem selection. Please try again."
            });
        }
    }
);


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
                    availableSlots: capacity,
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
// PARTICIPANT SELECTS A PROBLEM
// POST /api/problems/:id/select
// Only Participant
// ====================================

router.post(
    "/:id/select",
    requireParticipant,
    async (req, res) => {

        let teamClaimed = false;
        let problemUpdated = false;
        let selectedProblemId = null;

        try {

            const problemId = req.params.id;
            const team = req.team;

            if (!mongoose.isValidObjectId(problemId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
                });
            }

            if (team.selectedProblem) {
                return res.status(409).json({
                    success: false,
                    message: "Your team has already selected a problem."
                });
            }

            const problem = await Problem.findOne({
                _id: problemId,
                isPublished: true
            });

            if (!problem) {
                return res.status(404).json({
                    success: false,
                    message: "This problem is not available."
                });
            }

            selectedProblemId = problem._id;

            const claimedTeam = await Team.findOneAndUpdate(
                {
                    _id: team._id,
                    emailVerified: true,
                    $or: [
                        { selectedProblem: null },
                        { selectedProblem: { $exists: false } }
                    ]
                },
                {
                    $set: {
                        selectedProblem: problem._id
                    }
                },
                {
                    new: true
                }
            );

            if (!claimedTeam) {
                return res.status(409).json({
                    success: false,
                    message: "Your team has already selected a problem."
                });
            }

            teamClaimed = true;

            const updatedProblem = await Problem.findOneAndUpdate(
                {
                    _id: problem._id,
                    isPublished: true,
                    $expr: {
                        $lt: [
                            {
                                $size: {
                                    $ifNull: ["$selectedTeams", []]
                                }
                            },
                            "$capacity"
                        ]
                    }
                },
                {
                    $addToSet: {
                        selectedTeams: team._id
                    }
                },
                {
                    new: true
                }
            );

            if (!updatedProblem) {

                await Team.updateOne(
                    {
                        _id: team._id,
                        selectedProblem: problem._id
                    },
                    {
                        $set: {
                            selectedProblem: null
                        }
                    }
                );

                teamClaimed = false;

                const latestProblem = await Problem.findById(problemId);

                if (!latestProblem || !latestProblem.isPublished) {
                    return res.status(404).json({
                        success: false,
                        message: "This problem is no longer published."
                    });
                }

                return res.status(409).json({
                    success: false,
                    message: "This problem is full. Please select another problem."
                });
            }

            problemUpdated = true;

            res.json({
                success: true,
                message: "Problem selected successfully!",
                problem: {
                    id: updatedProblem._id,
                    code: updatedProblem.code,
                    title: updatedProblem.title,
                    statement: updatedProblem.statement,
                    capacity: updatedProblem.capacity,
                    occupied: updatedProblem.selectedTeams.length,
                    availableSlots: Math.max(
                        0,
                        updatedProblem.capacity -
                        updatedProblem.selectedTeams.length
                    )
                }
            });

        } catch (error) {

            if (teamClaimed && selectedProblemId) {

                try {

                    if (problemUpdated) {
                        await Problem.updateOne(
                            {
                                _id: selectedProblemId
                            },
                            {
                                $pull: {
                                    selectedTeams: req.team._id
                                }
                            }
                        );
                    }

                    await Team.updateOne(
                        {
                            _id: req.team._id,
                            selectedProblem: selectedProblemId
                        },
                        {
                            $set: {
                                selectedProblem: null
                            }
                        }
                    );

                } catch (rollbackError) {

                    console.error(
                        "Problem Selection Rollback Error:",
                        rollbackError.message
                    );
                }
            }

            console.error(
                "Problem Selection Error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Could not select this problem. Please try again."
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

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
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

            console.error(
                "Problem Publish Error:",
                error.message
            );

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
// Only Organizer
// ====================================

router.put(
    "/:id",
    requireOrganizer,
    async (req, res) => {

        try {

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
                });
            }

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
                    availableSlots: Math.max(
                        0,
                        problem.capacity - problem.selectedTeams.length
                    ),
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

            console.error(
                "Problem Update Error:",
                error.message
            );

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

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Problem ID."
                });
            }

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

            console.error(
                "Problem Delete Error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Failed to delete Problem Statement."
            });
        }
    }
);


// ====================================
// PDF PROBLEM STATEMENT UPLOAD
// POST /api/problems/import/pdf/preview
// Only Organizer
// ====================================


router.post(
    "/import/pdf/preview",
    requireOrganizer,
    (req, res, next) => {

        pdfUpload.single("pdfFile")(req, res, (error) => {

            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message || "PDF upload failed."
                });
            }

            next();
        });

    },
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a PDF file."
                });
            }

            const problems = [];

            const pdfData = await pdfParse(req.file.buffer, {
                pagerender: async (pageData) => {

                    const content = await pageData.getTextContent();
                    const lines = [];

                    content.items.forEach((item) => {

                        const value = item.str.trim();

                        if (!value || !item.transform) {
                            return;
                        }

                        const x = item.transform[4];
                        const y = item.transform[5];

                        let line = lines.find(
                            (entry) => Math.abs(entry.y - y) < 2
                        );

                        if (!line) {
                            line = {
                                y,
                                columns: {
                                    serial: [],
                                    organization: [],
                                    title: [],
                                    category: [],
                                    ps: [],
                                    ideas: [],
                                    theme: []
                                }
                            };

                            lines.push(line);
                        }

                        let column = null;

                        if (x >= 60 && x < 140) {
                            column = "serial";
                        } else if (x >= 140 && x < 245) {
                            column = "organization";
                        } else if (x >= 245 && x < 505) {
                            column = "title";
                        } else if (x >= 505 && x < 575) {
                            column = "category";
                        } else if (x >= 575 && x < 635) {
                            column = "ps";
                        } else if (x >= 635 && x < 705) {
                            column = "ideas";
                        } else if (x >= 705 && x < 820) {
                            column = "theme";
                        }

                        if (column) {
                            line.columns[column].push({
                                x,
                                text: value
                            });
                        }

                    });

                    lines.sort((a, b) => b.y - a.y);

                    let currentRow = null;

                    function saveRow() {

                        if (!currentRow) {
                            return;
                        }

                        const getColumn = (name) => {

                            return currentRow.lines
                                .map((line) => {

                                    return line.columns[name]
                                        .sort((a, b) => a.x - b.x)
                                        .map((item) => item.text)
                                        .join(" ");

                                })
                                .join(" ")
                                .replace(/\s+/g, " ")
                                .trim();
                        };

                        const serialNumber = Number(
                            getColumn("serial")
                        );

                        const organization = getColumn("organization");
                        const title = getColumn("title");
                        const categoryText = getColumn("category");
                        const psText = getColumn("ps");
                        const ideasText = getColumn("ideas");
                        const theme = getColumn("theme");

                        const codeMatch = psText.match(
                            /\bSIH\d{5}\b/i
                        );

                        if (!codeMatch || !title) {
                            return;
                        }

                        const categoryMatch = categoryText.match(
                            /\b(Software|Hardware)\b/i
                        );

                        problems.push({
                            serialNumber,
                            code: codeMatch[0].toUpperCase(),
                            organization,
                            title,
                            category: categoryMatch
                                ? categoryMatch[0]
                                : categoryText,
                            submittedIdeasCount: Number(
                                ideasText.match(/\d+/)?.[0] || 0
                            ),
                            theme,
                            statement: ""
                        });
                    }

                    lines.forEach((line) => {

                        const serialText = line.columns.serial
                            .map((item) => item.text)
                            .join(" ")
                            .trim();

                        const psText = line.columns.ps
                            .map((item) => item.text)
                            .join(" ");

                        const isNewRow =
                            /^\d{1,3}$/.test(serialText) &&
                            /\bSIH\d{5}\b/i.test(psText);

                        if (isNewRow) {

                            saveRow();

                            currentRow = {
                                lines: []
                            };
                        }

                        if (currentRow) {
                            currentRow.lines.push(line);
                        }

                    });

                    saveRow();

                    return "";
                }
            });

            if (problems.length === 0) {
                return res.status(422).json({
                    success: false,
                    message: "No problem statement rows could be identified in this PDF."
                });
            }

            res.json({
                success: true,
                message: "Problem statements extracted successfully.",
                fileName: req.file.originalname,
                totalPages: pdfData.numpages,
                totalProblems: problems.length,
                problems
            });

        } catch (error) {

            console.error("PDF Extraction Error:", error);

            res.status(500).json({
                success: false,
                message: "Failed to extract problem statements."
            });

        }

    }
);


// ====================================
// CONFIRM PDF PROBLEM IMPORT
// POST /api/problems/import/pdf/confirm
// Only Organizer
// ====================================

router.post(
    "/import/pdf/confirm",
    requireOrganizer,
    async (req, res) => {

        try {

            const { problems } = req.body || {};

            if (
                !Array.isArray(problems) ||
                problems.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "No problems received for import."
                });
            }

            if (problems.length > 500) {
                return res.status(400).json({
                    success: false,
                    message: "Maximum 500 problems can be imported at once."
                });
            }

            const uniqueProblems = [];
            const seenCodes = new Set();

            for (let i = 0; i < problems.length; i++) {

                const item = problems[i];

                if (
                    !item ||
                    typeof item.code !== "string" ||
                    typeof item.title !== "string"
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid problem data at row " + (i + 1)
                    });
                }

                const code = item.code.trim().toUpperCase();
                const title = item.title.trim();

                if (
                    !/^[A-Z0-9_-]{2,20}$/.test(code) ||
                    title.length < 3
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid problem code or title at row " + (i + 1)
                    });
                }

                if (seenCodes.has(code)) {
                    continue;
                }

                seenCodes.add(code);

                const serialNumber = Number(item.serialNumber);
                const ideasCount = Number(item.submittedIdeasCount);

                uniqueProblems.push({
                    code,
                    title,
                    statement: typeof item.statement === "string"
                        ? item.statement.trim()
                        : "",
                    serialNumber: Number.isSafeInteger(serialNumber)
                        ? serialNumber
                        : null,
                    organization: typeof item.organization === "string"
                        ? item.organization.trim()
                        : "",
                    category: typeof item.category === "string"
                        ? item.category.trim()
                        : "",
                    theme: typeof item.theme === "string"
                        ? item.theme.trim()
                        : "",
                    submittedIdeasCount: Number.isSafeInteger(ideasCount) &&
                        ideasCount >= 0
                        ? ideasCount
                        : 0
                });
            }

            const operations = uniqueProblems.map((item) => ({
                updateOne: {
                    filter: {
                        code: item.code
                    },
                    update: {
                        $setOnInsert: {
                            ...item,
                            source: "pdf",
                            capacity: 3,
                            selectedTeams: [],
                            isPublished: true
                        }
                    },
                    upsert: true
                }
            }));

            const result = await Problem.bulkWrite(
                operations,
                { ordered: false }
            );

            const importedCount = result.upsertedCount || 0;
            const skippedCount = problems.length - importedCount;

            res.status(201).json({
                success: true,
                message: importedCount +
                    " problems imported successfully.",
                totalReceived: problems.length,
                importedCount,
                skippedCount
            });

        } catch (error) {

            console.error(
                "PDF Problem Import Error:",
                error.message
            );

            res.status(500).json({
                success: false,
                message: "Failed to import PDF problems."
            });
        }
    }
);

// ====================================
// CONFIRM PDF PROBLEM IMPORT
// POST /api/problems/import/pdf/confirm
// Only Organizer
// ====================================

router.post(
    "/import/pdf/confirm",
    requireOrganizer,
    async (req, res) => {

        try {

            const { problems } = req.body || {};

            if (!Array.isArray(problems) || problems.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No problems received for import."
                });
            }

            const importedProblems = [];
            let skippedCount = 0;

            for (const item of problems) {

                const code = typeof item.code === "string"
                    ? item.code.trim().toUpperCase()
                    : "";

                const title = typeof item.title === "string"
                    ? item.title.trim()
                    : "";

                if (
                    !/^SIH\d{5}$/.test(code) ||
                    title.length < 3
                ) {
                    skippedCount++;
                    continue;
                }

                const existingProblem = await Problem.findOne({
                    code: code
                });

                if (existingProblem) {
                    skippedCount++;
                    continue;
                }

                const serial = Number(item.serialNumber);
                const ideas = Number(item.submittedIdeasCount);

                const problem = await Problem.create({

                    code: code,
                    title: title,

                    statement: typeof item.statement === "string"
                        ? item.statement.trim()
                        : "",

                    serialNumber:
                        Number.isSafeInteger(serial) && serial > 0
                            ? serial
                            : null,

                    organization: item.organization || "",
                    category: item.category || "",
                    theme: item.theme || "",

                    submittedIdeasCount:
                        Number.isSafeInteger(ideas) && ideas >= 0
                            ? ideas
                            : 0,

                    source: "pdf",
                    capacity: 3,
                    selectedTeams: [],
                    isPublished: true

                });

                importedProblems.push(problem);

            }

            res.status(201).json({

                success: true,

                message: "PDF problems imported successfully.",

                importedCount: importedProblems.length,

                skippedCount: skippedCount

            });

        } catch (error) {

            console.error("PDF Import Error:", error);

            res.status(500).json({

                success: false,

                message: "Failed to import PDF problems."

            });

        }

    }
);

module.exports = router;
