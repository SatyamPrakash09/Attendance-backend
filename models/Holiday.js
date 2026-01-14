import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  date: { type: String, required: true },
  reason: String
});

// chat_id + date must be unique (only one holiday record per user per date)
holidaySchema.index({ chat_id: 1, date: 1 }, { unique: true });

export default mongoose.model("Holiday", holidaySchema);
