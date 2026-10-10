
"use strict";

// ---------------------------------
// HACKARENA PARTICIPANT DASHBOARD
// ---------------------------------

// ---------------------------------
// NAVIGATION
// ---------------------------------

const pageTitles = {
  overview: "Overview",
  team: "My Team",
  problems: "Problem Statements",
  matching: "Smart Matching",
  submission: "Submission",
  updates: "Announcements & Notifications",
  leaderboard: "Leaderboard",
  achievements: "Achievements & Badges"
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
// PARTICIPANT DATA
// ---------------------------------

// All live data must eventually come
// from the authenticated backend.

const participantState = {
  team: null,
  teamCapacity: null,
  selectedProblem: null,
  problems: [],
  currentStage: null,
  submissionStatus: "Not loaded",

  achievements: {
    registration: null,
    problem: null,
    submission: null
  }
};

// ---------------------------------
// TEAM CAPACITY
// ---------------------------------

function updateTeamCapacity() {

  const element =
    document.getElementById("team-capacity");

  if (
    Number.isInteger(participantState.teamCapacity) &&
    participantState.teamCapacity > 0
  ) {
    element.textContent =
      `${participantState.teamCapacity} teams`;
  } else {
    element.textContent = "Not loaded";
  }
}

// ---------------------------------
// MY TEAM DETAILS
// ---------------------------------

function updateTeamDetails() {

  const team = participantState.team;

  if (!team) {
    return;
  }

  document.getElementById("detail-team-name")
    .textContent = team.name || "Not loaded";

  document.getElementById("detail-team-id")
    .textContent = team.teamId || "Not loaded";

  document.getElementById("detail-leader-name")
    .textContent = team.leaderName || "Not loaded";

  document.getElementById("detail-leader-email")
    .textContent = team.leaderEmail || "Not loaded";

  document.getElementById("detail-member-limit")
    .textContent = team.memberLimit ?? "Not loaded";

  const memberList =
    document.getElementById("team-members-list");

  memberList.replaceChildren();

  if (Array.isArray(team.members)) {

    team.members.forEach((member) => {

      const item = document.createElement("li");

      item.textContent =
        typeof member === "string"
          ? member
          : member.name || "Unnamed member";

      memberList.append(item);
    });
  }

  document.getElementById("team-members").hidden =
    memberList.children.length === 0;

  document.getElementById("team-empty").hidden = true;
}

// ---------------------------------
// SELECTED PROBLEM
// ---------------------------------

function updateSelectedProblem() {

  const element =
    document.getElementById("selected-problem");

  element.textContent =
    participantState.selectedProblem?.title ||
    "Not loaded";
}

// ---------------------------------
// PROBLEM LIST
// ---------------------------------

function renderProblems() {

  const list = document.getElementById("problem-list");
  const empty = document.getElementById("problems-empty");

  list.replaceChildren();

  const problems = participantState.problems;

  empty.hidden = problems.length > 0;

  problems.forEach((problem) => {

    const card = document.createElement("article");
    card.className = "problem-card";

    const title = document.createElement("h3");
    title.textContent = problem.title;

    const description = document.createElement("p");
    description.textContent =
      problem.statement || "";

    const capacity = document.createElement("p");

    capacity.textContent =
      `Available slots: ${
        problem.availableSlots ?? "Not loaded"
      }`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.textContent = "Select Problem";

    // Problem selection must be saved
    // and capacity-checked by the server.
    button.disabled = true;
    button.title =
      "Problem selection requires backend connection";

    card.append(title, description, capacity, button);
    list.append(card);
  });
}

// ---------------------------------
// SMART MATCHING
// ---------------------------------

const matchingForm =
  document.getElementById("matching-form");

const matchingStatus =
  document.getElementById("matching-status");

matchingForm.addEventListener("submit", (event) => {

  event.preventDefault();

  const skills =
    document.getElementById("skills").value.trim();

  const interests =
    document.getElementById("interests").value.trim();

  if (!skills || !interests) {

    matchingStatus.textContent =
      "Please enter your team's skills and interests.";

    return;
  }

  matchingStatus.textContent =
    "Problem matching is not connected yet. " +
    "The backend will compare your skills and interests " +
    "with available problem requirements. " +
    "No recommendation has been generated or saved.";
});

// ---------------------------------
// PRESENTATION FILE SELECTION
// ---------------------------------

const presentationInput =
  document.getElementById("presentation");

const fileStatus =
  document.getElementById("file-status");

presentationInput.addEventListener("change", () => {

  const file = presentationInput.files[0];

  if (!file) {

    fileStatus.textContent =
      "No file selected. Allowed formats and " +
      "maximum size are not finalized.";

    return;
  }

  const sizeInMB = file.size / (1024 * 1024);

  fileStatus.textContent =
    `Selected: ${file.name} ` +
    `(${sizeInMB.toFixed(2)} MB). ` +
    "Not uploaded. File size and format " +
    "acceptance are not checked yet.";
});

// ---------------------------------
// SUBMISSION READINESS CHECKER
// ---------------------------------

const submissionForm =
  document.getElementById("submission-form");

const readinessResult =
  document.getElementById("readiness-result");

function isWebAddress(value) {

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );

  } catch {
    return false;
  }
}

