
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({

    eventName: {
        type: String,
        required: true
    },

    organization: {
        type: String,
        required: true
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

    maximumTeams: {
        type: Number,
        default: 60
    },

    maximumMembers: {
        type: Number,
        default: 4
    },

    defaultProblemCapacity: {
        type: Number,
        default: 3
    }

}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);
