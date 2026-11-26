
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const Submission = require("../models/submission");
const Team = require("../models/team");
const Problem = require("../models/problem");
const Event = require("../models/event");

const requireParticipant = require("../middleware/requireParticipant");
const requireOrganizer = require("../middleware/requireOrganizer");
const getGridFSBucket = require("../utils/gridfs");

const uploadFolder = path.join(__dirname, "../uploads/presentations");

fs.mkdirSync(uploadFolder, { recursive: true });

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
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


// SUBMISSION LOCK

const activeSubmissions = new Set();

function preventConcurrentSubmission(req, res, next) {
    const teamId = String(req.team._id);

    if (activeSubmissions.has(teamId)) {
        return res.status(409).json({
            success: false,
            message: "A submission is already being processed. Please wait."
        });
    }

    activeSubmissions.add(teamId);

    req.releaseSubmissionLock = () => {
        activeSubmissions.delete(teamId);
    };

    next();
}


// VALIDATE URL

function validUrl(url) {
    try {
        const parsedUrl = new URL(url);

        return parsedUrl.protocol === "http:" ||
            parsedUrl.protocol === "https:";

    } catch (error) {
        return false;
    }
}


// GET TECHNOLOGIES

function getTechnologies(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        return value.split(",").map(item => item.trim()).filter(Boolean);
    }

    return [];
}


// UPLOAD PRESENTATION TO GRIDFS

async function getPresentation(file) {
    if (!file) return null;

    const bucket = getGridFSBucket();

    const uniqueName =
        new mongoose.Types.ObjectId().toString() +
        path.extname(file.originalname).toLowerCase();

    return new Promise((resolve, reject) => {

        const uploadStream = bucket.openUploadStream(uniqueName, {
            metadata: {
                originalName: file.originalname,
                mimeType: file.mimetype
            }
        });

        uploadStream.once("error", async (error) => {
            try {
                await bucket.delete(uploadStream.id);

            } catch (cleanupError) {
                console.error(
                    "Partial Upload Cleanup Error:",
                    cleanupError
                );
            }

            reject(error);
        });

        uploadStream.once("finish", () => {
            resolve({
                gridFsId: uploadStream.id,
                originalName: file.originalname,
                fileName: uniqueName,
                filePath: "/uploads/presentations/" + uniqueName,
                mimeType: file.mimetype,
                fileSize: file.size,
                uploadedAt: new Date()
            });
        });

        uploadStream.end(file.buffer);
    });
}


// DELETE PRESENTATION

async function deletePresentation(presentation) {
    if (!presentation) return;

    try {
        if (presentation.gridFsId) {
            const bucket = getGridFSBucket();

            await bucket.delete(presentation.gridFsId);

        } else if (presentation.fileName) {

            const filename = presentation.fileName;

            if (path.basename(filename) !== filename) {
                return;
            }

            const filePath = path.join(uploadFolder, filename);

            try {
                await fs.promises.unlink(filePath);

            } catch (error) {
                if (error.code !== "ENOENT") {
                    throw error;
                }
            }
        }

    } catch (error) {
        console.error("Presentation Delete Error:", error);
    }
}


// CLEANUP UNUSED PRESENTATION

async function cleanupFailedPresentation(presentation) {
    if (!presentation?.gridFsId) return;

    try {
        const referenced = await Submission.exists({
            "presentation.gridFsId": presentation.gridFsId
        });

        if (!referenced) {
            await deletePresentation(presentation);
        }

    } catch (error) {
        console.error("Presentation Cleanup Error:", error);
    }
}


// CLEANUP REPLACED PRESENTATION

async function cleanupOldPresentation(presentation) {
    if (!presentation) return;

    try {
        if (presentation.gridFsId) {
            await cleanupFailedPresentation(presentation);

        } else if (presentation.fileName) {

            const referenced = await Submission.exists({
                "presentation.fileName": presentation.fileName
            });

            if (!referenced) {
                await deletePresentation(presentation);
            }
        }

    } catch (error) {
        console.error("Old Presentation Cleanup Error:", error);
    }
}


