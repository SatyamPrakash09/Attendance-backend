import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  date: {
    type: String,
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

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
