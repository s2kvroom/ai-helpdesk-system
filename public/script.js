const ticketForm = document.getElementById("ticketForm");
const ticketsContainer = document.getElementById("ticketsContainer");
const clearTicketsBtn = document.getElementById("clearTickets");
const liveAgentBtn = document.getElementById("liveAgentBtn");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// 🔥 SOCKET GLOBALS
let socket;
let currentChatId = null;

function initSocket() {
  if (!socket) {
    socket = io();

    socket.on("connect", () => {
      console.log("Connected:", socket.id);
    });

    socket.on("agent-joined", () => {
      showAgentJoined();
    });

    socket.on("chat-message", (msg) => {
      appendChatMessage(msg.sender, msg.text);
    });
  }
}

// ---------------- TICKETS ----------------

async function loadTickets() {
  try {
    const res = await fetch("/api/tickets");
    const tickets = await res.json();
    renderTickets(tickets);
  } catch {
    ticketsContainer.innerHTML = `<p class="empty">Failed to load tickets.</p>`;
  }
}

function renderTickets(tickets) {
  if (!tickets.length) {
    ticketsContainer.innerHTML = `<p class="empty">No tickets yet.</p>`;
    return;
  }

  ticketsContainer.innerHTML = tickets.map(ticket => `
    <div class="ticket">
      <div class="ticket-header">
        <div>
          <h3>Ticket #${ticket.id} - ${escapeHtml(ticket.name)}</h3>
          <p class="meta">${new Date(ticket.createdAt).toLocaleString()}</p>
        </div>
        <span class="status ${ticket.status.toLowerCase()}">${ticket.status}</span>
      </div>

      <p><strong>Category:</strong> ${ticket.category}</p>
      <p><strong>Priority:</strong> ${ticket.priority}</p>
      <p><strong>Issue:</strong> ${ticket.issue}</p>

      <div class="ai-reply">
        <strong>AI Troubleshooting:</strong><br><br>
        ${escapeHtml(ticket.aiReply)}
      </div>
    </div>
  `).join("");
}

// ---------------- FORM ----------------

ticketForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const category = categoryInput.value;
  const priority = priorityInput.value;
  const issue = issueInput.value.trim();

  const res = await fetch("/api/tickets", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({name, category, priority, issue})
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  ticketForm.reset();
  loadTickets();
});

// ---------------- STRIPE ----------------

liveAgentBtn?.addEventListener("click", async () => {
  const res = await fetch("/create-live-agent-checkout-session", {method:"POST"});
  const data = await res.json();
  window.location.href = data.url;
});

// ---------------- SUCCESS FLOW ----------------

const params = new URLSearchParams(window.location.search);

if (params.get("premium") === "success") {
  startQueueSimulation(10);
}

// ---------------- QUEUE ----------------

function startQueueSimulation(seconds) {
  let remaining = seconds;

  const box = document.createElement("div");
  box.className = "system-message";

  document.querySelector(".container").prepend(box);

  const interval = setInterval(() => {
    box.textContent = `Waiting for agent... ${remaining}s`;

    if (remaining <= 0) {
      clearInterval(interval);
      box.remove();
      createLiveChatSession();
    }

    remaining--;
  }, 1000);
}

// ---------------- REAL CHAT ----------------

async function createLiveChatSession() {
  const res = await fetch("/api/live-chat-session", {method:"POST"});
  const data = await res.json();

  currentChatId = data.chatId;

  initSocket();

  socket.emit("join-room", {
    chatId: currentChatId,
    role: "user"
  });

  showChatUI();
}

function showChatUI() {
  const box = document.createElement("div");
  box.className = "agent-chat-box";

  box.innerHTML = `
    <h3>Live Chat</h3>
    <div id="chatMessages" class="chat-messages"></div>

    <div class="chat-input-row">
      <input id="chatInput" placeholder="Type message..." />
      <button id="sendBtn">Send</button>
    </div>
  `;

  document.querySelector(".container").appendChild(box);

  document.getElementById("sendBtn").onclick = sendMessage;
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  socket.emit("chat-message", {
    chatId: currentChatId,
    sender: "user",
    text
  });

  input.value = "";
}

function appendChatMessage(sender, text) {
  const box = document.getElementById("chatMessages");

  const div = document.createElement("div");
  div.className = sender === "agent" ? "agent-message" : "user-message";

  div.innerHTML = `<strong>${sender==="agent"?"Agent":"You"}:</strong> ${escapeHtml(text)}`;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function showAgentJoined() {
  appendChatMessage("agent", "Agent joined chat. How can I help?");
}

// ---------------- UTIL ----------------

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

loadTickets();