// CHECK SUBMISSION DEADLINE

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


// GET SELECTED PROBLEM

async function getSelectedProblem(team) {
    if (!team.selectedProblem) return null;

    return await Problem.findOne({
        _id: team.selectedProblem,
        selectedTeams: team._id,
        isPublished: true
    });
}


// VALIDATE FINAL SUBMISSION

function validateFinalDetails(body, file, existingPresentation) {

    const {
        projectTitle,
        description,
        githubUrl,
        liveDemoUrl
    } = body;

    if (
        typeof projectTitle !== "string" ||
        typeof description !== "string" ||
        typeof githubUrl !== "string" ||
        !projectTitle.trim() ||
        !description.trim() ||
        !githubUrl.trim()
    ) {
        return "Project title, description and GitHub URL are required.";
    }

    if (!validUrl(githubUrl)) {
        return "Please enter a valid GitHub URL.";
    }

    if (
        liveDemoUrl &&
        (
            typeof liveDemoUrl !== "string" ||
            !validUrl(liveDemoUrl)
        )
    ) {
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
    preventConcurrentSubmission,

    async (req, res) => {

        let presentation = null;

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

            const oldPresentation = existing
                ? existing.presentation
                : null;

            presentation = await getPresentation(req.file);

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
                    problem: problem._id,
                    status: { $ne: "evaluated" }
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
                    upsert: !existing,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            if (!submission) {
                await cleanupFailedPresentation(presentation);

                return res.status(409).json({
                    success: false,
                    message: "Submission has changed. Please refresh and try again."
                });
            }

            if (presentation && oldPresentation) {
                await cleanupOldPresentation(oldPresentation);
            }

            presentation = null;

            res.json({
                success: true,
                message: "Draft saved successfully.",
                submission: submission
            });

        } catch (error) {

            await cleanupFailedPresentation(presentation);

            console.error("Save Draft Error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to save draft."
            });

        } finally {
            req.releaseSubmissionLock();
        }
    }
);


// FINAL SUBMISSION

router.post(
    "/",
    requireParticipant,
    upload.single("presentation"),
    preventConcurrentSubmission,

    async (req, res) => {

        let presentation = null;

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

            const oldPresentation = existing
                ? existing.presentation
                : null;

            presentation = await getPresentation(req.file);

            if (presentation) {
                data.presentation = presentation;
            }

            const submission = await Submission.findOneAndUpdate(
                {
                    team: team._id,
                    problem: problem._id,
                    status: { $ne: "evaluated" }
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
                    upsert: !existing,
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            if (!submission) {
                await cleanupFailedPresentation(presentation);

                return res.status(409).json({
                    success: false,
                    message: "Submission has changed. Please refresh and try again."
                });
            }

            if (presentation && oldPresentation) {
                await cleanupOldPresentation(oldPresentation);
            }

            presentation = null;

            res.json({
                success: true,
                message: "Project submitted successfully.",
                submission: submission
            });

        } catch (error) {

            await cleanupFailedPresentation(presentation);

            console.error("Final Submission Error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to submit project."
            });

        } finally {
            req.releaseSubmissionLock();
        }
    }
);


// GET TEAM SUBMISSION

router.get(
    "/my-submission",
    requireParticipant,

    async (req, res) => {

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
    }
);


// UPDATE EXISTING SUBMISSION

