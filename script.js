
"use strict";

// ====================================
// HACKARENA API SETTINGS
// ====================================

const API_URL = "http://127.0.0.1:5000/api/teams";

const eventSettings = {
    maxMembersPerTeam: 6
};

// Team email for OTP verification
let pendingLeaderEmail =
    sessionStorage.getItem("hackarenaPendingEmail") || "";

// ====================================
// SEND DATA TO BACKEND
// ====================================

async function sendRequest(endpoint, data) {

    let response;

    try {
        response = await fetch(API_URL + endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
    } catch (error) {
        throw new Error(
            "Cannot connect to backend. Please start node SERVER.JS."
        );
    }

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Something went wrong.");
    }

    return result;
}

// ====================================
// PASSWORD SHOW / HIDE
// ====================================

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

// ====================================
// DIALOG CONTROLS
// ====================================

document.querySelectorAll("[data-close]").forEach((button) => {

    button.addEventListener("click", () => {

        const dialog = document.getElementById(
            button.dataset.close
        );

        if (dialog) {
            dialog.close();
        }

    });

});

// ====================================
// PARTICIPANT LOGIN
// ====================================

document.querySelectorAll(".login-form").forEach((form) => {

    const status = form.querySelector(".login-status");

    form.addEventListener("input", () => {
        status.textContent = "";
    });

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const role = form.dataset.role;

        // ORGANIZER LOGIN
        if (role === "Organizer") {

            const email = document.getElementById(
                "organizer-email"
            ).value.trim().toLowerCase();

            const password = document.getElementById(
                "organizer-password"
            ).value;

            const loginButton = form.querySelector(
                'button[type="submit"]'
            );

            loginButton.disabled = true;
            status.textContent = "Checking Organizer Login...";

            try {

                const response = await fetch(
                    "http://127.0.0.1:5000/api/auth/organizer/login",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email: email,
                            password: password
                        })
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success || !result.token) {
                    throw new Error(
                        result.message || "Organizer Login Failed."
                    );
                }

                if (result.organizer?.role !== "organizer") {
                    throw new Error("Organizer access denied.");
                }

                sessionStorage.setItem(
                    "hackarenaOrganizerToken",
                    result.token
                );

                sessionStorage.setItem(
                    "hackarenaOrganizer",
                    JSON.stringify(result.organizer)
                );

                status.textContent = "Organizer Login Successful!";

                window.location.href = "./organizer.html";

            } catch (error) {

                status.textContent = error.message;

            } finally {

                loginButton.disabled = false;

            }

            return;
        }


       
        // ====================================
        // ORGANIZER LOGIN
        // ====================================

        if (role === "Organizer") {

            const email = document.getElementById(
                "organizer-email"
            ).value.trim().toLowerCase();

            const password = document.getElementById(
                "organizer-password"
            ).value;

            const loginButton = form.querySelector(
                'button[type="submit"]'
            );

            loginButton.disabled = true;
            status.textContent = "Checking Organizer credentials...";

            try {

                const response = await fetch(
                    "http://127.0.0.1:5000/api/auth/organizer/login",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email: email,
                            password: password
                        })
                    }
                );

                const result = await response.json();

                if (
                    !response.ok ||
                    !result.success ||
                    !result.token ||
                    result.organizer?.role !== "organizer"
                ) {
                    throw new Error(
                        result.message || "Organizer Login Failed."
                    );
                }

                // Save Organizer session
                sessionStorage.setItem(
                    "hackarenaOrganizerToken",
                    result.token
                );

                sessionStorage.setItem(
                    "hackarenaOrganizer",
                    JSON.stringify(result.organizer)
                );

                status.textContent = "Organizer Login Successful!";

                // Open Organizer Dashboard
                window.location.href = "./organizer.html";

            } catch (error) {

                status.textContent =
                    error instanceof TypeError
                        ? "Cannot connect to backend. Check server."
                        : error.message;

            } finally {

                loginButton.disabled = false;

            }

            return;
        }

        // ====================================
        // JUDGE LOGIN (COMING LATER)
        // ====================================

        if (role === "Judge") {

            status.textContent =
                "Judge login backend is not connected yet.";

            return;
        }


        const teamId = document.getElementById("team-id")
            .value.trim().toUpperCase();

        const password = document.getElementById(
            "team-password"
        ).value;

        const loginButton = form.querySelector(
            'button[type="submit"]'
        );

        loginButton.disabled = true;

        status.textContent = "Checking Team ID and Password...";

        try {

            const result = await sendRequest("/login", {
                teamId: teamId,
                password: password
            });

            // Save temporary login session
            sessionStorage.setItem(
                "hackarenaTeamToken",
                result.token
            );

            sessionStorage.setItem(
                "hackarenaTeam",
                JSON.stringify(result.team)
            );

            status.textContent = "Login Successful!";

            // Open participant dashboard
            window.location.href = "./participant.html";

        } catch (error) {

            status.textContent = error.message;

        } finally {

            loginButton.disabled = false;

        }

    });

});

