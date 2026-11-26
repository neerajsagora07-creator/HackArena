
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

if (name === "submissions") {
    loadSubmissions();
}
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
const eventApiUrl = window.HACKARENA_API + "/api/event";
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

    const deadlineInput = document.getElementById("submission-deadline");

    if (deadlineInput) {
        if (saved.submissionDeadline) {
            const deadline = new Date(saved.submissionDeadline);

            if (!isNaN(deadline.getTime())) {
                const localDeadline = new Date(
                    deadline.getTime() - deadline.getTimezoneOffset() * 60000
                );

                deadlineInput.value = localDeadline.toISOString().slice(0, 16);
            }
        } else {
            deadlineInput.value = "";
        }
    }

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
    const token = sessionStorage.getItem("hackarenaOrganizerToken");

if (!token) {
  window.location.replace("./index.html");
  return;
}

const response = await fetch(eventApiUrl, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token
  },
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

const deadlineInput = document.getElementById("submission-deadline");

if (!deadlineInput || !deadlineInput.value) {
    status.textContent = "Please select a Project Submission Deadline.";
    deadlineInput?.focus();
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
        .value.trim(),
       submissionDeadline: new Date(deadlineInput.value).toISOString()
  };

  eventSettingsSaving = true;
  status.textContent = "Saving event information...";
  try {
    const response = await fetch(eventApiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + sessionStorage.getItem("hackarenaOrganizerToken")
  },
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

    const list = document.getElementById("teams-list");
    const empty = document.getElementById("teams-empty");

    list.replaceChildren();

    const teams = organizerData.teams;

    empty.hidden = teams.length > 0;

    if (teams.length === 0) {
        empty.querySelector("h3").textContent =
            "No Registered Teams";

        empty.querySelector("p").textContent =
            "Verified teams will appear here.";
        return;
    }

    teams.forEach((team) => {

        const row = document.createElement("tr");

        function addCell(value) {
            const cell = document.createElement("td");
            cell.textContent = value || "—";
            row.appendChild(cell);
        }

        addCell(team.teamId);
        addCell(team.teamName);
        addCell(team.leaderEmail);

        const memberCell = document.createElement("td");

        const members = [
            team.leaderName,
            ...(Array.isArray(team.memberNames)
                ? team.memberNames
                : [])
        ].filter(name => typeof name === "string" && name.trim());

        const details = document.createElement("details");
        const summary = document.createElement("summary");

        summary.textContent =
            members.length + " Members — View Names";

        const namesList = document.createElement("ol");

        members.forEach((name, index) => {

            const item = document.createElement("li");

            item.textContent = index === 0
                ? name + " (Team Leader)"
                : name;

            namesList.appendChild(item);
        });

        details.append(summary, namesList);
        memberCell.appendChild(details);
        row.appendChild(memberCell);

        addCell(
    team.selectedProblem
        ? team.selectedProblem.title + " (" +
          team.selectedProblem.code + ")"
        : "Not selected"
);

        list.appendChild(row);
    });
}


// ====================================
// LOAD REGISTERED TEAMS FROM MONGODB
// ====================================


async function loadTeams() {

    try {

        const token = sessionStorage.getItem(
            "hackarenaOrganizerToken"
        );

        const response = await fetch(
            window.HACKARENA_API + "/api/teams/organizer/roster",
            {
                method: "GET",
                headers: {
                    Authorization: "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Failed to load teams."
            );
        }

        organizerData.teams = result.teams;
        renderTeams();
    } catch (error) {

        console.error("Team Loading Error:", error);

        document.getElementById("teams-empty").hidden = false;

        document.querySelector("#teams-empty h3")
            .textContent = "Could Not Load Teams";

        document.querySelector("#teams-empty p")
            .textContent = error.message;
    }
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

    const token = sessionStorage.getItem("hackarenaOrganizerToken");

    if (!token) {
        window.location.replace("./index.html");
        return;
    }

    const code = document.getElementById("problem-code").value.trim().toUpperCase();
    const title = document.getElementById("problem-title").value.trim();
    const statement = document.getElementById("problem-statement").value.trim();
    const capacity = Number(document.getElementById("problem-capacity").value);
    const visibility = document.getElementById("problem-visibility").value;
    const isPublished = visibility === "published";

    const status = document.getElementById("problem-status");
    const submitButton = problemForm.querySelector('button[type="submit"]');

    if (!Number.isSafeInteger(capacity) || capacity < 1) {
        status.textContent = "Enter a valid Team Capacity.";
        return;
    }

    const isEditing = editingProblemId !== null;
    const url = isEditing
        ? window.HACKARENA_API + "/api/problems/" + editingProblemId
        : window.HACKARENA_API + "/api/problems";
    const method = isEditing ? "PUT" : "POST";

    submitButton.disabled = true;
    status.textContent = isEditing
        ? "Updating Problem Statement..."
        : "Saving Problem Statement...";

    try {
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                code,
                title,
                statement,
                capacity,
                ...(isEditing ? {} : { isPublished })
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to save Problem.");
        }

        let savedProblem = result.problem;

        if (isEditing && Boolean(savedProblem.isPublished) !== isPublished) {
            const visibilityResponse = await fetch(
                window.HACKARENA_API + "/api/problems/" + editingProblemId + "/publish",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                    },
                    body: JSON.stringify({ isPublished })
                }
            );

            const visibilityResult = await visibilityResponse.json();

            if (!visibilityResponse.ok || !visibilityResult.success) {
                throw new Error(
                    visibilityResult.message ||
                    "Problem details saved, but visibility could not be changed."
                );
            }

            savedProblem = visibilityResult.problem || {
                ...savedProblem,
                isPublished
            };
        }

        if (isEditing) {
            const index = organizerData.problems.findIndex(
                (problem) => String(problem.id || problem._id) === String(editingProblemId)
            );

            if (index !== -1) {
                organizerData.problems[index] = {
                    ...organizerData.problems[index],
                    ...savedProblem
                };
            }
        } else {
            organizerData.problems.push(savedProblem);
        }

        renderProblems();
        problemForm.reset();
        document.getElementById("problem-visibility").value = "published";
        editingProblemId = null;
        submitButton.textContent = "Check Problem Details";

        status.textContent = isEditing
            ? "Problem Statement Updated Successfully!"
            : (isPublished
                ? "Problem Statement Published Successfully!"
                : "Problem Statement Saved as Draft Successfully!");

    } catch (error) {
        status.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});


