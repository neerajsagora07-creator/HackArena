"use strict";

// Hide Judge Dashboard until login is verified
document.documentElement.style.visibility = "hidden";

// ---------------------------------
// HACKARENA JUDGE DASHBOARD
// ---------------------------------

// ---------------------------------
// NAVIGATION
// ---------------------------------

const pageTitles = {
    overview: "Overview",
    projects: "Submitted Projects",
    evaluation: "Evaluation",
    leaderboard: "Leaderboard",
    announcements: "Announcements & Notifications"
};

const pages = document.querySelectorAll(".page");

const navigationButtons =
    document.querySelectorAll("[data-page]");

const pageTitle =
    document.getElementById("page-title");

function showPage(pageName) {

    if (!Object.prototype.hasOwnProperty.call(
        pageTitles, pageName
    )) {
        return;
    }

    pages.forEach((page) => {
        page.hidden = page.id !== pageName;
    });

    navigationButtons.forEach((button) => {
        button.setAttribute(
            "aria-pressed",
            String(button.dataset.page === pageName)
        );
    });

    pageTitle.textContent = pageTitles[pageName];
}

navigationButtons.forEach((button) => {
    button.addEventListener("click", () => {
        showPage(button.dataset.page);
    });
});

document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
        showPage(button.dataset.open);
    });
});

// ---------------------------------
// JUDGE DATA
// ---------------------------------

const judgeData = {
    submissions: [],
    leaderboard: [],
    statistics: null
};

let judgeResultsPublished = false;

// ---------------------------------
// JUDGING CRITERIA
// ---------------------------------

let criteria = [];

const criteriaList =
    document.getElementById("criteria-list");

const totalScore =
    document.getElementById("total-score");

const evaluationForm =
    document.getElementById("evaluation-form");

const evaluationFields =
    document.getElementById("evaluation-fields");

const evaluationStatus =
    document.getElementById("evaluation-status");

// ---------------------------------
// LOAD DYNAMIC EVALUATION CRITERIA
// ---------------------------------

async function loadEvaluationCriteria() {

    const token = sessionStorage.getItem(
        "hackarenaJudgeToken"
    );

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/judges/evaluation-criteria",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load criteria."
            );
        }

        if (
            !Array.isArray(data.evaluationCriteria) ||
            data.evaluationCriteria.length === 0
        ) {
            throw new Error("No evaluation criteria are configured.");
        }

        criteria = data.evaluationCriteria.map((item, index) => ({
            id: "criterion-" + index,
            label: item.name,
            maximum: item.maximum
        }));

        renderCriteria();

    } catch (error) {

        console.error("Evaluation Criteria Error:", error);

        evaluationStatus.textContent = error.message;
    }
}

// ---------------------------------
// RENDER JUDGING CRITERIA
// ---------------------------------

function renderCriteria() {

    criteriaList.replaceChildren();

    criteria.forEach((criterion) => {

        const row = document.createElement("div");
        row.className = "criterion";

        const label = document.createElement("label");

        label.htmlFor = `score-${criterion.id}`;

        label.append(
            document.createTextNode(criterion.label)
        );

        const maximumLabel =
            document.createElement("small");

        maximumLabel.textContent =
            `Maximum ${criterion.maximum} marks`;

        label.append(maximumLabel);

        const input = document.createElement("input");

        input.id = `score-${criterion.id}`;
        input.name = criterion.id;
        input.type = "number";
        input.min = "0";
        input.max = String(criterion.maximum);
        input.step = "any";
        input.placeholder = "—";
        input.required = true;

        input.addEventListener("input", updateTotal);

        row.append(label, input);

        criteriaList.append(row);
    });

    updateTotal();
}

// ---------------------------------
// AUTOMATIC SCORE CALCULATION
// ---------------------------------

