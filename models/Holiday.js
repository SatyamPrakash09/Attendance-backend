import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  reason: String
},{timestamps:true});

// chat_id + date must be unique (only one holiday record per user per date)
// userId + date must be unique (only one holiday record per user per date)
holidaySchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Holiday", holidaySchema);
