import "dotenv/config";
import { connectDB } from "./db.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const API_BASE = "https://attendance-backend-hhkn.onrender.com";

await connectDB();

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

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
    function getTodayIST() {
      return new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata"
      });
    }

    const today = getTodayIST();

    if (text === "/test") {
      await sendMessage(
        chatId,
        "✅ Bot is working\n🌐 Backend: OK\n🗄️ MongoDB: Connected"
      );
      offset = update.update_id + 1;
      continue;
    }

    if (new Date().getDay() === 0) continue; // Sunday OFF

    if (text === "holiday") {
      await Holiday.updateOne(
        { date: today },
        { reason: "Declared by user" },
        { upsert: true }
      );
      await sendMessage(chatId, "📅 Marked today as HOLIDAY");
    }

    else if (text === "present") {
      try {
        await saveAttendance("Present");
        await sendMessage(chatId, "✅ Marked PRESENT");
      } catch {
        await sendMessage(chatId, "❌ PRESENT not saved");
      }
    }

    else if (text.startsWith("absent")) {
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
        "Use:\npresent\nabsent <reason>\nholiday"
      );
    }

    offset = update.update_id + 1;
  }

  setTimeout(() => getUpdates(offset), 2000);
}

getUpdates();
