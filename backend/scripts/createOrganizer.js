
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

require("dotenv").config();

// ====================================
// HACKARENA ORGANIZER ACCOUNT SETUP
// ====================================

async function createOrganizer() {

    try {

        const name = process.env.ORG_SETUP_NAME?.trim();
        const email = process.env.ORG_SETUP_EMAIL?.trim().toLowerCase();
        const password = process.env.ORG_SETUP_PASSWORD;

        if (
            !name ||
            name.length < 2 ||
            name.length > 100 ||
            !email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !password ||
            password.length < 8 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            throw new Error("Enter valid organizer details.");
        }

        if (!process.env.MONGO_URI) {
            throw new Error("MongoDB connection is missing.");
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: "hackarena"
        });

        console.log("MongoDB Connected!");

        // Check existing account
        const existingUser = await User.findOne({
            email: email
        });

        if (existingUser) {
            throw new Error("Email already registered.");
        }

        // Hash organizer password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create authorized organizer account
        await User.create({
            name: name,
            email: email,
            passwordHash: hashedPassword,
            role: "organizer"
        });

        console.log("Organizer Account Created Successfully!");
        console.log("Role: organizer");

    } catch (error) {

        console.error("Setup Error:", error.message);

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();

    }

}

createOrganizer();