// ====================================
// TEAM REGISTRATION
// ====================================

const registerDialog = document.getElementById("register-dialog");

const registerForm = document.getElementById("register-form");

const registerStatus = document.getElementById("register-status");

const openRegisterButton = document.getElementById("open-register");

openRegisterButton.addEventListener("click", () => {

    registerStatus.textContent = "";

    registerDialog.showModal();

});

// ====================================
// TEAM MEMBERS
// ====================================

const addMemberButton = document.getElementById("add-member");

const memberList = document.getElementById("member-list");

const memberCount = document.getElementById("member-count");

let memberSequence = 0;

function updateMemberCount() {

    const totalMembers = memberList.children.length + 1;

    memberCount.textContent =
        totalMembers + " / " +
        eventSettings.maxMembersPerTeam +
        " members (including the leader)";

    addMemberButton.disabled =
        totalMembers >= eventSettings.maxMembersPerTeam;

    // Update member numbering automatically
    Array.from(memberList.children).forEach((row, index) => {

        const label = row.querySelector("label");

        if (label) {
            label.textContent = "Member " + (index + 2) + " Name";
        }

    });


}

addMemberButton.addEventListener("click", () => {

    const totalMembers = memberList.children.length + 1;

    if (totalMembers >= eventSettings.maxMembersPerTeam) {
        return;
    }

    memberSequence++;

    const inputId = "member-name-" + memberSequence;

    const row = document.createElement("div");

    row.className = "member-row";

    const field = document.createElement("div");

    field.className = "field";

    const label = document.createElement("label");

    label.htmlFor = inputId;

    label.textContent = "Member name";label.textContent = "Member " + (totalMembers + 1) + " Name";

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

    removeButton.setAttribute(
        "aria-label",
        "Remove this member"
    );

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

// ====================================
// REGISTRATION FORM VALIDATION
// ====================================

const registerPassword = document.getElementById(
    "register-password"
);

const confirmPassword = document.getElementById(
    "confirm-password"
);

function checkPasswordMatch() {

    const mismatch =
        confirmPassword.value !== "" &&
        registerPassword.value !== confirmPassword.value;

    confirmPassword.setCustomValidity(
        mismatch ? "Passwords do not match." : ""
    );

}

registerPassword.addEventListener(
    "input",
    checkPasswordMatch
);

confirmPassword.addEventListener(
    "input",
    checkPasswordMatch
);

registerForm.addEventListener("input", (event) => {

    if (event.target.matches('input[type="text"]')) {
        event.target.setCustomValidity("");
    }

    registerStatus.textContent = "";

});

// ====================================
// REGISTER TEAM USING BACKEND
// ====================================

registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    checkPasswordMatch();

    // Validate team, leader and member names
    const nameInputs = registerForm.querySelectorAll(
        'input[type="text"]'
    );

    nameInputs.forEach((input) => {

        input.setCustomValidity(
            input.value.trim()
                ? ""
                : "Please enter a valid name."
        );

    });

    if (!registerForm.reportValidity()) {
        return;
    }

    const teamName = document.getElementById(
        "register-team-name"
    ).value.trim();

    const leaderName = document.getElementById(
        "leader-name"
    ).value.trim();

    const leaderEmail = document.getElementById(
        "leader-email"
    ).value.trim().toLowerCase();

    const password = registerPassword.value;

    const memberNames = Array.from(
        memberList.querySelectorAll(
            'input[name="memberNames[]"]'
        )
    ).map((input) => input.value.trim());

    if (
        memberNames.length + 1 >
        eventSettings.maxMembersPerTeam
    ) {

        registerStatus.textContent =
            "Team member limit exceeded.";

        return;
    }

    const submitButton = registerForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;

    registerStatus.textContent =
        "Registering team and sending OTP...";

    try {

        const result = await sendRequest("/register", {
            teamName: teamName,
            leaderName: leaderName,
            leaderEmail: leaderEmail,
            memberNames: memberNames,
            password: password
        });

        pendingLeaderEmail = leaderEmail;

        sessionStorage.setItem(
            "hackarenaPendingEmail",
            leaderEmail
        );

        registerStatus.textContent = result.message;

        // Open OTP verification dialog
        registerDialog.close();

        const verifyDialog = document.getElementById(
            "verify-dialog"
        );

        const verifyStatus = document.getElementById(
            "verify-status"
        );

        const verifyForm = document.getElementById(
            "verify-form"
        );

        verifyForm.reset();

        verifyStatus.textContent =
            "OTP sent to your registered email.";

        verifyForm.querySelector(
            'button[type="submit"]'
        ).disabled = false;

        verifyDialog.showModal();

    } catch (error) {

        registerStatus.textContent = error.message;

    } finally {

        submitButton.disabled = false;

    }

});