function renderProblems() {
    const list = document.getElementById("problem-list");
    const empty = document.getElementById("problem-list-empty");

    list.replaceChildren();
    empty.hidden = organizerData.problems.length > 0;

    organizerData.problems.forEach((problem) => {
        const row = document.createElement("tr");

        [
            problem.code,
            problem.title,
            problem.capacity,
            problem.occupied
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = String(value ?? "—");
            row.append(cell);
        });

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "status-pill";

        const isPublished = problem.isPublished !== false;
        const capacity = Number(problem.capacity);
        const occupied = Number(problem.occupied);

        if (!isPublished) {
            badge.textContent = "Draft";
            badge.classList.add("draft");
        } else if (
            Number.isFinite(capacity) &&
            capacity > 0 &&
            Number.isFinite(occupied) &&
            occupied >= 0
        ) {
            const full = occupied >= capacity;
            badge.textContent = full ? "Full" : "Published";
            badge.classList.add(full ? "full" : "available");
        } else {
            badge.textContent = "Published";
            badge.classList.add("available");
        }

        statusCell.append(badge);

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.className = "secondary-button";
        editButton.style.marginLeft = "10px";

        editButton.addEventListener("click", () => {
            editingProblemId = problem.id || problem._id;

            document.getElementById("problem-code").value = problem.code || "";
            document.getElementById("problem-title").value = problem.title || "";
            document.getElementById("problem-statement").value = problem.statement || "";
            document.getElementById("problem-capacity").value = problem.capacity || 1;
            document.getElementById("problem-visibility").value =
                problem.isPublished === false ? "draft" : "published";

            problemForm.querySelector('button[type="submit"]').textContent =
                "Save Changes";

            document.getElementById("problem-status").textContent =
                "Editing Problem: " + (problem.code || "");

            problemForm.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        statusCell.append(editButton);

        const visibilityButton = document.createElement("button");
        visibilityButton.type = "button";
        visibilityButton.textContent = isPublished ? "Unpublish" : "Publish";
        visibilityButton.className = "secondary-button";
        visibilityButton.style.marginLeft = "8px";

        visibilityButton.addEventListener("click", async () => {
            const token = sessionStorage.getItem("hackarenaOrganizerToken");
            const problemId = problem.id || problem._id;

            if (!token || !problemId) {
                document.getElementById("problem-status").textContent =
                    "Organizer login or Problem ID is missing.";
                return;
            }

            visibilityButton.disabled = true;

            try {
                const response = await fetch(
                    window.HACKARENA_API + "/api/problems/" + problemId + "/publish",
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": "Bearer " + token
                        },
                        body: JSON.stringify({ isPublished: !isPublished })
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Could not change problem visibility.");
                }

                const index = organizerData.problems.findIndex(
                    (item) => String(item.id || item._id) === String(problemId)
                );

                if (index !== -1) {
                    organizerData.problems[index] = {
                        ...organizerData.problems[index],
                        ...(result.problem || {}),
                        isPublished: !isPublished
                    };
                }

                renderProblems();
                document.getElementById("problem-status").textContent =
                    !isPublished
                        ? "Problem published. Participants can now see it."
                        : "Problem unpublished. It is now hidden from participants.";

            } catch (error) {
                document.getElementById("problem-status").textContent = error.message;
                visibilityButton.disabled = false;
            }
        });

        statusCell.append(visibilityButton);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "secondary-button";
        deleteButton.style.marginLeft = "8px";

        deleteButton.addEventListener("click", async () => {
            const token = sessionStorage.getItem("hackarenaOrganizerToken");
            const problemId = problem.id || problem._id;

            if (!token || !problemId) {
                document.getElementById("problem-status").textContent =
                    "Organizer login or Problem ID is missing.";
                return;
            }

            const confirmed = window.confirm(
                "Are you sure you want to delete problem " +
                (problem.code || "") +
                "? Problems already selected by teams cannot be deleted."
            );

            if (!confirmed) return;

            deleteButton.disabled = true;

            try {
                const response = await fetch(
                    window.HACKARENA_API + "/api/problems/" + problemId,
                    {
                        method: "DELETE",
                        headers: {
                            "Authorization": "Bearer " + token
                        }
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Could not delete problem.");
                }

                organizerData.problems = organizerData.problems.filter(
                    (item) => String(item.id || item._id) !== String(problemId)
                );

                if (String(editingProblemId) === String(problemId)) {
                    problemForm.reset();
                    editingProblemId = null;
                    problemForm.querySelector('button[type="submit"]').textContent =
                        "Check Problem Details";
                }

                renderProblems();
                document.getElementById("problem-status").textContent =
                    "Problem deleted successfully.";

            } catch (error) {
                document.getElementById("problem-status").textContent = error.message;
                deleteButton.disabled = false;
            }
        });

        statusCell.append(deleteButton);
        row.append(statusCell);
        list.append(row);
    });
}


// ---------------------------------
// PROBLEM FILE SELECTION
// ---------------------------------

const problemFileInput =
    document.getElementById("problem-file");

const uploadPdfButton =
    document.getElementById("upload-problem-pdf");

const confirmPdfImportButton =
    document.getElementById("confirm-problem-import");

const pdfStatus =
    document.getElementById("problem-file-status");

const pdfPreview =
    document.getElementById("problem-pdf-preview");

const pdfPreviewBody =
    document.getElementById("problem-pdf-preview-body");

const pdfPreviewSummary =
    document.getElementById("problem-pdf-preview-summary");

let extractedPdfProblems = [];

problemFileInput.addEventListener("change", () => {

    const file = problemFileInput.files[0];

    pdfPreview.hidden = true;
    pdfPreviewBody.replaceChildren();

    extractedPdfProblems = [];

    confirmPdfImportButton.disabled = true;

    if (!file) {
        pdfStatus.textContent = "Please select a PDF file.";
        uploadPdfButton.disabled = true;
        return;
    }

    if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
    ) {
        pdfStatus.textContent = "Only PDF files are allowed.";
        uploadPdfButton.disabled = true;
        problemFileInput.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        pdfStatus.textContent = "PDF size must be below 10 MB.";
        uploadPdfButton.disabled = true;
        problemFileInput.value = "";
        return;
    }

    pdfStatus.textContent = "Selected: " + file.name;
    uploadPdfButton.disabled = false;

});

