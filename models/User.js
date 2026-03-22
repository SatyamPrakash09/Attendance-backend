import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true }, // Telegram chat ID
  name: String,
  email: String,
  section: String,
  createdAt: { type: Date, default: Date.now }
}, {timestamps:true});

export default mongoose.model("User", userSchema);
