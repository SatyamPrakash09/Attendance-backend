import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  date: { type: String, unique: true },
  reason: String
});

export default mongoose.model("Holiday", holidaySchema);