uploadPdfButton.addEventListener("click", async () => {

    const file = problemFileInput.files[0];

    const token = sessionStorage.getItem(
        "hackarenaOrganizerToken"
    );

    if (!token) {
        window.location.replace("./index.html");
        return;
    }

    if (!file) {
        pdfStatus.textContent = "Please select a PDF file.";
        return;
    }

    const formData = new FormData();
    formData.append("pdfFile", file);

    uploadPdfButton.disabled = true;
    confirmPdfImportButton.disabled = true;

    pdfStatus.textContent = "Extracting problem statements...";

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/problems/import/pdf/preview",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token
                },
                body: formData
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "PDF extraction failed."
            );
        }

        if (
            !Array.isArray(result.problems) ||
            result.problems.length === 0
        ) {
            throw new Error("No problem statements found.");
        }

        extractedPdfProblems = result.problems;

        pdfPreviewBody.replaceChildren();

        extractedPdfProblems.forEach((problem) => {

            const row = document.createElement("tr");

            const values = [
                problem.serialNumber,
                problem.code,
                problem.organization,
                problem.title,
                problem.category,
                problem.submittedIdeasCount,
                problem.theme
            ];

            values.forEach((value) => {

                const cell = document.createElement("td");

                cell.textContent =
                    value === null || value === undefined
                        ? ""
                        : String(value);

                row.appendChild(cell);

            });

            pdfPreviewBody.appendChild(row);

        });

        pdfPreviewSummary.textContent =
            "Found " + result.totalProblems +
            " problem statements across " +
            result.totalPages + " pages.";

        pdfPreview.hidden = false;

        confirmPdfImportButton.disabled = false;

        pdfStatus.textContent =
            "PDF extracted successfully! Review the problems and confirm import.";

    } catch (error) {

        pdfStatus.textContent = error.message;

    } finally {

        uploadPdfButton.disabled = false;

    }

});


confirmPdfImportButton.addEventListener("click", async () => {

    const token = sessionStorage.getItem(
        "hackarenaOrganizerToken"
    );

    if (!token) {
        window.location.replace("./index.html");
        return;
    }

    if (extractedPdfProblems.length === 0) {
        pdfStatus.textContent = "Please extract a PDF first.";
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to import these problem statements into HackArena?"
    );

    if (!confirmed) {
        return;
    }

    confirmPdfImportButton.disabled = true;

    pdfStatus.textContent = "Importing problems into MongoDB...";

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/problems/import/pdf/confirm",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({
                    problems: extractedPdfProblems
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Problem import failed."
            );
        }

        pdfStatus.textContent =
            "Import completed! Imported: " +
            result.importedCount +
            " | Skipped: " +
            result.skippedCount;

        extractedPdfProblems = [];

        await loadProblems();

    } catch (error) {

        pdfStatus.textContent = error.message;
        confirmPdfImportButton.disabled = false;

    }

});


 


 // ---------------------------------
// JUDGE INVITATIONS
// ---------------------------------

const judgeApiUrl = window.HACKARENA_API + "/api/judges";

const judgeForm = document.getElementById("judge-form");

async function loadJudges() {

    const list = document.getElementById("judges-list");
    const empty = document.getElementById("judges-empty");

    try {

       const token = sessionStorage.getItem("hackarenaOrganizerToken");
        const response = await fetch(
            `${judgeApiUrl}/invitations`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load judges.");
        }

       organizerData.judges = data.invitations.map(invitation => ({
    id: invitation._id,
    name: invitation.name,
    email: invitation.email,
    invitationStatus: invitation.status
}));
        renderJudges();

    } catch (error) {

        console.error("Judge Loading Error:", error);

        empty.hidden = false;
        empty.querySelector("p").textContent =
            error.message;

    }
}

judgeForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!validateForm(judgeForm)) {
        return;
    }

    const status = document.getElementById("judge-status");

    const name = document.getElementById("judge-name").value.trim();
    const email = document.getElementById("judge-email").value.trim();

const token = sessionStorage.getItem("hackarenaOrganizerToken");

    try {

        status.textContent = "Sending invitation...";

        const response = await fetch(`${judgeApiUrl}/invite`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                name: name,
                email: email
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Invitation failed.");
        }

        status.textContent = data.message +
    (data.emailStatus ? " | " + data.emailStatus : "");

        judgeForm.reset();

        await loadJudges();

    } catch (error) {

        status.textContent = error.message;

        console.error("Judge Invitation Error:", error);

    }

});


