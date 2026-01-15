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
const API_BASE = process.env.VITE_API_BASE;


if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing");
  process.exit(1);
}

console.log("🤖 Bot started");

let offset = 0;

/* -------------------- HELPERS -------------------- */
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

  const data = await res.json();

  if (!res.ok) {
    // This will now catch the "UserId missing" message from the server
    throw new Error(data.message || "Holiday not saved"); 
  }

  return data;
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
      }


      if (text === "present") {
        try {
          await apiPost("/attendance", chatId, { status: "Present" });
          reply = "✅ Present marked";
        } catch {
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
        } catch {
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
        continue; // ⬅️ IMPORTANT
      }




      else if (text === "summary") {
        reply =
          "📊 Visit the dashboard to see your AI attendance summary.";
      }

      await sendMessage(chatId, reply);
    }
  } catch (err) {
    console.error("Polling error:", err.message);
  }
}

setInterval(poll, 1000);
