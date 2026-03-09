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

function getAppName(app?: AppEmail): string {
  return app?.name || "SupportDesk";
}

// ── Base email layout ──

function emailLayout(appName: string, content: string, footerNote?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;text-align:center;line-height:32px;font-size:18px;color:#fff;">&#9781;</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${appName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 28px;border-top:1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-top:20px;text-align:center;">
                    ${footerNote ? `<p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${footerNote}</p>` : ""}
                    <p style="margin:0;font-size:12px;color:#9ca3af;">
                      Sent by ${appName} &bull; ${new Date().getFullYear()}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function badge(text: string, bgColor: string, textColor: string = "#ffffff"): string {
  return `<span style="display:inline-block;padding:4px 12px;background-color:${bgColor};color:${textColor};border-radius:20px;font-size:12px;font-weight:600;letter-spacing:0.3px;">${text}</span>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:#6b7280;width:100px;">${label}</td>
    <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:500;">${value}</td>
  </tr>`;
}

function statusColor(status: string): string {
  switch (status) {
    case "open": case "new": return "#3b82f6";
    case "in_progress": return "#f59e0b";
    case "resolved": return "#10b981";
    case "closed": case "acknowledged": return "#6b7280";
    default: return "#6b7280";
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Send functions ──

export async function sendEmail(to: string, subject: string, html: string, app?: AppEmail) {
  const transport = getTransporter(app);
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

/** Send email and return the SMTP response (for test/debug — errors propagate) */
export async function sendEmailWithResponse(to: string, subject: string, html: string, app?: AppEmail) {
  const transport = getTransporter(app);
  if (transport === defaultTransporter && !config.smtp.user) {
    throw new Error("No SMTP configured");
  }
  const info = await transport.sendMail({
    from: getFrom(app),
    to,
    subject,
    html,
  });
  return {
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}

// ── Email templates ──

export async function notifyTicketCreated(userEmail: string, ticketTitle: string, ticketId: string, app?: AppEmail) {
  const appName = getAppName(app);
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">Ticket Created</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Your support request has been received and our team will review it shortly.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Title", ticketTitle)}
          ${infoRow("Ticket ID", `<code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:13px;">${ticketId.slice(0, 8)}</code>`)}
          ${infoRow("Status", badge("Open", "#3b82f6"))}
          ${infoRow("Created", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}
        </table>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">You'll receive updates when there's activity on your ticket.</p>`;

  await sendEmail(userEmail, `Ticket Created: ${ticketTitle}`, emailLayout(appName, content, "We'll get back to you as soon as possible."), app);
}

export async function notifyStatusChange(userEmail: string, ticketTitle: string, oldStatus: string, newStatus: string, app?: AppEmail) {
  const appName = getAppName(app);
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">Ticket Updated</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">The status of your support ticket has been updated.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Title", ticketTitle)}
          ${infoRow("Status", `${badge(formatStatus(oldStatus), "#e5e7eb", "#374151")} <span style="color:#9ca3af;margin:0 6px;">&#8594;</span> ${badge(formatStatus(newStatus), statusColor(newStatus))}`)}
        </table>
      </td></tr>
    </table>
    ${newStatus === "resolved" ? `<div style="margin-top:24px;padding:16px;background-color:#ecfdf5;border-radius:8px;border:1px solid #a7f3d0;">
      <p style="margin:0;font-size:14px;color:#065f46;">&#10003; Your ticket has been marked as resolved. If you still need help, you can reopen it by replying.</p>
    </div>` : ""}`;

  await sendEmail(userEmail, `Ticket Updated: ${ticketTitle}`, emailLayout(appName, content), app);
}

export async function notifyNewComment(userEmail: string, ticketTitle: string, commenterName: string, app?: AppEmail) {
  const appName = getAppName(app);
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">New Comment</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Someone has commented on your support ticket.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Ticket", ticketTitle)}
          ${infoRow("Comment by", `<span style="color:#059669;font-weight:600;">${commenterName}</span>`)}
        </table>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Open your ticket to view the full comment and reply.</p>`;

  await sendEmail(userEmail, `New Comment on: ${ticketTitle}`, emailLayout(appName, content), app);
}

export async function sendWelcomeEmail(userEmail: string, userName: string, app?: AppEmail) {
  const appName = getAppName(app);
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">Welcome, ${userName}!</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">Your account has been created successfully. Here's what you can do:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:16px;background-color:#ecfdf5;border-radius:8px;border:1px solid #a7f3d0;margin-bottom:12px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px;vertical-align:top;font-size:20px;">&#127915;</td>
              <td>
                <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#065f46;">Submit Support Tickets</p>
                <p style="margin:0;font-size:13px;color:#047857;">Get help from our team with any issues you encounter.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px;vertical-align:top;font-size:20px;">&#11088;</td>
              <td>
                <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e40af;">Share Feedback</p>
                <p style="margin:0;font-size:13px;color:#1d4ed8;">Rate your experience and help us improve.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:#fefce8;border-radius:8px;border:1px solid #fde68a;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px;vertical-align:top;font-size:20px;">&#128276;</td>
              <td>
                <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#92400e;">Stay Updated</p>
                <p style="margin:0;font-size:13px;color:#a16207;">Receive notifications when your tickets are updated.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  await sendEmail(userEmail, `Welcome to ${appName}!`, emailLayout(appName, content, "Thank you for joining us!"), app);
}

export async function notifyAdminNewTicket(adminEmail: string, userName: string, ticketTitle: string, ticketId: string, priority: string, app?: AppEmail) {
  const appName = getAppName(app);
  const priColor = priority === "urgent" ? "#EF4444" : priority === "high" ? "#F59E0B" : priority === "medium" ? "#3B82F6" : "#6B7280";
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">New Ticket Submitted</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">A new support ticket has been submitted and needs attention.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Title", ticketTitle)}
          ${infoRow("Submitted by", `<span style="color:#059669;font-weight:600;">${userName}</span>`)}
          ${infoRow("Ticket ID", `<code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:13px;">${ticketId.slice(0, 8)}</code>`)}
          ${infoRow("Priority", badge(formatStatus(priority), priColor))}
          ${infoRow("Status", badge("Open", "#3b82f6"))}
        </table>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Log in to the admin panel to review and respond to this ticket.</p>`;

  await sendEmail(adminEmail, `New Ticket: ${ticketTitle}`, emailLayout(appName, content, "Please review this ticket promptly."), app);
}

export async function notifyAdminNewFeedback(adminEmail: string, userName: string, rating: number, category: string, comment: string | null, app?: AppEmail) {
  const appName = getAppName(app);
  const stars = "&#9733;".repeat(rating) + "&#9734;".repeat(5 - rating);
  const ratingColor = rating >= 4 ? "#10B981" : rating >= 3 ? "#F59E0B" : "#EF4444";
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">New Feedback Received</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">A user has submitted new feedback for your app.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("From", `<span style="color:#059669;font-weight:600;">${userName}</span>`)}
          ${infoRow("Rating", `<span style="font-size:18px;color:${ratingColor};letter-spacing:2px;">${stars}</span>`)}
          ${infoRow("Category", badge(formatStatus(category), "#6B7280"))}
          ${comment ? infoRow("Comment", `<span style="color:#374151;font-style:italic;">"${comment.length > 100 ? comment.slice(0, 100) + "..." : comment}"</span>`) : ""}
        </table>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Log in to the admin panel to view and reply to this feedback.</p>`;

  await sendEmail(adminEmail, `New ${rating}★ Feedback from ${userName}`, emailLayout(appName, content), app);
}

export async function sendFeedbackReplyNotification(userEmail: string, rating: number, replyBy: string, app?: AppEmail) {
  const appName = getAppName(app);
  const stars = "&#9733;".repeat(rating) + "&#9734;".repeat(5 - rating);
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">Feedback Reply</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Your feedback has received a response from our team.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Your Rating", `<span style="font-size:18px;color:#f59e0b;letter-spacing:2px;">${stars}</span>`)}
          ${infoRow("Reply by", `<span style="color:#059669;font-weight:600;">${replyBy}</span>`)}
        </table>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Open the app to view the full reply.</p>`;

  await sendEmail(userEmail, "Your feedback received a reply", emailLayout(appName, content), app);
}