function renderJudges() {
    const list = document.getElementById("judges-list");
    const empty = document.getElementById("judges-empty");

    list.replaceChildren();

    empty.hidden = organizerData.judges.length > 0;

    organizerData.judges.forEach((judge) => {
        const row = document.createElement("tr");

        [
            judge.name,
            judge.email,
            judge.invitationStatus
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = String(value ?? "—");
            row.append(cell);
        });

        const actionCell = document.createElement("td");

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "secondary-button";

        deleteButton.addEventListener("click", async () => {
            const confirmed = window.confirm(
                "Are you sure you want to delete this judge invitation?"
            );

            if (!confirmed) return;

            const token = sessionStorage.getItem("hackarenaOrganizerToken");

            deleteButton.disabled = true;

            try {
                const response = await fetch(
                    `${judgeApiUrl}/invitations/${judge.id}`,
                    {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Unable to delete invitation.");
                }

                await loadJudges();

            } catch (error) {
                alert(error.message);
                deleteButton.disabled = false;
            }
        });

        actionCell.append(deleteButton);
        row.append(actionCell);

        list.append(row);
    });
}
// ---------------------------------
// AUTOMATIC PROJECT ASSIGNMENT
// ---------------------------------

const assignProjectsButton = document.getElementById(
    "assign-projects-button"
);

assignProjectsButton.addEventListener("click", async () => {

    const status = document.getElementById("assignment-status");
    const results = document.getElementById("assignment-results");
    const summary = document.getElementById("assignment-summary");

    const token = sessionStorage.getItem("hackarenaOrganizerToken");

    if (!token) {
        status.textContent = "Please login as an organizer first.";
        return;
    }

    assignProjectsButton.disabled = true;
    status.textContent = "Assigning projects to accepted judges...";
    results.hidden = true;

    try {

        const response = await fetch(
            `${judgeApiUrl}/assignments/sync`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Project assignment failed."
            );
        }

        status.textContent = data.message;

        summary.textContent =
            "Accepted Judges: " + data.assignedJudges +
            " | Newly Assigned Projects: " + data.assignedProjects +
            " | Total Submitted Projects: " +
            (data.totalSubmittedProjects ?? 0);

        results.hidden = false;

    } catch (error) {

        status.textContent = error.message;

        console.error("Project Assignment Error:", error);

    } finally {

        assignProjectsButton.disabled = false;

    }

});

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

async function controlTimer(action, hours = 0, minutes = 0) {
    const status = document.getElementById("timer-status");

    try {
        const token = sessionStorage.getItem(
            "hackarenaOrganizerToken"
        );

        const response = await fetch(
            window.HACKARENA_API + "/api/event/timer",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({
                    action,
                    hours,
                    minutes
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message);
        }

        status.textContent = data.message;

        return data.timer;

    } catch (error) {
        status.textContent = error.message;
        return null;
    }
}

document.getElementById("timer-form")
    .addEventListener("submit", async (event) => {

        event.preventDefault();

        const duration = readDuration(
            "timer-hours",
            "timer-minutes"
        );

        if (!duration) {
            document.getElementById("timer-status")
                .textContent = "Enter a valid duration.";

            return;
        }

        await controlTimer(
            "start",
            duration.hours,
            duration.minutes
        );
    });

document.getElementById("stop-timer")
    .addEventListener("click", async () => {

        if (!confirm("Are you sure you want to stop the timer?")) {
            return;
        }

        const timer = await controlTimer("stop");

        if (timer) {
            await loadLiveTimer();
        }
    });
// PAUSE TIMER

document.getElementById("pause-timer")
    .addEventListener("click", async () => {

        await controlTimer("pause");
        await loadLiveTimer();
    });

// RESUME TIMER

document.getElementById("resume-timer")
    .addEventListener("click", async () => {

        await controlTimer("resume");
        await loadLiveTimer();
    });

// RESET TIMER

document.getElementById("reset-timer")
    .addEventListener("click", async () => {

        if (!confirm("Are you sure you want to reset the timer?")) {
            return;
        }

        await controlTimer("reset");
        await loadLiveTimer();
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
    .addEventListener("submit", async (event) => {

        event.preventDefault();

        const form = event.currentTarget;

        if (!validateForm(form)) {
            return;
        }

        const duration = readDuration(
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

        const scope = extensionScope.value;

        if (scope === "countdown") {

            const timer = await controlTimer(
                "extend",
                duration.hours,
                duration.minutes
            );

            if (timer) {
                status.textContent =
                    "Hackathon countdown extended successfully.";

                await loadLiveTimer();
            } else {
                status.textContent =
                    document.getElementById("timer-status").textContent;
            }

            return;
        }
try {

    const token = sessionStorage.getItem(
        "hackarenaOrganizerToken"
    );

    const response = await fetch(
        window.HACKARENA_API + "/api/event/timer/extra-time",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },

            body: JSON.stringify({
                scope: scope,
                teamId: extensionTeam.value.trim(),
                hours: duration.hours,
                minutes: duration.minutes
            })
        }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message);
    }
status.textContent = data.message;

await loadLiveTimer();

if (scope === "event") {
    await loadSavedEventInformation();
}

} catch (error) {

    status.textContent = error.message;

}
    });

// ---------------------------------
// SUBMISSION MONITORING
// ---------------------------------

// LOAD OFFICIAL SUBMISSIONS FROM MONGODB

async function loadSubmissions() {

    const status = document.getElementById("submissions-status");
    const refreshButton = document.getElementById("refresh-submissions");

    const token = sessionStorage.getItem(
        "hackarenaOrganizerToken"
    );

    if (!token) {
        window.location.replace("./index.html");
        return;
    }

    refreshButton.disabled = true;
    status.textContent = "Loading submitted projects...";

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/submissions/organizer/all",
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
            throw new Error(
                result.message || "Unable to load submissions."
            );
        }

        if (!Array.isArray(result.submissions)) {
            throw new Error("Invalid submission data.");
        }

        organizerData.submissions = result.submissions;

        renderSubmissions();

        status.textContent =
            result.submissions.length +
            " submitted projects loaded successfully.";

    } catch (error) {

        console.error("Submission Loading Error:", error);

        status.textContent = error.message;

    } finally {

        refreshButton.disabled = false;

    }
}