function updateTotal() {

    let total = 0;
    let invalid = false;

    const maximumTotal = criteria.reduce(
        (sum, criterion) => sum + criterion.maximum,
        0
    );

    criteria.forEach((criterion) => {

        const input = document.getElementById(
            `score-${criterion.id}`
        );

        if (!input) {
            return;
        }

        input.setCustomValidity("");

        if (input.value === "") {
            return;
        }

        const value = Number(input.value);

        if (
            !Number.isFinite(value) ||
            value < 0 ||
            value > criterion.maximum
        ) {

            input.setCustomValidity(
                `Enter a score between 0 and ${criterion.maximum}.`
            );

            invalid = true;
            return;
        }

        total += value;
    });

    totalScore.textContent = invalid
        ? "Check marks"
        : `${Number(total.toFixed(2))} / ${maximumTotal}`;
}

// ---------------------------------
// PROJECT LIST
// ---------------------------------

const projectList =
    document.getElementById("project-list");

const projectsEmpty =
    document.getElementById("projects-empty");

function renderProjects() {

    projectList.replaceChildren();

    projectsEmpty.hidden =
        judgeData.submissions.length > 0;

    judgeData.submissions.forEach((submission) => {

        const row = document.createElement("tr");

        const values = [
            submission.teamName,
            submission.problemCode,
            submission.problemTitle,
            submission.projectName,
            submission.evaluationStatus
        ];

        values.forEach((value) => {

            const cell = document.createElement("td");

            cell.textContent = String(value ?? "—");

            row.append(cell);
        });

        const actionCell =
            document.createElement("td");

        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "table-action";
        button.textContent = "Select Project";

        button.addEventListener("click", () => {
            selectProject(submission);
        });

        actionCell.append(button);

        row.append(actionCell);

        projectList.append(row);
    });
}

// ---------------------------------
// LOAD ASSIGNED PROJECTS FROM BACKEND
// ---------------------------------

async function loadAssignedProjects() {

    const token = sessionStorage.getItem(
        "hackarenaJudgeToken"
    );

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/judges/assigned-projects",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load assigned projects."
            );
        }

        judgeData.submissions = data.projects.map((item) => {

            const submission = item.submission;

            const team = submission.team || {};

            const problem = submission.problem || {};

            return {
                assignmentId: item.assignmentId,
                submissionId: submission._id,
                teamName: team.teamName || "Team",
                problemCode: problem.code || "—",
                problemTitle: problem.title || "—",
                projectName: submission.projectTitle || "Untitled Project",
                evaluationStatus: item.status || "assigned",
                submissionStatus: submission.status,
                githubLink: submission.githubUrl || "",
                demoLink: submission.liveDemoUrl || "",
                presentationUrl: "",
                problemStatement: "",
                members: []
            };
        });

        judgeData.statistics = {
            availableSubmissions: judgeData.submissions.length,

            completedEvaluations: judgeData.submissions.filter(
                (project) =>
                    project.evaluationStatus === "evaluated"
            ).length,

            evaluationStatus: "Projects loaded"
        };

        renderProjects();

        updateStatistics();

    } catch (error) {

        console.error("Load Assigned Projects Error:", error);

        projectsEmpty.textContent = error.message;

        projectsEmpty.hidden = false;
    }
}

// ---------------------------------
// PROJECT DETAILS
// ---------------------------------

function setText(id, value) {

    document.getElementById(id).textContent =
        String(value ?? "—");
}

function showResource(elementId, url, label) {

    const container =
        document.getElementById(elementId);

    container.replaceChildren();

    if (!url) {

        const span = document.createElement("span");

        span.textContent = "Not available";

        container.append(span);

        return;
    }

    try {

        const parsed = new URL(url);

        if (
            parsed.protocol !== "https:" &&
            parsed.protocol !== "http:"
        ) {
            throw new Error("Unsupported URL");
        }

        const link = document.createElement("a");

        link.href = parsed.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;

        container.append(link);

    } catch {

        const span = document.createElement("span");

        span.textContent = "Invalid resource link";

        container.append(span);
    }
}
// ---------------------------------
// LOAD EXISTING EVALUATION
// ---------------------------------

