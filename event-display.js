
"use strict";

// ==========================================
// HACKARENA - EVENT BRANDING DISPLAY
// Login, Participant and Judge Dashboards
// ==========================================

(function () {

  const eventApiUrl = "http://127.0.0.1:5000/api/event";

  const storageKey =
    "hackarena-current-event-branding-v1";

  // ==========================================
  // LOAD EVENT INFORMATION
  // ==========================================

  async function loadEventInformation() {

    let eventData = null;

    try {

      const response = await fetch(eventApiUrl, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not load event from server.");
      }

      const result = await response.json();

      if (!result.success || !result.event) {
        throw new Error("Event information not found.");
      }

      eventData = result.event;

      console.log("HackArena event loaded from MongoDB.");

      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(eventData)
        );
      } catch (error) {
        console.warn("Could not update event cache.");
      }

    } catch (error) {

      console.warn("Event API unavailable:", error);

      try {
        eventData = JSON.parse(
          localStorage.getItem(storageKey) || "null"
        );
      } catch (error) {
        eventData = null;
      }
    }

    if (!eventData || !eventData.eventName) {
      console.warn("No event information available.");
      return;
    }

    displayEventInformation(eventData);
  }

  // ==========================================
  // DISPLAY EVENT INFORMATION
  // ==========================================

  function displayEventInformation(eventData) {

    // Remove old event card to avoid duplicates
    document.querySelectorAll(".hackarena-event-info")
      .forEach((element) => element.remove());

    // ==========================================
    // EVENT CARD CSS
    // ==========================================

    if (!document.getElementById("hackarena-event-style")) {

      const style = document.createElement("style");

      style.id = "hackarena-event-style";

      style.textContent = `
        .hackarena-event-info {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 20px;
          margin: 15px 0 25px;
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
          overflow-wrap: anywhere;
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
    }

    // ==========================================
    // CREATE EVENT CARD
    // ==========================================

    const eventBox = document.createElement("section");

    eventBox.className = "hackarena-event-info";

    // ORGANIZER LOGO
    if (
      typeof eventData.logo === "string" &&
      /^data:image\/(png|jpeg|webp);base64,/i.test(eventData.logo)
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

    // ORGANIZATION
    if (eventData.organization) {

      const organization = document.createElement("p");

      organization.className = "hackarena-event-organizer";

      organization.textContent =
        "Organized by " + eventData.organization;

      details.appendChild(organization);
    }

    // ==========================================
    // CHECK IF LOGIN PAGE
    // ==========================================

    const isLoginPage =
      document.querySelector(".login-grid") !== null ||
      window.location.pathname.toLowerCase()
        .endsWith("/index.html");

    // ==========================================
    // DISPLAY MORE DETAILS ON LOGIN PAGE
    // ==========================================

    if (isLoginPage) {

      function addDetail(label, value) {

        if (!value) return;

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

    // ==========================================
    // POSITION EVENT CARD
    // ==========================================

    if (isLoginPage) {

      // NEW LOGIN PAGE - LEFT SIDE
      const leftPanel =
        document.querySelector(".brand-panel");

      if (leftPanel) {

        const codingVisual =
          leftPanel.querySelector(".hero-visual");

        // Insert above coding illustration
        if (codingVisual) {
          codingVisual.before(eventBox);
        } else {
          leftPanel.appendChild(eventBox);
        }

        console.log("Event card added to LEFT panel.");

      } else {

        // OLD LOGIN PAGE FALLBACK
        const intro = document.querySelector(".intro");
        const loginGrid = document.querySelector(".login-grid");

        if (intro) {
          intro.after(eventBox);
        } else if (loginGrid) {
          loginGrid.before(eventBox);
        } else {
          document.querySelector("main")?.prepend(eventBox);
        }
      }

    } else {

      // PARTICIPANT AND JUDGE DASHBOARDS
      const topbar = document.querySelector(".topbar");

      if (topbar) {
        topbar.after(eventBox);
      } else {
        document.querySelector("main")?.prepend(eventBox);
      }
    }

    console.log("HackArena event information displayed.");
  }

  // START EVENT LOADING
  loadEventInformation();

})();
