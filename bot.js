import fetch from "node-fetch";
import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const API_BASE = "https://attendance-backend-hhkn.onrender.com";

/* -------------------- HELPERS -------------------- */
function getDayIST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  ).getDay();
}

function generateToken(userId) {
  // must match backend logic
  return require("crypto")
    .createHash("sha256")
    .update(userId + process.env.JWT_SECRET)
    .digest("hex");
}

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

/* -------------------- BACKEND CALLS -------------------- */
async function apiPost(path, userId, body = {}) {
  const token = generateToken(userId);

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-User-Id": userId
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}

/* -------------------- BOT LOOP -------------------- */
async function getUpdates(offset = 0) {
  const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}`);
  const data = await res.json();

  for (const update of data.result || []) {
    offset = update.update_id + 1;

    if (!update.message?.text) continue;

    const chatId = update.message.chat.id.toString();
    const text = update.message.text.toLowerCase();

    // Sunday OFF
    if (getDayIST() === 0) {
      await sendMessage(chatId, "📅 Sunday is a holiday");
      continue;
    }

    if (text === "test") {
      await sendMessage(chatId, "✅ Bot is working");
    }

    else if (text === "hello") {
      await sendMessage(
        chatId,
        "Hello 👋\nUse:\n• present\n• absent <reason>\n• holiday\n• summary"
      );
    }

    else if (text === "present") {
      try {
        await apiPost("/attendance", chatId, { status: "Present" });
        await sendMessage(chatId, "✅ Marked PRESENT");
      } catch {
        await sendMessage(chatId, "❌ Failed to mark PRESENT");
      }
    }

    else if (text.startsWith("absent")) {
      const reason = text.replace("absent", "").trim() || "-";
      try {
        await apiPost("/attendance", chatId, {
          status: "Absent",
          reason
        });
        await sendMessage(chatId, `❌ Marked ABSENT\nReason: ${reason}`);
      } catch {
        await sendMessage(chatId, "❌ Failed to mark ABSENT");
      }
    }

    else if (text === "holiday") {
      try {
        await apiPost("/holiday", chatId);
        await sendMessage(chatId, "📅 Marked today as HOLIDAY");
      } catch {
        await sendMessage(chatId, "❌ Failed to mark HOLIDAY");
      }
    }

    else if (text === "summary") {
      try {
        const res = await apiPost("/attendance/summarize", chatId);
        await sendMessage(chatId, res.summary);
      } catch {
        await sendMessage(chatId, "❌ Could not generate summary");
      }
    }

    else {
      await sendMessage(
        chatId,
        "Unknown command.\nTry: present, absent <reason>, holiday, summary"
      );
    }
  }

  setTimeout(() => getUpdates(offset), 2000);
}

export default getUpdates;
