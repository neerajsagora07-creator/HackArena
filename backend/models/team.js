const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({

    teamName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    leaderName: {
        type: String,
        required: true,
        trim: true
    },

    leaderEmail: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    memberNames: [{
        type: String,
        trim: true
    }],

    passwordHash: {
        type: String,
        required: true,
        select: false
    },

    teamId: {
        type: String,
        unique: true,
        sparse: true
    },

    emailVerified: {
        type: Boolean,
        default: false
    },

    verificationOtpHash: {
        type: String,
        select: false
    },

    verificationExpiresAt: {
        type: Date,
        select: false
    },

    selectedProblem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Problem",
        default: null
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Team", teamSchema);