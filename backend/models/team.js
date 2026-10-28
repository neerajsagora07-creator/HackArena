
const mongoose = require("mongoose");

// ======================================
// HACKARENA TEAM MODEL
// ======================================

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

    // Other members (leader is separate)
    memberNames: [{
        type: String,
        trim: true
    }],

    // Password is stored as a hash
    passwordHash: {
        type: String,
        required: true,
        select: false
    },

    // Generated after email verification
    teamId: {
        type: String,
        unique: true,
        sparse: true
    },

    emailVerified: {
        type: Boolean,
        default: false
    },

    // OTP is stored as a hash, not plain text
    verificationOtpHash: {
        type: String,
        select: false
    },

    verificationExpiresAt: {
        type: Date,
        select: false
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Team", teamSchema);
