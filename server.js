import express from "express";
import cors from "cors";
import "dotenv/config";

import { connectDB } from "./db.js";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";

const app = express();
app.use(cors());
app.use(express.json());

await connectDB();

/**
 * Save / Update today's attendance
 */
app.post("/attendance", async (req, res) => {
  const { status, reason = "-" } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  const today = new Date().toISOString().split("T")[0];

  // holiday protection
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
});

/**
 * Get all attendance (React dashboard)
 */
app.get("/attendance", async (req, res) => {
  const data = await Attendance.find().sort({ date: 1 });
  res.json(data);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
