
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Import Event Routes
const eventRoutes = require("./routes/eventRoutes");

// Home Route
app.get("/", (req, res) => {
    res.send("HackArena Backend is Running!");
});

// Health Check API
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "HackArena API is working!",
        database: mongoose.connection.readyState === 1
            ? "Connected"
            : "Disconnected"
    });
});

// EVENT API
app.use("/api/event", eventRoutes);

// MongoDB Connection
async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: "hackarena"
        });

        console.log("MongoDB Connected Successfully!");

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, "127.0.0.1", () => {
            console.log(
                "HackArena Server running on port " + PORT
            );
            console.log("Event API: /api/event");
        });

    } catch (error) {
        console.error(
            "MongoDB Connection Failed:",
            error.message
        );
    }
}

startServer();
