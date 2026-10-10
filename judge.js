
"use strict";

// ---------------------------------
// HACKARENA JUDGE DASHBOARD
// FRONTEND ONLY
// ---------------------------------

// ---------------------------------
// NAVIGATION
// ---------------------------------

const pageTitles = {
  overview: "Overview",
  projects: "Submitted Projects",
  evaluation: "Evaluation",
  leaderboard: "Leaderboard"
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

// Backend will supply authorized
// projects, scores and leaderboard.
// No fake submissions are created.

const judgeData = {
  submissions: [],
  leaderboard: [],
  statistics: null
};

let selectedSubmission = null;

// ---------------------------------
// JUDGING CRITERIA
// ---------------------------------

// Current agreed HackArena rubric.
// Backend must eventually provide
// the official event rubric.

let criteria = [
  {
    id: "innovation",
    label: "Innovation",
    maximum: 25
  },
  {
    id: "technical",
    label: "Technical Implementation",
    maximum: 25
  },
  {
    id: "impact",
    label: "Impact",
    maximum: 20
  },
  {
    id: "uiux",
    label: "UI/UX",
    maximum: 15
  },
  {
    id: "presentation",
    label: "Presentation",
    maximum: 15
  }
];

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

    const input =
      document.getElementById(
        `score-${criterion.id}`
      );

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

function selectProject(submission) {

  // Only submissions returned for an
  // authorized judge should be selectable.
  // The backend must enforce this rule.

  if (
    !judgeData.submissions.includes(submission)
  ) {
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

  document.getElementById("evaluate-selected")
    .disabled = false;

  document.getElementById("selection-notice")
    .textContent =
    `Selected project: ${submission.projectName}`;

  evaluationForm.reset();

  // UI activation only.
  // Actual saving still requires backend.
  evaluationFields.disabled = false;

  evaluationStatus.textContent = "";
  updateTotal();

  setText(
    "evaluation-overview-status",
    "Project selected"
  );
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

evaluationForm.addEventListener("submit", (event) => {

  event.preventDefault();

  if (!selectedSubmission) {

    evaluationStatus.textContent =
      "Please select a submitted project first.";

    return;
  }

  updateTotal();

  if (!evaluationForm.reportValidity()) {
    return;
  }

  let total = 0;

  criteria.forEach((criterion) => {

    const value = Number(
      document.getElementById(
        `score-${criterion.id}`
      ).value
    );

    total += value;
  });

  const feedback =
    document.getElementById("feedback").value.trim();

  evaluationStatus.textContent =
    `Frontend validation completed. ` +
    `Calculated score: ${Number(total.toFixed(2))}. ` +
    (feedback
      ? "Feedback entered. "
      : "No feedback entered. ") +
    "No evaluation has been saved. " +
    "Backend integration is required.";

  // Do not modify real evaluation status,
  // leaderboard or project scores locally.
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
      entry.projectName,
      entry.score
    ];

    values.forEach((value) => {

      const cell = document.createElement("td");

      cell.textContent = String(value ?? "—");
      row.append(cell);
    });

    leaderboardList.append(row);
  });
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

    document.getElementById("logout-status")
      .textContent =
      "Logout is not connected yet. " +
      "No authenticated session has been ended.";

    // Real logout will call the backend,
    // invalidate the session and then
    // redirect to the login page.
  });

// ---------------------------------
// INITIAL SETUP
// ---------------------------------

function initializeJudge() {

  showPage("overview");

  // No authenticated submission
  // is available on this frontend yet.
  evaluationFields.disabled = true;

  document.getElementById("evaluate-selected")
    .disabled = true;

  renderCriteria();
  renderProjects();
  renderLeaderboard();
  updateStatistics();
}

initializeJudge();

// ---------------------------------
// BACKEND INTEGRATION NOTES
// ---------------------------------

// The real backend must:
//
// 1. Authenticate the judge.
// 2. Enforce judge-only dashboard access.
// 3. Load authorized submissions.
// 4. Load selected project details.
// 5. Provide the official judging rubric.
// 6. Validate scores on the server.
// 7. Store judge scores and feedback.
// 8. Return real evaluation status.
// 9. Calculate official leaderboard ranks.
// 10. Invalidate the session on logout.
//
// No fake project, score or result is created.