async function loadExistingEvaluation(submissionId) {

    const token = sessionStorage.getItem(
        "hackarenaJudgeToken"
    );

    try {

        const response = await fetch(
            `${window.HACKARENA_API}/api/judges/evaluation/${submissionId}`,
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to check existing evaluation."
            );
        }

        return data.evaluation;

    } catch (error) {

        console.error("Existing Evaluation Error:", error);

        evaluationStatus.textContent = error.message;

        return null;
    }
}

// ---------------------------------
// PROJECT SELECTION
// ---------------------------------

async function selectProject(submission) {

    if (!judgeData.submissions.includes(submission)) {
        return;
    }

    selectedSubmission = submission;

    const members = Array.isArray(submission.members)
        ? submission.members
            .map((member) =>
                typeof member === "string"
                    ? member
                    : member.name
            )
            .filter(Boolean)
            .join(", ")
        : "";

    const teamDetails = members
        ? `${submission.teamName} — ${members}`
        : submission.teamName;

    setText("detail-team", teamDetails);
    setText("detail-code", submission.problemCode);
    setText("detail-problem", submission.problemTitle);
    setText("detail-project", submission.projectName);

    setText(
        "detail-submission-status",
        submission.submissionStatus || "Not loaded"
    );

    setText(
        "detail-statement",
        submission.problemStatement ||
        "Problem statement not loaded"
    );

    showResource(
        "github-resource",
        submission.githubLink,
        "Open GitHub Repository ↗"
    );

    showResource(
        "demo-resource",
        submission.demoLink,
        "Open Project Demo ↗"
    );

    showResource(
        "ppt-resource",
        submission.presentationUrl,
        "View Presentation ↗"
    );

    document.getElementById("evaluate-selected").disabled = false;

    document.getElementById("selection-notice").textContent =
        `Selected project: ${submission.projectName}`;

    evaluationForm.reset();
    const submitButton = evaluationForm.querySelector(
    'button[type="submit"]'
);

if (submitButton) {
    submitButton.textContent = "Save Evaluation";
}

    evaluationFields.disabled = judgeResultsPublished;

    evaluationStatus.textContent = "Checking evaluation status...";

    updateTotal();

    setText(
        "evaluation-overview-status",
        "Project selected"
    );

    const evaluation = await loadExistingEvaluation(
        submission.submissionId
    );

    if (selectedSubmission !== submission) {
        return;
    }

    if (evaluation) {
        if (submitButton) {
    submitButton.textContent = "Update Evaluation";
}

        submission.evaluationStatus = "evaluated";

        criteria.forEach((criterion) => {

            const savedCriterion = evaluation.criteria.find(
                (item) => item.name === criterion.label
            );

            const input = document.getElementById(
                `score-${criterion.id}`
            );

            if (savedCriterion && input) {
                input.value = savedCriterion.score;
            }
        });

        document.getElementById("feedback").value =
            evaluation.feedback || "";

        updateTotal();

        evaluationFields.disabled = judgeResultsPublished;

        evaluationStatus.textContent =
          `Already evaluated. You can edit the marks and update the evaluation. Score: ${evaluation.totalScore} / ${evaluation.totalMaximum}`;

        document.getElementById("evaluate-selected").disabled = false;

    } else {

        submission.evaluationStatus = "assigned";

        evaluationFields.disabled = judgeResultsPublished;

        evaluationStatus.textContent =
            "This project is ready for evaluation.";

        document.getElementById("evaluate-selected").disabled = false;
    }

    renderProjects();
    updateStatistics();
}

// ---------------------------------
// OPEN EVALUATION
// ---------------------------------

document.getElementById("evaluate-selected")
    .addEventListener("click", () => {

        if (!selectedSubmission) {
            return;
        }

        showPage("evaluation");
    });

// ---------------------------------
// EVALUATION SUBMISSION
// ---------------------------------