// ====================================
// EMAIL OTP VERIFICATION
// ====================================

const verifyDialog = document.getElementById("verify-dialog");

const verifyForm = document.getElementById("verify-form");

const verifyStatus = document.getElementById("verify-status");

verifyForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const otp = document.getElementById(
        "verify-otp"
    ).value.trim();

    if (!pendingLeaderEmail) {

        verifyStatus.textContent =
            "Please register your team first.";

        return;
    }

    if (!/^\d{6}$/.test(otp)) {

        verifyStatus.textContent =
            "Please enter a valid 6-digit OTP.";

        return;
    }

    const verifyButton = verifyForm.querySelector(
        'button[type="submit"]'
    );

    verifyButton.disabled = true;

    verifyStatus.textContent = "Verifying OTP...";

    let verified = false;

    try {

        const result = await sendRequest("/verify-email", {
            leaderEmail: pendingLeaderEmail,
            otp: otp
        });

        verified = true;

        // Show the actual generated Team ID
        verifyStatus.style.whiteSpace = "pre-line";

        verifyStatus.textContent =
            "Email Verified Successfully!\n\n" +
            "Your Team ID: " + result.teamId + "\n\n" +
            "Save your Team ID.\n" +
            "Now login using your Team ID and Password.";

        // Fill Team ID automatically on login page
        document.getElementById("team-id").value =
            result.teamId;

        // Clear pending verification state
        pendingLeaderEmail = "";

        sessionStorage.removeItem(
            "hackarenaPendingEmail"
        );

        // Clear registration form
        registerForm.reset();

        memberList.replaceChildren();

        updateMemberCount();

    } catch (error) {

        verifyStatus.textContent = error.message;

    } finally {

        // Keep button disabled after successful verification
        verifyButton.disabled = verified;

    }

});

// ====================================
// ACCOUNT RECOVERY
// ====================================

const recoveryDialog = document.getElementById(
    "recovery-dialog"
);

const recoveryTitle = document.getElementById(
    "recovery-title"
);

const recoveryDescription = document.getElementById(
    "recovery-description"
);

const recoveryForm = document.getElementById(
    "recovery-form"
);

const recoveryStatus = document.getElementById(
    "recovery-status"
);

const recoveryContent = {

    "team-id": {
        title: "Forgot Team ID?",
        description:
            "Enter your team leader's registered email."
    },

    "team-password": {
        title: "Reset team password",
        description:
            "Enter your registered team leader email."
    },

    "judge-password": {
        title: "Reset judge password",
        description:
            "Enter the email associated with your judge account."
    },

    "organizer-password": {
        title: "Reset organizer password",
        description:
            "Enter the email associated with your organizer account."
    }

};

