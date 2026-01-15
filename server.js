import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";

import { connectDB } from "./db.js";
import User from "./models/User.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";
import LoginToken from "./models/LoginToken.js";
import { summarizeAttendance } from "./ai.js";

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json());

/* -------------------- AUTH -------------------- */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  const userId = req.headers["x-user-id"] || req.query.userId;

  if (!token || !userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const validToken = crypto
    .createHash("sha256")
    .update(userId + process.env.JWT_SECRET)
    .digest("hex");

  if (token !== validToken) {
    return res.status(401).json({ message: "Invalid token" });
  }

  req.userId = userId;
  next();
}

/* -------------------- DB -------------------- */
await connectDB();

/* -------------------- HELPERS -------------------- */
function getTodayIST() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  });
}

/* -------------------- HEALTH -------------------- */
app.get("/health", (_, res) => res.send("OK"));

/* -------------------- ATTENDANCE -------------------- */
app.post("/attendance", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "UserId missing" });
    }

    const { status, reason = "-" } = req.body;
    const today = getTodayIST();
    await Holiday.deleteOne({ userId, date: today });
    // const holiday = await Holiday.findOne({ userId, date: today });
    // if (holiday) {
    //   return res.json({ message: "Holiday — attendance ignored" });
    // }

    await Attendance.findOneAndUpdate(
      { userId, date: today },     // ✅ FIX
      { status, reason },          // ✅ FIX
      { upsert: true, new: true }
    );

    res.json({
      message: "Attendance saved",
      date: today,
      userId
    });
  } catch (err) {
    console.error("POST /attendance ERROR:", err);
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
      { userId, date: today },          // ✅ FIXED
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


/* -------------------- GET ALL -------------------- */
app.get("/attendance/all", async (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"];
    if (!userId) return res.status(400).json({ message: "userId required" });

    const attendance = await Attendance.find({ userId }).lean();
    const holidays = await Holiday.find({ userId }).lean();

    const map = new Map();

    attendance.forEach(a =>
      map.set(a.date, { date: a.date, status: a.status, reason: a.reason })
    );

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
app.post("/attendance/summarize", auth, async (req, res) => {
  try {
    const summary = await summarizeAttendance(req.userId);
    res.json({ summary });
  } catch {
    res.status(500).json({ message: "AI failed" });
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
