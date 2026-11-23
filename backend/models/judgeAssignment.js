
const mongoose = require("mongoose");

const judgeAssignmentSchema = new mongoose.Schema({
    judge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Submission",
        required: true
    },

    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    status: {
        type: String,
        enum: ["assigned", "evaluated"],
        default: "assigned"
    },

    assignedAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

judgeAssignmentSchema.index(
    { judge: 1, submission: 1 },
    { unique: true }
);

module.exports = mongoose.models.JudgeAssignment ||
    mongoose.model("JudgeAssignment", judgeAssignmentSchema);
