
const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({

    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        required: true
    },

    problem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Problem",
        required: true
    },

    projectTitle: {
        type: String,
        default: "",
        trim: true,
        maxlength: 150
    },

    description: {
        type: String,
        default: "",
        trim: true,
        maxlength: 5000
    },

    githubUrl: {
        type: String,
        default: "",
        trim: true
    },

    liveDemoUrl: {
        type: String,
        default: "",
        trim: true
    },

    technologies: [{
        type: String,
        trim: true
    }],

    presentation: {
        originalName: {
            type: String,
            default: ""
        },
        fileName: {
            type: String,
            default: ""
        },
        filePath: {
            type: String,
            default: ""
        },
        mimeType: {
            type: String,
            default: ""
        },
        fileSize: {
            type: Number,
            default: 0
        },
        uploadedAt: {
            type: Date,
            default: null
        }
    },

    status: {
        type: String,
        enum: ["draft", "submitted", "evaluated"],
        default: "draft"
    },

    submittedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

submissionSchema.index(
    { team: 1, problem: 1 },
    { unique: true }
);

module.exports = mongoose.models.Submission ||
    mongoose.model("Submission", submissionSchema);
