import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import Stripe from "stripe";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Debug checks
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ Missing STRIPE_SECRET_KEY in .env");
}

// Clients
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    const { name, category, priority, issue } = req.body;

    if (!name || !category || !priority || !issue) {
      return res.status(400).json({ error: "All fields are required." });
    }

    let aiReply = "AI response unavailable at the moment.";

    if (process.env.OPENAI_API_KEY) {
      try {
        const completion = await client.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful IT helpdesk assistant. Give clear troubleshooting steps for technical issues. Keep responses practical, concise, and easy to follow.",
            },
            {
              role: "user",
              content: `A user submitted a support ticket.

Name: ${name}
Category: ${category}
Priority: ${priority}
Issue: ${issue}

Please provide a helpful troubleshooting response.`,
            },
          ],
          temperature: 0.7,
        });

        aiReply =
          completion.choices?.[0]?.message?.content?.trim() ||
          aiReply;
      } catch (openAiError) {
        console.error("OpenAI error:", openAiError);
      }
    }

    const newTicket = {
      id: nextId++,
      name,
      category,
      priority,
      issue,
      aiReply,
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    tickets.unshift(newTicket);
    res.status(201).json(newTicket);
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Failed to create ticket." });
  }
});

// UPDATE ticket status
app.patch("/api/tickets/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const ticket = tickets.find((t) => t.id === id);

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }

    if (!status) {
      return res.status(400).json({ error: "Status is required." });
    }

    ticket.status = status;
    res.json(ticket);
  } catch (error) {
    console.error("Update ticket error:", error);
    res.status(500).json({ error: "Failed to update ticket." });
  }
});

// DELETE all tickets
app.delete("/api/tickets", (req, res) => {
  try {
    tickets = [];
    nextId = 1;
    res.json({ message: "All tickets cleared." });
  } catch (error) {
    console.error("Delete tickets error:", error);
    res.status(500).json({ error: "Failed to clear tickets." });
  }
});

// Premium AI support checkout
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Premium AI Helpdesk Support",
              description: "Priority AI troubleshooting + enhanced support",
            },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/?payment=success",
      cancel_url: "http://localhost:3000/?payment=cancel",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe premium AI error:", error);
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

// Premium live agent checkout
app.post("/create-live-agent-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Premium Live Agent Support",
              description: "One-time live support request with priority handling",
            },
            unit_amount: 1499,
          },
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/?premium=success",
      cancel_url: "http://localhost:3000/?premium=cancel",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe live agent error:", error);
    res.status(500).json({ error: "Failed to create live agent checkout session." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
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