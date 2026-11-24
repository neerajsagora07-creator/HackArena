
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const Event = require("../models/Event");

const JudgeInvitation = require("../models/JudgeInvitation");
const User = require("../models/User");
const requireOrganizer = require("../middleware/requireOrganizer");

const Submission = require("../models/submission");
const JudgeAssignment = require("../models/JudgeAssignment");
const Evaluation = require("../models/Evaluation");

const requireJudge = require("../middleware/requireJudge");

const router = express.Router();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});


// SEND JUDGE INVITATION

router.post("/invite", requireOrganizer, async (req, res) => {
    try {
        const { name, email } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            name.trim().length < 2 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid judge name and email are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        const existingInvitation = await JudgeInvitation.findOne({
            email: cleanEmail,
            status: "pending",
            expiresAt: { $gt: new Date() }
        });

        if (existingInvitation) {
            return res.status(409).json({
                success: false,
                message: "An active invitation already exists."
            });
        }

        const token = crypto.randomBytes(32).toString("hex");

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const invitation = await JudgeInvitation.create({
            name: name.trim(),
            email: cleanEmail,
            tokenHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            invitedBy: req.organizer._id
        });

        const invitationLink =
            `${process.env.FRONTEND_URL}/judge-accept.html?token=${token}`;

        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: cleanEmail,
                subject: "HackArena - Judge Invitation",
                html: `
                    <h2>Hello ${name.trim()},</h2>
                    <p>You have been invited to become a Judge at HackArena.</p>
                    <p>Click below to accept your invitation and create your password.</p>
                    <a href="${invitationLink}">Accept Invitation</a>
                    <p>This invitation expires in 24 hours.</p>
                `
            });
        } catch (mailError) {
            await JudgeInvitation.findByIdAndDelete(invitation._id);
            throw mailError;
        }

        res.status(201).json({
            success: true,
            message: "Judge invitation email sent successfully."
        });

    } catch (error) {
        console.error("Judge Invitation Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to send judge invitation."
        });
    }
});


// GET JUDGE INVITATIONS

router.get("/invitations", requireOrganizer, async (req, res) => {
    try {
        const invitations = await JudgeInvitation.find({
            invitedBy: req.organizer._id
        }).select("-tokenHash").sort({ createdAt: -1 });

        res.json({
            success: true,
            invitations
        });

    } catch (error) {
        console.error("Judge List Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load judge invitations."
        });
    }
});


// ACCEPT JUDGE INVITATION

router.post("/accept", async (req, res) => {
    try {
        const { token, password } = req.body;

        if (
            typeof token !== "string" ||
            typeof password !== "string" ||
            password.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid invitation token and password of at least 8 characters are required."
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const invitation = await JudgeInvitation.findOne({
            tokenHash,
            status: "pending"
        });

        if (!invitation) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invitation link."
            });
        }

        if (invitation.expiresAt <= new Date()) {
            invitation.status = "expired";
            await invitation.save();

            return res.status(410).json({
                success: false,
                message: "This invitation has expired. Please contact the organizer."
            });
        }

        const existingUser = await User.findOne({
            email: invitation.email
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await User.create({
            name: invitation.name,
            email: invitation.email,
            passwordHash,
            role: "judge"
        });

        invitation.status = "accepted";
        await invitation.save();

        res.status(201).json({
            success: true,
            message: "Judge account created successfully. You can now log in."
        });

    } catch (error) {
        console.error("Judge Acceptance Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to accept judge invitation."
        });
    }
});


// DELETE JUDGE INVITATION

router.delete("/invitations/:id", requireOrganizer, async (req, res) => {
    try {
        const invitation = await JudgeInvitation.findOneAndDelete({
            _id: req.params.id,
            invitedBy: req.organizer._id
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Judge invitation not found."
            });
        }

        res.json({
            success: true,
            message: "Judge invitation deleted successfully."
        });

    } catch (error) {
        console.error("Judge Invitation Delete Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to delete judge invitation."
        });
    }
});


