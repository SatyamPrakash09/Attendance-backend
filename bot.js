import "dotenv/config";
import fetch from "node-fetch";
import { connectDB } from "./db.js";
import User from "./models/User.js";

/* -------------------- CONFIG -------------------- */
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const API_BASE =
  process.env.API_BASE || "https://attendance-backend-hhkn.onrender.com";

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing");
  process.exit(1);
}

await connectDB();
console.log("🤖 Bot started");

/* -------------------- STATE -------------------- */
let offset = 0;
const userSessions = new Map();

/* -------------------- HELPERS -------------------- */
async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function apiPost(path, userId, body = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "API error");
  return data;
}

async function markHoliday(userId) {
  const res = await fetch(`${API_BASE}/holiday?userId=${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId
    }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Holiday failed");
  return data;
}

/* -------------------- POLLING LOOP -------------------- */
async function poll() {
  try {
    const res = await fetch(
      `${TELEGRAM_API}/getUpdates?timeout=30&offset=${offset}`
    );
    const data = await res.json();

    for (const update of data.result || []) {
      offset = update.update_id + 1;

      if (!update.message?.text) continue;

      const chatId = update.message.chat.id.toString();
      const text = update.message.text.trim();
      const lower = text.toLowerCase();

      /* ---------- REGISTRATION FLOW ---------- */
      const session = userSessions.get(chatId);

      if (session) {
        if (session.step === "name") {
          session.name = text;
          session.step = "email";
          await sendMessage(chatId, "📧 Enter your email address:");
          continue;
        }

        if (session.step === "email") {
          if (!text.includes("@")) {
            await sendMessage(chatId, "❌ Invalid email. Try again:");
            continue;
          }
          session.email = text;
          session.step = "section";
          await sendMessage(chatId, "🏫 Enter your section (eg: CSE-A):");
          continue;
        }

        if (session.step === "section") {
          await User.create({
            userId: chatId,
            name: session.name,
            email: session.email,
            section: text
          });

          userSessions.delete(chatId);

          await sendMessage(
            chatId,
            `✅ Registration complete!\n\nCommands:\n• present\n• absent <reason>\n• holiday\n• summary\nDashboard:\nhttps://attendance-09.vercel.app/?uid=${chatId}`
          );
          continue;
        }
      }

      /* ---------- COMMANDS ---------- */
      if (lower === "/start") {
        const existing = await User.findOne({ userId: chatId });

        if (existing) {
          await sendMessage(
            chatId,
            `👋 Welcome back ${existing.name}!\n\nDashboard:\nhttps://attendance-09.vercel.app/?uid=${chatId}`
          );
        } else {
          userSessions.set(chatId, { step: "name" });
          await sendMessage(chatId, "👋 Welcome! Please enter your full name:");
        }
        continue;
      }

      if (lower === "present") {
        try {
          await apiPost("/attendance", chatId, { status: "Present" });
          await sendMessage(chatId, "✅ Present marked");
        } catch {
          await sendMessage(chatId, "❌ Failed to mark present");
        }
        continue;
      }

      if (lower.startsWith("absent")) {
        const reason = text.replace(/absent/i, "").trim() || "-";
        try {
          await apiPost("/attendance", chatId, {
            status: "Absent",
            reason
          });
          await sendMessage(chatId, `❌ Absent marked\nReason: ${reason}`);
        } catch {
          await sendMessage(chatId, "❌ Failed to mark absent");
        }
        continue;
      }

      if (lower === "holiday") {
        try {
          await markHoliday(chatId);
          await sendMessage(chatId, "📅 Today marked as HOLIDAY");
        } catch {
          await sendMessage(chatId, "❌ Failed to mark holiday");
        }
        continue;
      }

      if (lower === "summary") {
        await sendMessage(
          chatId,
          `📊 View your dashboard:\nhttps://attendance-09.vercel.app/?uid=${chatId}`
        );
        continue;
      }

      await sendMessage(
        chatId,
        "❓ Unknown command\n\nUse:\n• present\n• absent <reason>\n• holiday\n• summary"
      );
    }
  } catch (err) {
    console.error("Polling error:", err.message);
  }
}

/* -------------------- START -------------------- */
setInterval(poll, 1200);
