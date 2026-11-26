
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

matchingForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const skills = document.getElementById("skills").value.trim();
    const interests = document.getElementById("interests").value.trim();

    if (!skills || !interests) {
        matchingStatus.textContent =
            "Please enter your team's skills and interests.";
        return;
    }

    const button = matchingForm.querySelector('button[type="submit"]');

    button.disabled = true;
    button.textContent = "Finding matches...";

    matchingStatus.textContent = "Analyzing your team profile...";

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/api/problems/match",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " +
                        sessionStorage.getItem("hackarenaTeamToken")
                },
                body: JSON.stringify({
                    skills,
                    interests
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Matching failed.");
        }

        matchingStatus.replaceChildren();

        if (!data.recommendations.length) {
            matchingStatus.textContent =
                "No suitable matches found. Try different skills or interests.";
            return;
        }

        const heading = document.createElement("h3");
        heading.textContent = "Recommended Problems";
        matchingStatus.append(heading);

        data.recommendations.forEach(problem => {

            const card = document.createElement("article");
            card.className = "problem-card";
            card.style.marginTop = "15px";

            const title = document.createElement("h3");
            title.textContent = problem.code + " - " + problem.title;

            const score = document.createElement("strong");
            score.textContent = problem.matchPercentage + "% Keyword Match";
            score.style.color = "green";

            const progress = document.createElement("progress");
            progress.max = 100;
            progress.value = problem.matchPercentage;
            progress.style.width = "100%";

            const description = document.createElement("p");
            description.textContent = problem.statement;

            const slots = document.createElement("p");
            slots.textContent =
                "Available Slots: " + problem.availableSlots;

            const why = document.createElement("h4");
            why.textContent = "Why This Match?";

            const reason = document.createElement("p");
            reason.textContent = problem.reason;

            const selectButton = document.createElement("button");
            selectButton.type = "button";
            selectButton.className = "button";

            selectButton.textContent = participantState.selectedProblem
                ? "Already Selected"
                : "Select Problem";

            selectButton.disabled =
                Boolean(participantState.selectedProblem);

            selectButton.addEventListener("click", async () => {
                await selectProblem(problem, selectButton);

                if (participantState.selectedProblem) {
                    showPage("problems");
                    matchingStatus.textContent =
                        "A problem has been selected.";
                }
            });

            card.append(
                title,
                score,
                progress,
                description,
                slots,
                why,
                reason,
                selectButton
            );

            matchingStatus.append(card);
        });

    } catch (error) {

        matchingStatus.textContent = error.message;

    } finally {

        button.disabled = false;
        button.textContent = "Find matches";
    }
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
// LOAD LEADERBOARD
// ---------------------------------

