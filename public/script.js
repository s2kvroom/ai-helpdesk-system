const ticketForm = document.getElementById("ticketForm");
const ticketsContainer = document.getElementById("ticketsContainer");
const clearTicketsBtn = document.getElementById("clearTickets");
const liveAgentBtn = document.getElementById("liveAgentBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const nameInput = document.getElementById("name");
const categoryInput = document.getElementById("category");
const priorityInput = document.getElementById("priority");
const issueInput = document.getElementById("issue");

const premiumTab = document.getElementById("premiumTab");

// ---------------- TAB SWITCHING ----------------

function activateTab(tabId) {
  tabButtons.forEach((btn) => btn.classList.remove("active"));
  tabContents.forEach((tab) => tab.classList.remove("active"));

  const targetButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const targetTab = document.getElementById(tabId);

  if (targetButton) targetButton.classList.add("active");
  if (targetTab) targetTab.classList.add("active");
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

function getPremiumContainer() {
  return premiumTab || document.querySelector(".container");
}

// ---------------- TICKETS ----------------

async function loadTickets() {
  if (!ticketsContainer) return;

  try {
    const res = await fetch("/api/tickets");
    const tickets = await res.json();
    renderTickets(tickets);
  } catch (error) {
    ticketsContainer.innerHTML = `<p class="empty">Failed to load tickets.</p>`;
  }
}

function renderTickets(tickets) {
  if (!ticketsContainer) return;

  if (!tickets.length) {
    ticketsContainer.innerHTML = `<p class="empty">No tickets yet.</p>`;
    return;
  }

  ticketsContainer.innerHTML = tickets
    .map((ticket) => {
      const safeStatus = (ticket.status || "Open").toLowerCase();
      const safePriority = (ticket.priority || "Low").toLowerCase();

      return `
        <div class="ticket">
          <div class="ticket-header">
            <div>
              <h3>Ticket #${ticket.id} - ${escapeHtml(ticket.name || "Unknown")}</h3>
              <p class="meta">${new Date(ticket.createdAt).toLocaleString()}</p>
            </div>
            <span class="status ${safeStatus}">${escapeHtml(ticket.status || "Open")}</span>
          </div>

          <p><strong>Category:</strong> ${escapeHtml(ticket.category || "N/A")}</p>
          <p><strong>Priority:</strong> <span class="priority-${safePriority}">${escapeHtml(ticket.priority || "N/A")}</span></p>
          <p><strong>Issue:</strong> ${escapeHtml(ticket.issue || "")}</p>

          <div class="ai-reply">
            <strong>AI Troubleshooting:</strong><br><br>
            ${escapeHtml(ticket.aiReply || "No response available.")}
          </div>

          <div class="ticket-actions">
            ${
              ticket.status === "Open"
                ? `<button onclick="updateTicketStatus(${ticket.id}, 'Resolved')">Mark Resolved</button>`
                : `<button onclick="updateTicketStatus(${ticket.id}, 'Open')">Reopen</button>`
            }
          </div>
        </div>
      `;
    })
    .join("");
}

// ---------------- FORM ----------------

if (ticketForm) {
  ticketForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput?.value.trim();
    const category = categoryInput?.value;
    const priority = priorityInput?.value;
    const issue = issueInput?.value.trim();

    if (!name || !category || !priority || !issue) {
      alert("Please fill out all fields.");
      return;
    }

    const submitBtn = ticketForm.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Analyzing issue...";

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, category, priority, issue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create ticket.");
      }

      ticketForm.reset();
      loadTickets();
    } catch (error) {
      alert(error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Ticket";
    }
  });
}

// ---------------- UPDATE / CLEAR ----------------

async function updateTicketStatus(id, status) {
  try {
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      throw new Error("Failed to update ticket.");
    }

    loadTickets();
  } catch (error) {
    alert(error.message);
  }
}

if (clearTicketsBtn) {
  clearTicketsBtn.addEventListener("click", async () => {
    const confirmed = confirm("Are you sure you want to clear all tickets?");
    if (!confirmed) return;

    try {
      const res = await fetch("/api/tickets", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to clear tickets.");
      }

      loadTickets();
    } catch (error) {
      alert(error.message);
    }
  });
}

// ---------------- STRIPE ----------------

