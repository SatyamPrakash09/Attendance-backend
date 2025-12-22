import express from "express";
import cors from "cors";
import "dotenv/config";

import { connectDB } from "./db.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

/* -------------------- DB CONNECT -------------------- */
await connectDB();

/* ====================================================
   SAVE / UPDATE ATTENDANCE (FROM BOT / FRONTEND)
   ==================================================== */
app.post("/attendance", async (req, res) => {
  try {
    const { status, reason = "-" } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const today = new Date().toISOString().split("T")[0];

    // ❌ Do not allow attendance on holidays
    const holiday = await Holiday.findOne({ date: today });
    if (holiday) {
      return res.json({ message: "Holiday — attendance ignored" });
    }

    await Attendance.findOneAndUpdate(
      { date: today },
      { status, reason },
      { upsert: true, new: true }
    );

    res.json({
      message: "Attendance saved",
      date: today,
      status,
      reason
    });

  } catch (err) {
    console.error("POST /attendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ====================================================
   GET ALL ATTENDANCE ONLY (RAW)
   ==================================================== */
app.get("/attendance", async (req, res) => {
  try {
    const data = await Attendance.find().sort({ date: 1 });
    res.json(data);
  } catch (err) {
    console.error("GET /attendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ====================================================
   GET TODAY'S STATUS (BOT / FRONTEND)
   ==================================================== */
app.get("/attendance/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const holiday = await Holiday.findOne({ date: today });
    if (holiday) {
      return res.json({
        date: today,
        status: "Holiday",
        reason: holiday.reason || "Holiday"
      });
    }

    const record = await Attendance.findOne({ date: today });
    res.json(record || null);

  } catch (err) {
    console.error("GET /attendance/today error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ====================================================
   🔥 MERGED DATA FOR FRONTEND (ATTENDANCE + HOLIDAYS)
   ==================================================== */
app.get("/attendance/all", async (req, res) => {
  try {
    const attendance = await Attendance.find().lean();
    const holidays = await Holiday.find().lean();

    const holidayMap = new Map(
      holidays.map(h => [h.date, h.reason || "Holiday"])
    );

    const merged = [];

    // Add attendance records
    for (const a of attendance) {
      merged.push({
        date: a.date,
        status: a.status,
        reason: a.reason
      });
      holidayMap.delete(a.date);
    }

    // Add holidays not in attendance
    for (const [date, reason] of holidayMap.entries()) {
      merged.push({
        date,
        status: "Holiday",
        reason
      });
    }

    merged.sort((a, b) => a.date.localeCompare(b.date));

    res.json(merged);

  } catch (err) {
    console.error("GET /attendance/all error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ====================================================
   HEALTH CHECK
   ==================================================== */
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
