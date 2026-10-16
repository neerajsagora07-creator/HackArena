"use strict";
// Hide dashboard until Organizer Login is verified
document.documentElement.style.visibility = "hidden";

// ---------------------------------
// HACKARENA ORGANIZER DASHBOARD
// FRONTEND ONLY
// ---------------------------------

// ---------------------------------
// NAVIGATION
// ---------------------------------

const pageTitles = {
  overview: "Overview",
  settings: "Event Settings",
  teams: "Teams",
  problems: "Problem Statements",
  judges: "Judges & Invitations",
  timer: "Timer & Extra Time",
  submissions: "Submissions",
  criteria: "Judging Criteria",
  announcements: "Announcements",
  analytics: "Analytics"
};

function showPage(name) {
  if (!Object.prototype.hasOwnProperty.call(
    pageTitles, name
  )) {
    return;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.hidden = page.id !== name;
  });

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.page === name)
    );
  });

  document.getElementById("page-title")
    .textContent = pageTitles[name];
}

document.querySelectorAll("[data-page]").forEach((button) => {
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
// FRONTEND DATA PLACEHOLDERS
// ---------------------------------

// Real event data will come from the backend.
// Empty arrays do not represent real records.

const organizerData = {
  teams: [],
  problems: [],
  judges: [],
  submissions: [],
  analytics: null,
  eventSettings: null
};

// ---------------------------------
// FORM VALIDATION
// ---------------------------------

function validateForm(form) {
  form.querySelectorAll(
    'input[type="text"][required], textarea[required]'
  ).forEach((input) => {
    input.setCustomValidity(
      input.value.trim() ? "" : "Please enter a value."
    );
  });

  return form.reportValidity();
}

document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("input", (event) => {
    const input = event.target;

    if (
      input instanceof HTMLInputElement ||
      input instanceof HTMLTextAreaElement
    ) {
      input.setCustomValidity("");
    }
  });
});

// =====================================
// EVENT SETTINGS AND ORGANIZER BRANDING
// =====================================

const settingsForm =
  document.getElementById("settings-form");

// Same-browser fallback for event branding.
const eventApiUrl = "http://127.0.0.1:5000/api/event";
let eventSettingsRevision = 0;
let eventSettingsSaving = false;
settingsForm.addEventListener("input", () => { eventSettingsRevision++; });
settingsForm.addEventListener("change", () => { eventSettingsRevision++; });
const brandingKey =
  "hackarena-current-event-branding-v1";

const organizerLogoInput =
  document.getElementById("organizer-logo");

const organizerLogoPreview =
  document.getElementById("organizer-logo-preview");

const organizerLogoPreviewBox =
  document.getElementById("organizer-logo-preview-box");

let selectedLogoData = "";

// ---------------------------------
// DISPLAY LOGO PREVIEW
// ---------------------------------

function displayOrganizerLogo(data) {

  if (
    typeof data === "string" &&
    data.startsWith("data:image/")
  ) {
    organizerLogoPreview.src = data;
    organizerLogoPreviewBox.hidden = false;
  } else {
    organizerLogoPreview.removeAttribute("src");
    organizerLogoPreviewBox.hidden = true;
  }
}

// ---------------------------------
// DISPLAY EVENT BRANDING IN HEADER
// ---------------------------------

function renderOrganizerBranding(branding) {

  const header =
    document.getElementById(
      "organizer-branding-header"
    );

  const eventName =
    document.getElementById("header-event-name");

  const organization =
    document.getElementById("header-organization");

  const image =
    document.getElementById("header-organizer-logo");

  eventName.textContent =
    branding.eventName || "";

  organization.textContent =
    branding.organization || "";

  if (
    typeof branding.logo === "string" &&
    branding.logo.startsWith("data:image/")
  ) {
    image.src = branding.logo;
    image.hidden = false;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
  }

  header.hidden = !(
    branding.eventName ||
    branding.organization
  );
}

