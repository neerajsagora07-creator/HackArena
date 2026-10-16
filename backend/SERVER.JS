
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

const app = express();

// ====================================
// MIDDLEWARE
// ====================================

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ====================================
// IMPORT ROUTES
// ====================================

const eventRoutes = require("./routes/eventRoutes");
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");

// ====================================
// HOME ROUTE
// ====================================

app.get("/", (req, res) => {
    res.send("HackArena Backend is Running!");
});

// ====================================
// HEALTH CHECK
// ====================================

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        message: "HackArena API is working!",
        database: mongoose.connection.readyState === 1
            ? "Connected"
            : "Disconnected"
    });

});

// ====================================
// EVENT API
// ====================================

app.use("/api/event", eventRoutes);

// ====================================
// AUTHENTICATION API
// ====================================

app.use("/api/auth", authRoutes);

// ====================================
// TEAM REGISTRATION AND LOGIN API
// ====================================

app.use("/api/teams", teamRoutes);

// ====================================
// MONGODB CONNECTION
// ====================================

async function startServer() {

    try {

        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing");
        }

        if (
            !process.env.JWT_SECRET ||
            process.env.JWT_SECRET.length < 32
        ) {
            throw new Error(
                "Add a secure JWT_SECRET to the .env file"
            );
        }

        await mongoose.connect(process.env.MONGO_URI, {
            dbName: "hackarena"
        });

        console.log("MongoDB Connected Successfully!");

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, "127.0.0.1", () => {

            console.log("HackArena Server running on port " + PORT);

            console.log("Event API: /api/event");

            console.log("Register API: /api/auth/register");
            console.log("Login API: /api/auth/login");

            console.log("Team Register API: /api/teams/register");
            console.log("Team Verify API: /api/teams/verify-email");
            console.log("Team Login API: /api/teams/login");

        });

    } catch (error) {

        console.error("Server Error:", error.message);
        process.exit(1);

    }
}

startServer();
