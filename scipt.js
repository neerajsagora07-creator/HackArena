"use strict";

// This is a frontend default.
// Later, load the member limit from organizer settings on the server.
const eventSettings = {
  maxMembersPerTeam: 4
};

// -----------------------------
// PASSWORD SHOW / HIDE
// -----------------------------

document.querySelectorAll(".show-password").forEach((button) => {
  const originalLabel = button.getAttribute("aria-label");

  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const isShowing = input.type === "password";

    input.type = isShowing ? "text" : "password";
    button.textContent = isShowing ? "Hide" : "Show";

    button.setAttribute("aria-pressed", String(isShowing));
    button.setAttribute(
      "aria-label",
      isShowing
        ? originalLabel.replace("Show", "Hide")
        : originalLabel
    );
  });
});

// -----------------------------
// DIALOG CONTROLS
// -----------------------------

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.close);
    dialog.close();
  });
});

const noticeDialog = document.getElementById("notice-dialog");
const noticeMessage = document.getElementById("notice-message");

function showNotice(message) {
  noticeMessage.textContent = message;

  if (!noticeDialog.open) {
    noticeDialog.showModal();
  }
}

// -----------------------------
// LOGIN FORM VALIDATION
// -----------------------------

document.querySelectorAll(".login-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const role = form.dataset.role;

    showNotice(
      `${role} login is not connected yet. ` +
      "The backend will verify your credentials and permissions " +
      "before opening the correct dashboard. " +
      "No login has been performed."
    );
  });
});

// -----------------------------
// TEAM REGISTRATION
// -----------------------------

const registerDialog = document.getElementById("register-dialog");
const registerForm = document.getElementById("register-form");
const registerStatus = document.getElementById("register-status");

document.getElementById("open-register").addEventListener("click", () => {
  registerStatus.textContent = "";
  registerDialog.showModal();
});

const addMemberButton = document.getElementById("add-member");
const memberList = document.getElementById("member-list");
const memberCount = document.getElementById("member-count");

let memberSequence = 0;

function updateMemberCount() {
  const totalMembers = memberList.children.length + 1;

  memberCount.textContent =
    `${totalMembers} / ${eventSettings.maxMembersPerTeam} members ` +
    "(including the leader)";

  addMemberButton.disabled =
    totalMembers >= eventSettings.maxMembersPerTeam;
}

addMemberButton.addEventListener("click", () => {
  const totalMembers = memberList.children.length + 1;

  if (totalMembers >= eventSettings.maxMembersPerTeam) {
    return;
  }

  memberSequence += 1;

  const inputId = `member-name-${memberSequence}`;

  const row = document.createElement("div");
  row.className = "member-row";

  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.htmlFor = inputId;
  label.textContent = "Member name";

  const input = document.createElement("input");
  input.id = inputId;
  input.name = "memberNames[]";
  input.type = "text";
  input.placeholder = "Enter member name";
  input.required = true;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-member";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", "Remove this member");

  removeButton.addEventListener("click", () => {
    row.remove();
    updateMemberCount();
    addMemberButton.focus();
  });

  field.append(label, input);
  row.append(field, removeButton);
  memberList.append(row);

  updateMemberCount();
  input.focus();
});

updateMemberCount();

// Clear name validation messages when the user types.
registerForm.addEventListener("input", (event) => {
  if (event.target.matches('input[type="text"]')) {
    event.target.setCustomValidity("");
  }

  registerStatus.textContent = "";
});

const registerPassword = document.getElementById("register-password");
const confirmPassword = document.getElementById("confirm-password");

function checkPasswordMatch() {
  const mismatch =
    confirmPassword.value !== "" &&
    registerPassword.value !== confirmPassword.value;

  confirmPassword.setCustomValidity(
    mismatch ? "Passwords do not match." : ""
  );
}

registerPassword.addEventListener("input", checkPasswordMatch);
confirmPassword.addEventListener("input", checkPasswordMatch);

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  checkPasswordMatch();

  const nameInputs = registerForm.querySelectorAll('input[type="text"]');

  nameInputs.forEach((input) => {
    input.setCustomValidity(
      input.value.trim() ? "" : "Please enter a valid name."
    );
  });

  if (!registerForm.reportValidity()) {
    return;
  }

  registerStatus.textContent =
    "Frontend details checked. Registration has not been saved. " +
    "Email verification, capacity checks and unique Team ID generation " +
    "will work after the backend is connected.";
});

// -----------------------------
// TEAM ID / PASSWORD RECOVERY
// -----------------------------

const recoveryDialog = document.getElementById("recovery-dialog");
const recoveryTitle = document.getElementById("recovery-title");
const recoveryDescription = document.getElementById(
  "recovery-description"
);
const recoveryForm = document.getElementById("recovery-form");
const recoveryStatus = document.getElementById("recovery-status");

const recoveryContent = {
  "team-id": {
    title: "Forgot Team ID?",
    description:
      "Enter your team leader's registered email. " +
      "The connected system will verify an email OTP before " +
      "providing your Team ID."
  },

  "team-password": {
    title: "Reset team password",
    description:
      "Enter your team leader's registered email to begin " +
      "password recovery."
  },

  "judge-password": {
    title: "Reset judge password",
    description:
      "Enter the email associated with your invited judge account."
  },

  "organizer-password": {
    title: "Reset organizer password",
    description:
      "Enter the email associated with your authorized organizer account."
  }
};

document.querySelectorAll("[data-recovery]").forEach((button) => {
  button.addEventListener("click", () => {
    const option = recoveryContent[button.dataset.recovery];

    recoveryForm.reset();
    recoveryStatus.textContent = "";

    recoveryTitle.textContent = option.title;
    recoveryDescription.textContent = option.description;

    recoveryDialog.showModal();
  });
});

recoveryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  recoveryStatus.textContent =
    "Recovery is not connected yet. No OTP or email has been sent. " +
    "The backend and email service will handle verification.";
});

// No passwords are saved in browser storage.
// No fake Team IDs, authentication or OTPs are generated.