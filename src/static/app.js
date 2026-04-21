document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");

  const userMenuButton = document.getElementById("user-menu-button");
  const authPanel = document.getElementById("auth-panel");
  const authStatus = document.getElementById("auth-status");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");

  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginButton = document.getElementById("cancel-login");

  const state = {
    teacherToken: localStorage.getItem("teacherToken") || "",
    teacherUsername: localStorage.getItem("teacherUsername") || "",
  };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setAuthUI() {
    const isLoggedIn = Boolean(state.teacherToken);

    signupContainer.classList.toggle("hidden", !isLoggedIn);
    loginButton.classList.toggle("hidden", isLoggedIn);
    logoutButton.classList.toggle("hidden", !isLoggedIn);

    if (isLoggedIn) {
      authStatus.textContent = `Signed in as ${state.teacherUsername}`;
    } else {
      authStatus.textContent = "Not logged in";
    }
  }

  function saveSession(token, username) {
    state.teacherToken = token;
    state.teacherUsername = username;
    localStorage.setItem("teacherToken", token);
    localStorage.setItem("teacherUsername", username);
    setAuthUI();
  }

  function clearSession() {
    state.teacherToken = "";
    state.teacherUsername = "";
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    setAuthUI();
  }

  function authHeaders() {
    if (!state.teacherToken) {
      return {};
    }
    return {
      "X-Teacher-Token": state.teacherToken,
    };
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      const canManage = Boolean(state.teacherToken);

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${details.participants
                    .map((email) => {
                      const removeButton = canManage
                        ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">Remove</button>`
                        : "";
                      return `<li><span class="participant-email">${email}</span>${removeButton}</li>`;
                    })
                    .join("")}
                </ul>
              </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    event.preventDefault();

    if (!state.teacherToken) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.teacherToken) {
      showMessage("Teacher login required", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", () => {
    authPanel.classList.toggle("hidden");
  });

  loginButton.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    authPanel.classList.add("hidden");
  });

  cancelLoginButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        saveSession(result.token, result.username);
        loginModal.classList.add("hidden");
        loginForm.reset();
        showMessage(`Welcome, ${result.username}`, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "Invalid login", "error");
      }
    } catch (error) {
      showMessage("Login failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error("Error while logging out:", error);
    }

    clearSession();
    fetchActivities();
    showMessage("Logged out", "success");
  });

  // Close login modal when user clicks outside modal content.
  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  setAuthUI();
  fetchActivities();
});