if (liveAgentBtn) {
  liveAgentBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/create-live-agent-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not start live agent payment.");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

// ---------------- SUCCESS FLOW ----------------

const params = new URLSearchParams(window.location.search);

if (params.get("premium") === "success") {
  activateTab("premiumTab");
  startQueueSimulation(10);
  window.history.replaceState({}, document.title, window.location.pathname);
}

if (params.get("payment") === "success") {
  activateTab("standardTab");
  showSystemMessage(`
Premium support payment received.

Your premium AI support request has been submitted successfully.
  `);
  window.history.replaceState({}, document.title, window.location.pathname);
}

// ---------------- QUEUE ----------------

function startQueueSimulation(seconds) {
  removeQueueElements();

  let remaining = seconds;

  const box = document.createElement("div");
  box.id = "queueMessage";
  box.className = "system-message";

  const container = getPremiumContainer();
  container.prepend(box);

  const interval = setInterval(() => {
    box.textContent =
      `Premium support payment received.\n\n` +
      `Your live support request has been submitted successfully.\n` +
      `You are now in the waiting room.\n` +
      `Estimated wait time: 0:${remaining.toString().padStart(2, "0")}`;

    if (remaining <= 0) {
      clearInterval(interval);
      box.remove();
      showAgentJoined();
      showAgentChat();
      return;
    }

    remaining--;
  }, 1000);
}

// ---------------- FAKE CHAT ----------------

function showAgentJoined() {
  const existing = document.getElementById("agentJoinedMessage");
  if (existing) existing.remove();

  const box = document.createElement("div");
  box.id = "agentJoinedMessage";
  box.className = "agent-joined-message";
  box.textContent = "Agent joined chat. A live support representative is now available.";

  const container = getPremiumContainer();
  container.prepend(box);
}

function showAgentChat() {
  const existing = document.getElementById("agentChatBox");
  if (existing) existing.remove();

  const box = document.createElement("div");
  box.id = "agentChatBox";
  box.className = "agent-chat-box";

  box.innerHTML = `
    <h3>Live Agent Chat</h3>

    <div id="chatMessages" class="chat-messages">
      <div class="chat-message agent-message">
        <strong>Agent Mia:</strong> Hi, thanks for waiting. I’m here to help you now.
      </div>
      <div class="chat-message agent-message">
        <strong>Agent Mia:</strong> I’ve received your premium support request and I’m reviewing your issue details.
      </div>
    </div>

    <div class="chat-input-row">
      <input
        type="text"
        id="chatReplyInput"
        class="chat-reply-input"
        placeholder="Type your reply to the agent..."
      />
      <button type="button" id="sendChatReplyBtn">Send</button>
    </div>
  `;

  const container = getPremiumContainer();
  container.appendChild(box);

  const sendBtn = document.getElementById("sendChatReplyBtn");
  const input = document.getElementById("chatReplyInput");

  if (sendBtn && input) {
    sendBtn.addEventListener("click", sendUserChatMessage);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendUserChatMessage();
      }
    });
  }
}

function sendUserChatMessage() {
  const input = document.getElementById("chatReplyInput");
  const messages = document.getElementById("chatMessages");

  if (!input || !messages) return;

  const text = input.value.trim();
  if (!text) return;

  const userMessage = document.createElement("div");
  userMessage.className = "chat-message user-message";
  userMessage.innerHTML = `<strong>You:</strong> ${escapeHtml(text)}`;

  messages.appendChild(userMessage);

  input.value = "";
  messages.scrollTop = messages.scrollHeight;

  setTimeout(() => {
    const agentReply = document.createElement("div");
    agentReply.className = "chat-message agent-message";
    agentReply.innerHTML = `<strong>Agent Mia:</strong> Got it — thanks for that info. I’m checking this for you now.`;

    messages.appendChild(agentReply);
    messages.scrollTop = messages.scrollHeight;
  }, 1200);
}

// ---------------- UI HELPERS ----------------

function showSystemMessage(message) {
  const existing = document.getElementById("systemMessage");
  if (existing) existing.remove();

  const box = document.createElement("div");
  box.id = "systemMessage";
  box.className = "system-message";
  box.textContent = message.trim();

  const container = getPremiumContainer();
  container.prepend(box);
}

function removeQueueElements() {
  const ids = ["systemMessage", "queueMessage", "agentJoinedMessage", "agentChatBox"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadTickets();
window.updateTicketStatus = updateTicketStatus;