evaluationForm.addEventListener("submit", async (event) => {

    event.preventDefault();
if (judgeResultsPublished) {
    evaluationStatus.textContent =
        "Official results published. Evaluation is permanently locked.";
    return;
}
    if (!selectedSubmission) {

        evaluationStatus.textContent =
            "Please select a submitted project first.";

        return;
    }

    updateTotal();

    if (!evaluationForm.reportValidity()) {
        return;
    }

   

    const token = sessionStorage.getItem(
        "hackarenaJudgeToken"
    );

    const criteriaScores = criteria.map((criterion) => {

        const input = document.getElementById(
            `score-${criterion.id}`
        );

        return {
            name: criterion.label,
            score: Number(input.value)
        };
    });

    const feedback =
        document.getElementById("feedback").value.trim();

    const submitButton =
        evaluationForm.querySelector('[type="submit"]');

    if (submitButton) {
        submitButton.disabled = true;
    }

    evaluationStatus.textContent =
        "Saving evaluation...";

    try {

        const response = await fetch(
            `${window.HACKARENA_API}/api/judges/evaluation/${selectedSubmission.submissionId}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({
                    criteria: criteriaScores,
                    feedback: feedback
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
    data.message || `Unable to save evaluation. Status: ${response.status}`
);
        }

        selectedSubmission.evaluationStatus = "evaluated";

       evaluationFields.disabled = judgeResultsPublished;

        document.getElementById("evaluate-selected").disabled = false;

        evaluationStatus.textContent =
            `Evaluation saved successfully! Score: ${data.evaluation.totalScore} / ${data.evaluation.totalMaximum}`;

        judgeData.statistics.completedEvaluations =
            judgeData.submissions.filter(
                (project) =>
                    project.evaluationStatus === "evaluated"
            ).length;

        renderProjects();

        updateStatistics();

    } catch (error) {

        console.error("Evaluation Submission Error:", error);

        evaluationStatus.textContent = error.message;

        } finally {

        if (submitButton) {
            submitButton.disabled = judgeResultsPublished;
        }

    }

});
// ---------------------------------
// LEADERBOARD
// ---------------------------------

const leaderboardList =
    document.getElementById("leaderboard-list");

const leaderboardEmpty =
    document.getElementById("leaderboard-empty");

function renderLeaderboard() {

    leaderboardList.replaceChildren();

    leaderboardEmpty.hidden =
        judgeData.leaderboard.length > 0;

    judgeData.leaderboard.forEach((entry) => {

        const row = document.createElement("tr");

        const values = [
    entry.rank,
    entry.teamName,
    entry.projectTitle,
    `${entry.totalScore} / ${entry.totalMaximum}`
];

        values.forEach((value) => {

            const cell = document.createElement("td");

            cell.textContent = String(value ?? "—");

            row.append(cell);
        });

        leaderboardList.append(row);
    });
}
async function loadLeaderboard() {

    const token = sessionStorage.getItem("hackarenaJudgeToken");

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/leaderboard",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Could not load leaderboard.");
        }

        judgeData.leaderboard = result.leaderboard || [];

        renderLeaderboard();

    } catch (error) {

        console.error("Leaderboard Loading Error:", error);

        leaderboardEmpty.hidden = false;
        leaderboardEmpty.textContent = error.message;
    }
}
// ---------------------------------
// OVERVIEW STATISTICS
// ---------------------------------

function updateStatistics() {

    const stats = judgeData.statistics;

    setText(
        "available-count",
        stats?.availableSubmissions ?? "Not loaded"
    );

    setText(
        "evaluated-count",
        stats?.completedEvaluations ?? "Not loaded"
    );

    setText(
        "evaluation-overview-status",
        stats?.evaluationStatus ?? "Waiting for data"
    );
}

// ---------------------------------
// LOGOUT
// ---------------------------------

document.getElementById("logout-button")
    .addEventListener("click", () => {

        sessionStorage.removeItem("hackarenaJudgeToken");

        sessionStorage.removeItem("hackarenaJudge");

        window.location.replace("./index.html");
    });

// ---------------------------------
// INITIAL SETUP
// ---------------------------------

async function initializeJudge() {
    showPage("overview");

    evaluationFields.disabled = true;

    document.getElementById("evaluate-selected")
        .disabled = true;

    renderCriteria();

    renderProjects();

    renderLeaderboard();

    updateStatistics();

    await loadLeaderboard();
}

// ---------------------------------
// VERIFY JUDGE LOGIN
// ---------------------------------

async function verifyJudgeLogin() {

    const token = sessionStorage.getItem(
        "hackarenaJudgeToken"
    );

    if (!token) {

        window.location.replace("./index.html");

        return;
    }

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/auth/judge/me",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            sessionStorage.removeItem("hackarenaJudgeToken");

            sessionStorage.removeItem("hackarenaJudge");

            window.location.replace("./index.html");

            return;
        }

        if (!response.ok) {
            throw new Error("Judge verification failed.");
        }

        const result = await response.json();

        if (
            !result.success ||
            result.judge?.role !== "judge"
        ) {

            sessionStorage.removeItem("hackarenaJudgeToken");

            sessionStorage.removeItem("hackarenaJudge");

            window.location.replace("./index.html");

            return;
        }

        sessionStorage.setItem(
            "hackarenaJudge",
            JSON.stringify(result.judge)
        );

        initializeJudge();

        await loadEvaluationCriteria();

        await loadAssignedProjects();

        document.documentElement.style.visibility = "visible";

    } catch (error) {

        console.error("Judge Verification Error:", error);

        document.body.replaceChildren();

        const message = document.createElement("p");

        message.textContent =
            "Cannot verify Judge login. Check backend server and refresh.";

        document.body.append(message);

        document.documentElement.style.visibility = "visible";
    }
}

// ---------------------------------
// START JUDGE DASHBOARD
// ---------------------------------

verifyJudgeLogin();


// JUDGE LIVE HACKATHON TIMER

(() => {

    let timerData = null;
    let serverOffset = 0;

    async function loadJudgeTimer() {
        try {
            const response = await fetch(
                window.HACKARENA_API + "/api/event/timer",
                { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error("Timer unavailable");
            }

            timerData = data.timer;

            serverOffset =
                timerData.serverTime - Date.now();

            displayJudgeTimer();

        } catch (error) {
            timerData = null;

            document.getElementById("judge-countdown")
                .textContent = "--:--:--";

            document.getElementById("judge-countdown-status")
                .textContent = "Timer not connected";
        }
    }

    function displayJudgeTimer() {

        if (!timerData) return;

        const value =
            document.getElementById("judge-countdown");

        const status =
            document.getElementById("judge-countdown-status");

        let remaining = timerData.remaining;

        if (timerData.status === "running") {

            remaining = Math.max(
                0,
                Math.ceil(
                    (
                        new Date(timerData.endAt).getTime()
                        - Date.now()
                        - serverOffset
                    ) / 1000
                )
            );
        }

        const hours = String(
            Math.floor(remaining / 3600)
        ).padStart(2, "0");

        const minutes = String(
            Math.floor((remaining % 3600) / 60)
        ).padStart(2, "0");

        const seconds = String(
            remaining % 60
        ).padStart(2, "0");

        value.textContent =
            `${hours}:${minutes}:${seconds}`;

        if (timerData.status === "idle") {

            value.textContent = "--:--:--";
            status.textContent =
                "Waiting for organizer to start";

        } else if (remaining === 0) {

            status.textContent = "Hackathon Time Over";

        } else if (timerData.status === "paused") {

            status.textContent = "Timer Paused";

        } else {

            status.textContent = "Hackathon in Progress";
        }
    }

    loadJudgeTimer();

    setInterval(loadJudgeTimer, 3000);
    setInterval(displayJudgeTimer, 1000);

})();

// ---------------------------------
// LIVE JUDGE ANNOUNCEMENTS
// ---------------------------------

async function loadJudgeAnnouncements() {

    const token =
        sessionStorage.getItem("hackarenaJudgeToken");

    if (!token) return;

    const list =
        document.getElementById("judge-announcements-list");

    const empty =
        document.getElementById("judge-announcements-empty");

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/announcements/judge",
            {
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message);
        }

        updateJudgeUnreadBadge(data.announcements);

        list.replaceChildren();

        empty.hidden = data.announcements.length > 0;

        if (!data.announcements.length) {
            empty.textContent =
                "No announcements published yet.";
        }

        data.announcements.forEach(announcement => {

            const card = document.createElement("article");

            card.className = "empty-state";
            card.style.marginBottom = "15px";
            card.style.textAlign = "left";

            const color =
                announcement.priority === "urgent"
                    ? "#dc2626"
                    : announcement.priority === "important"
                    ? "#d97706"
                    : "#16a34a";

            card.style.borderLeft = "4px solid " + color;

            const priority = document.createElement("strong");

            priority.textContent =
                announcement.priority.toUpperCase();

            priority.style.color = color;

            const title = document.createElement("h3");

            title.textContent = announcement.title;

            const message = document.createElement("p");

            message.textContent = announcement.message;
            message.style.whiteSpace = "pre-wrap";

            const date = document.createElement("small");

            date.textContent =
                new Date(announcement.createdAt)
                    .toLocaleString("en-IN");

            card.append(priority, title, message, date);

            list.append(card);

        });

    } catch (error) {

        empty.hidden = false;

        empty.textContent =
            "Unable to load announcements.";

        console.error(
            "Judge Announcement Error:",
            error
        );

    }

}

loadJudgeAnnouncements();

setInterval(loadJudgeAnnouncements, 5000);

// ---------------------------------
// JUDGE UNREAD ANNOUNCEMENT TRACKING
// ---------------------------------

let judgeAnnouncementIds = [];

function updateJudgeUnreadBadge(announcements) {

    const token =
        sessionStorage.getItem("hackarenaJudgeToken");

    if (!token) return;

    let judgeId;

    try {

        const payload = token.split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const decoded = JSON.parse(atob(payload));

        judgeId = decoded.id ||
                  decoded.userId ||
                  decoded.sub ||
                  decoded._id;

    } catch (error) {
        return;
    }

    if (!judgeId) return;

    const storageKey =
        "hackarenaJudgeReadAnnouncements_" + judgeId;

    const badge =
        document.getElementById("judge-unread-badge");

    const announcementsPage =
        document.getElementById("announcements");

    judgeAnnouncementIds =
        announcements.map(item => item._id);

    let readIds = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
    );

    if (!announcementsPage.hidden) {

        readIds = [...new Set([
            ...readIds,
            ...judgeAnnouncementIds
        ])];

        localStorage.setItem(
            storageKey,
            JSON.stringify(readIds)
        );

    }

    const unreadCount =
        judgeAnnouncementIds.filter(
            id => !readIds.includes(id)
        ).length;

    badge.textContent = unreadCount;
    badge.hidden = unreadCount === 0;

}

document.querySelector('[data-page="announcements"]')
    .addEventListener("click", () => {

        updateJudgeUnreadBadge(
            judgeAnnouncementIds.map(id => ({
                _id: id
            }))
        );

    });

    // OFFICIAL RESULTS STATUS

async function loadJudgeResultsStatus() {

    const status = document.getElementById(
        "judge-results-status"
    );

    const date = document.getElementById(
        "judge-results-date"
    );

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/results",
            { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message);
        }


          judgeResultsPublished =
    judgeResultsPublished || data.resultsPublished === true;

if (judgeResultsPublished) {

    evaluationFields.disabled = true;

    evaluationStatus.textContent =
        "Official results published. Evaluation is permanently locked.";

            status.textContent = "Official Results Published";
            status.style.color = "#16a34a";

            date.textContent = "Published on: " +
                new Date(data.resultsPublishedAt)
                    .toLocaleString("en-IN");

        } else {

            status.textContent = "Results Not Published";
            status.style.color = "#d97706";

            date.textContent = "";

        }

    } catch (error) {

        status.textContent = "Unable to load results status";
        status.style.color = "#dc2626";

    }

}

loadJudgeResultsStatus();

setInterval(loadJudgeResultsStatus, 5000);