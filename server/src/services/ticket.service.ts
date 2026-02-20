import { PrismaClient, Priority, TicketStatus } from "@prisma/client";
import { calculateSlaDeadline } from "../utils/sla";
import { notifyTicketCreated, notifyStatusChange, notifyNewComment } from "./email.service";
import { notifyAdmins } from "./notification.service";
import { sendPushToUser } from "./fcm.service";

const prisma = new PrismaClient();

const ticketInclude = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, email: true } },
  app: { select: { id: true, name: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } },
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

  // Send email notification (from app-specific sender if configured)
  notifyTicketCreated(ticket.user.email, ticket.title, ticket.id, ticket.app);

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

  // Notify ticket owner and assigned developer
  if (!data.isInternalNote) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      include: {
        user: { select: { email: true } },
        assignee: { select: { id: true, email: true } },
        app: { select: { name: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } },
      },
    });
    if (ticket) {
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
    include: { user: { select: { email: true } }, app: { select: { name: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } } },
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
