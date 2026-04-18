import { PrismaClient, Priority, TicketStatus } from "@prisma/client";
import { calculateSlaDeadline } from "../utils/sla";
import { notifyTicketCreated, notifyStatusChange, notifyNewComment, notifyAdminNewTicket } from "./email.service";
import { notifyAdmins, createNotification } from "./notification.service";
import { sendPushToUser } from "./fcm.service";
import { resolveMentions } from "../utils/mentions";
import { broadcastToUser } from "../websocket";

const prisma = new PrismaClient();

const ticketInclude = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, email: true } },
  app: { select: { id: true, name: true, iconUrl: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } },
  _count: { select: { comments: true, attachments: true } },
};

async function getAutoAssignee(appId: string): Promise<string | null> {
  // Prefer admins assigned to this app, fall back to all admins
  const appAdmins = await prisma.appAdmin.findMany({
    where: { appId },
    select: { userId: true },
  });
  let candidateIds = appAdmins.map((a) => a.userId);

  if (candidateIds.length === 0) {
    const allAdmins = await prisma.user.findMany({
      where: { role: { in: ["admin", "super_admin"] } },
      select: { id: true },
    });
    candidateIds = allAdmins.map((a) => a.id);
  }

  if (candidateIds.length === 0) return null;

  const counts = await Promise.all(
    candidateIds.map(async (id) => ({
      id,
      count: await prisma.ticket.count({
        where: { assignedTo: id, status: { in: ["open", "in_progress"] } },
      }),
    }))
  );
  counts.sort((a, b) => a.count - b.count);
  return counts[0].id;
}

export async function createTicket(data: {
  appId: string;
  userId: string;
  title: string;
  description: string;
  category?: string;
  priority?: Priority;
}) {
  const priority = data.priority || "medium";
  const assignedTo = await getAutoAssignee(data.appId);
  const ticket = await prisma.ticket.create({
    data: {
      appId: data.appId,
      userId: data.userId,
      title: data.title,
      description: data.description,
      category: data.category,
      priority,
      slaDeadline: calculateSlaDeadline(priority),
      assignedTo,
    },
    include: ticketInclude,
  });

  // Send email notification to user (from app-specific sender if configured)
  notifyTicketCreated(ticket.user.email, ticket.title, ticket.id, ticket.app);

  // Email all app admins about the new ticket
  const appAdmins = await prisma.appAdmin.findMany({
    where: { appId: data.appId },
    include: { user: { select: { email: true } } },
  });
  const assigneeName = ticket.assignee?.name;
  for (const aa of appAdmins) {
    notifyAdminNewTicket(aa.user.email!, {
      userName: ticket.user.name,
      userEmail: ticket.user.email,
      ticketTitle: ticket.title,
      ticketId: ticket.id,
      description: data.description,
      priority,
      category: data.category,
      assigneeName,
      slaDeadline: ticket.slaDeadline || undefined,
    }, ticket.app);
  }

  // Notify admins in real-time
  notifyAdmins({
    type: "new_ticket",
    title: "New Ticket",
    message: `${ticket.user.name} created: ${ticket.title}`,
    link: `/tickets/${ticket.id}`,
  });

  return ticket;
}

export async function listUserTickets(userId: string, appId?: string, page = 1, limit = 20) {
  const where: any = { userId };
  if (appId) where.appId = appId;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getTicketDetail(ticketId: string, userId?: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      ...ticketInclude,
      comments: {
        where: userId ? { OR: [{ isInternalNote: false }, { userId }] } : undefined,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: true,
      history: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return ticket;
}

export async function addComment(data: {
  ticketId: string;
  userId: string;
  body: string;
  isInternalNote?: boolean;
}) {
  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: data.ticketId,
      userId: data.userId,
      body: data.body,
      isInternalNote: data.isInternalNote || false,
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // @-mentions fire regardless of internal/public — admins should get pinged
  // either way. Skip if the mentioned user is the author themselves.
  processMentions({
    body: data.body,
    authorId: data.userId,
    authorName: comment.user.name,
    ticketId: data.ticketId,
  }).catch((err) => console.warn("processMentions failed:", err));

  // Notify ticket owner and assigned developer
  if (!data.isInternalNote) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      include: {
        user: { select: { email: true } },
        assignee: { select: { id: true, email: true } },
        app: { select: { name: true, iconUrl: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } },
      },
    });
    if (ticket) {
      // Live WebSocket push — the SDK's ticket detail listens for this and
      // appends the new comment without a full refresh. Sent to the creator
      // and (if different) the assignee so both sides see the same thread.
      const wsPayload = {
        type: "ticket_comment",
        ticketId: data.ticketId,
        userId: data.userId,
        data: comment,
      };
      if (ticket.userId !== data.userId) broadcastToUser(ticket.userId, wsPayload);
      if (ticket.assignee && ticket.assignee.id !== data.userId) {
        broadcastToUser(ticket.assignee.id, wsPayload);
      }

      // Notify ticket creator (if commenter is not the creator)
      if (ticket.userId !== data.userId) {
        notifyNewComment(ticket.user.email, ticket.title, comment.user.name, ticket.app);
        // FCM push to ticket creator
        sendPushToUser(ticket.userId, ticket.appId, {
          title: "New Comment",
          body: `${comment.user.name} commented on "${ticket.title}"`,
        }, { type: "new_comment", ticketId: data.ticketId });
      }
      // Notify assigned developer (if commenter is not the assignee)
      if (ticket.assignee && ticket.assignee.id !== data.userId) {
        notifyNewComment(ticket.assignee.email!, ticket.title, comment.user.name, ticket.app);
      }
    }
  }

  return comment;
}

