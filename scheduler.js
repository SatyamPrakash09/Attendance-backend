import cron from "node-cron";
import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function sendMessage(text) {
  fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text })
  });
}

// 9 AM, Monday–Saturday
cron.schedule("0 9 * * 1-6", () => {
  sendMessage(
    "📘 Attendance Time\nReply with:\npresent\nabsent <reason>\nholiday"
  );
});