// ---------------------------------
// LOAD PREVIOUS EVENT INFORMATION
// ---------------------------------

function applyEventInformation(saved) {
  const values = {
    "event-name": "eventName",
    "organization": "organization",
    "event-date": "eventDate",
    "event-end-date": "eventEndDate",
    "event-time": "eventTime",
    "event-venue": "eventVenue",
    "event-description": "eventDescription",
    "maximum-teams": "maximumTeams",
    "maximum-members": "maximumMembers",
    "default-problem-capacity": "defaultProblemCapacity"
  };
  Object.entries(values).forEach(([id, key]) => {
    if (saved[key] !== undefined && saved[key] !== null) {
      document.getElementById(id).value = saved[key];
    }
  });
  selectedLogoData = typeof saved.logo === "string" ? saved.logo : "";
  displayOrganizerLogo(selectedLogoData);
  renderOrganizerBranding(saved);
  organizerData.eventSettings = saved;
  updateOverview();
}

function cacheEventInformation(branding) {
  try {
    localStorage.setItem(brandingKey, JSON.stringify(branding));
    return true;
  } catch (error) {
    console.warn("Could not cache event information.", error);
    return false;
  }
}

async function loadSavedEventInformation() {
  const revision = eventSettingsRevision;
  const status = document.getElementById("settings-status");
  let cached = false;
  try {
    const saved = JSON.parse(localStorage.getItem(brandingKey) || "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      applyEventInformation(saved);
      cached = true;
    }
  } catch (error) {
    console.warn("Could not load cached event information.", error);
  }
  try {
    const response = await fetch(eventApiUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      throw new Error(`Event load failed (HTTP ${response.status}).`);
    }
    const payload = await response.json();
    const saved = payload?.event ?? payload?.data ?? payload;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      throw new Error("The event API returned invalid event information.");
    }
    // Do not overwrite edits made while the GET request was pending.
    if (revision !== eventSettingsRevision) return;
    applyEventInformation(saved);
    cacheEventInformation(saved);
    status.textContent = "Event information loaded from server.";
  } catch (error) {
    console.warn("Could not load event information from server.", error);
    if (revision !== eventSettingsRevision) return;
    status.textContent = cached
      ? "Server unavailable. Showing information saved in this browser."
      : "Could not load event information from server. You can still enter and save settings.";
  }
}

// ---------------------------------
// ORGANIZER LOGO UPLOAD
// ---------------------------------

