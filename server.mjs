import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Debug check
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
}

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory ticket storage
let tickets = [];
let nextId = 1;

// GET all tickets
app.get("/api/tickets", (req, res) => {
  res.json(tickets);
});

// CREATE ticket
app.post("/api/tickets", async (req, res) => {
  try {
    const { name, issue, category, priority } = req.body;

    if (!name || !issue || !category || !priority) {
      return res.status(400).json({
        error: "Name, category, priority, and issue are required.",
      });
    }

    const prompt = `
You are an IT support assistant.

User Name: ${name}
Category: ${category}
Priority: ${priority}
Issue: ${issue}

Give a clear, beginner-friendly troubleshooting response.

Format:
1. Likely cause
2. Steps to try
3. When to escalate

Keep it practical and concise.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional IT support technician.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.6,
    });

    const aiReply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Unable to generate troubleshooting steps right now.";

    const ticket = {
      id: nextId++,
      name,
      category,
      priority,
      issue,
      aiReply,
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    tickets.unshift(ticket);

    res.status(201).json(ticket);
  } catch (error) {
    console.error("❌ Ticket creation error:", error.message);

    res.status(500).json({
      error: "Failed to create ticket.",
      details: error.message,
    });
  }
});

// UPDATE ticket status
app.patch("/api/tickets/:id", (req, res) => {
  const ticketId = Number(req.params.id);
  const { status } = req.body;

  const ticket = tickets.find((t) => t.id === ticketId);

  if (!ticket) {
    return res.status(404).json({
      error: "Ticket not found.",
    });
  }

  if (status) {
    ticket.status = status;
  }

  res.json(ticket);
});

// DELETE all tickets
app.delete("/api/tickets", (req, res) => {
  tickets = [];
  nextId = 1;

  res.json({
    message: "All tickets cleared.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});