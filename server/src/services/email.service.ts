import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";

const defaultTransporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

interface AppEmail {
  emailFrom?: string | null;
  emailName?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  name: string;
}

// Cache per-app transporters to avoid creating a new one on every email
const transporterCache = new Map<string, Transporter>();

function getTransporter(app?: AppEmail): Transporter {
  if (app?.smtpHost && app.smtpUser && app.smtpPass) {
    const key = `${app.smtpHost}:${app.smtpPort || 587}:${app.smtpUser}`;
    if (!transporterCache.has(key)) {
      const port = app.smtpPort || 587;
      transporterCache.set(key, nodemailer.createTransport({
        host: app.smtpHost,
        port,
        secure: port === 465,
        auth: { user: app.smtpUser, pass: app.smtpPass },
      }));
    }
    return transporterCache.get(key)!;
  }
  return defaultTransporter;
}

function getFrom(app?: AppEmail): string {
  if (app?.emailFrom) {
    const name = app.emailName || app.name;
    return `"${name}" <${app.emailFrom}>`;
  }
  return config.smtp.from;
}

export async function sendEmail(to: string, subject: string, html: string, app?: AppEmail) {
  const transport = getTransporter(app);
  // Skip if no SMTP configured (neither app-level nor global)
  if (transport === defaultTransporter && !config.smtp.user) return;
  try {
    await transport.sendMail({
      from: getFrom(app),
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("Email send error:", err);
  }
}

export async function notifyTicketCreated(userEmail: string, ticketTitle: string, ticketId: string, app?: AppEmail) {
  await sendEmail(
    userEmail,
    `Ticket Created: ${ticketTitle}`,
    `<h2>Your ticket has been created</h2>
     <p><strong>Title:</strong> ${ticketTitle}</p>
     <p><strong>Ticket ID:</strong> ${ticketId}</p>
     <p>We'll get back to you soon.</p>`,
    app
  );
}

export async function notifyStatusChange(userEmail: string, ticketTitle: string, oldStatus: string, newStatus: string, app?: AppEmail) {
  await sendEmail(
    userEmail,
    `Ticket Updated: ${ticketTitle}`,
    `<h2>Your ticket status has changed</h2>
     <p><strong>Title:</strong> ${ticketTitle}</p>
     <p><strong>Status:</strong> ${oldStatus} → ${newStatus}</p>`,
    app
  );
}

export async function notifyNewComment(userEmail: string, ticketTitle: string, commenterName: string, app?: AppEmail) {
  await sendEmail(
    userEmail,
    `New Comment on: ${ticketTitle}`,
    `<h2>New comment on your ticket</h2>
     <p><strong>Title:</strong> ${ticketTitle}</p>
     <p><strong>Comment by:</strong> ${commenterName}</p>`,
    app
  );
}

export async function sendWelcomeEmail(userEmail: string, userName: string, app?: AppEmail) {
  const appName = app?.name || "Feedback Hub";
  await sendEmail(
    userEmail,
    `Welcome to ${appName}!`,
    `<h2>Welcome, ${userName}!</h2>
     <p>Thank you for joining ${appName}. You can now submit tickets and share feedback.</p>
     <p>If you need help, just create a support ticket and our team will get back to you.</p>`,
    app
  );
}

export async function sendFeedbackReplyNotification(userEmail: string, rating: number, replyBy: string, app?: AppEmail) {
  await sendEmail(
    userEmail,
    "Your feedback received a reply",
    `<h2>Reply to your feedback</h2>
     <p>Your ${rating}★ feedback has received a reply from <strong>${replyBy}</strong>.</p>
     <p>Log in to view the full response.</p>`,
    app
  );
}
