
"use strict";

document.documentElement.style.visibility = "hidden";

// ---------------------------------
// HACKARENA PARTICIPANT DASHBOARD
// ---------------------------------

// NAVIGATION

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

// ---------------------------------
// PARTICIPANT DATA
// ---------------------------------

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

  const element = document.getElementById("team-capacity");

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

  const selectedProblemElement =
    document.getElementById("detail-selected-problem");

  if (selectedProblemElement) {
    selectedProblemElement.textContent =
      getProblemTitle(participantState.selectedProblem) ||
      "Not selected";
  }

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

function getSelectedProblemId(problem) {

  if (!problem) {
    return null;
  }

  if (typeof problem === "string") {
    return problem;
  }

  return problem.id || problem._id || null;
}

function getProblemId(problem) {
  return getSelectedProblemId(problem);
}

function getProblemTitle(problem) {

  if (!problem || typeof problem === "string") {
    return "";
  }

  return problem.title || problem.name || "";
}

function updateSelectedProblem() {

  const selected = participantState.selectedProblem;

  const problemText = selected
    ? `${selected.code ? selected.code + " - " : ""}${getProblemTitle(selected) || "Selected"}`
    : "Not selected";

  const overviewElement = document.getElementById(
    "selected-problem"
  );

  if (overviewElement) {
    overviewElement.textContent = problemText;
  }

  const teamElement = document.getElementById(
    "detail-selected-problem"
  );

  if (teamElement) {
    teamElement.textContent = problemText;
  }
}


// ---------------------------------
// SELECT PROBLEM
// ---------------------------------

async function selectProblem(problem, button) {

  const token = sessionStorage.getItem(
    "hackarenaTeamToken"
  );

  if (!token) {
    alert("Please login again.");
    return;
  }

  if (participantState.selectedProblem) {
    alert("Your team has already selected a problem. Cancel the current selection first.");
    return;
  }

  const problemId = getProblemId(problem);

  if (!problemId) {
    alert("Problem ID is missing. Please refresh and try again.");
    return;
  }

  button.disabled = true;
  button.textContent = "Selecting...";

  try {

    const response = await fetch(
      `http://127.0.0.1:5000/api/problems/${problemId}/select`,
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Problem selection failed."
      );
    }

    const selected = result.problem ||
      result.selectedProblem ||
      result.team?.selectedProblem;

    participantState.selectedProblem = {
      id: getProblemId(selected) || problemId,
      code: selected?.code || problem.code || "",
      title: getProblemTitle(selected) || problem.title || "Selected Problem"
    };

    if (participantState.team) {
      participantState.team.selectedProblem =
        participantState.selectedProblem;
    }

    participantState.achievements.problem = true;

    updateSelectedProblem();
    updateAchievements();

    await loadAvailableProblems();

    alert("Problem selected successfully!");

  } catch (error) {

    alert(error.message);

    button.disabled = false;
    button.textContent = "Select Problem";
  }
}


// ---------------------------------
// CANCEL SELECTED PROBLEM
// ---------------------------------

async function cancelProblemSelection(button) {

  const token = sessionStorage.getItem(
    "hackarenaTeamToken"
  );

  if (!token) {
    alert("Please login again.");
    return;
  }

  const problemId = getProblemId(
    participantState.selectedProblem
  );

  if (!problemId) {
    alert("No problem is currently selected.");
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to cancel your selected problem? You can select another published problem afterward."
  );

  if (!confirmed) {
    return;
  }

  button.disabled = true;
  button.textContent = "Cancelling...";

  try {

    const response = await fetch(
      `http://127.0.0.1:5000/api/problems/${problemId}/cancel`,
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not cancel problem selection."
      );
    }

    participantState.selectedProblem = null;

    if (participantState.team) {
      participantState.team.selectedProblem = null;
    }

    participantState.achievements.problem = false;

    updateSelectedProblem();
    updateTeamDetails();
    updateAchievements();

    await loadAvailableProblems();

    alert(
      "Selection cancelled successfully! You can now select another problem."
    );

  } catch (error) {

    alert(error.message);

    button.disabled = false;
    button.textContent = "Cancel Selection";
  }
}


// ---------------------------------
// RENDER PROBLEM STATEMENTS
// ---------------------------------

