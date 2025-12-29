import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, unique: true }, // YYYY-MM-DD
    status: { type: String, enum: ["Present", "Absent"], required: true },
    reason: { type: String, default: "Present" }
  },
  { timestamps: true }
);

export default mongoose.model("Attendance", attendanceSchema);