// AUTOMATICALLY ASSIGN SUBMITTED PROJECTS TO ACCEPTED JUDGES

router.post("/assignments/sync", requireOrganizer, async (req, res) => {
    try {
        // Get accepted judge invitations of this organizer
        const invitations = await JudgeInvitation.find({
            invitedBy: req.organizer._id,
            status: "accepted"
        }).select("email");

        const emails = invitations.map(item => item.email);

        // Get registered judge accounts
        const judges = await User.find({
            email: { $in: emails },
            role: "judge"
        }).select("_id").sort({ _id: 1 });

        if (judges.length === 0) {
            return res.json({
                success: true,
                message: "No accepted judges available.",
                assignedJudges: 0,
                assignedProjects: 0
            });
        }

        // Get all submitted projects
        const submissions = await Submission.find({
            status: "submitted"
        }).sort({ submittedAt: 1, _id: 1 }).select("_id");

        if (submissions.length === 0) {
            return res.json({
                success: true,
                message: "No submitted projects available.",
                assignedJudges: judges.length,
                assignedProjects: 0
            });
        }

        const judgeIds = judges.map(judge => judge._id);
        const submissionIds = submissions.map(item => item._id);

        // Find projects that are already assigned
        const existingAssignments = await JudgeAssignment.find({
            submission: { $in: submissionIds }
        }).select("submission");

        const alreadyAssigned = new Set(
            existingAssignments.map(item => item.submission.toString())
        );

        // Count each judge's existing workload
        const judgeAssignments = await JudgeAssignment.find({
            judge: { $in: judgeIds }
        }).select("judge");

        const workload = {};

        judges.forEach(judge => {
            workload[judge._id.toString()] = 0;
        });

        judgeAssignments.forEach(assignment => {
            const judgeId = assignment.judge.toString();

            if (workload[judgeId] !== undefined) {
                workload[judgeId]++;
            }
        });

        let assignedProjects = 0;

        // Assign each new project to the judge with the lowest workload
        for (const submission of submissions) {

            if (alreadyAssigned.has(submission._id.toString())) {
                continue;
            }

            let selectedJudge = judges[0];

            for (const judge of judges) {
                if (
                    workload[judge._id.toString()] <
                    workload[selectedJudge._id.toString()]
                ) {
                    selectedJudge = judge;
                }
            }

            await JudgeAssignment.create({
                judge: selectedJudge._id,
                submission: submission._id,
                assignedBy: req.organizer._id,
                status: "assigned"
            });

            workload[selectedJudge._id.toString()]++;
            assignedProjects++;
        }

        res.json({
            success: true,
            message: assignedProjects > 0
                ? "Projects assigned successfully."
                : "All submitted projects are already assigned.",
            assignedJudges: judges.length,
            assignedProjects: assignedProjects,
            totalSubmittedProjects: submissions.length,
            judgeWorkload: workload
        });

    } catch (error) {
        console.error("Judge Assignment Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to assign projects."
        });
    }
});

// GET PROJECTS ASSIGNED TO LOGGED-IN JUDGE

router.get("/assigned-projects", requireJudge, async (req, res) => {
    try {
        const assignments = await JudgeAssignment.find({
            judge: req.judge._id
        })
        .populate({
            path: "submission",
           match: { status: { $in: ["submitted", "evaluated"] } },
            populate: [
                {
                    path: "team",
                    select: "teamName teamId"
                },
                {
                    path: "problem",
                    select: "title code"
                }
            ]
        })
        .sort({ assignedAt: -1 });

        const projects = assignments
            .filter(item => item.submission)
            .map(item => ({
                assignmentId: item._id,
                submission: item.submission,
                status: item.status
            }));

        res.json({
            success: true,
            count: projects.length,
            projects
        });

    } catch (error) {
        console.error("Assigned Projects Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load assigned projects."
        });
    }
});

// ==========================================
// JUDGE EVALUATION SYSTEM
// ==========================================

