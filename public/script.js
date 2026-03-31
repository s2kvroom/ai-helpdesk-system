const ticketForm = document.getElementById("ticketForm");
const ticketsContainer = document.getElementById("ticketsContainer");
const clearTicketsBtn = document.getElementById("clearTickets");

async function loadTickets() {
  try {
    const res = await fetch("/api/tickets");
    const tickets = await res.json();
    renderTickets(tickets);
  } catch (error) {
    ticketsContainer.innerHTML = `<p class="empty">Failed to load tickets.</p>`;
  }
}

function renderTickets(tickets) {
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

ticketForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const category = document.getElementById("category").value;
  const priority = document.getElementById("priority").value;
  const issue = document.getElementById("issue").value.trim();

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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll(/\n/g, "<br>");
}

loadTickets();