const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true,
        trim: true
    },

    message: {
        type: String,
        required: true,
        trim: true
    },

    priority: {
        type: String,
        enum: ["normal", "important", "urgent"],
        default: "normal"
    },

    audience: {
        type: String,
        enum: ["all", "participants", "judges"],
        default: "all"
    }

}, {
    timestamps: true
});

module.exports = mongoose.model(
    "Announcement",
    announcementSchema
);