document.getElementById("refresh-submissions")
    .addEventListener("click", loadSubmissions);

function renderSubmissions() {

    const list = document.getElementById("submissions-list");
    const empty = document.getElementById("submissions-empty");

    list.replaceChildren();

    empty.hidden = organizerData.submissions.length > 0;

    if (organizerData.submissions.length === 0) {

        empty.querySelector("h3").textContent =
            "No Submitted Projects";

        empty.querySelector("p").textContent =
            "Official project submissions will appear here.";

        return;
    }

    organizerData.submissions.forEach((submission) => {

        const row = document.createElement("tr");

        function addCell(value) {

            const cell = document.createElement("td");

            cell.textContent = String(value ?? "—");

            row.appendChild(cell);

            return cell;
        }

        // TEAM DETAILS

        addCell(
            submission.team?.teamName || "Unknown Team"
        );

        // PROBLEM DETAILS

        const problemCell = addCell(
            submission.problem?.code || "—"
        );

        const problemTitle = document.createElement("p");

        problemTitle.textContent =
            submission.problem?.title || "";

        problemCell.appendChild(problemTitle);

        // PROJECT DETAILS

        const projectCell = document.createElement("td");

        const projectTitle = document.createElement("strong");

        projectTitle.textContent =
            submission.projectTitle || "Untitled Project";

        const details = document.createElement("details");

        const summary = document.createElement("summary");

        summary.textContent = "View Project Details";

        const description = document.createElement("p");

        description.textContent =
            submission.description || "No description provided.";

        const technologies = document.createElement("p");

        technologies.textContent =
            "Technologies: " +
            (submission.technologies || "Not provided");

        details.append(summary, description, technologies);

        function addProjectLink(label, url) {

            if (!url) return;

            try {

                const parsedUrl = new URL(url);

                if (
                    parsedUrl.protocol !== "https:" &&
                    parsedUrl.protocol !== "http:"
                ) {
                    return;
                }

                const paragraph = document.createElement("p");

                const link = document.createElement("a");

                link.textContent = label;
                link.href = parsedUrl.href;
                link.target = "_blank";
                link.rel = "noopener noreferrer";

                paragraph.appendChild(link);

                details.appendChild(paragraph);

            } catch (error) {

                console.warn("Invalid project URL.");

            }
        }

        addProjectLink(
            "View GitHub Repository",
            submission.githubUrl
        );

        addProjectLink(
            "View Live Demo",
            submission.liveDemoUrl
        );

        projectCell.append(projectTitle, details);

        row.appendChild(projectCell);

        // PRESENTATION DOWNLOAD

        const presentationCell = document.createElement("td");

        const presentation = submission.presentation;

        if (presentation?.fileName) {

            const fileName = document.createElement("p");

            fileName.textContent =
                presentation.originalName ||
                presentation.fileName;

            const downloadButton =
                document.createElement("button");

            downloadButton.type = "button";

            downloadButton.className = "secondary-button";

            downloadButton.textContent = "Download Presentation";

            downloadButton.addEventListener("click", async () => {

                const status = document.getElementById(
                    "submissions-status"
                );

                const token = sessionStorage.getItem(
                    "hackarenaOrganizerToken"
                );

                if (!token) {

                    window.location.replace("./index.html");

                    return;
                }

                downloadButton.disabled = true;

                downloadButton.textContent = "Downloading...";

                try {

                    const response = await fetch(

                        window.HACKARENA_API +
                        "/api/submissions/organizer/presentation/" +
                        encodeURIComponent(presentation.fileName),

                        {
                            headers: {
                                "Authorization": "Bearer " + token
                            },
                            cache: "no-store"
                        }
                    );

                    if (!response.ok) {

                        throw new Error(
                            "Unable to download presentation."
                        );
                    }

                    const blob = await response.blob();

                    const url = URL.createObjectURL(blob);

                    const link = document.createElement("a");

                    link.href = url;

                    link.download =
                        presentation.originalName ||
                        presentation.fileName;

                    document.body.appendChild(link);

                    link.click();

                    link.remove();

                    setTimeout(() => {

                        URL.revokeObjectURL(url);

                    }, 1000);

                    status.textContent =
                        "Presentation downloaded successfully.";

                } catch (error) {

                    status.textContent = error.message;

                } finally {

                    downloadButton.disabled = false;

                    downloadButton.textContent =
                        "Download Presentation";
                }
            });

            presentationCell.append(
                fileName,
                downloadButton
            );

        } else {

            presentationCell.textContent =
                "No Presentation";
        }

        row.appendChild(presentationCell);

        // SUBMISSION STATUS

        const submissionCell = document.createElement("td");

        const submissionBadge = document.createElement("span");

        submissionBadge.className = "status-pill available";

        submissionBadge.textContent = "Submitted";

        submissionCell.appendChild(submissionBadge);

        row.appendChild(submissionCell);

        // JUDGING STATUS

        const judgingCell = document.createElement("td");

        const judgingBadge = document.createElement("span");

        judgingBadge.className = "status-pill";

        if (submission.status === "evaluated") {

            judgingBadge.textContent = "Evaluated";

            judgingBadge.classList.add("available");

        } else {

            judgingBadge.textContent = "Pending";

            judgingBadge.classList.add("draft");
        }

        judgingCell.appendChild(judgingBadge);

        row.appendChild(judgingCell);

        list.appendChild(row);
    });
}

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
      number > 10000
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
    ? `${Number(total.toFixed(2))} marks`
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
  marksInput.max = "10000";
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

