import "dotenv/config";
import { connectDB } from "./db.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

await connectDB();

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
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
    const today = new Date().toISOString().split("T")[0];

    // Sunday OFF
    if (new Date().getDay() === 0) {
      offset = update.update_id + 1;
      continue;
    }

    if (text === "holiday") {
      await Holiday.updateOne(
        { date: today },
        { reason: "Declared by user" },
        { upsert: true }
      );
      await sendMessage(chatId, "📅 Marked today as HOLIDAY");
    }

    else if (text === "present") {
      await Attendance.updateOne(
        { date: today },
        { status: "Present", reason: "-" },
        { upsert: true }
      );
      await sendMessage(chatId, "✅ Marked PRESENT");
    }

    else if (text.startsWith("absent")) {
      const reason = text.replace("absent", "").trim() || "No reason";
      await Attendance.updateOne(
        { date: today },
        { status: "Absent", reason },
        { upsert: true }
      );
      await sendMessage(chatId, `❌ Marked ABSENT\nReason: ${reason}`);
    }

    else {
      await sendMessage(chatId, "Use:\npresent\nabsent <reason>\nholiday");
    }

    offset = update.update_id + 1;
  }

  setTimeout(() => getUpdates(offset), 2000);
}

getUpdates();
