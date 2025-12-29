import { GoogleGenerativeAI } from "@google/generative-ai";
import Attendance from "./models/Attendance.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function summarizeAttendance() {
  const records = await Attendance.find().sort({ date: 1 }).lean();

  if (!records.length) {
    return "No attendance data available yet.";
  }

  const total = records.length;
  const present = records.filter(r => r.status === "Present").length;
  const absent = records.filter(r => r.status === "Absent").length;

  const details = records
    .map(r => `${r.date}: ${r.status}`)
    .join("\n");

  const prompt = `
You are summarizing a student's attendance.

Total days: ${total}
Present: ${present}
Absent: ${absent}

Daily records:
${details}

Write a short, clear summary (4–5 lines) in simple English.
`;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);

  return result.response.text();
}
