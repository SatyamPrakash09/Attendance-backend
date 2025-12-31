import cron from "node-cron";
import "dotenv/config";
import mongoose from "mongoose";

import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";

/* ------------------ START LOG ------------------ */
console.log("🔥 Scheduler file loaded");

/* ------------------ MONGODB CONNECT ------------------ */
if (mongoose.connection.readyState === 0) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Scheduler connected to MongoDB");
}

/* ------------------ TELEGRAM CONFIG ------------------ */
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* ------------------ HELPERS ------------------ */
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

async function sendMessage(text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text })
  });
}

/* ------------------ TEST CRON (every minute) ------------------ */
cron.schedule("* * * * *", () => {
  console.log("🧪 Cron heartbeat:", new Date().toISOString());
});

/* =====================================================
   ⏰ MORNING PROMPT — 9:00 AM IST (03:30 UTC)
   ===================================================== */
cron.schedule("30 3 * * 1-6", async () => {
  console.log("⏰ Morning attendance check");

  if (getDayIST() === 0) return;

  const today = getTodayIST();

  if (await Holiday.findOne({ date: today })) return;
  if (await Attendance.findOne({ date: today })) return;

  await sendMessage(
    "📘 Attendance Time\n\npresent | absent <reason> | holiday"
  );

  console.log("📩 Prompt sent");
});

/* =====================================================
   ⏰ AUTO ABSENT — 11:00 AM IST (05:30 UTC)
   ===================================================== */
cron.schedule("30 5 * * 1-6", async () => {
  console.log("⏰ Auto-absent check");

  if (getDayIST() === 0) return;

  const today = getTodayIST();

  if (await Holiday.findOne({ date: today })) return;
  if (await Attendance.findOne({ date: today })) return;

  await Attendance.create({
    date: today,
    status: "Absent",
    reason: "Auto-marked (No response by 11:00 AM IST)"
  });

  await sendMessage("⚠️ Marked ABSENT (no response)");

  console.log("❌ Auto-absent recorded");
});

console.log("✅ Scheduler initialized");