
const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema({
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

    criteria: [{
        name: {
            type: String,
            required: true
        },

        maximum: {
            type: Number,
            required: true,
            min: 1
        },

        score: {
            type: Number,
            required: true,
            min: 0
        }
    }],

    totalScore: {
        type: Number,
        required: true,
        min: 0
    },

    totalMaximum: {
        type: Number,
        required: true,
        min: 1
    },

    feedback: {
        type: String,
        default: "",
        trim: true,
        maxlength: 5000
    },

    evaluatedAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

evaluationSchema.index(
    { judge: 1, submission: 1 },
    { unique: true }
);

module.exports = mongoose.models.Evaluation ||
    mongoose.model("Evaluation", evaluationSchema);
