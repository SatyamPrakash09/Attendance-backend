import { GoogleGenerativeAI } from "@google/generative-ai";
import Attendance from "./models/Attendance.js";
import Holiday from "./models/Holiday.js";
import User from "./models/User.js";
import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function summarizeAttendance(userId,query) {
  if (!userId) {
    throw new Error("userId is required for summary");
  }

  // ✅ FIX: Proper user-scoped queries
  const attendance = await Attendance.find({ userId })
    .sort({ date: 1 })
    .lean();

  const holidays = await Holiday.find({ userId: userId })
    .sort({ date: 1 })
    .lean();

  // Case 1: No data at all
  if (!attendance.length && !holidays.length) {
    return "No attendance or holiday data has been recorded yet.";
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

    //Case 4 User Query 
  if(query){
    const totalDays = attendance.length;
    const present = attendance.filter(r => r.status === "Present").length;
    const absent = attendance.filter(r => r.status === "Absent").length;

    const attendanceDetails = attendance
      .map(r => `${r.date}: ${r.status}`)
      .join("\n");

    const holidayDetails =
      holidays.length > 0
        ? holidays.map(h => h.date).join(", ")
        : "None";
        
    const prompt = `You are an helpful assistant named Onix. Answer the user's query based on their attendance data below.
    Total present days: ${present}
    Total absent days: ${absent}
    Holidays: ${holidayDetails}
    
    Attendance Details:
    ${attendanceDetails}

    User Query: ${query}

    Follow these rules strictly:
    - Do not use markdown symbols like **, *, or bullet icons.
    - Do not use quotation marks.
    - Keep the response short and professional.
    - Only answer attendance-related questions.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
  

  try {
    // Case 2: Only holidays declared
    if (!attendance.length && holidays.length) {
      const holidayDates = holidays.map(h => h.date).join(", ");

      const prompt = `
A student has not recorded attendance yet, but has declared holidays.
Holiday dates: ${holidayDates}
Write a short summary explaining that attendance has not started, but holidays have been recorded. Keep it friendly and clear.
`;

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

    const holidayDetails =
      holidays.length > 0
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
- Output ONLY the attendance summary in plain text.

Include all of the following details clearly and accurately and strictly follow below format only with each data in new line:

Number of present days:
<insert total present days>

Number of absent days:
<insert total absent days>

Number of holidays:
Total holidays: <insert total number>

Breakdown of holidays:
Public holidays in India: <insert count of public holidays and name of the public holidays with date>
User-declared holidays: <insert count of holidays declared by the student>
(Note: Classify holidays based on common knowledge of Indian holidays. If unsure, list under User-declared.)

If a category has zero count, explicitly mention it as 0.
Use clear, formal, and professional language.
`;


    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Error:", error.message);
    return "Summary temporarily unavailable.";
  }
}
