
"use strict";

// HACKARENA PUBLIC LEADERBOARD

const API_URL = "http://127.0.0.1:5000/api/leaderboard";

const leaderboardList =
    document.getElementById("leaderboard-list");

const leaderboardStatus =
    document.getElementById("leaderboard-status");

const leaderboardCount =
    document.getElementById("leaderboard-count");

const leaderboardEmpty =
    document.getElementById("leaderboard-empty");

const refreshButton =
    document.getElementById("refresh-button");

// LOAD PUBLIC LEADERBOARD

async function loadLeaderboard() {

    refreshButton.disabled = true;
    leaderboardStatus.textContent = "Loading leaderboard...";
    leaderboardEmpty.hidden = true;
    leaderboardList.replaceChildren();

    try {

        const response = await fetch(API_URL, {
            method: "GET",
            cache: "no-store"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load leaderboard."
            );
        }

        const leaderboard = data.leaderboard;

        leaderboardCount.textContent =
            `${data.count} evaluated projects`;

        if (!Array.isArray(leaderboard) ||
            leaderboard.length === 0) {

            leaderboardStatus.textContent =
                "No evaluation results available yet.";

            leaderboardEmpty.hidden = false;
            return;
        }

        leaderboardStatus.textContent =
            "Official evaluation results loaded successfully.";

        // DISPLAY RANKINGS

        leaderboard.forEach((item) => {

            const row = document.createElement("tr");

            const rankCell = document.createElement("td");

            const rankNumber = item.rank;

            rankCell.className = "rank";

            if (rankNumber === 1) {
                rankCell.textContent = "🥇 1";
            } else if (rankNumber === 2) {
                rankCell.textContent = "🥈 2";
            } else if (rankNumber === 3) {
                rankCell.textContent = "🥉 3";
            } else {
                rankCell.textContent = rankNumber;
            }

            const teamCell = document.createElement("td");

            const teamName = document.createElement("strong");
            teamName.className = "team-name";
            teamName.textContent = item.teamName || "Unknown Team";

            const teamId = document.createElement("small");
            teamId.className = "team-id";
            teamId.textContent = item.teamId || "";

            teamCell.append(teamName, teamId);

            const projectCell = document.createElement("td");
            projectCell.textContent =
                item.projectTitle || "Untitled Project";

            const scoreCell = document.createElement("td");
            scoreCell.className = "score";

            scoreCell.textContent =
                `${item.totalScore} / ${item.totalMaximum}`;

            row.append(
                rankCell,
                teamCell,
                projectCell,
                scoreCell
            );

            leaderboardList.append(row);

        });

    } catch (error) {

        console.error("Leaderboard Error:", error);

        leaderboardStatus.textContent = error.message;

        leaderboardCount.textContent =
            "Results unavailable";

    } finally {

        refreshButton.disabled = false;

    }
}

// REFRESH BUTTON

refreshButton.addEventListener("click", loadLeaderboard);

// LOAD DATA WHEN PAGE OPENS

loadLeaderboard();
