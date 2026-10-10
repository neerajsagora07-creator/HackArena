
"use strict";

// HACKARENA EVENT BRANDING DISPLAY
// Works on Login, Participant and Judge pages

(function () {

  const storageKey =
    "hackarena-current-event-branding-v1";

  let eventData;

  try {
    eventData = JSON.parse(
      localStorage.getItem(storageKey) || "null"
    );
  } catch (error) {
    console.warn("Event information could not be loaded.");
    return;
  }

  if (!eventData || !eventData.eventName) {
    return;
  }

  // ADD STYLING WITHOUT CHANGING EXISTING CSS

  const style = document.createElement("style");

  style.textContent = `
    .hackarena-event-info {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 20px;
      margin: 20px 0 25px;
      border-radius: 14px;
      background: #d5d5c9;
      border-left: 4px solid #ff7b3c;
      color: #292d25;
    }

    .hackarena-event-logo {
      width: 75px;
      height: 75px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .hackarena-event-details {
      min-width: 0;
    }

    .hackarena-event-name {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 6px;
      color: #292d25;
    }

    .hackarena-event-organizer {
      font-size: 13px;
      margin: 0;
      color: #535a49;
    }

    .hackarena-event-extra {
      font-size: 12px;
      color: #535a49;
      margin: 6px 0 0;
    }

    .hackarena-event-description {
      font-size: 13px;
      margin: 10px 0 0;
      color: #535a49;
    }

    @media (max-width: 520px) {
      .hackarena-event-info {
        padding: 15px;
        gap: 12px;
      }

      .hackarena-event-logo {
        width: 50px;
        height: 50px;
      }

      .hackarena-event-name {
        font-size: 16px;
      }
    }
  `;

  document.head.appendChild(style);

  // CREATE EVENT INFORMATION BOX

  const eventBox = document.createElement("section");
  eventBox.className = "hackarena-event-info";

  // ORGANIZER LOGO

  if (
    typeof eventData.logo === "string" &&
    /^data:image\/(png|jpeg|webp);base64,/i
      .test(eventData.logo)
  ) {

    const logo = document.createElement("img");

    logo.className = "hackarena-event-logo";
    logo.src = eventData.logo;
    logo.alt = "Organizer Logo";

    eventBox.appendChild(logo);
  }

  const details = document.createElement("div");
  details.className = "hackarena-event-details";

  // EVENT NAME

  const eventName = document.createElement("h2");

  eventName.className = "hackarena-event-name";
  eventName.textContent = eventData.eventName;

  details.appendChild(eventName);

  // ORGANIZER NAME

  if (eventData.organization) {

    const organization = document.createElement("p");

    organization.className =
      "hackarena-event-organizer";

    organization.textContent =
      "Organized by " + eventData.organization;

    details.appendChild(organization);
  }

  // CHECK WHETHER THIS IS LOGIN PAGE

  const isLoginPage =
    document.querySelector(".login-grid") !== null ||
    window.location.pathname.endsWith("/index.html");

  // SHOW FULL DETAILS ON LOGIN PAGE

  if (isLoginPage) {

    function addDetail(label, value) {

      if (!value) {
        return;
      }

      const paragraph = document.createElement("p");

      paragraph.className = "hackarena-event-extra";
      paragraph.textContent = label + value;

      details.appendChild(paragraph);
    }

    function formatDate(value) {
      if (!value) return "";

      const parts = value.split("-");

      return parts.length === 3
        ? parts[2] + "/" + parts[1] + "/" + parts[0]
        : value;
    }

    const startDate = formatDate(eventData.eventDate);
    const endDate = formatDate(eventData.eventEndDate);

    const dateText =
      startDate && endDate && startDate !== endDate
        ? startDate + " - " + endDate
        : startDate;

    addDetail("Date: ", dateText);
    addDetail("Time: ", eventData.eventTime);
    addDetail("Venue: ", eventData.eventVenue);

    if (eventData.eventDescription) {

      const description = document.createElement("p");

      description.className =
        "hackarena-event-description";

      description.textContent =
        eventData.eventDescription;

      details.appendChild(description);
    }
  }

  eventBox.appendChild(details);

  // PLACE BRANDING ON PAGE

  if (isLoginPage) {

    const intro = document.querySelector(".intro");
    const loginGrid = document.querySelector(".login-grid");

    if (intro) {
      intro.after(eventBox);
    } else if (loginGrid) {
      loginGrid.before(eventBox);
    } else {
      document.querySelector("main")?.prepend(eventBox);
    }

  } else {

    const topbar = document.querySelector(".topbar");

    if (topbar) {
      topbar.after(eventBox);
    } else {
      document.querySelector("main")?.prepend(eventBox);
    }
  }

})();
