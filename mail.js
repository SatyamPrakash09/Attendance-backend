import { summarizeAttendance } from "./ai";
import nodemailer from nodemailer;

// Create a transporter using Ethereal test credentials.
// For production, replace with your actual SMTP server details.
export async function mail(){const transporter = nodemailer.createTransport({
  host: "satyamprakash669@gmail.com",
  port: 587,
  secure: false, // Use true for port 465, false for port 587
  auth: {
    user: "satyamprakash669@gmail.com",
    pass: process.env.app_password,
  },
});
const response = await summarizeAttendance()
// Send an email using async/await
(async () => {
  const info = await transporter.sendMail({
    from: '"Attendance System" <satyamprakash669@gmail.com>',
    to: "satyamprakash996@gmail.com",
    subject: "Attendance Summary ✔",
    text: `${response}`, // Plain-text version of the message
    html: `<b>${response}</b>`, // HTML version of the message
  });

  return("Message sent:", info.messageId);
})();}