router.put(
    "/:id",
    requireParticipant,
    upload.single("presentation"),
    preventConcurrentSubmission,

    async (req, res) => {

        let presentation = null;

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

            const oldPresentation = {
                gridFsId: submission.presentation?.gridFsId,
                fileName: submission.presentation?.fileName
            };

            const data = {
                projectTitle: req.body.projectTitle.trim(),
                description: req.body.description.trim(),
                githubUrl: req.body.githubUrl.trim(),
                liveDemoUrl: (req.body.liveDemoUrl || "").trim(),
                technologies: getTechnologies(req.body.technologies),
                status: "submitted",
                submittedAt: new Date()
            };

            presentation = await getPresentation(req.file);

            if (presentation) {
                data.presentation = presentation;
            }

            const updatedSubmission =
                await Submission.findOneAndUpdate(
                    {
                        _id: submission._id,
                        team: req.team._id,
                        status: { $ne: "evaluated" }
                    },
                    {
                        $set: data
                    },
                    {
                        new: true,
                        runValidators: true
                    }
                );

            if (!updatedSubmission) {

                await cleanupFailedPresentation(presentation);

                return res.status(409).json({
                    success: false,
                    message: "Submission has changed. Please refresh and try again."
                });
            }

            if (presentation) {
                await cleanupOldPresentation(oldPresentation);
            }

            presentation = null;

            res.json({
                success: true,
                message: "Project updated successfully.",
                submission: updatedSubmission
            });

        } catch (error) {

            await cleanupFailedPresentation(presentation);

            console.error("Update Submission Error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update submission."
            });

        } finally {
            req.releaseSubmissionLock();
        }
    }
);


// SECURE PRESENTATION DOWNLOAD

router.get(
    "/presentation/:filename",
    requireParticipant,

    async (req, res) => {

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

            const presentation = submission.presentation;

            const downloadName = path.basename(
                presentation.originalName || filename
            );

            if (presentation.gridFsId) {

                const bucket = getGridFSBucket();

                const files = await bucket.find({
                    _id: presentation.gridFsId
                }).toArray();

                if (!files.length) {
                    return res.status(404).json({
                        success: false,
                        message: "Presentation file not found."
                    });
                }

                const storedFile = files[0];

                res.attachment(downloadName);

                res.setHeader(
                    "Content-Type",
                    "application/octet-stream"
                );

                res.setHeader(
                    "X-Content-Type-Options",
                    "nosniff"
                );

                res.setHeader(
                    "Content-Length",
                    storedFile.length
                );

                const downloadStream =
                    bucket.openDownloadStream(presentation.gridFsId);

                downloadStream.on("error", (error) => {

                    console.error(
                        "GridFS Download Error:",
                        error
                    );

                    if (!res.headersSent) {

                        res.removeHeader("Content-Length");
                        res.removeHeader("Content-Disposition");

                        return res.status(500).json({
                            success: false,
                            message: "Unable to download presentation."
                        });
                    }

                    res.destroy(error);
                });

                res.on("close", () => {
                    if (!res.writableFinished) {
                        downloadStream.destroy();
                    }
                });

                downloadStream.pipe(res);

            } else {

                const localFile = path.join(
                    uploadFolder,
                    filename
                );

                if (!fs.existsSync(localFile)) {
                    return res.status(404).json({
                        success: false,
                        message: "Presentation file not found."
                    });
                }

                res.download(
                    localFile,
                    downloadName,
                    (error) => {

                        if (!error) return;

                        console.error(
                            "Local Presentation Download Error:",
                            error
                        );

                        if (!res.headersSent) {

                            res.removeHeader("Content-Length");
                            res.removeHeader("Content-Disposition");

                            return res.status(500).json({
                                success: false,
                                message: "Unable to download presentation."
                            });
                        }

                        res.destroy(error);
                    }
                );
            }

        } catch (error) {

            console.error("Presentation Access Error:", error);

            if (!res.headersSent) {

                res.removeHeader("Content-Length");
                res.removeHeader("Content-Disposition");

                res.status(500).json({
                    success: false,
                    message: "Unable to access presentation."
                });

            } else {
                res.destroy(error);
            }
        }
    }
);

// GET ALL SUBMITTED PROJECTS FOR ORGANIZER

