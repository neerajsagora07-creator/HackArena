"use strict";

async function sendEmail({ to, subject, html, text }) {

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName =
        process.env.BREVO_SENDER_NAME || "HackArena - Team Nexora";

    if (!apiKey || !senderEmail) {
        throw new Error("Brevo email configuration is missing.");
    }

    const emailData = {
        sender: {
            name: senderName,
            email: senderEmail
        },

        to: [
            {
                email: to
            }
        ],

        subject: subject
    };

    if (html) {
        emailData.htmlContent = html;
    }

    if (text) {
        emailData.textContent = text;
    }

    const response = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
            method: "POST",

            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json"
            },

            body: JSON.stringify(emailData),

            signal: AbortSignal.timeout(30000)
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Brevo email sending failed."
        );
    }

    console.log("HackArena email accepted by Brevo.");

    return data;
}

module.exports = { sendEmail };