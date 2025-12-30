import "dotenv/config";
import express from "express";
import cors from "cors";

import { connectDB } from "./db.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";
import { sendSummaryEmail } from "./mailer.js";
import { summarizeAttendance } from "./ai.js";

// import { sendSummaryMail } from "./mailer.js"; // if you enabled email

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

/* -------------------- HELPERS -------------------- */
function getTodayIST() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  });
}


/* ====================================================
   BACKEND HEALTH
   ==================================================== */
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});


/* ====================================================
   SAVE / UPDATE ATTENDANCE
   ==================================================== */
app.post("/attendance", async (req, res) => {
  try {
    const { status, reason = "present" } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const today = getTodayIST();

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
   GET RAW ATTENDANCE
   ==================================================== */
app.get("/attendance", async (req, res) => {
  try {
    const data = await Attendance.find().sort({ date: 1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ====================================================
   GET TODAY STATUS
   ==================================================== */
app.get("/attendance/today", async (req, res) => {
  try {
    const today = getTodayIST();

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
    res.status(500).json({ message: "Server error" });
  }
});

/* ====================================================
   MERGED DATA FOR FRONTEND
   ==================================================== */
app.get("/attendance/all", async (req, res) => {
  try {
    const attendance = await Attendance.find().lean();
    const holidays = await Holiday.find().lean();

    const map = new Map();

    attendance.forEach(a => {
      map.set(a.date, {
        date: a.date,
        status: a.status,
        reason: a.reason
      });
    });

    holidays.forEach(h => {
      if (!map.has(h.date)) {
        map.set(h.date, {
          date: h.date,
          status: "Holiday",
          reason: h.reason || "Holiday"
        });
      }
    });

    const result = [...map.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    res.json(result);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/holiday", async (req, res) => {
  const today = getTodayIST();

  await Holiday.findOneAndUpdate(
    { date: today },
    { reason: "Declared by user" },
    { upsert: true }
  );

  res.json({ message: "Holiday saved", date: today });
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

app.post("/attendance/summarize", async (req, res) => {
  try {
    // 1️⃣ Generate summary
    const summary = await summarizeAttendance();

    // 2️⃣ Send response to frontend immediately
    res.json({
      summary,
      emailed: false
    });

    // 3️⃣ Send email in background (DO NOT await)
    sendSummaryEmail(summary)
      .then(() => {
        console.log("📧 Summary email sent successfully");
      })
      .catch(err => {
        console.error("📧 Email failed:", err.message);
      });

  } catch (err) {
    console.error("Summary error:", err.message);
    res.status(500).json({
      message: "Failed to generate summary"
    });
  }
});


app.get("/__test/ai", async (req, res) => {
  try {
    const summary = await summarizeAttendance();
    res.json({
      status: "AI working",
      summary
    });
  } catch (err) {
    res.status(500).json({
      status: "AI failed",
      error: err.message
    });
  }
});


/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
