
const mongoose = require("mongoose");

const judgeInvitationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    tokenHash: {
        type: String,
        required: true,
        select: false
    },
    expiresAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "expired"],
        default: "pending"
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model("JudgeInvitation", judgeInvitationSchema);