// 1. GET DYNAMIC EVALUATION CRITERIA
router.get("/evaluation-criteria", requireJudge, async (req, res) => {
    try {
        const event = await Event.findOne();

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found."
            });
        }

        res.json({
            success: true,
            evaluationCriteria: event.evaluationCriteria
        });

    } catch (error) {
        console.error("Evaluation criteria error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load evaluation criteria."
        });
    }
});


// 2. GET EXISTING EVALUATION
router.get("/evaluation/:submissionId", requireJudge, async (req, res) => {
    try {
        const { submissionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid submission ID."
            });
        }

        const assignment = await JudgeAssignment.findOne({
            judge: req.judge._id,
            submission: submissionId
        });

        if (!assignment) {
            return res.status(403).json({
                success: false,
                message: "This project is not assigned to you."
            });
        }

        const evaluation = await Evaluation.findOne({
            judge: req.judge._id,
            submission: submissionId
        });

        res.json({
            success: true,
            evaluation
        });

    } catch (error) {
        console.error("Fetch evaluation error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch evaluation."
        });
    }
});


// 3. SAVE JUDGE EVALUATION
router.post("/evaluation/:submissionId", requireJudge, async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { criteria, feedback } = req.body;

        if (!mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid submission ID."
            });
        }

        const assignment = await JudgeAssignment.findOne({
            judge: req.judge._id,
            submission: submissionId
        });

        if (!assignment) {
            return res.status(403).json({
                success: false,
                message: "This project is not assigned to you."
            });
        }

        const existingEvaluation = await Evaluation.findOne({
            judge: req.judge._id,
            submission: submissionId
        });

        if (existingEvaluation) {
            return res.status(409).json({
                success: false,
                message: "This project has already been evaluated."
            });
        }

        const submission = await Submission.findById(submissionId);

        if (!submission || submission.status !== "submitted") {
            return res.status(400).json({
                success: false,
                message: "Only submitted projects can be evaluated."
            });
        }

        const event = await Event.findOne();

        if (!event || !Array.isArray(event.evaluationCriteria)) {
            return res.status(400).json({
                success: false,
                message: "Evaluation criteria are not configured."
            });
        }

        if (!Array.isArray(criteria) ||
            criteria.length !== event.evaluationCriteria.length) {
            return res.status(400).json({
                success: false,
                message: "Please provide marks for all evaluation criteria."
            });
        }

        const savedCriteria = [];
        let totalScore = 0;
        let totalMaximum = 0;
        const usedNames = new Set();

        for (const configured of event.evaluationCriteria) {
            const entered = criteria.find(
                item => item.name === configured.name
            );

            if (!entered || usedNames.has(entered.name)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or duplicate evaluation criteria."
                });
            }

            const score = entered.score;

            if (
                typeof score !== "number" ||
                !Number.isFinite(score) ||
                score < 0 ||
                score > configured.maximum
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Marks for ${configured.name} must be between 0 and ${configured.maximum}.`
                });
            }

            usedNames.add(entered.name);

            savedCriteria.push({
                name: configured.name,
                maximum: configured.maximum,
                score
            });

            totalScore += score;
            totalMaximum += configured.maximum;
        }

        if (
            feedback !== undefined &&
            typeof feedback !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Feedback must be text."
            });
        }

        const evaluation = await Evaluation.create({
            judge: req.judge._id,
            submission: submissionId,
            criteria: savedCriteria,
            totalScore,
            totalMaximum,
            feedback: feedback || ""
        });

        assignment.status = "evaluated";
        await assignment.save();

        submission.status = "evaluated";
        await submission.save();

        res.status(201).json({
            success: true,
            message: "Evaluation saved successfully.",
            evaluation
        });

    } catch (error) {
        console.error("Save evaluation error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This project has already been evaluated."
            });
        }

        res.status(500).json({
            success: false,
            message: "Unable to save evaluation."
        });
    }
});
module.exports = router;
