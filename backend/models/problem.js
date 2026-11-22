
const mongoose = require("mongoose");

const problemSchema = new mongoose.Schema({

    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    title: {
        type: String,
        required: true,
        trim: true
    },

    statement: {
        type: String,
        default: "",
        trim: true
    },

    serialNumber: {
        type: Number,
        default: null
    },

    organization: {
        type: String,
        default: "",
        trim: true
    },

    category: {
        type: String,
        default: "",
        trim: true
    },

    theme: {
        type: String,
        default: "",
        trim: true
    },

    submittedIdeasCount: {
        type: Number,
        default: 0
    },

    source: {
        type: String,
        enum: ["manual", "pdf"],
        default: "manual"
    },

    capacity: {
        type: Number,
        default: 3,
        min: 1
    },

    selectedTeams: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team"
    }],

    isPublished: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.models.Problem || mongoose.model("Problem", problemSchema);