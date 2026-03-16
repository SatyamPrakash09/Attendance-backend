# Attendance Backend

A lightweight backend for a Telegram-based attendance system. The project provides:
- a REST API for recording attendance and holidays,
- a Telegram bot that prompts students and accepts commands,
- scheduled jobs to prompt users and auto-mark absentees,
- an AI-powered attendance summarizer (uses Google Generative AI / Gemini).

Built with Node.js, Express, MongoDB (Mongoose), and node-cron.

## Table of contents
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment variables (.env)](#environment-variables-env)
  - [Install & run](#install--run)
- [API](#api)
  - [Authentication](#authentication)
  - [Endpoints](#endpoints)
- [Telegram bot](#telegram-bot)
- [Scheduler](#scheduler)
- [AI summarization](#ai-summarization)
- [Database models](#database-models)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features
- Record daily attendance (Present / Absent) with optional reason
- Mark holidays declared by users
- Telegram bot to register users and accept commands (`present`, `absent <reason>`, `holiday`, `summary`)
- Cron jobs to prompt users and auto-mark absentees
- Attendance summarization using Google Generative AI (Gemini)
- MongoDB-backed persistence with Mongoose models

## Tech stack
- Node.js (ES modules)
- Express
- MongoDB + Mongoose
- node-cron
- Telegram Bot API (polling)
- Google Generative AI (gemini) client (optional)
- Additional deps: cors, dotenv, node-fetch, nodemailer (listed but optional)

## Getting started

### Prerequisites
- Node.js >= 18
- npm
- MongoDB instance (URI)
- Telegram bot token (create via BotFather) if you want bot features
- (Optional) Google Gemini API key for summarization
- (Optional) SMTP credentials if you plan to use nodemailer functionality (not required by core endpoints)

### Environment variables (.env)
Create a `.env` file in the project root with these variables (example):

MONGO_URI="mongodb+srv://<user>:<pass>@cluster0.mongodb.net/attendance?retryWrites=true&w=majority"
BOT_TOKEN="<your-telegram-bot-token>"
GEMINI_API_KEY="<google-gemini-api-key>"
JWT_SECRET="<a-secret-string-used-for-auth-tokens>"
API_BASE="<public-or-local-api-base-url>" # e.g. https://your-domain.com OR http://localhost:3000
# Optional / informational:
MYSQL_HOST="<mysql-host-if-used>"
# If using nodemailer:
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""

Notes:
- The server generates/validates a simple authorization token using: sha256(userId + JWT_SECRET). Requests from the bot include the userId header.
- Ensure `MONGO_URI` and `BOT_TOKEN` are set for full functionality.

### Install & run
1. Clone the repository:
   git clone https://github.com/SatyamPrakash09/Attendance-backend.git
2. Install dependencies:
   npm install
3. Start the app:
   npm start
   (The `start` script runs `node index.js` which loads server, bot, scheduler, db, and ai modules.)

You can also run in development with `nodemon` if installed.

## API

### Authentication
- The API expects a header `Authorization: Bearer <token>` and either a header `X-User-Id: <userId>` or query parameter `?userId=<userId>`.
- The token is validated in server code as:
  sha256(userId + process.env.JWT_SECRET)
- For local testing you can compute the token using any sha256 tool or a small script.

Example header:
Authorization: Bearer <sha256-of-userId+JWT_SECRET>
X-User-Id: 123456789

### Endpoints
Note: examples use JSON bodies.

- GET /health
  - Returns: `OK`
  - Purpose: health check

- POST /attendance
  - Headers: `X-User-Id` or query `?userId=...`, optionally `Authorization: Bearer <token>`
  - Body:
    {
      "status": "Present" | "Absent",
      "reason": "<optional reason>"
    }
  - Behavior: Saves or upserts attendance for today (India timezone). Deletes any holiday for the date if present.
  - Response:
    { message: "Attendance saved", date: "YYYY-MM-DD", userId: "..." }

- POST /holiday
  - Headers: `X-User-Id` or query `?userId=...`, optionally `Authorization: Bearer <token>`
  - Body (none required)
  - Behavior: Deletes any attendance for today and creates a holiday record for the user+date.
  - Response:
    { message: "Holiday saved", date: "YYYY-MM-DD", userId: "..." }

- (Other endpoints)
  - The project contains an AI summarizer and may expose summary-related endpoints (e.g. `/summary`) — consult `server.js` for full route list. I reviewed the repository files while drafting this README.

Example curl (mark present):
curl -X POST "http://localhost:3000/attendance" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 123456" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"Present"}'

## Telegram bot
- The bot code polls Telegram and interacts with users.
- Registration flow: `/start` then collects name, email, section.
- Commands supported (as seen in bot code):
  - `present`
  - `absent <reason>`
  - `holiday`
  - `summary`
- Bot uses `BOT_TOKEN` and sends requests to the backend `API_BASE` (or default render URL).
- To enable bot features, set `BOT_TOKEN` and ensure the app is reachable by the bot (if using webhooks, adapt logic; current bot uses polling so outgoing access only).

## Scheduler
- Uses `node-cron` to:
  - Prompt users every morning at 9:00 AM IST (cron set to 03:30 UTC / 30 3)
  - Auto-mark absent at 11:00 AM IST (05:30 UTC / 30 5)
- Cron schedules are defined in `scheduler.js`. Scheduler reads users, checks attendance and holidays, then messages via Telegram.

## AI summarization
- The project integrates with Google Generative AI (Gemini) via `@google/generative-ai`.
- `ai.js` expects `GEMINI_API_KEY` and provides `summarizeAttendance(userId)` which:
  - Collects attendance and holiday records for a user and calls the model to generate a formatted summary.
- If you do not plan to use AI features, you can omit `GEMINI_API_KEY`. The code throws an error at load time if missing; consider guarding or disabling AI import in `index.js` if you want to run without it.

## Database models (Mongoose)
- User: { userId (unique), name, email, section, createdAt }
- Attendance: { userId, date (YYYY-MM-DD), status: "Present"|"Absent", reason } with unique index on (userId, date)
- Holiday: { userId, date, reason } with unique index on (userId, date)
- LoginToken: token storage (if login flow is used)

## Deployment
- Any Node.js host (Render, Heroku, Railway, DigitalOcean) that supports environment variables and keeps long-running processes will work.
- Ensure `MONGO_URI`, `BOT_TOKEN`, and `JWT_SECRET` are configured in your deployment environment.
- If you want the bot to run reliably use a host that supports long-lived processes (polling) or adapt to webhooks.

## Troubleshooting & notes
- The current token approach is a simple deterministic hash (sha256(userId + JWT_SECRET)). For production, consider a proper auth flow (JWTs, OAuth, or signed tokens with expirations).
- The code logs `DB HOST: process.env.MYSQL_HOST` in `index.js` but MongoDB (MONGO_URI) is the primary DB. `mysql2` is present in package.json but not essential to the shown code paths—remove or document if unused.
- The AI module currently throws if `GEMINI_API_KEY` is missing. If you want the service to run without AI, update `index.js` to lazily import `ai.js` or guard its initialization.

## Contributing
- Feel free to open issues or PRs.
- Suggested improvements:
  - Add tests and CI
  - Add proper authentication + token expiry
  - Add API docs (Swagger/OpenAPI)
  - Add graceful shutdown handling for cron and bot polling

## License
- ISC (see package.json). Adjust license file if needed.

## Contact
- Repo: https://github.com/SatyamPrakash09/Attendance-backend