organizerLogoInput.addEventListener("change", () => {

  const file = organizerLogoInput.files[0];

  if (!file) {
    return;
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  const status =
    document.getElementById("settings-status");

  // Check image format
  if (!allowedTypes.includes(file.type)) {

    organizerLogoInput.value = "";

    status.textContent =
      "Please select a PNG, JPG or WEBP image.";

    return;
  }

  // Maximum logo size: 1 MB
  if (file.size > 1024 * 1024) {

    organizerLogoInput.value = "";

    status.textContent =
      "Please choose a logo smaller than 1 MB.";

    return;
  }

  const reader = new FileReader();

  reader.onload = () => {

    selectedLogoData =
      String(reader.result || "");

    displayOrganizerLogo(selectedLogoData);

    status.textContent =
      "Logo preview ready. Save event information " +
      "to apply the selected logo.";
  };

  reader.onerror = () => {

    status.textContent =
      "Could not read this image. " +
      "Please select another logo.";
  };

  reader.readAsDataURL(file);
});

// ---------------------------------
// SAVE EVENT INFORMATION
// ---------------------------------

settingsForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!validateForm(settingsForm)) {
    return;
  }

  const maximumTeams =
    Number(
      document.getElementById("maximum-teams").value
    );

  const maximumMembers =
    Number(
      document.getElementById("maximum-members").value
    );

  const problemCapacity =
    Number(
      document.getElementById(
        "default-problem-capacity"
      ).value
    );

  const status =
    document.getElementById("settings-status");

  const valid =
    [
      maximumTeams,
      maximumMembers,
      problemCapacity
    ].every((value) =>
      Number.isSafeInteger(value) && value > 0
    );

  if (!valid) {

    status.textContent =
      "Please enter valid positive whole numbers.";

    return;
  }

  const eventDate =
    document.getElementById("event-date").value;

  const eventEndDate =
    document.getElementById("event-end-date").value;

  if (eventEndDate < eventDate) {

    status.textContent =
      "Event end date cannot be before start date.";

    return;
  }

  if (eventSettingsSaving) return;
  eventSettingsRevision++;

  const branding = {

    maximumTeams,
    maximumMembers,
    defaultProblemCapacity: problemCapacity,

    eventName:
      document.getElementById("event-name")
        .value.trim(),

    organization:
      document.getElementById("organization")
        .value.trim(),

    logo: selectedLogoData,

    eventDate: eventDate,

    eventEndDate: eventEndDate,

    eventTime:
      document.getElementById("event-time").value,

    eventVenue:
      document.getElementById("event-venue")
        .value.trim(),

    eventDescription:
      document.getElementById("event-description")
        .value.trim()
  };

  eventSettingsSaving = true;
  status.textContent = "Saving event information...";
  try {
    const response = await fetch(eventApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      throw new Error(`Event save failed (HTTP ${response.status}).`);
    }
    // A successful POST may return event JSON, a message, or no body.
    const cached = cacheEventInformation(branding);
    organizerData.eventSettings = branding;
    renderOrganizerBranding(branding);
    updateOverview();
    status.textContent = cached
      ? "Event information and participation limits saved to server!"
      : "Saved to server, but browser cache could not be updated.";
  } catch (error) {
    console.warn("Event API save failed.", error);
    const cached = cacheEventInformation(branding);
    if (cached) {
      organizerData.eventSettings = branding;
      renderOrganizerBranding(branding);
      updateOverview();
    }
    status.textContent = cached
      ? "Server save failed. Information saved only in this browser. Retry Save when the server is available."
      : "Could not save to server or browser storage. Check the server or try a smaller logo.";
  } finally {
    eventSettingsSaving = false;
  }
});

// Load saved branding when page opens
loadSavedEventInformation();

// ---------------------------------
// TEAM MANAGEMENT
// ---------------------------------

function renderTeams() {

  const list =
    document.getElementById("teams-list");

  const empty =
    document.getElementById("teams-empty");

  list.replaceChildren();

  empty.hidden =
    organizerData.teams.length > 0;

  organizerData.teams.forEach((team) => {

    const row = document.createElement("tr");

    const values = [
      team.teamId,
      team.name,
      team.leaderEmail,
      team.memberCount,
      team.selectedProblem
    ];

    values.forEach((value) => {

      const cell = document.createElement("td");

      cell.textContent =
        String(value ?? "—");

      row.append(cell);
    });

    list.append(row);
  });
}

// ---------------------------------
// PROBLEM STATEMENTS
// ---------------------------------

const problemForm =
  document.getElementById("problem-form");
  
  let editingProblemId = null;


 // ====================================
 // CREATE AND EDIT PROBLEM STATEMENTS
 // ====================================

problemForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!validateForm(problemForm)) {
        return;
    }

    const token = sessionStorage.getItem(
        "hackarenaOrganizerToken"
    );

    if (!token) {
        window.location.replace("./index.html");
        return;
    }

    const code = document.getElementById(
        "problem-code"
    ).value.trim().toUpperCase();

    const title = document.getElementById(
        "problem-title"
    ).value.trim();

    const statement = document.getElementById(
        "problem-statement"
    ).value.trim();

    const capacity = Number(
        document.getElementById("problem-capacity").value
    );

    const status = document.getElementById(
        "problem-status"
    );

    const submitButton = problemForm.querySelector(
        'button[type="submit"]'
    );

    if (!Number.isSafeInteger(capacity) || capacity < 1) {
        status.textContent = "Enter a valid Team Capacity.";
        return;
    }

    // Check Create or Edit Mode
    const isEditing = editingProblemId !== null;

    const url = isEditing
        ? "http://127.0.0.1:5000/api/problems/" + editingProblemId
        : "http://127.0.0.1:5000/api/problems";

    const method = isEditing ? "PUT" : "POST";

    submitButton.disabled = true;

    status.textContent = isEditing
        ? "Updating Problem Statement..."
        : "Saving Problem Statement...";

    try {

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                code: code,
                title: title,
                statement: statement,
                capacity: capacity
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Failed to save Problem."
            );
        }

        if (isEditing) {

            // Update existing Problem
            const index = organizerData.problems.findIndex(
                (problem) => problem.id === editingProblemId
            );

            if (index !== -1) {
                organizerData.problems[index] = {
                    ...organizerData.problems[index],
                    ...result.problem
                };
            }

        } else {

            // Add newly created Problem
            organizerData.problems.push(result.problem);

        }

        // Refresh Problem Table
        renderProblems();

        // Reset Form
        problemForm.reset();

        editingProblemId = null;

        submitButton.textContent = "Check Problem Details";

        status.textContent = isEditing
            ? "Problem Statement Updated Successfully!"
            : "Problem Statement Created Successfully!";

    } catch (error) {

        status.textContent = error.message;

    } finally {

        submitButton.disabled = false;

    }

});