router.get(
    "/organizer/all",
    requireOrganizer,

    async (req, res) => {

        try {

           const teams = await Team.find({
    emailVerified: true
}).select("_id");

const submissions = await Submission.find({
    team: {
        $in: teams.map(team => team._id)
    },
    status: {
        $in: ["submitted", "evaluated"]
    }
})
            .populate("team", "teamName teamId leaderName")
            .populate("problem", "code title")
            .sort({ submittedAt: -1 })
            .lean();

            res.json({
                success: true,
                count: submissions.length,
                submissions: submissions
            });

        } catch (error) {

            console.error(
                "Organizer Submission Error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to load submitted projects."
            });

        }
    }
);
// SECURE PRESENTATION DOWNLOAD FOR ORGANIZER

router.get(
    "/organizer/presentation/:filename",
    requireOrganizer,

    async (req, res) => {

        try {

            const filename = req.params.filename;

            if (
                path.basename(filename) !== filename ||
                filename.includes("\\") ||
                filename === "." ||
                filename === ".."
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid file name."
                });
            }

            const teams = await Team.find({
    emailVerified: true
}).select("_id");

const submission = await Submission.findOne({
    "presentation.fileName": filename,
    team: {
        $in: teams.map(team => team._id)
    },
    status: {
        $in: ["submitted", "evaluated"]
    }
});

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: "Presentation not found."
                });
            }

            const presentation = submission.presentation;

            const downloadName = path.basename(
                presentation.originalName || filename
            );

            if (presentation.gridFsId) {

                const bucket = getGridFSBucket();

                const files = await bucket.find({
                    _id: presentation.gridFsId
                }).toArray();

                if (!files.length) {
                    return res.status(404).json({
                        success: false,
                        message: "Presentation file not found."
                    });
                }

                res.attachment(downloadName);

                res.setHeader(
                    "Content-Type",
                    "application/octet-stream"
                );

                res.setHeader(
                    "X-Content-Type-Options",
                    "nosniff"
                );

                res.setHeader(
                    "Content-Length",
                    files[0].length
                );

                const downloadStream =
                    bucket.openDownloadStream(
                        presentation.gridFsId
                    );

                downloadStream.on("error", (error) => {

                    console.error(
                        "Organizer Download Error:",
                        error
                    );

                    if (!res.headersSent) {

                        res.removeHeader("Content-Length");
                        res.removeHeader("Content-Disposition");

                        return res.status(500).json({
                            success: false,
                            message: "Unable to download presentation."
                        });
                    }

                    res.destroy(error);
                });

                res.on("close", () => {
                    if (!res.writableFinished) {
                        downloadStream.destroy();
                    }
                });

                downloadStream.pipe(res);

            } else {

                const localFile = path.join(
                    uploadFolder,
                    filename
                );

                if (!fs.existsSync(localFile)) {
                    return res.status(404).json({
                        success: false,
                        message: "Presentation file not found."
                    });
                }

                res.setHeader(
                    "X-Content-Type-Options",
                    "nosniff"
                );

                res.download(
                    localFile,
                    downloadName,
                    (error) => {

                        if (!error) return;

                        if (!res.headersSent) {

                            res.removeHeader("Content-Length");
                            res.removeHeader("Content-Disposition");

                            return res.status(500).json({
                                success: false,
                                message: "Unable to download presentation."
                            });
                        }

                        res.destroy(error);
                    }
                );
            }

        } catch (error) {

            console.error(
                "Organizer Presentation Error:",
                error
            );

            if (!res.headersSent) {

                res.removeHeader("Content-Length");
                res.removeHeader("Content-Disposition");

                return res.status(500).json({
                    success: false,
                    message: "Unable to access presentation."
                });
            }

            res.destroy(error);
        }
    }
);
// MULTER ERROR HANDLER

router.use((error, req, res, next) => {

    if (error instanceof multer.MulterError) {

        return res.status(400).json({
            success: false,
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Presentation file must be 5 MB or smaller."
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