async function loadLeaderboard() {

    const leaderboardList = document.getElementById("leaderboard-list");
    const leaderboardEmpty = document.getElementById("leaderboard-empty");

    leaderboardList.replaceChildren();

    leaderboardEmpty.hidden = false;
    leaderboardEmpty.textContent = "Loading leaderboard...";

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/api/leaderboard",
            {
                method: "GET",
                cache: "no-store"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Could not load leaderboard.");
        }

        const leaderboard = result.leaderboard || [];

        leaderboardList.replaceChildren();
        leaderboardEmpty.hidden = leaderboard.length > 0;

        if (leaderboard.length === 0) {
            leaderboardEmpty.textContent = "No evaluated projects available yet.";
            return;
        }

        leaderboard.forEach((entry) => {

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

    } catch (error) {

        console.error("Leaderboard Loading Error:", error);

        leaderboardEmpty.hidden = false;
        leaderboardEmpty.textContent = error.message;
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
        submission: "badge-submission",
        evaluation: "badge-evaluation"
    };

    Object.entries(badges).forEach(([name, elementId]) => {

        const element =
            document.getElementById(elementId);

        if (!element) return;

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
loadLeaderboard();

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

// LIVE HACKATHON COUNTDOWN

(() => {

    let timerData = null;
    let serverOffset = 0;

    async function loadParticipantTimer() {
        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/event/timer",
                { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error("Timer unavailable");
            }

            timerData = data.timer;
            serverOffset = timerData.serverTime - Date.now();

            displayParticipantTimer();

        } catch (error) {
            timerData = null;

            document.getElementById("countdown-status")
                .textContent = "Timer not connected";
        }
    }

    function displayParticipantTimer() {

        if (!timerData) return;

        const value = document.getElementById("countdown-value");
        const status = document.getElementById("countdown-status");

        let remaining = timerData.remaining;

        if (timerData.status === "running") {
            remaining = Math.max(
                0,
                Math.ceil(
                    (new Date(timerData.endAt).getTime()
                    - Date.now() - serverOffset) / 1000
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

        value.textContent = `${hours}:${minutes}:${seconds}`;

        if (timerData.status === "idle") {
            value.textContent = "--:--:--";
            status.textContent = "Waiting for organizer to start";

        } else if (remaining === 0) {
            status.textContent = "Hackathon Time Over";

        } else if (timerData.status === "paused") {
            status.textContent = "Timer Paused";

        } else if (remaining <= 300) {
            status.textContent = "Hurry up! Less than 5 minutes remaining";

        } else {
            status.textContent = "Hackathon in Progress";
        }

        value.setAttribute("aria-label", value.textContent);
    }

    loadParticipantTimer();

    setInterval(loadParticipantTimer, 3000);
    setInterval(displayParticipantTimer, 1000);

})();

// LIVE SUBMISSION DEADLINE

async function loadSubmissionDeadline() {
    const token = getSubmissionToken();

    if (!token) return;

    const message = document.getElementById(
        "submission-deadline-message"
    );

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

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Deadline unavailable");
        }
const submissionStatus = String(
    data.submissions[0]?.status || ""
).toLowerCase();

const permanentlyLocked =
    submissionStatus === "submitted" ||
    submissionStatus === "evaluated";

const isLocked =
    !data.submissionOpen || permanentlyLocked;

submissionForm.querySelectorAll("input, textarea")
    .forEach(element => {
        element.disabled = isLocked;
    });

document.getElementById("save-draft").disabled =
    isLocked;

document.getElementById("check-readiness").disabled =
    isLocked;

document.getElementById("final-submit").disabled =
    isLocked;
        if (!data.effectiveDeadline) {
            message.textContent =
                "Submission deadline not configured.";
            message.style.color = "orange";
            return;
        }

        const deadline = new Date(
            data.effectiveDeadline
        ).toLocaleString("en-IN");

        if (data.submissionOpen) {
            message.textContent =
                "Submission Open | Deadline: " + deadline;
            message.style.color = "green";
        } else {
            message.textContent =
                "Submission Closed | Deadline: " + deadline;
            message.style.color = "red";
        }

        if (data.extraSeconds > 0) {
    message.textContent +=
        " | Individual deadline extension applied";
}

    } catch (error) {
        message.textContent =
            "Unable to load submission deadline.";
        message.style.color = "red";
    }
}

loadSubmissionDeadline();

setInterval(loadSubmissionDeadline, 3000);

// ---------------------------------
// LIVE ANNOUNCEMENTS & NOTIFICATIONS
// ---------------------------------

async function loadParticipantAnnouncements() {

    const token =
        sessionStorage.getItem("hackarenaTeamToken");

    if (!token) return;

    const list =
        document.getElementById("announcements-list");

    const empty =
        document.getElementById("announcements-empty");

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/api/announcements/participant",
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

        updateParticipantUnreadBadge(data.announcements);
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

            card.append(
                priority,
                title,
                message,
                date
            );

            list.append(card);

        });

        const navigationButton =
            document.querySelector('[data-page="updates"]');

        if (navigationButton) {

            navigationButton.setAttribute(
                "data-announcement-count",
                data.announcements.length
            );

            navigationButton.title =
                data.announcements.length +
                " published announcements";

        }

    } catch (error) {

        empty.hidden = false;

        empty.textContent =
            "Unable to load announcements.";

        console.error(
            "Announcement Loading Error:",
            error
        );

    }

}

loadParticipantAnnouncements();

setInterval(loadParticipantAnnouncements, 5000);

// ---------------------------------
// AUTOMATIC SYSTEM NOTIFICATIONS
// ---------------------------------

async function loadSystemNotifications() {

    const token =
        sessionStorage.getItem("hackarenaTeamToken");

    if (!token) return;

    const list =
        document.getElementById("notifications-list");

    const empty =
        document.getElementById("notifications-empty");

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

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message);
        }

        const notifications = [];

        notifications.push({
            title: "Registration Successful",
            message: "Your team is registered and verified.",
            color: "#16a34a"
        });

        if (participantState.selectedProblem) {

            notifications.push({
                title: "Problem Statement Selected",
                message: "Your team has selected a problem statement.",
                color: "#2563eb"
            });

        }

        if (data.effectiveDeadline) {

            notifications.push({
                title: data.submissionOpen
                    ? "Submission Window Open"
                    : "Submission Window Closed",

                message: "Submission deadline: " +
                    new Date(data.effectiveDeadline)
                        .toLocaleString("en-IN"),

                color: data.submissionOpen
                    ? "#16a34a"
                    : "#dc2626"
            });

        }

        if (data.extraSeconds > 0) {

            notifications.push({
                title: "Individual Extra Time Granted",
                message: "The organizer has extended your team's submission deadline.",
                color: "#d97706"
            });

        }

        const submission = data.submissions[0];
        
        participantState.achievements.registration = true;