function renderProblems() {

  const list =
    document.getElementById("problem-list");

  const empty =
    document.getElementById("problem-list-empty");

  list.replaceChildren();

  empty.hidden =
    organizerData.problems.length > 0;

  organizerData.problems.forEach((problem) => {

    const row = document.createElement("tr");

    const values = [
      problem.code,
      problem.title,
      problem.capacity,
      problem.occupied
    ];

    values.forEach((value) => {

      const cell = document.createElement("td");

      cell.textContent =
        String(value ?? "—");

      row.append(cell);
    });

    const statusCell =
      document.createElement("td");

    const badge =
      document.createElement("span");

    badge.className = "status-pill";

    const capacity = Number(problem.capacity);
    const occupied = Number(problem.occupied);

    if (
      Number.isFinite(capacity) &&
      capacity > 0 &&
      Number.isFinite(occupied) &&
      occupied >= 0
    ) {

      const full =
        occupied >= capacity;

      badge.textContent =
        full ? "Full" : "Available";

      badge.classList.add(
        full ? "full" : "available"
      );

    } else {

      badge.textContent = "Not loaded";
    }

    statusCell.append(badge);
    
        // ====================================
        // EDIT PROBLEM BUTTON
        // ====================================

        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.className = "secondary-button";

        editButton.style.marginLeft = "10px";

        editButton.addEventListener("click", () => {

            // Remember selected Problem ID
            editingProblemId = problem.id;

            // Fill existing details in form
            document.getElementById("problem-code").value =
                problem.code;

            document.getElementById("problem-title").value =
                problem.title;

            document.getElementById("problem-statement").value =
                problem.statement;

            document.getElementById("problem-capacity").value =
                problem.capacity;

            // Change submit button label
            problemForm.querySelector(
                'button[type="submit"]'
            ).textContent = "Save Changes";

            document.getElementById("problem-status")
                .textContent =
                "Editing Problem: " + problem.code;

            // Scroll to Problem Form
            problemForm.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

        statusCell.append(editButton);

    row.append(statusCell);

    list.append(row);
  });
}

// ---------------------------------
// PROBLEM FILE SELECTION
// ---------------------------------

document.getElementById("problem-file")
  .addEventListener("change", (event) => {

    const file = event.target.files[0];

    const status =
      document.getElementById(
        "problem-file-status"
      );

    if (!file) {

      status.textContent =
        "No file selected. Upload formats " +
        "and import rules are not finalized.";

      return;
    }

    const size =
      file.size / (1024 * 1024);

    status.textContent =
      `Selected: ${file.name} ` +
      `(${size.toFixed(2)} MB). ` +
      "The file has not been uploaded or imported.";
  });

// ---------------------------------
// JUDGE INVITATIONS
// ---------------------------------

const judgeForm =
  document.getElementById("judge-form");

judgeForm.addEventListener("submit", (event) => {

  event.preventDefault();

  if (!validateForm(judgeForm)) {
    return;
  }

  document.getElementById("judge-status")
    .textContent =
    "Judge information checked. " +
    "No account has been created and " +
    "no invitation email has been sent. " +
    "The backend will handle secure invitations.";
});

function renderJudges() {

  const list =
    document.getElementById("judges-list");

  const empty =
    document.getElementById("judges-empty");

  list.replaceChildren();

  empty.hidden =
    organizerData.judges.length > 0;

  organizerData.judges.forEach((judge) => {

    const row = document.createElement("tr");

    [
      judge.name,
      judge.email,
      judge.invitationStatus
    ].forEach((value) => {

      const cell = document.createElement("td");

      cell.textContent =
        String(value ?? "—");

      row.append(cell);
    });

    list.append(row);
  });
}

// ---------------------------------
// TIMER VALIDATION
// ---------------------------------

function readDuration(hoursId, minutesId) {

  const hoursField =
    document.getElementById(hoursId);

  const minutesField =
    document.getElementById(minutesId);

  if (
    hoursField.value === "" ||
    minutesField.value === ""
  ) {
    return null;
  }

  const hours =
    Number(hoursField.value);

  const minutes =
    Number(minutesField.value);

  const totalMinutes =
    hours * 60 + minutes;

  if (
    !Number.isSafeInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59 ||
    !Number.isSafeInteger(totalMinutes) ||
    totalMinutes <= 0
  ) {
    return null;
  }

  return {
    hours,
    minutes,
    totalMinutes
  };
}

// ---------------------------------
// TIMER FORM
// ---------------------------------

document.getElementById("timer-form")
  .addEventListener("submit", (event) => {

    event.preventDefault();

    const duration =
      readDuration(
        "timer-hours",
        "timer-minutes"
      );

    const status =
      document.getElementById("timer-status");

    if (!duration) {

      status.textContent =
        "Enter a positive duration using whole " +
        "hours and 0–59 minutes.";

      return;
    }

    status.textContent =
      `Requested duration: ${duration.hours} hour(s), ` +
      `${duration.minutes} minute(s). ` +
      "No live timer has started. " +
      "The backend will control the shared deadline.";
  });

document.getElementById("stop-timer")
  .addEventListener("click", () => {

    document.getElementById("timer-status")
      .textContent =
      "No live timer is connected. " +
      "Pause, resume or reset behavior must be finalized.";
  });

// ---------------------------------
// EXTRA TIME
// ---------------------------------

const extensionScope =
  document.getElementById("extension-scope");

const extensionTeamField =
  document.getElementById("extension-team-field");

const extensionTeam =
  document.getElementById("extension-team");

function updateExtensionScope() {

  const isTeam =
    extensionScope.value === "team";

  extensionTeamField.hidden = !isTeam;

  extensionTeam.required = isTeam;

  extensionTeam.disabled = !isTeam;

  document.getElementById("extension-status")
    .textContent = "";
}

extensionScope.addEventListener(
  "change",
  updateExtensionScope
);

updateExtensionScope();

document.getElementById("extension-form")
  .addEventListener("submit", (event) => {

    event.preventDefault();

    const form = event.currentTarget;

    if (!validateForm(form)) {
      return;
    }

    const duration =
      readDuration(
        "extra-hours",
        "extra-minutes"
      );

    const status =
      document.getElementById("extension-status");

    if (!duration) {

      status.textContent =
        "Enter valid extra hours and minutes.";

      return;
    }

    const recipient =
      extensionScope.value === "team"
        ? `Team ID ${extensionTeam.value.trim()}`
        : "all participating teams";

    status.textContent =
      `Requested ${duration.hours} hour(s) and ` +
      `${duration.minutes} minute(s) for ${recipient}. ` +
      "No extension has been granted. " +
      "The backend must verify the recipient " +
      "and update the applicable deadline.";
  });

// ---------------------------------
// SUBMISSION MONITORING
// ---------------------------------

function renderSubmissions() {

  const list =
    document.getElementById("submissions-list");

  const empty =
    document.getElementById("submissions-empty");

  list.replaceChildren();

  empty.hidden =
    organizerData.submissions.length > 0;

  organizerData.submissions.forEach((submission) => {

    const row = document.createElement("tr");

    const values = [
      submission.team,
      submission.problemCode,
      submission.projectName,
      submission.presentationName,
      submission.submissionStatus,
      submission.judgingStatus
    ];

    values.forEach((value) => {

      const cell = document.createElement("td");

      cell.textContent =
        String(value ?? "—");

      row.append(cell);
    });

    list.append(row);
  });
}

// ---------------------------------
// SUBMISSION STATISTICS
// ---------------------------------

// Real statistics will come from backend.

function updateSubmissionStats(stats) {

  document.getElementById("submitted-count")
    .textContent =
    stats?.submitted ?? "Not loaded";

  document.getElementById("pending-count")
    .textContent =
    stats?.pending ?? "Not loaded";

  document.getElementById("evaluated-count")
    .textContent =
    stats?.evaluated ?? "Not loaded";
}

// ---------------------------------
// JUDGING CRITERIA
// ---------------------------------

const defaultCriteria = [
  {
    name: "Innovation",
    maximum: 25
  },
  {
    name: "Technical Implementation",
    maximum: 25
  },
  {
    name: "Impact",
    maximum: 20
  },
  {
    name: "UI/UX",
    maximum: 15
  },
  {
    name: "Presentation",
    maximum: 15
  }
];

const criteriaList =
  document.getElementById("criteria-list");

const rubricTotal =
  document.getElementById("rubric-total");

let criterionSequence = 0;

// ---------------------------------
// CALCULATE RUBRIC TOTAL
// ---------------------------------

function updateRubricTotal() {

  let total = 0;
  let valid = true;

  const marksInputs =
    criteriaList.querySelectorAll(
      ".criterion-marks"
    );

  marksInputs.forEach((input) => {

    const number =
      Number(input.value);

    if (
      input.value === "" ||
      !Number.isFinite(number) ||
      number <= 0 ||
      number > 100
    ) {

      valid = false;
      return;
    }

    total += number;
  });

  if (!marksInputs.length) {
    valid = false;
  }

  rubricTotal.textContent = valid
    ? `${Number(total.toFixed(2))} / 100`
    : "Check marks";

  return {
    total,
    valid
  };
}

// ---------------------------------
// ADD JUDGING CRITERION
// ---------------------------------

function addCriterion(name = "", maximum = "") {

  criterionSequence++;

  const row = document.createElement("div");
  row.className = "criterion-row";

  const nameWrapper =
    document.createElement("div");

  const nameLabel =
    document.createElement("label");

  const nameInput =
    document.createElement("input");

  nameInput.id =
    `criterion-name-${criterionSequence}`;

  nameInput.className =
    "criterion-name";

  nameInput.type = "text";
  nameInput.value = name;
  nameInput.required = true;

  nameLabel.htmlFor = nameInput.id;
  nameLabel.textContent = "Criterion";

  nameWrapper.append(nameLabel, nameInput);

  const marksWrapper =
    document.createElement("div");

  const marksLabel =
    document.createElement("label");

  const marksInput =
    document.createElement("input");

  marksInput.id =
    `criterion-marks-${criterionSequence}`;

  marksInput.className = "criterion-marks";
  marksInput.type = "number";
  marksInput.min = "0";
  marksInput.max = "100";
  marksInput.step = "any";
  marksInput.value = maximum;
  marksInput.required = true;

  marksLabel.htmlFor = marksInput.id;
  marksLabel.textContent = "Maximum marks";

  marksWrapper.append(
    marksLabel,
    marksInput
  );

  const removeButton =
    document.createElement("button");

  removeButton.type = "button";
  removeButton.className = "remove-criterion";
  removeButton.textContent = "Remove";

  removeButton.addEventListener("click", () => {
    row.remove();
    updateRubricTotal();
  });

  marksInput.addEventListener(
    "input",
    updateRubricTotal
  );

  row.append(
    nameWrapper,
    marksWrapper,
    removeButton
  );

  criteriaList.append(row);

  updateRubricTotal();

  return nameInput;
}

// ---------------------------------
// DEFAULT CRITERIA
// ---------------------------------

defaultCriteria.forEach((criterion) => {
  addCriterion(
    criterion.name,
    criterion.maximum
  );
});

document.getElementById("add-criterion")
  .addEventListener("click", () => {

    addCriterion().focus();
  });

// ---------------------------------
// CRITERIA FORM
// ---------------------------------

document.getElementById("criteria-form")
  .addEventListener("submit", (event) => {

    event.preventDefault();

    const form =
      event.currentTarget;

    if (!validateForm(form)) {
      return;
    }

    const result =
      updateRubricTotal();

    const status =
      document.getElementById("criteria-status");

    if (
      !result.valid ||
      Math.abs(result.total - 100) > 0.000001
    ) {

      status.textContent =
        "Each criterion must have positive marks, " +
        "and the total must be exactly 100.";

      return;
    }

    status.textContent =
      "The rubric totals 100 marks. " +
      "No changes have been saved or applied " +
      "to the Judge Dashboard.";
  });

// ---------------------------------
// ANNOUNCEMENTS
// ---------------------------------

const announcementForm =
  document.getElementById("announcement-form");

// ---------------------------------
// ANNOUNCEMENT PREVIEW
// ---------------------------------

document.getElementById("preview-announcement")
  .addEventListener("click", () => {

    if (!validateForm(announcementForm)) {
      return;
    }

    document.getElementById("preview-title")
      .textContent =
      document.getElementById(
        "announcement-title"
      ).value.trim();

    document.getElementById("preview-message")
      .textContent =
      document.getElementById(
        "announcement-message"
      ).value.trim();

    document.getElementById(
      "announcement-preview"
    ).hidden = false;
  });

announcementForm.addEventListener("input", () => {

  document.getElementById(
    "announcement-preview"
  ).hidden = true;
});

// ---------------------------------
// PUBLISH ANNOUNCEMENT
// ---------------------------------

announcementForm.addEventListener("submit", (event) => {

  event.preventDefault();

  if (!validateForm(announcementForm)) {
    return;
  }

  document.getElementById("announcement-status")
    .textContent =
    "Announcement details checked. " +
    "No announcement has been published or sent. " +
    "The backend will save and distribute it.";
});

// ---------------------------------
// ANALYTICS
// ---------------------------------

function updateAnalytics(stats) {

  const fields = {
    "analytics-teams": "totalTeams",
    "analytics-submissions": "totalSubmissions",
    "analytics-full": "fullProblems",
    "analytics-judging": "judgingStatus",
    "analytics-progress": "overallProgress"
  };

  Object.entries(fields).forEach(
    ([elementId, key]) => {

      document.getElementById(elementId)
        .textContent =
        stats?.[key] ?? "Not loaded";
    }
  );
}

// ---------------------------------
// OVERVIEW DATA
// ---------------------------------

function updateOverview() {

  const settings =
    organizerData.eventSettings;

  const stats =
    organizerData.analytics;

  document.getElementById("registered-teams")
    .textContent =
    stats?.registeredTeams ?? "Not loaded";

  document.getElementById("capacity-summary")
    .textContent =
    settings?.maximumTeams
      ? `Maximum ${settings.maximumTeams} teams`
      : "Organizer-configurable capacity";

  document.getElementById("total-submissions")
    .textContent =
    stats?.totalSubmissions ?? "Not loaded";

  document.getElementById("overview-judging")
    .textContent =
    stats?.judgingStatus ?? "Not loaded";
}

// ---------------------------------
// LOGOUT
// ---------------------------------


 // ====================================
 // ORGANIZER LOGOUT
 // ====================================

document.getElementById("logout-button")
    .addEventListener("click", () => {

        // Remove Organizer login token
        sessionStorage.removeItem(
            "hackarenaOrganizerToken"
        );

        // Remove Organizer information
        sessionStorage.removeItem(
            "hackarenaOrganizer"
        );

        // Redirect to login page
        window.location.replace("./index.html");

    });


// ---------------------------------
// INITIAL PAGE SETUP
// ---------------------------------

 // ====================================
 // LOAD SAVED PROBLEMS FROM MONGODB
 // ====================================

async function loadProblems() {

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
            throw new Error("Failed to load Problems.");
        }

        // Store MongoDB Problems in Dashboard
        organizerData.problems = result.problems;

        // Update Problem Statements Table
        renderProblems();

    } catch (error) {

        console.error("Problem Load Error:", error);

        document.getElementById("problem-status")
            .textContent =
            "Could not load saved Problems. Check Backend Server.";

    }

}

