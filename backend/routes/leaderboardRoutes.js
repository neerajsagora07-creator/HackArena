
const express = require("express");
const router = express.Router();

const Submission = require("../models/submission");
const Evaluation = require("../models/Evaluation");
const Event = require("../models/event");

// GENERATE LEADERBOARD
async function generateLeaderboard() {

    const submissions = await Submission.find({
        status: "evaluated"
    })
    .populate("team", "teamName teamId")
    .populate("problem", "title code");

    if (submissions.length === 0) {
        return [];
    }

    const submissionIds = submissions.map(
        item => item._id
    );

    const evaluations = await Evaluation.find({
        submission: { $in: submissionIds }
    }).select(
        "submission totalScore totalMaximum evaluatedAt"
    );

    const evaluationMap = new Map();

    evaluations.forEach(item => {
        evaluationMap.set(
            item.submission.toString(),
            item
        );
    });

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

    leaderboard.sort((a, b) => {
        return b.totalScore - a.totalScore;
    });

    let currentRank = 0;
    let previousScore = null;

    leaderboard.forEach((item, index) => {
        if (item.totalScore !== previousScore) {
            currentRank = index + 1;
            previousScore = item.totalScore;
        }

        item.rank = currentRank;
    });

    return leaderboard;
}

// GET PUBLIC LEADERBOARD
router.get("/", async (req, res) => {
    try {

        const event = await Event.findOne();

        const resultsPublished =
            event?.resultsPublished === true;

        const leaderboard = resultsPublished
            ? event.finalLeaderboard || []
            : await generateLeaderboard();

        res.json({
            success: true,
            count: leaderboard.length,
            leaderboard,
            resultsPublished,
            resultsPublishedAt:
                event?.resultsPublishedAt || null
        });

    } catch (error) {
        console.error("Public Leaderboard Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load leaderboard."
        });
    }
});

router.generateLeaderboard = generateLeaderboard;

module.exports = router;
