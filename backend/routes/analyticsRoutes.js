const express = require("express");
const Team = require("../models/team");
const Problem = require("../models/problem");
const Submission = require("../models/submission");
const requireOrganizer = require("../middleware/requireOrganizer");

const router = express.Router();

router.get("/", requireOrganizer, async (req, res) => {

    try {

        const teams = await Team.find({
            emailVerified: true
        }).select("_id selectedProblem");

        const problems = await Problem.find({
            isPublished: true
        });

        const submissions = await Submission.find({
            team: {
                $in: teams.map(team => team._id)
            }
        });

        const totalTeams = teams.length;

        const totalProblems = problems.length;

        const selectedTeams = teams.filter(
            team => team.selectedProblem
        ).length;

        const fullProblems = problems.filter(
            problem =>
                problem.selectedTeams.length >= problem.capacity
        ).length;

        const draftSubmissions = submissions.filter(
            submission => submission.status === "draft"
        ).length;

        const finalSubmissions = submissions.filter(
            submission =>
                submission.status === "submitted" ||
                submission.status === "evaluated"
        ).length;

        const evaluatedProjects = submissions.filter(
            submission => submission.status === "evaluated"
        ).length;

        const submittedTeamIds = new Set(
            submissions.filter(
                submission =>
                    submission.status === "submitted" ||
                    submission.status === "evaluated"
            ).map(submission => String(submission.team))
        );

        const pendingSubmissions =
            totalTeams - submittedTeamIds.size;

        const submissionCompletion = totalTeams > 0
            ? Math.round(
                submittedTeamIds.size / totalTeams * 100
            )
            : 0;

        const evaluationProgress = finalSubmissions > 0
            ? Math.round(
                evaluatedProjects / finalSubmissions * 100
            )
            : 0;

        const problemDistribution = problems.map(problem => ({

            code: problem.code,

            title: problem.title,

            selectedTeams: problem.selectedTeams.length,

            capacity: problem.capacity,

            availableSlots: Math.max(
                0,
                problem.capacity - problem.selectedTeams.length
            )

        }));

        res.json({

            success: true,

            analytics: {

                totalTeams,

                totalProblems,

                selectedTeams,

                fullProblems,

                totalSubmissions: submissions.length,

                draftSubmissions,

                finalSubmissions,

                pendingSubmissions,

                evaluatedProjects,

                submissionCompletion,

                evaluationProgress,

                problemDistribution

            }

        });

    } catch (error) {

        console.error("Analytics Error:", error);

        res.status(500).json({

            success: false,

            message: "Unable to load event analytics."

        });

    }

});

module.exports = router;