function loadCriteriaInDashboard(savedCriteria) {

  if (!Array.isArray(savedCriteria) || savedCriteria.length === 0) {
    return;
  }

  criteriaList.replaceChildren();

  savedCriteria.forEach((criterion) => {
    addCriterion(criterion.name, criterion.maximum);
  });

  updateRubricTotal();
}

// ---------------------------------
// CRITERIA FORM
// ---------------------------------

document.getElementById("criteria-form")
  .addEventListener("submit", async (event) => {

    event.preventDefault();

    const form = event.currentTarget;

    if (!validateForm(form)) {
      return;
    }

    const status = document.getElementById("criteria-status");
    const token = sessionStorage.getItem("hackarenaOrganizerToken");

    if (!token) {
      window.location.replace("./index.html");
      return;
    }

    const names = Array.from(
      criteriaList.querySelectorAll(".criterion-name")
    );

    const marks = Array.from(
      criteriaList.querySelectorAll(".criterion-marks")
    );

    const evaluationCriteria = [];
    const usedNames = new Set();

    for (let i = 0; i < names.length; i++) {

      const name = names[i].value.trim();
      const maximum = Number(marks[i].value);
      const normalizedName = name.toLowerCase();

      if (
        !name ||
        name.length > 100 ||
        !Number.isFinite(maximum) ||
        maximum <= 0 ||
        maximum > 10000
      ) {
        status.textContent = "Please enter valid criteria and marks.";
        return;
      }

      if (usedNames.has(normalizedName)) {
        status.textContent = "Each criterion must have a unique name.";
        return;
      }

      usedNames.add(normalizedName);

      evaluationCriteria.push({
        name,
        maximum
      });
    }

    if (evaluationCriteria.length === 0 || evaluationCriteria.length > 30) {
      status.textContent = "Add between 1 and 30 judging criteria.";
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    status.textContent = "Saving judging criteria...";

    try {

      const response = await fetch(
        eventApiUrl + "/criteria",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          },
          body: JSON.stringify({
            evaluationCriteria
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not save judging criteria."
        );
      }

      organizerData.eventSettings = {
        ...(organizerData.eventSettings || {}),
        evaluationCriteria: result.evaluationCriteria || evaluationCriteria
      };

      cacheEventInformation(organizerData.eventSettings);

      status.textContent =
        "Judging criteria saved successfully! Total: " +
        (result.totalMarks ??
          evaluationCriteria.reduce((sum, item) => sum + item.maximum, 0)) +
        " marks.";

    } catch (error) {

      console.error("Criteria Save Error:", error);
      status.textContent = error.message;

    } finally {

      if (submitButton) {
        submitButton.disabled = false;
      }
    }
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

const announcementApiUrl =
  window.HACKARENA_API + "/api/announcements";

announcementForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (!validateForm(announcementForm)) {
    return;
  }

  const status =
    document.getElementById("announcement-status");

  const button =
    announcementForm.querySelector('button[type="submit"]');

  const announcement = {

    title: document.getElementById(
      "announcement-title"
    ).value.trim(),

    message: document.getElementById(
      "announcement-message"
    ).value.trim(),

    audience: document.getElementById(
      "announcement-audience"
    ).value,

    priority: document.getElementById(
      "announcement-priority"
    ).value

  };

  if (!announcement.title || !announcement.message) {
    status.textContent = "Enter title and message.";
    return;
  }

  if (!confirm("Publish this announcement to the selected audience?")) {
    return;
  }

  button.disabled = true;
  button.textContent = "Publishing...";

  status.textContent = "Publishing announcement...";

  try {

    const response = await fetch(announcementApiUrl, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " +
          sessionStorage.getItem("hackarenaOrganizerToken")
      },

      body: JSON.stringify(announcement)

    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message);
    }

    status.textContent = data.message;
    status.style.color = "green";

    if (data.emailStatus) {
      status.textContent += " | " + data.emailStatus;
    }

    announcementForm.reset();

    document.getElementById(
      "announcement-preview"
    ).hidden = true;

    await loadAnnouncementHistory();

  } catch (error) {

    status.textContent = error.message;
    status.style.color = "red";

  } finally {

    button.disabled = false;
    button.textContent = "Publish Announcement";

  }

});


// ---------------------------------
// ANNOUNCEMENT HISTORY
// ---------------------------------

async function loadAnnouncementHistory() {

  const history =
    document.getElementById("announcement-history");

  try {

    const response = await fetch(announcementApiUrl, {

      headers: {
        "Authorization": "Bearer " +
          sessionStorage.getItem("hackarenaOrganizerToken")
      },

      cache: "no-store"

    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message);
    }

    history.replaceChildren();

    if (!data.announcements.length) {

      history.textContent = "No announcements published yet.";
      return;

    }

    data.announcements.forEach(announcement => {

      const card = document.createElement("article");

      card.className = "empty-state";
      card.style.marginTop = "15px";

      const title = document.createElement("h3");
      title.textContent = announcement.title;

      const message = document.createElement("p");
      message.textContent = announcement.message;

      const audience = document.createElement("p");
      audience.textContent =
        "Audience: " + announcement.audience.toUpperCase();

      const priority = document.createElement("strong");
      priority.textContent =
        "Priority: " + announcement.priority.toUpperCase();

      priority.style.color =
        announcement.priority === "urgent"
          ? "red"
          : announcement.priority === "important"
          ? "orange"
          : "green";

      const date = document.createElement("p");

      date.textContent =
        "Published: " +
        new Date(announcement.createdAt).toLocaleString("en-IN");

      const deleteButton = document.createElement("button");

      deleteButton.type = "button";
      deleteButton.className = "button secondary";
      deleteButton.textContent = "Delete Announcement";

      deleteButton.addEventListener("click", () => {
        deleteAnnouncement(announcement._id);
      });

      card.append(
        title,
        message,
        audience,
        priority,
        date,
        deleteButton
      );

      history.append(card);

    });

  } catch (error) {

    history.textContent =
      "Unable to load announcements: " + error.message;

  }

}


