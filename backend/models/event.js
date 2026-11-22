
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({

    eventName: {
        type: String,
        required: true,
        trim: true
    },

    organization: {
        type: String,
        required: true,
        trim: true
    },

    logo: {
        type: String,
        default: ""
    },

    eventDate: String,

    eventEndDate: String,

    eventTime: String,

    eventVenue: String,

    eventDescription: String,

    submissionDeadline: {
        type: Date,
        default: null
    },

    maximumTeams: {
        type: Number,
        default: 60,
        min: 1
    },

    maximumMembers: {
        type: Number,
        default: 4,
        min: 1
    },

    defaultProblemCapacity: {
        type: Number,
        default: 3,
        min: 1
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Event", eventSchema);
