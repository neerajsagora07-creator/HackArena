"use strict";

// -------------------------------
// DASHBOARD NAVIGATION
// -------------------------------

const pageTitles = {
  overview: "Overview",
  team: "My Team",
  problems: "Problem Statements",
  matching: "Smart Matching",
  submission: "Submission",
  updates: "Announcements & Notifications",
  leaderboard: "Leaderboard"
};

const pages = document.querySelectorAll(".page");
const navigationButtons = document.querySelectorAll("[data-page]");
const pageTitle = document.getElementById("page-title");

function showPage(pageName) {
  if (!Object.prototype.hasOwnProperty.call(pageTitles, pageName)) {
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

// -------------------------------
// SMART MATCHING FORM
// -------------------------------

const matchingForm = document.getElementById("matching-form");
const matchingStatus = document.getElementById("matching-status");

matchingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const skills = document.getElementById("skills").value.trim();
  const interests = document.getElementById("interests").value.trim();

  if (!skills || !interests) {
    matchingStatus.textContent =
      "Please enter your team's skills and interests.";
    return;
  }

  matchingStatus.textContent =
    "No organizer-provided problem data is connected yet, so " +
    "recommendations cannot be calculated. Your input has not " +
    "been saved to a server.";
});

// -------------------------------
// PRESENTATION SELECTION
// -------------------------------

const presentationInput = document.getElementById("presentation");
const fileStatus = document.getElementById("file-status");

presentationInput.addEventListener("change", () => {
  const file = presentationInput.files[0];

  if (!file) {
    fileStatus.textContent =
      "No file selected. Allowed formats and maximum size " +
      "are not finalized.";
    return;
  }

  const sizeInMB = file.size / (1024 * 1024);

  fileStatus.textContent =
    `Selected: ${file.name} (${sizeInMB.toFixed(2)} MB). ` +
    "Not uploaded. Format and size acceptance are not checked yet.";
});

// -------------------------------
// SUBMISSION READINESS
// -------------------------------

const submissionForm = document.getElementById("submission-form");
const readinessResult = document.getElementById("readiness-result");

function isWebAddress(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getMissingItems() {
  const missing = [];

  const projectName = document
    .getElementById("project-name")
    .value.trim();

  const githubLink = document
    .getElementById("github-link")
    .value.trim();

  const demoLink = document
    .getElementById("demo-link")
    .value.trim();

  if (!projectName) {
    missing.push("Project name");
  }

  if (!isWebAddress(githubLink)) {
    missing.push("A valid GitHub repository URL starting with http or https");
  }

  if (!isWebAddress(demoLink)) {
    missing.push("A valid demo URL starting with http or https");
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

document.getElementById("check-readiness").addEventListener("click", () => {
  const missing = getMissingItems();

  if (missing.length) {
    displayMissingItems(missing);
    return;
  }

  readinessResult.textContent =
    "The visible fields are filled and a file is selected. " +
    "Links have not been opened or verified, and presentation format " +
    "and size have not been validated. The backend will check " +
    "account access, selected problem and submission deadline.";
});

submissionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const missing = getMissingItems();

  if (missing.length) {
    displayMissingItems(missing);
    return;
  }

  readinessResult.textContent =
    "Final submission is not connected yet. Nothing has been " +
    "uploaded or saved. The backend must verify your team, " +
    "selected problem and applicable deadline before accepting it.";
});

// This preview does not start an event timer.
// Authentication, persistent storage, file uploads, deadline checks,
// recommendations and scores must come from the backend.
