
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const Submission = require("../models/submission");
const Problem = require("../models/problem");
const Event = require("../models/event");

const requireParticipant = require("../middleware/requireParticipant");

const uploadFolder = path.join(__dirname, "../uploads/presentations");

fs.mkdirSync(uploadFolder, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" +
            Math.round(Math.random() * 1000000) +
            path.extname(file.originalname).toLowerCase();

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = [".pdf", ".ppt", ".pptx"];
        const extension = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            return cb(new Error("Only PDF, PPT and PPTX files are allowed."));
        }

        cb(null, true);
    }
});

function validUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === "http:" ||
            parsedUrl.protocol === "https:";
    } catch (error) {
        return false;
    }
}

function getTechnologies(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        return value.split(",").map(item => item.trim()).filter(Boolean);
    }

    return [];
}

function getPresentation(file) {
    if (!file) return null;

    return {
        originalName: file.originalname,
        fileName: file.filename,
        filePath: "/uploads/presentations/" + file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedAt: new Date()
    };
}

async function checkDeadline(res, teamId) {

    const event = await Event.findOne();

    if (event?.resultsPublished) {

    res.status(403).json({

        success: false,

        message: "Official results have been published. Submissions are permanently closed."

    });

    return false;

}

    if (!event || !event.submissionDeadline) {

        res.status(400).json({
            success: false,
            message: "Submission deadline has not been configured."
        });

        return false;
    }

    const extraSeconds = teamId
        ? Number(event.teamExtraTime?.get(String(teamId)) || 0)
        : 0;

    const effectiveDeadline =
        new Date(event.submissionDeadline).getTime()
        + extraSeconds * 1000;

    if (Date.now() >= effectiveDeadline) {

        res.status(403).json({
            success: false,
            message: "Submission deadline has passed."
        });

        return false;
    }

    return true;
}

async function getSelectedProblem(team) {
    if (!team.selectedProblem) return null;

    return await Problem.findOne({
        _id: team.selectedProblem,
        selectedTeams: team._id,
        isPublished: true
    });
}

function validateFinalDetails(body, file, existingPresentation) {
    const {
        projectTitle,
        description,
        githubUrl,
        liveDemoUrl
    } = body;

    if (!projectTitle || !description || !githubUrl) {
        return "Project title, description and GitHub URL are required.";
    }

    if (!validUrl(githubUrl)) {
        return "Please enter a valid GitHub URL.";
    }

    if (liveDemoUrl && !validUrl(liveDemoUrl)) {
        return "Please enter a valid Live Demo URL.";
    }

    if (!file && !existingPresentation?.fileName) {
        return "Please upload your project presentation.";
    }

    return null;
}

// SAVE DRAFT

