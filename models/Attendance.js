import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true
  },
  status: {
    type: String,
    enum: ["Present", "Absent"],
    required: true
  },
  reason: {
    type: String,
    default: "-"
  }
});

// ✅ one attendance per user per date
attendanceSchema.index(
  { userId: 1, date: 1 },
  { unique: true }
);

export default mongoose.model("Attendance", attendanceSchema);