// ---------------------------------
// DELETE ANNOUNCEMENT
// ---------------------------------

async function deleteAnnouncement(id) {

  if (!confirm(
    "Delete this announcement from dashboards? Already sent emails cannot be recalled."
  )) {
    return;
  }

  try {

    const response = await fetch(
      announcementApiUrl + "/" + id,
      {
        method: "DELETE",

        headers: {
          "Authorization": "Bearer " +
            sessionStorage.getItem("hackarenaOrganizerToken")
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message);
    }

    await loadAnnouncementHistory();

    alert("Announcement deleted successfully.");

  } catch (error) {

    alert(error.message);

  }

}

if (sessionStorage.getItem("hackarenaOrganizerToken")) {
  loadAnnouncementHistory();
}
// ---------------------------------
// ANALYTICS
// ---------------------------------

function updateAnalytics(stats) {

    const fields = {
        "analytics-teams": "totalTeams",
        "analytics-submissions": "totalSubmissions",
        "analytics-full": "fullProblems",
        "analytics-problems": "totalProblems",
        "analytics-selected": "selectedTeams",
        "analytics-pending": "pendingSubmissions",
        "analytics-drafts": "draftSubmissions",
        "analytics-final": "finalSubmissions",
        "analytics-evaluated": "evaluatedProjects"
    };

    Object.entries(fields).forEach(([elementId, key]) => {

        const element = document.getElementById(elementId);

        if (element) {
            element.textContent = stats?.[key] ?? "Not loaded";
        }

    });

    document.getElementById("analytics-completion").textContent =
        stats?.submissionCompletion != null
            ? stats.submissionCompletion + "%"
            : "Not loaded";

    document.getElementById("analytics-judging").textContent =
        stats?.evaluationProgress != null
            ? stats.evaluationProgress + "% Evaluated"
            : "Not loaded";

    document.getElementById("analytics-progress").textContent =
        stats?.totalTeams != null
            ? stats.evaluatedProjects + " of " +
              stats.totalTeams + " registered teams evaluated"
            : "Not loaded";
}

async function loadLiveAnalytics() {

    const token = sessionStorage.getItem("hackarenaOrganizerToken");

    if (!token) return;

    try {

        const response = await fetch(
            window.HACKARENA_API + "/api/analytics",
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

       updateAnalytics(data.analytics);

updateSubmissionStats({
    submitted: data.analytics.finalSubmissions,
    pending: data.analytics.pendingSubmissions,
    evaluated: data.analytics.evaluatedProjects
});
renderAnalyticsCharts(data.analytics);


    } catch (error) {

        console.error("Analytics Loading Error:", error);

        document.getElementById("analytics-progress").textContent =
            "Unable to load analytics";

    }
}

loadLiveAnalytics();

setInterval(loadLiveAnalytics, 5000);

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
        const token = sessionStorage.getItem("hackarenaOrganizerToken");

        if (!token) {
            window.location.replace("./index.html");
            return;
        }

        const response = await fetch(
            window.HACKARENA_API + "/api/problems/organizer/all",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                },
                cache: "no-store"
            }
        );

        const result = await response.json();

        if (
            !response.ok ||
            !result.success ||
            !Array.isArray(result.problems)
        ) {
            throw new Error(result.message || "Failed to load Problems.");
        }

        organizerData.problems = result.problems;
        renderProblems();

    } catch (error) {
        console.error("Problem Load Error:", error);
        document.getElementById("problem-status").textContent =
            "Could not load saved Problems: " + error.message;
    }
}

