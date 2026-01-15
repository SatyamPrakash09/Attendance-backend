import "dotenv/config";
import fetch from "node-fetch";
import { connectDB } from "./db.js";
import User from "./models/User.js";

/* -------------------- CONFIG -------------------- */
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const API_BASE = process.env.API_BASE || "https://attendance-backend-hhkn.onrender.com";

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing");
  process.exit(1);
}

await connectDB();
console.log("🤖 Bot started");

/* -------------------- STATE -------------------- */
let offset = 0;

/* -------------------- HELPERS -------------------- */
async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
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
  if (!res.ok) {
    throw new Error(data.message || "API error");
  }
  return data;
}

async function markHoliday(userId) {
  const res = await fetch(
    `${API_BASE}/holiday?userId=${encodeURIComponent(userId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId
      }
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Holiday failed");
  }
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
      const text = update.message.text.trim().toLowerCase();
      const firstName = update.message.from.first_name || "there";
      const username = update.message.from.username || "";

      /* -------------------- /start -------------------- */
      if (text === "/start") {
        const existing = await User.findOne({ userId: chatId });

        if (!existing) {
          await User.create({
            userId: chatId,
            name: firstName,
            username
          });

          await sendMessage(
            chatId,
            `👋 Hi ${firstName}!\n\nYour attendance tracker is ready.\n\nCommands:\n• present\n• absent <reason>\n• holiday\n• summary`
          );
        } else {
          await sendMessage(
            chatId,
            `👋 Welcome back ${existing.name}!\n\nDashboard:\nhttps://attendance-09.vercel.app/?uid=${chatId}`
          );
        }
        continue;
      }

      /* -------------------- PRESENT -------------------- */
      if (text === "present") {
        try {
          await apiPost("/attendance", chatId, {
            status: "Present"
          });
          await sendMessage(chatId, "✅ Present marked successfully");
        } catch (err) {
          console.error("Present error:", err.message);
          await sendMessage(chatId, "❌ Failed to mark present");
        }
        continue;
      }

      /* -------------------- ABSENT -------------------- */
      if (text.startsWith("absent")) {
        const reason = text.replace("absent", "").trim() || "-";
        try {
          await apiPost("/attendance", chatId, {
            status: "Absent",
            reason
          });
          await sendMessage(chatId, `❌ Absent marked\nReason: ${reason}`);
        } catch (err) {
          console.error("Absent error:", err.message);
          await sendMessage(chatId, "❌ Failed to mark absent");
        }
        continue;
      }

      /* -------------------- HOLIDAY -------------------- */
      if (text === "holiday") {
        try {
          await markHoliday(chatId);
          await sendMessage(chatId, "📅 Today marked as HOLIDAY");
        } catch (err) {
          console.error("Holiday error:", err.message);
          await sendMessage(chatId, "❌ Failed to mark holiday");
        }
        continue;
      }

      /* -------------------- SUMMARY -------------------- */
      if (text === "summary") {
        await sendMessage(
          chatId,
          "📊 Open your dashboard to view the AI attendance summary:\nhttps://attendance-09.vercel.app/?uid=" +
            chatId
        );
        continue;
      }

      /* -------------------- DEFAULT -------------------- */
      await sendMessage(
        chatId,
        "❓ I didn't understand that.\n\nUse:\n• present\n• absent <reason>\n• holiday\n• summary"
      );
    }
  } catch (err) {
    console.error("Polling error:", err.message);
  }
}

/* -------------------- START -------------------- */
setInterval(poll, 1200);