participantState.achievements.problem =
    Boolean(participantState.selectedProblem);

participantState.achievements.submission =
    submission?.status === "submitted" ||
    submission?.status === "evaluated";

participantState.achievements.evaluation =
    submission?.status === "evaluated";

updateAchievements();

if (officialResultsPublished) {

    participantState.currentStage = "Results";

} else if (submission?.status === "evaluated") {

    participantState.currentStage = "Judging";

} else if (submission?.status === "submitted") {

    participantState.currentStage = "Judging";

} else if (submission?.status === "draft") {

    participantState.currentStage = "Development";

} else if (participantState.selectedProblem) {

    participantState.currentStage = "Development";

} else {

    participantState.currentStage = "Problem";

}

updateProgressTracker();


        if (submission) {

            if (submission.status === "draft") {

                notifications.push({
                    title: "Project Draft Saved",
                    message: "Your project draft is saved successfully.",
                    color: "#2563eb"
                });

            }

            if (
                submission.status === "submitted" ||
                submission.status === "evaluated"
            ) {

                notifications.push({
                    title: "Project Submitted Successfully",
                    message: "Your final project submission has been received.",
                    color: "#16a34a"
                });

            }

            if (submission.status === "evaluated") {

                notifications.push({
                    title: "Evaluation Completed",
                    message: "Your project has been evaluated.",
                    color: "#16a34a"
                });

            }

        }

        list.replaceChildren();

        empty.hidden = notifications.length > 0;

        notifications.reverse().forEach(notification => {

            const card = document.createElement("article");

            card.className = "empty-state";

            card.style.marginBottom = "12px";
            card.style.textAlign = "left";

            card.style.borderLeft =
                "4px solid " + notification.color;

            const title = document.createElement("h3");

            title.textContent = notification.title;
            title.style.color = notification.color;

            const message = document.createElement("p");

            message.textContent = notification.message;

            card.append(title, message);

            list.append(card);

        });

    } catch (error) {

        console.error("System Notification Error:", error);

        empty.hidden = false;

        empty.textContent =
            "Unable to load system notifications.";

    }

}

loadSystemNotifications();

setInterval(loadSystemNotifications, 5000);

// ---------------------------------
// UNREAD ANNOUNCEMENT TRACKING
// ---------------------------------

let participantAnnouncementIds = [];

function updateParticipantUnreadBadge(announcements) {

    const teamId = participantState.team?.teamId;

    if (!teamId) return;

    const storageKey =
        "hackarenaReadAnnouncements_" + teamId;

    const badge =
        document.getElementById("participant-unread-badge");

    const updatesPage =
        document.getElementById("updates");

    participantAnnouncementIds =
        announcements.map(item => item._id);

    let readIds = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
    );

    if (!updatesPage.hidden) {

        readIds = [...new Set([
            ...readIds,
            ...participantAnnouncementIds
        ])];

        localStorage.setItem(
            storageKey,
            JSON.stringify(readIds)
        );

    }

    const unreadCount =
        participantAnnouncementIds.filter(
            id => !readIds.includes(id)
        ).length;

    badge.textContent = unreadCount;
    badge.hidden = unreadCount === 0;

}

document.querySelector('[data-page="updates"]')
    .addEventListener("click", () => {

        updateParticipantUnreadBadge(
            participantAnnouncementIds.map(id => ({
                _id: id
            }))
        );

    });

    // OFFICIAL RESULTS STATUS

let officialResultsPublished = false;

async function loadOfficialResultsStatus() {

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/api/results",
            { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message);
        }

        officialResultsPublished = data.resultsPublished === true;
        const status = document.getElementById(
    "participant-results-status"
);

const date = document.getElementById(
    "participant-results-date"
);

if (officialResultsPublished) {

    status.textContent = "Official Results Published";
    status.style.color = "#16a34a";

    date.textContent = "Published on: " +
        new Date(data.resultsPublishedAt)
            .toLocaleString("en-IN");

} else {

    status.textContent = "Provisional Leaderboard - Results Not Published";
    status.style.color = "#d97706";

    date.textContent = "";

}

        if (officialResultsPublished) {

            participantState.currentStage = "Results";

            updateProgressTracker();

        }

    } catch (error) {

        console.error("Results Status Error:", error);

    }

}

loadOfficialResultsStatus();

setInterval(loadOfficialResultsStatus, 5000);
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
