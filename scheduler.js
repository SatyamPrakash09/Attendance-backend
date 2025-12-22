import cron from "node-cron";
import "dotenv/config";
import mongoose from "mongoose";

import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";

// ------------------ TELEGRAM CONFIG ------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ------------------ MONGODB CONNECT ------------------
if (mongoose.connection.readyState === 0) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Scheduler connected to MongoDB");
}

// ------------------ HELPERS ------------------
async function sendMessage(text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text
    })
  });
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function isSunday() {
  return new Date().getDay() === 0;
}

// =====================================================
// ⏰ 1️⃣ ATTENDANCE PROMPT (9:00 AM IST)
// Render runs in UTC → 9:00 AM IST = 3:30 AM UTC
// =====================================================
cron.schedule("30 3 * * 1-6", async () => {
  console.log("⏰ Scheduler: Morning prompt check");

  if (isSunday()) {
    console.log("Sunday — skipped");
    return;
  }

  const today = getToday();

  // Skip if holiday
  const holiday = await Holiday.findOne({ date: today });
  if (holiday) {
    console.log("Holiday — skipped");
    return;
  }

  // Skip if already marked
  const alreadyMarked = await Attendance.findOne({ date: today });
  if (alreadyMarked) {
    console.log("Attendance already marked — skipped");
    return;
  }

  await sendMessage(
    "📘 Attendance Time (9:00 AM IST)\n\nReply with:\n• present\n• absent <reason>\n• holiday"
  );

  console.log("📩 Attendance prompt sent");
});

// =====================================================
// ⏰ 2️⃣ AUTO-ABSENT (11:00 AM IST)
// 11:00 AM IST = 5:30 AM UTC
// =====================================================
cron.schedule("30 5 * * 1-6", async () => {
  console.log("⏰ Scheduler: Auto-absent check");

  if (isSunday()) {
    console.log("Sunday — skipped");
    return;
  }

  const today = getToday();

  // Skip if holiday
  const holiday = await Holiday.findOne({ date: today });
  if (holiday) {
    console.log("Holiday — skipped");
    return;
  }

  // Skip if already marked
  const alreadyMarked = await Attendance.findOne({ date: today });
  if (alreadyMarked) {
    console.log("Attendance already marked — skipped");
    return;
  }

  // Auto-mark absent
  await Attendance.create({
    date: today,
    status: "Absent",
    reason: "Auto-marked (No response by 11:00 AM)"
  });

  await sendMessage(
    "⚠️ Marked ABSENT\nReason: No response by 11:00 AM IST"
  );

  console.log("❌ Auto-absent recorded");
});

console.log("✅ Scheduler started and running");
