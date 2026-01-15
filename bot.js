import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });
import { connectDB } from "./db.js";
import User from "./models/User.js";
await connectDB();

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing");
  process.exit(1);
}

if (!API_BASE) {
  console.error("❌ API_BASE missing");
  console.error("Please set API_BASE or VITE_API_BASE in your .env file");
  process.exit(1);
}

console.log("🤖 Bot started");
console.log("📡 API_BASE:", API_BASE);

let offset = 0;

/* -------------------- HELPERS -------------------- */
async function apiPost(path, userId, body = {}) {
  const url = `${API_BASE}${path}`;
  console.log(`📤 API Call: ${url}`);
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "API error");
    console.log(`✅ API Success: ${path}`);
    return data;
  } catch (error) {
    console.error(`❌ API Failed: ${url}`);
    console.error(`Error: ${error.message}`);
    throw error;
  }
}

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function markHoliday(chatId) {
  if (!chatId) {
    throw new Error("chatId missing in bot");
  }

  const url = `${API_BASE}/holiday?userId=${encodeURIComponent(String(chatId))}`;
  console.log(`📤 Holiday Call: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": String(chatId)
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Holiday not saved"); 
    }

    console.log(`✅ Holiday Success`);
    return data;
  } catch (error) {
    console.error(`❌ Holiday Failed: ${url}`);
    console.error(`Error: ${error.message}`);
    throw error;
  }
}

/* -------------------- POLLING -------------------- */
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
      const text = update.message.text.toLowerCase();

      let reply = `Incorrect Command !!!!!!!!!
                    Send Only:
                    • present
                    • absent <reason>
                    • holiday
                    • summary`;

      if (text === "/start") {
        const firstName = update.message.from.first_name || "";
        const username = update.message.from.username || "";

        const existing = await User.findOne({ userId: chatId });

        if (!existing) {
          await User.create({
            userId: chatId,
            name: firstName,
            username
          });

          await sendMessage(
            chatId,
            `👋 Hi ${firstName}!\n\nI've set up your attendance tracker.\n\nSend:\n• present\n• absent <reason>\n• holiday\n• summary`
          );
        } else {
          await sendMessage(
            chatId,
            `👋 Welcome back ${existing.name}!\n\nDashboard:\nhttps://attendance-09.vercel.app/?uid=${chatId}`
          );
        }
        continue; // ✅ Skip default reply
      }

      if (text === "present") {
        try {
          await apiPost(`/attendance`,chatId,{ status: "Present" });
          reply = "✅ Present marked";
        } catch (err) {
          console.error("Present error:", err.message);
          reply = "❌ Failed to mark present";
        }
      }
      else if (text.startsWith("absent")) {
        const reason = text.replace("absent", "").trim() || "-";
        try {
          await apiPost("/attendance", chatId, {
            status: "Absent",
            reason
          });
          reply = "❌ Absent marked";
        } catch (err) {
          console.error("Absent error:", err.message);
          reply = "❌ Failed to mark absent";
        }
      }
      else if (text === "holiday") {
        try {
          await markHoliday(chatId);
          await sendMessage(chatId, "📅 Marked today as HOLIDAY");
        } catch (err) {
          console.error("Holiday error:", err.message);
          await sendMessage(chatId, "❌ Holiday not saved");
        }
        continue; // ⬅️ IMPORTANT: Skip default reply
      }
      else if (text === "summary") {
        reply = "📊 Visit the dashboard to see your AI attendance summary.";
      }

      await sendMessage(chatId, reply);
    }
  } catch (err) {
    console.error("Polling error:", err.message);
  }
}

setInterval(poll, 1000);