import cron from "node-cron";
import "dotenv/config";
import mongoose from "mongoose";

import Attendance from "./models/Attendance.js";
import User from "./models/User.js";
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

async function sendMessage(chatId, text) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (err) {
    console.error(`Failed to send message to ${chatId}:`, err.message);
  }
}


/* =====================================================
   ⏰ MORNING PROMPT — 9:00 AM IST (03:30 UTC)
   ===================================================== */
cron.schedule("30 3 * * 1-6", async () => {
  console.log("⏰ Morning attendance check");

  if (getDayIST() === 0) return;

  const today = getTodayIST();
  const users = await User.find({});

  for (const user of users) {
    if (!user.userId) continue;

    const holiday = await Holiday.findOne({ userId: user.userId, date: today });
    if (holiday) continue;

    const attendance = await Attendance.findOne({ userId: user.userId, date: today });
    if (attendance) continue;

    await sendMessage(
      user.userId,
      "📘 Attendance Time\n\npresent | absent <reason> | holiday"
    );
  }

  console.log(`📩 Prompt process completed for ${users.length} users`);
});

/* =====================================================
   ⏰ AUTO ABSENT — 11:00 AM IST (05:30 UTC)
   ===================================================== */
/* =====================================================
   ⏰ AUTO ABSENT — 11:00 AM IST (05:30 UTC)
   ===================================================== */
cron.schedule("30 5 * * 1-6", async () => {
  console.log("⏰ Auto-absent check");

  if (getDayIST() === 0) return;

  const today = getTodayIST();
  const users = await User.find({});

  for (const user of users) {
    if (!user.userId) continue;

    // Check holiday
    const holiday = await Holiday.findOne({ userId: user.userId, date: today });
    if (holiday) continue;

    // Check attendance
    const attendance = await Attendance.findOne({ userId: user.userId, date: today });
    if (attendance) continue;

    // Mark absent
    try {
      await Attendance.create({
        userId: user.userId,
        date: today,
        status: "Absent",
        reason: "Auto-marked (No response by 11:00 AM IST)"
      });
      await sendMessage(user.userId, "⚠️ Marked ABSENT (no response)");
      console.log(`❌ Auto-absent recorded for ${user.name}`);
    } catch (err) {
      console.error(`Error marking absent for ${user.userId}:`, err.message);
    }
  }
});

console.log("✅ Scheduler initialized");