router.post(
    "/draft",
    requireParticipant,
    upload.single("presentation"),
    async (req, res) => {
       try {
    const team = req.team;

    const allowed = await checkDeadline(res, team._id);
    if (!allowed) return;

    const problem = await getSelectedProblem(team);

            if (!problem) {
                return res.status(400).json({
                    success: false,
                    message: "Please select an available problem first."
                });
            }

            const existing = await Submission.findOne({
                team: team._id,
                problem: problem._id
            });

            if (existing && existing.status === "evaluated") {
                return res.status(403).json({
                    success: false,
                    message: "Evaluated submissions cannot be changed."
                });
            }

            const presentation = getPresentation(req.file);

            const data = {
                projectTitle: req.body.projectTitle || "",
                description: req.body.description || "",
                githubUrl: req.body.githubUrl || "",
                liveDemoUrl: req.body.liveDemoUrl || "",
                technologies: getTechnologies(req.body.technologies),
                status: "draft"
            };

            if (presentation) {
                data.presentation = presentation;
            }

            const submission = await Submission.findOneAndUpdate(
                {
                    team: team._id,
                    problem: problem._id
                },
                {
                    $set: data,
                    $setOnInsert: {
                        team: team._id,
                        problem: problem._id
                    }
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            res.json({
                success: true,
                message: "Draft saved successfully.",
                submission: submission
            });

        } catch (error) {
            console.error("Save Draft Error:", error);
            res.status(500).json({
                success: false,
                message: "Unable to save draft."
            });
        }
    }
);

// FINAL SUBMISSION

router.post(
    "/",
    requireParticipant,
    upload.single("presentation"),
    async (req, res) => {
        try {
            const team = req.team;

           const allowed = await checkDeadline(res, team._id);
            if (!allowed) return;

            const problem = await getSelectedProblem(team);

            if (!problem) {
                return res.status(400).json({
                    success: false,
                    message: "Your selected problem is not available."
                });
            }

            const existing = await Submission.findOne({
                team: team._id,
                problem: problem._id
            });

            if (existing && existing.status === "evaluated") {
                return res.status(403).json({
                    success: false,
                    message: "Evaluated submissions cannot be changed."
                });
            }

            const validationError = validateFinalDetails(
                req.body,
                req.file,
                existing ? existing.presentation : null
            );

            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const data = {
                projectTitle: req.body.projectTitle.trim(),
                description: req.body.description.trim(),
                githubUrl: req.body.githubUrl.trim(),
                liveDemoUrl: (req.body.liveDemoUrl || "").trim(),
                technologies: getTechnologies(req.body.technologies),
                status: "submitted",
                submittedAt: new Date()
            };

            const presentation = getPresentation(req.file);

            if (presentation) {
                data.presentation = presentation;
            }

            const submission = await Submission.findOneAndUpdate(
                {
                    team: team._id,
                    problem: problem._id
                },
                {
                    $set: data,
                    $setOnInsert: {
                        team: team._id,
                        problem: problem._id
                    }
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            res.json({
                success: true,
                message: "Project submitted successfully.",
                submission: submission
            });

        } catch (error) {
            console.error("Final Submission Error:", error);
            res.status(500).json({
                success: false,
                message: "Unable to submit project."
            });
        }
    }
);



// GET TEAM SUBMISSION

router.get("/my-submission", requireParticipant, async (req, res) => {
    try {
        const submissions = await Submission.find({
            team: req.team._id
        }).populate("problem", "code title");

        const event = await Event.findOne();

        const submissionDeadline =
            event?.submissionDeadline || null;

        const extraSeconds = Number(
            event?.teamExtraTime?.get(String(req.team._id)) || 0
        );

        const effectiveDeadline = submissionDeadline
            ? new Date(
                new Date(submissionDeadline).getTime() +
                extraSeconds * 1000
            )
            : null;

       const submissionOpen =
    !event?.resultsPublished &&
    effectiveDeadline !== null &&
    Date.now() < effectiveDeadline.getTime();

        res.json({
            success: true,
            count: submissions.length,
            submissions: submissions,
            submissionDeadline: submissionDeadline,
            extraSeconds: extraSeconds,
            effectiveDeadline: effectiveDeadline,
            submissionOpen: submissionOpen,
            serverTime: Date.now()
        });

    } catch (error) {
        console.error("Get Submission Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetch submissions."
        });
    }
});

// UPDATE EXISTING SUBMISSION

router.put(
    "/:id",
    requireParticipant,
    upload.single("presentation"),
    async (req, res) => {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid submission ID."
                });
            }

          const allowed = await checkDeadline(res, req.team._id);
            if (!allowed) return;

            const submission = await Submission.findOne({
                _id: req.params.id,
                team: req.team._id
            });

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: "Submission not found."
                });
            }

            if (submission.status === "evaluated") {
                return res.status(403).json({
                    success: false,
                    message: "Evaluated submissions cannot be changed."
                });
            }

            const problem = await getSelectedProblem(req.team);

            if (!problem || !submission.problem.equals(problem._id)) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot update this problem submission."
                });
            }

            const validationError = validateFinalDetails(
                req.body,
                req.file,
                submission.presentation
            );

            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            submission.projectTitle = req.body.projectTitle.trim();
            submission.description = req.body.description.trim();
            submission.githubUrl = req.body.githubUrl.trim();
            submission.liveDemoUrl = (req.body.liveDemoUrl || "").trim();
            submission.technologies = getTechnologies(req.body.technologies);
            submission.status = "submitted";
            submission.submittedAt = new Date();

            const presentation = getPresentation(req.file);

            if (presentation) {
                submission.presentation = presentation;
            }

            await submission.save();

            res.json({
                success: true,
                message: "Project updated successfully.",
                submission: submission
            });

        } catch (error) {
            console.error("Update Submission Error:", error);
            res.status(500).json({
                success: false,
                message: "Unable to update submission."
            });
        }
    }
);

router.get("/presentation/:filename", requireParticipant, async (req, res) => {
    try {
        const filename = req.params.filename;

        if (path.basename(filename) !== filename) {
            return res.status(400).json({
                success: false,
                message: "Invalid file name."
            });
        }

        const submission = await Submission.findOne({
            team: req.team._id,
            "presentation.fileName": filename
        });

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: "Presentation not found."
            });
        }

        res.sendFile(path.join(uploadFolder, filename));

    } catch (error) {
        console.error("Presentation Access Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to access presentation."
        });
    }
});

// MULTER ERROR HANDLER

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Presentation file must be 10 MB or smaller."
                : error.message
        });
    }

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    next();
});

module.exports = router;

