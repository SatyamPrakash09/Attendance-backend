import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const API_BASE = "https://attendance-backend-hhkn.onrender.com";

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

      let reply = "I didn't understand that.";

      if (text === "/start") {
        reply =
          "👋 Welcome to Attendance Tracker\n\n" +
          "Commands:\n" +
          `https://attendance-09.vercel.app/?uid=${chatId}\n\n`+
          "• present\n" +
          "• absent <reason>\n" +
          "• holiday\n" +
          "• summary";
      }

      else if (text === "present") {
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
          await apiPost("/holiday", chatId);
          reply = "📅 Holiday marked";
        } catch {
          reply = "❌ Failed to mark holiday";
        }
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