function initializeOrganizer() {

  showPage("overview");

  renderTeams();
  renderProblems();
  loadProblems();
  renderJudges();
  renderSubmissions();

  updateSubmissionStats(null);
  updateAnalytics(null);
  updateOverview();
}


 // ====================================
 // ORGANIZER LOGIN VERIFICATION
 // ====================================

async function verifyOrganizerLogin() {

    const token = sessionStorage.getItem(
        "hackarenaOrganizerToken"
    );

    // If no token, go back to login
    if (!token) {
        window.location.replace("./index.html");
        return;
    }

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/api/auth/organizer/me",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        // Invalid or expired login
        if (
            response.status === 401 ||
            response.status === 403
        ) {
            sessionStorage.removeItem(
                "hackarenaOrganizerToken"
            );

            sessionStorage.removeItem(
                "hackarenaOrganizer"
            );

            window.location.replace("./index.html");
            return;
        }

        if (!response.ok) {
            throw new Error("Backend verification failed.");
        }

        const result = await response.json();

        // Check Organizer role
        if (
            !result.success ||
            result.organizer?.role !== "organizer"
        ) {

            sessionStorage.removeItem(
                "hackarenaOrganizerToken"
            );

            sessionStorage.removeItem(
                "hackarenaOrganizer"
            );

            window.location.replace("./index.html");
            return;
        }

        // Login successfully verified
        initializeOrganizer();

        // Show dashboard
        document.documentElement.style.visibility = "visible";

    } catch (error) {

        console.error("Organizer Verification Error:", error);

        document.body.replaceChildren();

        const message = document.createElement("p");

        message.textContent =
            "Cannot verify Organizer login. Check backend server and refresh.";

        document.body.append(message);

        document.documentElement.style.visibility = "visible";

    }
}

// Start Organizer Login Verification
verifyOrganizerLogin();


// ---------------------------------
// FUTURE BACKEND INTEGRATION
// ---------------------------------

// 1. Authenticate organizer.
// 2. Protect organizer dashboard.
// 3. Store event settings in database.
// 4. Store event logo on the server.
// 5. Connect event branding to Event ID.
// 6. Manage teams and problems.
// 7. Enforce capacity limits.
// 8. Manage judge invitations.
// 9. Control timers and deadlines.
// 10. Save official submissions.
// 11. Handle announcements.
// 12. Calculate analytics.
// 13. End authenticated sessions on logout.

// Current version is frontend-only.
// Event branding is saved in browser localStorage.
// No database data has been changed.