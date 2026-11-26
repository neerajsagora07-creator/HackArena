
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const app = express();

if (process.env.RENDER === "true") {
    app.set("trust proxy", 1);
}
// SMTP CONFIGURATION CHECK

console.log("SMTP CHECK:", {
    host: !!process.env.SMTP_HOST,
    port: !!process.env.SMTP_PORT,
    user: !!process.env.SMTP_USER,
    pass: !!process.env.SMTP_PASS
});

// MIDDLEWARE

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// IMPORT ROUTES

const eventRoutes = require("./routes/eventRoutes");
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const problemRoutes = require("./routes/problemRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const judgeRoutes = require("./routes/judgeRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

// HOME ROUTE

app.get("/", (req, res) => {
    res.send("HackArena Backend is Running!");
});

// HEALTH CHECK

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
app.use("/api/event/timer", 
    require("./routes/timerRoutes"));
app.use("/api/event", eventRoutes);
app.use("/api/announcements", 
    require("./routes/announcementRoutes"));

    app.use("/api/analytics", 
        require("./routes/analyticsRoutes"));

        app.use("/api/results",
         require("./routes/resultsRoutes"));
// AUTHENTICATION API

app.use("/api/auth", authRoutes);

// TEAM API

app.use("/api/teams", teamRoutes);

// PROBLEM API

app.use("/api/problems", problemRoutes);

// SUBMISSION API

app.use("/api/submissions", submissionRoutes);

// JUDGE API

app.use("/api/judges", judgeRoutes);

// PUBLIC LEADERBOARD API

app.use("/api/leaderboard", leaderboardRoutes);

// MONGODB CONNECTION

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

       app.listen(PORT, "0.0.0.0", () => {

            console.log("HackArena Server running on port " + PORT);

            console.log("Event API: /api/event");
            console.log("Auth API: /api/auth");
            console.log("Team API: /api/teams");
            console.log("Problem API: /api/problems");
            console.log("Submission API: /api/submissions");
            console.log("Judge API: /api/judges");
            console.log("Leaderboard API: /api/leaderboard");

        });

    } catch (error) {

        console.error("Server Error:", error.message);
        process.exit(1);

    }

}

startServer();
