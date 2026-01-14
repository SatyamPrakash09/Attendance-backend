import mongoose from "mongoose";

const loginTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
});

export default mongoose.model("LoginToken", loginTokenSchema);
