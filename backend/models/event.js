
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
    },
    evaluationCriteria: {
        type: [{
            name: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100
            },
            maximum: {
                type: Number,
                required: true,
                min: 0.01,
                max: 10000
            }
        }],
        default: [
            { name: "Innovation", maximum: 25 },
            { name: "Technical Implementation", maximum: 25 },
            { name: "Impact", maximum: 20 },
            { name: "UI/UX", maximum: 15 },
            { name: "Presentation", maximum: 15 }
        ]
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.Event || mongoose.model("Event", eventSchema);
