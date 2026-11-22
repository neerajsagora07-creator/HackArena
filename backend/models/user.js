
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    passwordHash: {
        type: String,
        required: true,
        select: false
    },

    role: {
        type: String,
        enum: ["participant", "judge", "organizer"],
        default: "participant"
    }

}, {
    timestamps: true
});

const User = mongoose.model("User", userSchema);

module.exports = User;

