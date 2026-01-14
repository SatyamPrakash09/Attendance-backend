import crypto from "crypto";

export function generateLoginToken(userId) {
  return crypto
    .createHash("sha256")
    .update(userId + process.env.JWT_SECRET + Date.now())
    .digest("hex");
}