document.querySelectorAll("[data-recovery]").forEach((button) => {

    button.addEventListener("click", () => {

        const option = recoveryContent[
            button.dataset.recovery
        ];

        recoveryForm.reset();

        recoveryStatus.textContent = "";

        recoveryTitle.textContent = option.title;

        recoveryDescription.textContent =
            option.description;

        recoveryDialog.showModal();

    });

});

recoveryForm.addEventListener("submit", (event) => {

    event.preventDefault();

    recoveryStatus.textContent =
        "Account recovery is not connected yet. " +
        "No OTP or recovery email has been sent.";

});

// ====================================
// UPDATE PREVIEW MESSAGE
// ====================================

const previewLabel = document.querySelector(".preview-label");

if (previewLabel) {

    previewLabel.textContent =
        "Participant registration and login connected. " +
        "Judge and Organizer authentication coming soon.";

}

// ====================================
// LOGIN ROLE TAB SWITCHING
// ====================================

const loginRoleTabs = Array.from(
    document.querySelectorAll("[data-login-tab]")
);

const loginRolePanels = Array.from(
    document.querySelectorAll("[data-login-panel]")
);

function activateLoginRole(role) {

    loginRoleTabs.forEach((tab) => {
        const selected = tab.dataset.loginTab === role;

        tab.setAttribute(
            "aria-selected",
            String(selected)
        );

        tab.tabIndex = selected ? 0 : -1;
    });

    loginRolePanels.forEach((panel) => {
        panel.hidden = panel.dataset.loginPanel !== role;
    });
}

loginRoleTabs.forEach((tab, index) => {

    tab.addEventListener("click", () => {
        activateLoginRole(tab.dataset.loginTab);
    });

    // Keyboard navigation for login tabs
    tab.addEventListener("keydown", (event) => {

        let nextIndex = index;

        if (event.key === "ArrowRight") {
            nextIndex = (index + 1) % loginRoleTabs.length;
        } else if (event.key === "ArrowLeft") {
            nextIndex =
                (index - 1 + loginRoleTabs.length) %
                loginRoleTabs.length;
        } else if (event.key === "Home") {
            nextIndex = 0;
        } else if (event.key === "End") {
            nextIndex = loginRoleTabs.length - 1;
        } else {
            return;
        }

        event.preventDefault();

        const nextTab = loginRoleTabs[nextIndex];

        activateLoginRole(nextTab.dataset.loginTab);
        nextTab.focus();
    });
});

// Default: Participant Login
activateLoginRole("Participant");

// Update outdated preview message, if present
const loginPreviewLabel = document.querySelector(".preview-label");

if (loginPreviewLabel) {
    loginPreviewLabel.textContent =
        "Participant and Organizer Login Connected. Judge Login Coming Soon.";
}

// ====================================
// TEAM MEMBERS LIVE PREVIEW
// ====================================

function updateTeamMembersPreview() {

    const previewList =
        document.getElementById("team-preview-list");

    if (!previewList) return;

    previewList.replaceChildren();

    // Team Leader
    const leaderName =
        document.getElementById("leader-name").value.trim();

    const leaderItem = document.createElement("li");

    leaderItem.textContent =
        (leaderName || "Enter leader name") + " (Team Leader)";

    previewList.appendChild(leaderItem);

    // Other Team Members
    const members = document.querySelectorAll(
        '#member-list input[name="memberNames[]"]'
    );

    members.forEach((input, index) => {

        const item = document.createElement("li");

        item.textContent =
            input.value.trim() ||
            "Enter Member " + (index + 2) + " Name";

        previewList.appendChild(item);
    });
}

// Update when names are typed
document.getElementById("leader-name")
    .addEventListener("input", updateTeamMembersPreview);

document.getElementById("member-list")
    .addEventListener("input", updateTeamMembersPreview);

// Update when member is added
document.getElementById("add-member")
    .addEventListener("click", updateTeamMembersPreview);

// Update when member is removed
document.getElementById("member-list")
    .addEventListener("click", (event) => {

        if (event.target.closest(".remove-member")) {
            updateTeamMembersPreview();
        }

    });

updateTeamMembersPreview();

