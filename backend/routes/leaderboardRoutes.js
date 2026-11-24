
const express = require("express");
const router = express.Router();

const Submission = require("../models/submission");
const Evaluation = require("../models/Evaluation");

// GET PUBLIC LEADERBOARD
router.get("/", async (req, res) => {
    try {
        // Get all evaluated submissions
        const submissions = await Submission.find({
            status: "evaluated"
        })
        .populate("team", "teamName teamId")
        .populate("problem", "title code");

        if (submissions.length === 0) {
            return res.json({
                success: true,
                count: 0,
                leaderboard: []
            });
        }

        // Get submission IDs
        const submissionIds = submissions.map(
            item => item._id
        );

        // Get evaluations
        const evaluations = await Evaluation.find({
            submission: { $in: submissionIds }
        }).select(
            "submission totalScore totalMaximum evaluatedAt"
        );

        // Map evaluations by submission ID
        const evaluationMap = new Map();

        evaluations.forEach(item => {
            evaluationMap.set(
                item.submission.toString(),
                item
            );
        });

        // Prepare leaderboard
        const leaderboard = submissions
            .map(submission => {
                const evaluation = evaluationMap.get(
                    submission._id.toString()
                );

                if (!evaluation || !submission.team) {
                    return null;
                }

                return {
                    submissionId: submission._id,
                    teamName: submission.team.teamName,
                    teamId: submission.team.teamId,
                    projectTitle: submission.projectTitle,
                    problemTitle: submission.problem
                        ? submission.problem.title
                        : "",
                    totalScore: evaluation.totalScore,
                    totalMaximum: evaluation.totalMaximum,
                    evaluatedAt: evaluation.evaluatedAt
                };
            })
            .filter(item => item !== null);

        // Sort highest score first
        leaderboard.sort((a, b) => {
            return b.totalScore - a.totalScore;
        });

        // Assign ranks (equal scores get equal ranks)
        let currentRank = 0;
        let previousScore = null;

        leaderboard.forEach((item, index) => {
            if (item.totalScore !== previousScore) {
                currentRank = index + 1;
                previousScore = item.totalScore;
            }

            item.rank = currentRank;
        });

        res.json({
            success: true,
            count: leaderboard.length,
            leaderboard
        });

    } catch (error) {
        console.error("Public Leaderboard Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load leaderboard."
        });
    }
});

module.exports = router;
