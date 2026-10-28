
const mongoose = require("mongoose");

// ====================================
// HACKARENA PROBLEM STATEMENT MODEL
// ====================================

const problemSchema = new mongoose.Schema({

    // Unique Problem Code
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    // Problem Title
    title: {
        type: String,
        required: true,
        trim: true
    },

    // Full Problem Description
    statement: {
        type: String,
        required: true,
        trim: true
    },

    // Maximum Teams Allowed
    capacity: {
        type: Number,
        default: 3,
        min: 1
    },

    // Teams that selected this problem
    selectedTeams: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team"
    }],

    // Problem Visibility
    isPublished: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Problem", problemSchema);
