import path from "path";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  jwtExpiresIn: "7d",
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@feedback.app",
  },
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads"),
  slaHours: {
    critical: 4,
    high: 24,
    medium: 72,
    low: 168,
  },
};
