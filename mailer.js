import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function sendSummaryEmail(summary) {
  await transporter.sendMail({
    from: `Attendance Tracker <${process.env.EMAIL_USER}>`,
    to: process.env.SUMMARY_RECEIVER,
    subject: "Attendance Summary Report",
    text: summary
  });
}
