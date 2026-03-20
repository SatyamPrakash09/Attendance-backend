import "dotenv/config";
import express from "express";
import cors from "cors";

import { connectDB } from "./db.js";
import User from "./models/User.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";
import { summarizeAttendance } from "./ai.js";

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json());

await connectDB();

/* -------------------- HELPERS -------------------- */
function getTodayIST() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  });
}

/* -------------------- LOGIN -------------------- */
// TODO



/* -------------------- HEALTH -------------------- */
app.get("/health", (_, res) => res.send("OK"));

/* -------------------- ATTENDANCE -------------------- */

app.post("/attendance", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "UserId missing" });
    }

    const { status, reason = "Present" } = req.body;
    const today = getTodayIST();
    await Holiday.deleteOne({ userId, date: today });

    await Attendance.findOneAndUpdate(
      { userId, date: today },     
      { status, reason },         
      { upsert: true, new: true }
    );

    res.json({
      message: "Attendance saved",
      date: today,
    });
  } catch (err) {
    console.error("POST /attendance ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------- EDIT PAST ATTENDANCE ---------- */
app.put("/attendance", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "UserId missing" });
    }

    const { date, status, reason = "-" } = req.body;

    // Validate date format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
      return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD format." });
    }

    // Reject future dates
    const today = getTodayIST();
    if (date > today) {
      return res.status(400).json({ message: "Cannot mark attendance for a future date." });
    }

    // Remove any holiday entry for this date
    await Holiday.deleteOne({ userId, date });

    await Attendance.findOneAndUpdate(
      { userId, date },
      { status, reason },
      { upsert: true, new: true }
    );

    res.json({
      message: "Attendance updated",
      date
    });
  } catch (err) {
    console.error("PUT /attendance ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* -------------------- HOLIDAY -------------------- */
app.post("/holiday", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "UserId missing" });
    }
    const today = getTodayIST();

    await Attendance.deleteOne({ userId, date: today });

    await Holiday.findOneAndUpdate(
      { userId, date: today },          
      { $set: { reason: "Declared by user" } },
      { upsert: true, new: true }
    );

    res.json({
      message: "Holiday saved",
      date: today,
      userId
    });
  } catch (err) {
    console.error("POST /holiday ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------- EDIT PAST HOLIDAY ---------- */
app.put("/holiday", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "UserId missing" });
    }

    const { date } = req.body;

    // Validate date format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
      return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD format." });
    }

    // Reject future dates
    const today = getTodayIST();
    if (date > today) {
      return res.status(400).json({ message: "Cannot mark holiday for a future date." });
    }

    // Remove any attendance entry for this date
    await Attendance.deleteOne({ userId, date });

    await Holiday.findOneAndUpdate(
      { userId, date },
      { $set: { reason: "Declared by user" } },
      { upsert: true, new: true }
    );

    res.json({
      message: "Holiday updated",
      date
    });
  } catch (err) {
    console.error("PUT /holiday ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------- GET ALL -------------------- */
app.get("/attendance/all", async (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"];
    if (!userId) return res.status(400).json({ message: "userId required" });

    const attendance = await Attendance.find({ userId }).lean();
    const holidays = await Holiday.find({ userId }).lean();
    const user = await User.find({userId}).lean();
    const map = new Map();

    attendance.forEach(a => {
      const u = user.find(usr => usr.userId === a.userId);
      map.set(a.date, { 
        date: a.date, 
        status: a.status, 
        reason: a.reason,
        name: u?.name || "Unknown", 
        section: u?.section || "N/A"
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
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------- AI SUMMARY -------------------- */
app.get("/attendance/summarize",  async (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"];
    if (!userId) return res.status(400).json({ message: "userId required" });
    const summary = await summarizeAttendance(userId);
    res.json({ summary });
  } catch {
    res.status(500).json({ message: "AI failed" });
  }
});

app.post("/attendance/query", async (req, res) => {
  try {
    const userId = req.body.userId || req.headers["x-user-id"];
    const { query } = req.body;

    if (!userId) return res.status(400).json({ message: "userId required" });
    if (!query) return res.status(400).json({ message: "query required" });

    const response = await summarizeAttendance(userId, query);
    res.json({ response });
  } catch (error) {
    console.error("POST /attendance/query ERROR:", error);
    res.status(500).json({ message: "AI query failed" });
  }
});

/* -------------------- USER -------------------- */
app.get("/user", async (req, res) => {
  const userId = req.query.userId;
  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
