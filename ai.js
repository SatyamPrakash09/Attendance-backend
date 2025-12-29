import { GoogleGenerativeAI } from "@google/generative-ai";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";
import "dotenv/config";
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function summarizeAttendance() {
  const attendance = await Attendance.find().sort({ date: 1 }).lean();
  const holidays = await Holiday.find().sort({ date: 1 }).lean();

  // Case 1: No data at all
  if (!attendance.length && !holidays.length) {
    return "No attendance or holiday data has been recorded yet.";
  }

  // Use the model ID that worked in your region test
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    // Case 2: Only holidays declared
    if (!attendance.length && holidays.length) {
      const holidayDates = holidays.map(h => h.date).join(", ");

      const prompt = `
A student has not recorded attendance yet, but has declared holidays.
Holiday dates: ${holidayDates}
Write a short summary explaining that attendance has not started, but holidays have been recorded. Keep it friendly and clear.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    }

    // Case 3: Attendance exists
    const totalDays = attendance.length;
    const present = attendance.filter(r => r.status === "Present").length;
    const absent = attendance.filter(r => r.status === "Absent").length;

    const attendanceDetails = attendance
      .map(r => `${r.date}: ${r.status}`)
      .join("\n");

    // --- FIXED SYNTAX ERROR HERE ---
    const holidayDetails = holidays.length > 0 
      ? holidays.map(h => h.date).join(", ") 
      : "None";

    const prompt = `
You are summarizing a student's attendance.
Total attendance days: ${totalDays}
Present days: ${present}
Absent days: ${absent}
Attendance records:
${attendanceDetails}
Holidays:
${holidayDetails}

You are generating a formal student attendance summary.

Follow these rules strictly:
- Do not use quotation marks.
- Do not use markdown symbols such as **, *, or bullet icons.
- Do not add greetings, explanations, or conclusions.
- Do not mention databases, systems, AI, or internal logic.
- Output ONLY the attendance summary in plain text.

Include all of the following details clearly and accurately:

Number of present days:
<insert total present days>

Number of absent days:
<insert total absent days>

Number of holidays:
Total holidays: <insert total number>

You must cross-check every holiday date against the official 2025 Indian Public Holiday list. If a date matches an official holiday, count it as a public holiday in India. If it was a holiday provided by me that does not match the official list, count it as a user declared holiday.

Breakdown of holidays:
Public holidays in India: <insert count of public holidays>
User-declared holidays: <insert count of holidays declared by the student>

If a category has zero count, explicitly mention it as 0.
Use clear, formal, and professional language.
Ensure the summary is easy to read and well structured.
`;

    const result = await model.generateContent(prompt);
    
    return result.response.text();
  } catch (error) {
    console.error("Gemini Error:", error.message);
    return "Summary temporarily unavailable.";
  }
}