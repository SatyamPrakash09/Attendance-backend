import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  chat_id:{type:String,unique:true},
  date: { type: String, unique: true },
  reason: String
});

export default mongoose.model("Holiday", holidaySchema);
