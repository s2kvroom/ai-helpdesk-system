import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import Stripe from "stripe";

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Debug checks
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ Missing STRIPE_SECRET_KEY");
}

// Clients
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory storage
let tickets = [];
let nextId = 1;

// GET tickets
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

    let aiReply = "AI response unavailable.";

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful IT helpdesk assistant. Give clear troubleshooting steps.",
          },
          {
            role: "user",
            content: `Name: ${name}
Category: ${category}
Priority: ${priority}
Issue: ${issue}

Give:
1. Likely cause
2. Steps
3. When to escalate`,
          },
        ],
      });

      aiReply =
        completion.choices?.[0]?.message?.content?.trim() || aiReply;
    } catch (err) {
      console.error("OpenAI error:", err.message);
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
    console.error("Create error:", error);
    res.status(500).json({ error: "Failed to create ticket." });
  }
});

// UPDATE ticket
app.patch("/api/tickets/:id", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  const ticket = tickets.find((t) => t.id === id);

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }

  if (status) ticket.status = status;

  res.json(ticket);
});

// DELETE tickets
app.delete("/api/tickets", (req, res) => {
  tickets = [];
  nextId = 1;
  res.json({ message: "All tickets cleared." });
});

//
// 💳 STRIPE ROUTES (UPDATED FOR LIVE URL)
//

// Premium AI
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
            },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/?payment=success`,
      cancel_url: `${APP_URL}/?payment=cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe AI error:", error.message);
    res.status(500).json({ error: "Stripe failed." });
  }
});

// Live Agent
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
            },
            unit_amount: 1499,
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/?premium=success`,
      cancel_url: `${APP_URL}/?premium=cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Live error:", error.message);
    res.status(500).json({ error: "Stripe failed." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${APP_URL}`);
});