async function initializeOrganizer() {

    showPage("overview");

await loadSavedEventInformation();

if (organizerData.eventSettings?.evaluationCriteria) {
  loadCriteriaInDashboard(
    organizerData.eventSettings.evaluationCriteria
  );
}
    loadTeams();
    renderProblems();
    loadProblems();
    await loadJudges();
    renderSubmissions();

   
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
            window.HACKARENA_API + "/api/auth/organizer/me",
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
await initializeOrganizer();

// Hide frontend preview banner
const previewBanner = document.querySelector(".preview-banner");

if (previewBanner) {
    previewBanner.hidden = true;
}

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
// LIVE HACKATHON COUNTDOWN

let liveTimerData = null;
let timerServerOffset = 0;

async function loadLiveTimer() {
    try {
        const response = await fetch(
            window.HACKARENA_API + "/api/event/timer",
            { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("Timer unavailable");
        }

        liveTimerData = data.timer;

        timerServerOffset =
            data.timer.serverTime - Date.now();

        displayLiveTimer();

    } catch (error) {
        liveTimerData = null;

        document.getElementById("overview-timer")
            .textContent = "Not connected";
    }
}

function displayLiveTimer() {

    if (!liveTimerData) return;

    let remaining = liveTimerData.remaining;

    if (liveTimerData.status === "running") {
        remaining = Math.max(
            0,
            Math.ceil(
                (
                    new Date(liveTimerData.endAt).getTime()
                    - Date.now()
                    - timerServerOffset
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

    const countdown = `${hours}:${minutes}:${seconds}`;

    const overview = document.getElementById("overview-timer");

    if (liveTimerData.status === "idle") {
        overview.textContent = "Not Started";
    } else if (remaining === 0) {
        overview.textContent = "Time Over";
    } else if (liveTimerData.status === "paused") {
        overview.textContent = countdown + " (Paused)";
    } else {
        overview.textContent = countdown;
    }
}

loadLiveTimer();

setInterval(loadLiveTimer, 3000);
setInterval(displayLiveTimer, 1000);

// GRAPHICAL ANALYTICS

function renderAnalyticsCharts(stats) {

    if (!stats) return;

    const canvas = document.getElementById("submission-chart");

    if (canvas) {

        canvas.width = 300;
        canvas.height = 300;

        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, 300, 300);

        const values = [
            Math.max(0, stats.pendingSubmissions - stats.draftSubmissions),
            stats.draftSubmissions,
            Math.max(0, stats.finalSubmissions - stats.evaluatedProjects),
            stats.evaluatedProjects
        ];

        const colors = [
            "#ef4444",
            "#f59e0b",
            "#2563eb",
            "#16a34a"
        ];

        const labels = [
            "Not Submitted",
            "Draft",
            "Submitted",
            "Evaluated"
        ];

        const total = values.reduce((sum, value) => sum + value, 0);

        let startAngle = -Math.PI / 2;

        if (total > 0) {

            values.forEach((value, index) => {

                if (value <= 0) return;

                const angle = value / total * Math.PI * 2;

                ctx.beginPath();

                ctx.arc(
                    150, 100, 75,
                    startAngle,
                    startAngle + angle
                );

                ctx.lineWidth = 32;
                ctx.strokeStyle = colors[index];
                ctx.stroke();

                startAngle += angle;

            });

        } else {

            ctx.beginPath();
            ctx.arc(150, 100, 75, 0, Math.PI * 2);
            ctx.lineWidth = 32;
            ctx.strokeStyle = "#9ca3af";
            ctx.stroke();

        }

        const textColor = getComputedStyle(canvas).color;

        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.font = "bold 28px Arial";
        ctx.fillText(total, 150, 100);

        ctx.font = "12px Arial";
        ctx.fillText("Total Teams", 150, 120);

        ctx.textAlign = "left";

        labels.forEach((label, index) => {

            const y = 210 + index * 22;

            ctx.fillStyle = colors[index];
            ctx.fillRect(40, y - 10, 12, 12);

            ctx.fillStyle = textColor;
            ctx.font = "13px Arial";

            ctx.fillText(
                label + ": " + values[index],
                62,
                y
            );

        });

    }

    document.getElementById(
        "submission-progress-bar"
    ).style.width = stats.submissionCompletion + "%";

    document.getElementById(
        "submission-progress-label"
    ).textContent = stats.submissionCompletion +
        "% of registered teams have submitted";

    document.getElementById(
        "evaluation-progress-bar"
    ).style.width = stats.evaluationProgress + "%";

    document.getElementById(
        "evaluation-progress-label"
    ).textContent = stats.evaluationProgress +
        "% of submitted projects evaluated";

    const distribution = document.getElementById(
        "problem-distribution"
    );

    distribution.replaceChildren();

    const problems = [...(stats.problemDistribution || [])];

    problems.sort(
        (a, b) => b.selectedTeams - a.selectedTeams
    );

    problems.forEach(problem => {

        const item = document.createElement("div");
        item.className = "problem-distribution-item";

        const heading = document.createElement("div");
        heading.className = "problem-distribution-heading";

        const title = document.createElement("span");
        title.textContent = problem.code + " - " + problem.title;

        const count = document.createElement("strong");
        count.textContent =
            problem.selectedTeams + "/" + problem.capacity;

        heading.append(title, count);

        const track = document.createElement("div");
        track.className = "analytics-progress-track";

        const fill = document.createElement("div");

        fill.className =
            "analytics-progress-fill problem-distribution-fill";

        const percentage = problem.capacity > 0
            ? problem.selectedTeams / problem.capacity * 100
            : 0;

        fill.style.width = Math.min(100, percentage) + "%";

        if (problem.selectedTeams >= problem.capacity) {
            fill.style.background = "#ef4444";
        }

        track.append(fill);

        item.append(heading, track);

        distribution.append(item);

    });

}

// OFFICIAL RESULTS PUBLICATION

const publishResultsBtn =
    document.getElementById("publish-results-btn");

let publishingResults = false;

async function loadResultsStatus() {

    const status = document.getElementById(
        "results-publication-status"
    );

    const date = document.getElementById(
        "results-publication-date"
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

        if (data.resultsPublished) {

            status.textContent = "Official Results Published";
            status.style.color = "#16a34a";

            date.textContent = "Published on: " +
                new Date(data.resultsPublishedAt)
                    .toLocaleString("en-IN");

            publishResultsBtn.disabled = true;
            publishResultsBtn.textContent = "Results Published";

        } else {

            status.textContent = "Results Not Published";
            status.style.color = "#d97706";

            date.textContent = "";

            publishResultsBtn.disabled = publishingResults;

        }

    } catch (error) {

        status.textContent = "Unable to load results status";
        publishResultsBtn.disabled = true;

    }

}

publishResultsBtn.addEventListener("click", async () => {

    const confirmed = confirm(
        "Are you sure you want to publish the official hackathon results?"
    );

    if (!confirmed || publishingResults) return;

    const status = document.getElementById(
        "results-action-status"
    );

    publishingResults = true;
    publishResultsBtn.disabled = true;

    status.textContent = "Publishing results...";

    try {

        const token = sessionStorage.getItem(
            "hackarenaOrganizerToken"
        );

        const response = await fetch(
            window.HACKARENA_API + "/api/results/publish",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message);
        }

        status.textContent = data.message;
        status.style.color = "#16a34a";

    } catch (error) {

        status.textContent = error.message;
        status.style.color = "#dc2626";

    } finally {

        publishingResults = false;
        await loadResultsStatus();

    }

});

loadResultsStatus();

setInterval(loadResultsStatus, 5000);

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