function renderProblems() {

  const list = document.getElementById("problem-list");
  const empty = document.getElementById("problems-empty");

  list.replaceChildren();

  const problems = participantState.problems;
  const selectedProblemId = getProblemId(
    participantState.selectedProblem
  );

  empty.hidden = problems.length > 0;

  problems.forEach((problem) => {

    const card = document.createElement("article");
    card.className = "problem-card";

    const title = document.createElement("h3");
    title.textContent = problem.title || "Untitled Problem";

    const code = document.createElement("p");
    code.textContent = problem.code || "";

    const description = document.createElement("p");
    description.textContent = problem.statement || "";

    const capacity = document.createElement("p");
    capacity.textContent =
      `Available slots: ${problem.availableSlots ?? "Not loaded"}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";

    const isSelected =
      selectedProblemId &&
      String(selectedProblemId) === String(getProblemId(problem));

    if (isSelected) {

      button.textContent = "Selected";
      button.disabled = true;

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "button secondary";
      cancelButton.textContent = "Cancel Selection";

      cancelButton.addEventListener("click", () => {
        cancelProblemSelection(cancelButton);
      });

      card.append(
        title,
        code,
        description,
        capacity,
        button,
        cancelButton
      );

    } else {

      if (selectedProblemId) {

        button.textContent = "Already Selected";
        button.disabled = true;

      } else if (problem.availableSlots === 0) {

        button.textContent = "Full";
        button.disabled = true;

      } else {

        button.textContent = "Select Problem";
        button.disabled = false;

        button.addEventListener("click", () => {
          selectProblem(problem, button);
        });
      }

      card.append(
        title,
        code,
        description,
        capacity,
        button
      );
    }

    list.append(card);
  });
}


// ---------------------------------
// LOAD PUBLISHED PROBLEMS
// ---------------------------------

function setProblemEmptyMessage(heading, message) {

  const empty = document.getElementById("problems-empty");

  empty.replaceChildren();

  const title = document.createElement("h3");
  title.textContent = heading;

  const description = document.createElement("p");
  description.textContent = message;

  empty.append(title, description);
  empty.hidden = false;
}

async function loadAvailableProblems() {

  const empty = document.getElementById("problems-empty");

  empty.hidden = false;

  setProblemEmptyMessage(
    "Loading Problems...",
    "Please wait while published problem statements are loaded."
  );

  try {

    const response = await fetch(
      "http://127.0.0.1:5000/api/problems",
      {
        method: "GET",
        cache: "no-store"
      }
    );

    const result = await response.json();

    if (
      !response.ok ||
      !result.success ||
      !Array.isArray(result.problems)
    ) {
      throw new Error(
        result.message || "Could not load published problems."
      );
    }

    participantState.problems = result.problems
      .filter((problem) => problem.isPublished !== false)
      .map((problem) => {

        const capacity = Number(problem.capacity);
        const occupied = Number(problem.occupied);

        const availableSlots = Number.isFinite(
          Number(problem.availableSlots)
        )
          ? Number(problem.availableSlots)
          : (
              Number.isFinite(capacity) &&
              Number.isFinite(occupied)
                ? Math.max(0, capacity - occupied)
                : null
            );

        return {
          ...problem,
          availableSlots
        };
      });

    if (participantState.selectedProblem) {

      const selectedProblemId =
        getProblemId(participantState.selectedProblem);

      const matchingProblem = participantState.problems.find(
        (problem) =>
          String(getProblemId(problem)) === String(selectedProblemId)
      );

      if (
        matchingProblem &&
        !getProblemTitle(participantState.selectedProblem)
      ) {
        participantState.selectedProblem = {
          ...matchingProblem
        };
      }
    }

    updateSelectedProblem();
    updateTeamDetails();
    renderProblems();

    if (participantState.problems.length === 0) {
      setProblemEmptyMessage(
        "No Published Problems",
        "The organizer has not published any problem statements yet."
      );
    }

  } catch (error) {

    console.error("Problem Loading Error:", error);

    participantState.problems = [];
    renderProblems();

    setProblemEmptyMessage(
      "Could Not Load Problems",
      error.message + " Please check the backend server and refresh."
    );
  }
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
// PROJECT SUBMISSION INTEGRATION
// ---------------------------------

const presentationInput = document.getElementById("presentation");
const fileStatus = document.getElementById("file-status");
const submissionForm = document.getElementById("submission-form");
const readinessResult = document.getElementById("readiness-result");

let existingPresentation = null;

function getSubmissionToken() {
    return sessionStorage.getItem("hackarenaTeamToken");
}

function isWebAddress(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function getSubmissionFormData() {
    const data = new FormData();

    data.append("projectTitle",
        document.getElementById("project-name").value.trim());

    data.append("description",
        document.getElementById("project-description").value.trim());

    data.append("githubUrl",
        document.getElementById("github-link").value.trim());

    data.append("liveDemoUrl",
        document.getElementById("demo-link").value.trim());

    data.append("technologies",
        document.getElementById("technologies").value.trim());

    if (presentationInput.files.length) {
        data.append("presentation", presentationInput.files[0]);
    }

    return data;
}

function getMissingItems() {
    const missing = [];

    const title = document.getElementById("project-name").value.trim();
    const description = document.getElementById("project-description").value.trim();
    const github = document.getElementById("github-link").value.trim();
    const demo = document.getElementById("demo-link").value.trim();

    if (!title) missing.push("Project name");
    if (!description) missing.push("Project description");
    if (!github || !isWebAddress(github)) missing.push("Valid GitHub URL");

    if (demo && !isWebAddress(demo)) {
        missing.push("Valid Live Demo URL");
    }

    if (!presentationInput.files.length &&
        !existingPresentation?.fileName) {
        missing.push("Project presentation");
    }

    return missing;
}

function showSubmissionMessage(message, success = false) {
    readinessResult.textContent = message;
    readinessResult.style.color = success ? "green" : "red";
}

function validatePresentationFile() {
    const file = presentationInput.files[0];

    if (!file) return true;

    const extension = file.name.split(".").pop().toLowerCase();
    const allowed = ["pdf", "ppt", "pptx"];

    if (!allowed.includes(extension)) {
        showSubmissionMessage("Only PDF, PPT and PPTX files are allowed.");
        presentationInput.value = "";
        return false;
    }

    if (file.size > 10 * 1024 * 1024) {
        showSubmissionMessage("Presentation must be 10 MB or smaller.");
        presentationInput.value = "";
        return false;
    }

    fileStatus.textContent =
        "Selected: " + file.name + " (" +
        (file.size / (1024 * 1024)).toFixed(2) + " MB)";

    return true;
}

presentationInput.addEventListener("change", validatePresentationFile);

// SAVE DRAFT

document.getElementById("save-draft").addEventListener("click", async () => {
    const token = getSubmissionToken();

    if (!token) {
        showSubmissionMessage("Please login again.");
        return;
    }

    if (!participantState.selectedProblem) {
        showSubmissionMessage("Please select a problem first.");
        return;
    }

    if (!validatePresentationFile()) return;

    const button = document.getElementById("save-draft");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/submissions/draft",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token
                },
                body: getSubmissionFormData()
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Draft could not be saved.");
        }

        showSubmissionMessage("Draft saved successfully!", true);
        await loadMySubmission();

    } catch (error) {
        showSubmissionMessage(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Save Draft";
    }
});

// CHECK READINESS

document.getElementById("check-readiness").addEventListener("click", () => {
    if (!validatePresentationFile()) return;

    const missing = getMissingItems();

    if (missing.length) {
        showSubmissionMessage("Please complete: " + missing.join(", "));
        return;
    }

    showSubmissionMessage(
        "All required details are ready. You can now submit your project.",
        true
    );
});

// FINAL SUBMISSION

submissionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = getSubmissionToken();

    if (!token) {
        showSubmissionMessage("Please login again.");
        return;
    }

    if (!participantState.selectedProblem) {
        showSubmissionMessage("Please select a problem first.");
        return;
    }

    if (!validatePresentationFile()) return;

    const missing = getMissingItems();

    if (missing.length) {
        showSubmissionMessage("Please complete: " + missing.join(", "));
        return;
    }

    const button = document.getElementById("final-submit");
    button.disabled = true;
    button.textContent = "Submitting...";

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/submissions",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token
                },
                body: getSubmissionFormData()
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Submission failed.");
        }

        showSubmissionMessage("Project submitted successfully!", true);

        await loadMySubmission();

        participantState.achievements.submission = true;
        participantState.currentStage = "Submission";

        updateAchievements();
        updateProgressTracker();

        submissionForm.querySelectorAll("input, textarea").forEach(element => {
            element.disabled = true;
        });

        document.getElementById("save-draft").disabled = true;
        document.getElementById("check-readiness").disabled = true;

    } catch (error) {
        showSubmissionMessage(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Final Submission";
    }
});

// LOAD SUBMISSION FROM DATABASE

async function loadMySubmission() {
    const token = getSubmissionToken();

    if (!token) return;

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/submissions/my-submission",
            {
                headers: {
                    Authorization: "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Could not load submission.");
        }

        if (!result.submissions.length) {
            participantState.submissionStatus = "Not submitted";
            existingPresentation = null;
            updateSubmissionStatus();
            return;
        }

        const submission = result.submissions[0];

        document.getElementById("project-name").value =
            submission.projectTitle || "";

        document.getElementById("project-description").value =
            submission.description || "";

        document.getElementById("github-link").value =
            submission.githubUrl || "";

        document.getElementById("demo-link").value =
            submission.liveDemoUrl || "";

        document.getElementById("technologies").value =
            Array.isArray(submission.technologies)
                ? submission.technologies.join(", ")
                : "";

        existingPresentation = submission.presentation || null;

        if (existingPresentation?.originalName) {
            fileStatus.textContent =
                "Uploaded presentation: " + existingPresentation.originalName;
        }

        participantState.submissionStatus =
            submission.status.charAt(0).toUpperCase() +
            submission.status.slice(1);

        updateSubmissionStatus();

        if (submission.status === "submitted" ||
            submission.status === "evaluated") {

            submissionForm.querySelectorAll("input, textarea").forEach(element => {
                element.disabled = true;
            });

            document.getElementById("save-draft").disabled = true;
            document.getElementById("check-readiness").disabled = true;
            document.getElementById("final-submit").disabled = true;
        }

    } catch (error) {
        console.error("Submission Loading Error:", error);
    }
}


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

function logoutParticipant() {

  sessionStorage.removeItem("hackarenaTeamToken");
  sessionStorage.removeItem("hackarenaTeam");

  window.location.replace("./index.html");
}

logoutButton.addEventListener("click", () => {
  logoutParticipant();
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
  loadAvailableProblems();

 updateSubmissionStatus();
loadMySubmission();

updateProgressTracker();
updateAchievements();
}

// ====================================
// VERIFY LOGIN AND LOAD TEAM
// ====================================

async function loadAuthenticatedTeam() {

  const token = sessionStorage.getItem("hackarenaTeamToken");

  if (!token) {
    logoutParticipant();
    return;
  }

  try {

    const response = await fetch(
      "http://127.0.0.1:5000/api/teams/me",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        },
        cache: "no-store"
      }
    );

    const result = await response.json();

    if (
      !response.ok ||
      !result.success ||
      !result.team
    ) {
      throw new Error(
        result.message || "Invalid session."
      );
    }

    const team = result.team;

    participantState.selectedProblem =
      team.selectedProblem || null;

    participantState.achievements.problem =
      Boolean(participantState.selectedProblem);

    participantState.team = {
      name: team.teamName,
      teamId: team.teamId,
      leaderName: team.leaderName,
      leaderEmail: team.leaderEmail,
      memberLimit: null,
      members: team.memberNames || [],
      selectedProblem: participantState.selectedProblem
    };

    participantState.achievements.registration = true;

    // LOAD REAL EVENT SETTINGS

    try {

      const eventResponse = await fetch(
        "http://127.0.0.1:5000/api/event",
        {
          method: "GET",
          cache: "no-store"
        }
      );

      if (!eventResponse.ok) {
        throw new Error("Event settings unavailable.");
      }

      const eventResult = await eventResponse.json();

      if (eventResult.success && eventResult.event) {

        const eventData = eventResult.event;

        if (
          Number.isInteger(eventData.maximumTeams) &&
          eventData.maximumTeams > 0
        ) {
          participantState.teamCapacity =
            eventData.maximumTeams;
        }

        if (
          Number.isInteger(eventData.maximumMembers) &&
          eventData.maximumMembers > 0
        ) {
          participantState.team.memberLimit =
            eventData.maximumMembers;
        }

        console.log("Event settings loaded from MongoDB.");
      }

    } catch (error) {

      console.warn(
        "Could not load event settings:",
        error.message
      );
    }

    initializeDashboard();

    const banner = document.getElementById("preview-banner");

    if (banner) {
      banner.textContent =
        "Team login verified successfully. " +
        "Other dashboard features are being connected.";
    }

    document.documentElement.style.visibility = "visible";

  } catch (error) {

    console.error(
      "Participant Authentication:",
      error.message
    );

    logoutParticipant();
  }
}

loadAuthenticatedTeam();

// ---------------------------------
// BACKEND INTEGRATION NOTES
// ---------------------------------

// 1. Verify participant login.
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
