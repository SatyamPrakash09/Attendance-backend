import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true }, // chatId
  name: { type: String, required: true },
  username: {type: String},
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