function getMissingItems() {

  const missing = [];

  const projectName =
    document.getElementById("project-name")
      .value.trim();

  const githubLink =
    document.getElementById("github-link")
      .value.trim();

  const demoLink =
    document.getElementById("demo-link")
      .value.trim();

  if (!projectName) {
    missing.push("Project name");
  }

  if (!isWebAddress(githubLink)) {
    missing.push("A valid GitHub repository URL");
  }

  if (!isWebAddress(demoLink)) {
    missing.push("A valid demo URL");
  }

  if (!presentationInput.files.length) {
    missing.push("Project presentation");
  }

  return missing;
}

function displayMissingItems(missing) {

  readinessResult.replaceChildren();

  const heading = document.createElement("strong");
  heading.textContent = "Complete these items:";

  const list = document.createElement("ul");

  missing.forEach((item) => {

    const listItem = document.createElement("li");

    listItem.textContent = item;
    list.append(listItem);
  });

  readinessResult.append(heading, list);
}

document.getElementById("check-readiness")
  .addEventListener("click", () => {

    const missing = getMissingItems();

    if (missing.length) {
      displayMissingItems(missing);
      return;
    }

    readinessResult.textContent =
      "The visible fields are filled and " +
      "a presentation file is selected. " +
      "The backend still needs to verify the team, " +
      "selected problem, deadline, links and file rules.";
  });

// ---------------------------------
// FINAL SUBMISSION
// ---------------------------------

submissionForm.addEventListener("submit", (event) => {

  event.preventDefault();

  const missing = getMissingItems();

  if (missing.length) {
    displayMissingItems(missing);
    return;
  }

  readinessResult.textContent =
    "Final submission is not connected yet. " +
    "No project information or presentation " +
    "has been uploaded or saved. " +
    "The server will verify authentication, " +
    "problem selection and the deadline.";
});

// ---------------------------------
// SUBMISSION STATUS
// ---------------------------------

function updateSubmissionStatus() {

  const status =
    participantState.submissionStatus;

  document.getElementById("submission-status-value")
    .textContent = status;

  document.getElementById("submission-detail-status")
    .textContent = status;
}

// ---------------------------------
// PROGRESS TRACKER
// ---------------------------------

const stages = [
  "Registration",
  "Team",
  "Problem",
  "Development",
  "Submission",
  "Judging",
  "Results"
];

function updateProgressTracker() {

  const currentStage =
    participantState.currentStage;

  const currentIndex = stages.indexOf(currentStage);

  const stageElements =
    document.querySelectorAll(".journey li");

  stageElements.forEach((item, index) => {

    item.classList.remove("completed", "current");

    item.removeAttribute("aria-current");

    if (currentIndex === -1) {
      return;
    }

    if (index < currentIndex) {
      item.classList.add("completed");
    }

    if (index === currentIndex) {
      item.classList.add("current");
      item.setAttribute("aria-current", "step");
    }
  });

  const description =
    document.getElementById("progress-description");

  const status =
    document.getElementById("progress-status");

  if (currentIndex === -1) {

    description.textContent =
      "Your current stage will appear " +
      "after your account is connected.";

    status.textContent = "Progress not loaded";

    return;
  }

  description.textContent =
    `Current stage: ${currentStage}`;

  status.textContent =
    `${currentIndex} of ${stages.length} ` +
    "previous stages completed";
}

// ---------------------------------
// ACHIEVEMENTS AND BADGES
// ---------------------------------

function updateAchievements() {

  const badges = {
    registration: "badge-registration",
    problem: "badge-problem",
    submission: "badge-submission"
  };

  Object.entries(badges).forEach(([name, elementId]) => {

    const element =
      document.getElementById(elementId);

    const unlocked =
      participantState.achievements[name];

    element.classList.remove("unlocked");

    if (unlocked === true) {

      element.textContent = "Unlocked";
      element.classList.add("unlocked");

    } else if (unlocked === false) {

      element.textContent = "Locked";

    } else {

      element.textContent = "Not verified";
    }
  });
}

// ---------------------------------
// LOGOUT
// ---------------------------------

const logoutButton =
  document.getElementById("logout-button");

const logoutStatus =
  document.getElementById("logout-status");

logoutButton.addEventListener("click", () => {

  // No real authentication session exists yet.
  // The backend must invalidate the session
  // before redirecting to the login page.

  logoutStatus.textContent =
    "Logout is not connected yet. " +
    "No session has been ended.";
});

// ---------------------------------
// INITIAL DASHBOARD RENDER
// ---------------------------------

function initializeDashboard() {

  showPage("overview");

  updateTeamCapacity();
  updateTeamDetails();
  updateSelectedProblem();
  renderProblems();

  updateSubmissionStatus();
  updateProgressTracker();
  updateAchievements();
}

initializeDashboard();

// ---------------------------------
// BACKEND INTEGRATION NOTES
// ---------------------------------

// Planned backend responsibilities:
//
// 1. Verify the participant login.
// 2. Protect participant dashboard access.
// 3. Load team and organizer event settings.
// 4. Load available problem statements.
// 5. Save selected problem with capacity checks.
// 6. Calculate Smart Problem Matching results.
// 7. Load progress and verified achievements.
// 8. Accept official project submissions.
// 9. Enforce submission deadline lock.
// 10. Load notifications and leaderboard.
// 11. End authenticated sessions on logout.
//
// No fake authentication, scores,
// unlocked badges or submissions are created.