export async function getComment(commentId: string) {
  return prisma.ticketComment.findUnique({
    where: { id: commentId },
    select: { id: true, ticketId: true, userId: true, createdAt: true, body: true, isInternalNote: true },
  });
}

export async function updateCommentBody(commentId: string, body: string) {
  return prisma.ticketComment.update({
    where: { id: commentId },
    data: { body },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function deleteComment(commentId: string) {
  return prisma.ticketComment.delete({ where: { id: commentId } });
}

export async function addAttachment(data: {
  ticketId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}) {
  return prisma.ticketAttachment.create({ data });
}

export async function updateTicket(
  ticketId: string,
  changedBy: string,
  updates: { status?: TicketStatus; priority?: Priority; assignedTo?: string | null; slaDeadline?: Date }
) {
  const current = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true } }, app: { select: { name: true, iconUrl: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } } },
  });
  if (!current) return null;

  // Track history
  const historyEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  for (const [field, newValue] of Object.entries(updates)) {
    const oldValue = (current as any)[field];
    if (oldValue !== newValue) {
      historyEntries.push({ field, oldValue: String(oldValue ?? ""), newValue: String(newValue ?? "") });
    }
  }

  // Recalculate SLA if priority changed
  if (updates.priority && updates.priority !== current.priority) {
    updates.slaDeadline = calculateSlaDeadline(updates.priority);
  }

  const [ticket] = await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: updates, include: ticketInclude }),
    ...historyEntries.map((h) =>
      prisma.ticketHistory.create({
        data: { ticketId, changedBy, ...h },
      })
    ),
  ]);

  // Notify on status change
  if (updates.status && updates.status !== current.status) {
    notifyStatusChange(current.user.email, current.title, current.status, updates.status, current.app);
    // FCM push to ticket creator
    sendPushToUser(current.userId, current.appId, {
      title: "Ticket Updated",
      body: `Your ticket "${current.title}" is now ${updates.status.replace("_", " ")}`,
    }, { type: "ticket_update", ticketId });
  }

  return ticket;
}

/**
 * Merge `duplicateId` into `primaryId`:
 *   - Move comments and attachments under the primary ticket
 *   - Record a history entry on the primary ticket ("merged from X")
 *   - Add an internal note on the primary with the admin-provided reason
 *   - Close the duplicate with a user-facing comment linking to the primary
 *
 * Returns the updated primary ticket (re-fetched with full detail shape).
 */
export async function mergeTicket(data: {
  primaryId: string;
  duplicateId: string;
  adminId: string;
  reason?: string;
}) {
  if (data.primaryId === data.duplicateId) throw new Error("Cannot merge a ticket into itself");

  const [primary, duplicate] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: data.primaryId } }),
    prisma.ticket.findUnique({ where: { id: data.duplicateId } }),
  ]);
  if (!primary) throw new Error("Primary ticket not found");
  if (!duplicate) throw new Error("Duplicate ticket not found");

  await prisma.$transaction(async (tx) => {
    // Re-parent comments
    await tx.ticketComment.updateMany({
      where: { ticketId: data.duplicateId },
      data: { ticketId: data.primaryId },
    });
    // Re-parent attachments
    await tx.ticketAttachment.updateMany({
      where: { ticketId: data.duplicateId },
      data: { ticketId: data.primaryId },
    });

    // Internal note on primary explaining the merge
    await tx.ticketComment.create({
      data: {
        ticketId: data.primaryId,
        userId: data.adminId,
        body: `🔗 Merged from #${duplicate.id.slice(0, 8)}${data.reason ? ` — ${data.reason}` : ""}`,
        isInternalNote: true,
      },
    });

    // History entry on primary
    await tx.ticketHistory.create({
      data: {
        ticketId: data.primaryId,
        changedBy: data.adminId,
        field: "merge",
        oldValue: null,
        newValue: duplicate.id,
      },
    });

    // Close the duplicate + add a user-facing comment pointing to the primary
    await tx.ticket.update({
      where: { id: data.duplicateId },
      data: { status: "closed" },
    });
    await tx.ticketComment.create({
      data: {
        ticketId: data.duplicateId,
        userId: data.adminId,
        body: `This ticket has been merged into #${primary.id.slice(0, 8)}. Please follow up there for further updates.`,
        isInternalNote: false,
      },
    });
  });

  return prisma.ticket.findUnique({
    where: { id: data.primaryId },
    include: ticketInclude,
  });
}

/**
 * Resolve @-mentions in a ticket comment body and deliver an in-app + WS
 * notification to each mentioned admin. Skips self-mentions.
 */
async function processMentions(data: {
  body: string;
  authorId: string;
  authorName: string;
  ticketId: string;
}) {
  const mentionedIds = await resolveMentions(data.body);
  const recipients = mentionedIds.filter((id) => id !== data.authorId);
  if (recipients.length === 0) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: data.ticketId },
    select: { title: true },
  });
  const title = ticket?.title ?? "a ticket";
  const excerpt = data.body.length > 120 ? data.body.slice(0, 117) + "…" : data.body;

  await Promise.all(
    recipients.map((uid) =>
      createNotification({
        userId: uid,
        type: "mention",
        title: `${data.authorName} mentioned you`,
        message: `On "${title}": ${excerpt}`,
        link: `/tickets/${data.ticketId}`,
      })
    )
  );
}
