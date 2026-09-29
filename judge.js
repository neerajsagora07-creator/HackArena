"use strict";

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
// DEFAULT RUBRIC
// Later load the event rubric from
// Organizer settings on the backend.
// ---------------------------------

const criteria = [
  { id: "innovation", label: "Innovation", maximum: 25 },
  {
    id: "technical",
    label: "Technical Implementation",
    maximum: 25
  },
  { id: "impact", label: "Impact", maximum: 20 },
  { id: "uiux", label: "UI/UX", maximum: 15 },
  { id: "presentation", label: "Presentation", maximum: 15 }
];

const criteriaList = document.getElementById("criteria-list");
const totalScore = document.getElementById("total-score");
const evaluationForm = document.getElementById("evaluation-form");
const evaluationStatus = document.getElementById("evaluation-status");
const evaluationFields = document.getElementById("evaluation-fields");

// No fabricated project is selected.
let selectedSubmission = null;

const maximumTotal = criteria.reduce(
  (total, criterion) => total + criterion.maximum,
  0
);

function renderCriteria() {
  criteriaList.replaceChildren();

  criteria.forEach((criterion) => {
    const row = document.createElement("div");
    row.className = "criterion";

    const label = document.createElement("label");
    label.htmlFor = `score-${criterion.id}`;
    label.append(document.createTextNode(criterion.label));

    const maximumLabel = document.createElement("small");
    maximumLabel.textContent = `Maximum ${criterion.maximum} marks`;
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

function updateTotal() {
  let total = 0;
  let invalid = false;

  criteria.forEach((criterion) => {
    const input = document.getElementById(`score-${criterion.id}`);
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
// EVALUATION SUBMISSION
// ---------------------------------

evaluationForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!selectedSubmission) {
    evaluationStatus.textContent =
      "Select an available submission before entering an evaluation.";
    return;
  }

  updateTotal();

  if (!evaluationForm.reportValidity()) {
    return;
  }

  evaluationStatus.textContent =
    "Evaluation submission is not connected yet. " +
    "No marks or feedback have been saved.";
});

// The backend will provide authorized submissions.
// Only after a valid project is selected should this fieldset be enabled.
evaluationFields.disabled = true;

renderCriteria();

// No sample projects, fake scores or leaderboard data are created.
// Hiding or disabling frontend elements is not authentication:
// the backend must enforce judge permissions and validate all marks.