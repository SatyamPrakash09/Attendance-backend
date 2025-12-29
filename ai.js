import { GoogleGenerativeAI } from "@google/generative-ai";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";


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

  // Case 2: Only holidays declared
  if (!attendance.length && holidays.length) {
    const holidayDates = holidays.map(h => h.date).join(", ");

    const prompt = `
A student has not recorded attendance yet, but has declared holidays.

Holiday dates:
${holidayDates}

Write a short summary explaining that attendance has not started,
but holidays have been recorded. Keep it friendly and clear.
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  // Case 3: Attendance exists (with or without holidays)
  const totalDays = attendance.length;
  const present = attendance.filter(r => r.status === "Present").length;
  const absent = attendance.filter(r => r.status === "Absent").length;

  const attendanceDetails = attendance
    .map(r => `${r.date}: ${r.status}`)
    .join("\n");

  const holidayDetails = holidays.length
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

Write a concise, friendly summary (4–5 lines).
Do not mention databases or technical details.

important : Be strict on your guidelines and donot give anything other than the student attendance summary.
`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);

  return result.response.text();
}
