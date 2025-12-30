import "dotenv/config";
import { connectDB } from "./db.js";
import {summarizeAttendance} from "./ai.js"

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const API_BASE = "https://attendance-backend-hhkn.onrender.com";

await connectDB();

/* -------------------- HELPERS -------------------- */
function getTodayIST() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  });
}

function getDayIST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  ).getDay();
}

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

/* -------------------- API CALLS -------------------- */
async function saveAttendance(status, reason = "-") {
  const res = await fetch(`${API_BASE}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason })
  });

  const data = await res.json();
  if (!res.ok || data.message !== "Attendance saved") {
    throw new Error("Attendance not saved");
  }
}

async function markHoliday() {
  const res = await fetch(`${API_BASE}/holiday`, {
    method: "POST"
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Holiday not saved");
  }
}

/* -------------------- BOT LOOP -------------------- */
async function getUpdates(offset = 0) {
  const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}`);
  const data = await res.json();

  for (const update of data.result || []) {
    if (!update.message || !update.message.text) {
      offset = update.update_id + 1;
      continue;
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.toLowerCase();

    // Sunday OFF (IST-safe)
    if (getDayIST() === 0) {
      offset = update.update_id + 1;
      continue;
    }

    if (text.toLowerCase() === "test") {
      await sendMessage(
        chatId,
        "✅ Bot is working\n🌐 Backend: OK\n🗄️ MongoDB: Connected"
      );
    }

    else if (text.toLowerCase() === "holiday") {
      try {
        await markHoliday();
        await sendMessage(chatId, "📅 Marked today as HOLIDAY");
      } catch {
        await sendMessage(chatId, "❌ Holiday not saved");
      }
    }

    else if (text.toLowerCase() === "present" || text === "Present") {
      try {
        await saveAttendance("Present");
        await sendMessage(chatId, "✅ Marked PRESENT");
      } catch {
        await sendMessage(chatId, "❌ PRESENT not saved");
      }
    }

    else if(text === "/summary" || text.toLowerCase() ==="summary"){
      try{
        const response = await summarizeAttendance()
        await sendMessage(chatId, response)
      }catch{
        await sendMessage(chatId, "AI summary not generated ❌")
      }
    }
    else if (text.toLowerCase().startsWith("absent")) {
      const reason = text.replace("absent", "").trim() || "No reason";
      try {
        await saveAttendance("Absent", reason);
        await sendMessage(chatId, `❌ Marked ABSENT\nReason: ${reason}`);
      } catch {
        await sendMessage(chatId, "❌ ABSENT not saved");
      }
    }

    else {
      await sendMessage(
        chatId,
        "Use:\n1. Present\n\n2. Absent <reason>\n\n3. holiday"
      );
    }

    offset = update.update_id + 1;
  }

  setTimeout(() => getUpdates(offset), 2000);
}

getUpdates();
