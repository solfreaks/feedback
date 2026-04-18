import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../middleware/auth";
import { adminGuard } from "../middleware/adminGuard";
import * as ticketService from "../services/ticket.service";
import * as analyticsService from "../services/analytics.service";
import * as feedbackService from "../services/feedback.service";
import * as userService from "../services/user.service";
import * as emailService from "../services/email.service";
import { config } from "../config";
import { toCsv } from "../utils/csv";
import * as announcementService from "../services/announcement.service";

const router = Router();
const prisma = new PrismaClient();

function deleteUploadedFile(fileUrl: string) {
  try {
    const filename = path.basename(fileUrl);
    const filepath = path.join(config.uploadDir, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch { /* ignore */ }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate, adminGuard);

// List all tickets with filters
router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const appId = req.query.appId as string | undefined;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const search = req.query.search as string | undefined;
    // "stale": tickets not closed/resolved with no activity in the last 24h.
    // "unread": tickets where the admin hasn't viewed since the ticket was last updated.
    const stale = req.query.stale === "true";
    const unread = req.query.unread === "true";
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");

    const where: any = {};
    if (appId) where.appId = appId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) {
      where.assignedTo = assignedTo === "unassigned" ? null : assignedTo;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (stale) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      where.status = where.status || { in: ["open", "in_progress"] };
      where.updatedAt = { lt: oneDayAgo };
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          app: { select: { id: true, name: true } },
          _count: { select: { comments: true, attachments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    // Derive unread flag per ticket; optionally filter to unread-only.
    const enriched = tickets.map((t: any) => ({
      ...t,
      isUnread: !t.adminLastViewedAt || t.adminLastViewedAt < t.updatedAt,
      isStale: (t.status === "open" || t.status === "in_progress") &&
        t.updatedAt < new Date(Date.now() - 24 * 60 * 60 * 1000),
    }));
    const filtered = unread ? enriched.filter((t: any) => t.isUnread) : enriched;

    return res.json({ tickets: filtered, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin list tickets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Export tickets as CSV — honors the same filters as the list endpoint but
// returns every matching row (no pagination). Capped at 10k to avoid blowing
// up memory on a run-away query.
router.get("/tickets/export.csv", async (req: Request, res: Response) => {
  try {
    const appId = req.query.appId as string | undefined;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (appId) where.appId = appId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        assignee: { select: { name: true } },
        app: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const headers = [
      "ID", "App", "Title", "Status", "Priority", "Category",
      "User Name", "User Email", "Assignee", "Created", "Updated",
    ];
    const rows = tickets.map((t) => [
      t.id, t.app.name, t.title, t.status, t.priority, t.category ?? "",
      t.user.name ?? "", t.user.email ?? "", t.assignee?.name ?? "",
      t.createdAt.toISOString(), t.updatedAt.toISOString(),
    ]);

    const csv = toCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tickets-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error("Admin export tickets CSV error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk update tickets — supports status, priority, assignedTo across a
// selected set of IDs. Runs each update through ticketService.updateTicket so
// the same auto-assign / history-tracking / notification plumbing still fires.
// Registered BEFORE the /:id variant so Express doesn't treat "bulk" as an id.
router.patch("/tickets/bulk", async (req: Request, res: Response) => {
  try {
    const { ids, status, priority, assignedTo } = req.body as {
      ids?: string[];
      status?: string;
      priority?: string;
      assignedTo?: string | null;
    };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    // Safety cap so a wayward select-all doesn't touch the whole DB.
    if (ids.length > 500) {
      return res.status(400).json({ error: "Cannot bulk update more than 500 tickets at once" });
    }
    const results = await Promise.allSettled(
      ids.map((id) => ticketService.updateTicket(id, req.user!.id, {
        status: status as any,
        priority: priority as any,
        assignedTo: assignedTo as any,
      }))
    );
    const updated = results.filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<any>).value).length;
    const failed = results.length - updated;
    return res.json({ updated, failed });
  } catch (err) {
    console.error("Bulk update tickets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk delete tickets.
router.delete("/tickets/bulk", async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    if (ids.length > 500) {
      return res.status(400).json({ error: "Cannot bulk delete more than 500 tickets at once" });
    }
    // Cascade rules on the schema handle comments/attachments/history, but we
    // still want to clean up files on disk so they don't leak storage.
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: ids } },
      include: { attachments: true },
    });
    for (const t of tickets) {
      for (const a of t.attachments) deleteUploadedFile(a.fileUrl);
    }
    const result = await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
    return res.json({ deleted: result.count });
  } catch (err) {
    console.error("Bulk delete tickets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Merge one ticket into another. Runs comments/attachments re-parenting
// plus history + notification inside a transaction — see mergeTicket().
router.post("/tickets/:id/merge-into/:primaryId", async (req: Request, res: Response) => {
  try {
    const { reason } = req.body as { reason?: string };
    const merged = await ticketService.mergeTicket({
      primaryId: req.params.primaryId,
      duplicateId: req.params.id,
      adminId: req.user!.id,
      reason,
    });
    return res.json(merged);
  } catch (err: any) {
    console.error("Merge ticket error:", err);
    return res.status(err?.message?.startsWith("Primary") || err?.message?.startsWith("Duplicate") || err?.message?.startsWith("Cannot merge") ? 400 : 500)
      .json({ error: err?.message || "Internal server error" });
  }
});

// Update ticket (status, priority, assignment, SLA)
router.patch("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const { status, priority, assignedTo, handoffNote } = req.body;
    const ticket = await ticketService.updateTicket(req.params.id, req.user!.id, {
      status,
      priority,
      assignedTo,
    });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // If the admin provided a handoff note alongside a reassignment, store it
    // as an internal comment so the new assignee picks up the context. We
    // require `assignedTo` to be present to avoid leaking random comments.
    if (assignedTo !== undefined && typeof handoffNote === "string" && handoffNote.trim()) {
      await ticketService.addComment({
        ticketId: req.params.id,
        userId: req.user!.id,
        body: `🔁 Handoff: ${handoffNote.trim()}`,
        isInternalNote: true,
      });
    }

    return res.json(ticket);
  } catch (err) {
    console.error("Admin update ticket error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get ticket detail (admin view with internal notes)
router.get("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true } },
        app: { select: { id: true, name: true } },
        comments: {
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
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // Mark as viewed by admin. Fire-and-forget; don't block the response on it.
    prisma.ticket.update({
      where: { id: ticket.id },
      data: { adminLastViewedAt: new Date() },
    }).catch((err) => console.warn("markTicketAdminViewed failed:", err));

    // Resolve user names in assignedTo history entries
    const assigneeIds = new Set<string>();
    for (const h of ticket.history) {
      if (h.field === "assignedTo") {
        if (h.oldValue) assigneeIds.add(h.oldValue);
        if (h.newValue) assigneeIds.add(h.newValue);
      }
    }
    let assigneeMap: Record<string, string> = {};
    if (assigneeIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...assigneeIds] } },
        select: { id: true, name: true },
      });
      assigneeMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
    }
    const enrichedHistory = ticket.history.map((h) => {
      if (h.field === "assignedTo") {
        return {
          ...h,
          oldValue: (h.oldValue && assigneeMap[h.oldValue]) || h.oldValue,
          newValue: (h.newValue && assigneeMap[h.newValue]) || h.newValue,
        };
      }
      return h;
    });

    return res.json({ ...ticket, history: enrichedHistory });
  } catch (err) {
    console.error("Admin get ticket error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete ticket
router.delete("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId: req.params.id },
      select: { fileUrl: true },
    });
    await prisma.ticket.delete({ where: { id: req.params.id } });
    attachments.forEach((a) => deleteUploadedFile(a.fileUrl));
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete ticket error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete comment
router.delete("/tickets/:id/comments/:commentId", async (req: Request, res: Response) => {
  try {
    await prisma.ticketComment.delete({ where: { id: req.params.commentId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete comment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Add comment or internal note
router.post("/tickets/:id/notes", async (req: Request, res: Response) => {
  try {
    const { body, isInternalNote } = req.body;
    if (!body) return res.status(400).json({ error: "body is required" });
    // Fail safe toward internal — omitting the flag must never accidentally
    // push content user-visible. A snarky admin note leaking to the user
    // isn't recoverable; the opposite mistake (hiding a public reply) is.
    const comment = await ticketService.addComment({
      ticketId: req.params.id,
      userId: req.user!.id,
      body,
      isInternalNote: isInternalNote !== false,
    });
    return res.status(201).json(comment);
  } catch (err) {
    console.error("Admin add note error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upload attachment to ticket
router.post("/tickets/:id/attachments", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const attachment = await ticketService.addAttachment({
      ticketId: req.params.id,
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
    return res.status(201).json(attachment);
  } catch (err) {
    console.error("Admin upload attachment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List admin users (for assignee picker)
router.get("/admins", async (_req: Request, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["admin", "super_admin"] } },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      orderBy: { name: "asc" },
    });
    return res.json(admins);
  } catch (err) {
    console.error("List admins error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get logged-in admin's personalized dashboard data
router.get("/my-dashboard", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const days = parseInt((req.query.days as string) || "7");
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevPeriodStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    // Get admin's assigned apps (only relevant for non-super_admin)
    let assignedAppIds: string[] | null = null;
    if (role !== "super_admin") {
      const assignments = await prisma.appAdmin.findMany({
        where: { userId },
        select: { appId: true },
      });
      assignedAppIds = assignments.map((a) => a.appId);
    }

    // Build scope filter for app-scoped data
    const scopeWhere: any = assignedAppIds ? { appId: { in: assignedAppIds } } : {};

    // Tickets assigned to this admin
    const myTickets = await prisma.ticket.findMany({
      where: { assignedTo: userId, status: { in: ["open", "in_progress"] } },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        app: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const [myOpenCount, myTotalAssigned, myResolvedCount] = await Promise.all([
      prisma.ticket.count({ where: { assignedTo: userId, status: { in: ["open", "in_progress"] } } }),
      prisma.ticket.count({ where: { assignedTo: userId } }),
      prisma.ticket.count({ where: { assignedTo: userId, status: { in: ["resolved", "closed"] } } }),
    ]);

    // SLA breached tickets assigned to this admin
    const mySlaBreached = await prisma.ticket.count({
      where: {
        assignedTo: userId,
        status: { in: ["open", "in_progress"] },
        slaDeadline: { lt: now },
      },
    });

    // Trend data: current period vs previous period
    const [ticketsCurrent, ticketsPrev, feedbacksCurrent, feedbacksPrev] = await Promise.all([
      prisma.ticket.count({ where: { ...scopeWhere, createdAt: { gte: periodStart } } }),
      prisma.ticket.count({ where: { ...scopeWhere, createdAt: { gte: prevPeriodStart, lt: periodStart } } }),
      prisma.feedback.count({ where: { ...scopeWhere, createdAt: { gte: periodStart } } }),
      prisma.feedback.count({ where: { ...scopeWhere, createdAt: { gte: prevPeriodStart, lt: periodStart } } }),
    ]);

    // Unassigned tickets count
    const unassignedCount = await prisma.ticket.count({
      where: { ...scopeWhere, assignedTo: null, status: { in: ["open", "in_progress"] } },
    });

    // SLA compliance (scoped)
    const [totalActive, slaMet] = await Promise.all([
      prisma.ticket.count({ where: { ...scopeWhere, status: { in: ["open", "in_progress"] }, slaDeadline: { not: null } } }),
      prisma.ticket.count({ where: { ...scopeWhere, status: { in: ["open", "in_progress"] }, slaDeadline: { gte: now } } }),
    ]);

    // Workload: tickets per admin (open/in_progress)
    const workloadRaw = await prisma.ticket.groupBy({
      by: ["assignedTo"],
      _count: true,
      where: { ...scopeWhere, status: { in: ["open", "in_progress"] }, assignedTo: { not: null } },
    });
    const adminIds = workloadRaw.map((w) => w.assignedTo!).filter(Boolean);
    const adminUsers = adminIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
      : [];
    const adminNameMap = Object.fromEntries(adminUsers.map((u) => [u.id, u.name]));
    const workload = workloadRaw.map((w) => ({
      adminId: w.assignedTo,
      name: adminNameMap[w.assignedTo!] || "Unknown",
      count: w._count,
    })).sort((a, b) => b.count - a.count);

    // Activity timeline: recent ticket history changes
    const activityWhere: any = {};
    if (assignedAppIds) {
      activityWhere.ticket = { appId: { in: assignedAppIds } };
    }
    const activity = await prisma.ticketHistory.findMany({
      where: activityWhere,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        ticket: { select: { id: true, title: true, app: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    return res.json({
      role,
      assignedAppIds,
      myTickets,
      myOpenCount,
      myTotalAssigned,
      myResolvedCount,
      mySlaBreached,
      trends: {
        ticketsCurrent,
        ticketsPrev,
        ticketsChange: ticketsPrev > 0 ? Math.round(((ticketsCurrent - ticketsPrev) / ticketsPrev) * 100) : ticketsCurrent > 0 ? 100 : 0,
        feedbacksCurrent,
        feedbacksPrev,
        feedbacksChange: feedbacksPrev > 0 ? Math.round(((feedbacksCurrent - feedbacksPrev) / feedbacksPrev) * 100) : feedbacksCurrent > 0 ? 100 : 0,
      },
      unassignedCount,
      slaCompliance: {
        total: totalActive,
        met: slaMet,
        breached: totalActive - slaMet,
        rate: totalActive > 0 ? Math.round((slaMet / totalActive) * 100) : 100,
      },
      workload,
      activity,
    });
  } catch (err) {
    console.error("My dashboard error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Analytics dashboard
router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const appId = req.query.appId as string | undefined;
    const appIdsParam = req.query.appIds as string | undefined;
    const appIds = appIdsParam ? appIdsParam.split(",") : undefined;
    const stats = await analyticsService.getDashboardStats(appId, appIds);
    return res.json(stats);
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List apps
router.get("/apps", async (_req: Request, res: Response) => {
  try {
    const apps = await prisma.app.findMany({
      include: {
        _count: { select: { tickets: true, feedbacks: true } },
        admins: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    const result = apps.map((a) => ({ ...a, admins: a.admins.map((aa) => aa.user) }));
    return res.json(result);
  } catch (err) {
    console.error("List apps error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get app detail
router.get("/apps/:id", async (req: Request, res: Response) => {
  try {
    const app = await prisma.app.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { tickets: true, feedbacks: true } },
        // AppDetail seeds its selectedAdminIds from this — without it the
        // Overview tab's admin chips always look empty after a refetch.
        admins: {
          select: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
        },
      },
    });
    if (!app) return res.status(404).json({ error: "App not found" });
    // Flatten to match the `admins` shape the client expects (App.admins in types.ts).
    const { admins, ...rest } = app as any;
    return res.json({ ...rest, admins: admins.map((a: any) => a.user) });
  } catch (err) {
    console.error("Get app error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Register new app
router.post("/apps", async (req: Request, res: Response) => {
  try {
    const { name, description, platform, bundleId, emailFrom, emailName, smtpHost, smtpPort, smtpUser, smtpPass, googleClientId, firebaseProjectId, firebaseClientEmail, firebasePrivateKey } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const app = await prisma.app.create({
      data: { name, description, platform, bundleId, emailFrom, emailName, smtpHost, smtpPort, smtpUser, smtpPass, googleClientId, firebaseProjectId, firebaseClientEmail, firebasePrivateKey, apiKey: `fb_${uuidv4().replace(/-/g, "")}` },
    });
    return res.status(201).json(app);
  } catch (err) {
    console.error("Create app error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update app
router.patch("/apps/:id", async (req: Request, res: Response) => {
  try {
    const { name, description, platform, bundleId, isActive, emailFrom, emailName, smtpHost, smtpPort, smtpUser, smtpPass, googleClientId, firebaseProjectId, firebaseClientEmail, firebasePrivateKey } = req.body;
    // Clear cached Firebase app if config changes
    if (firebaseProjectId !== undefined || firebaseClientEmail !== undefined || firebasePrivateKey !== undefined) {
      const { clearFirebaseApp } = await import("../services/fcm.service");
      clearFirebaseApp(req.params.id);
    }
    const app = await prisma.app.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(platform !== undefined && { platform }),
        ...(bundleId !== undefined && { bundleId }),
        ...(isActive !== undefined && { isActive }),
        ...(emailFrom !== undefined && { emailFrom }),
        ...(emailName !== undefined && { emailName }),
        ...(smtpHost !== undefined && { smtpHost }),
        ...(smtpPort !== undefined && { smtpPort }),
        ...(smtpUser !== undefined && { smtpUser }),
        ...(smtpPass !== undefined && { smtpPass }),
        ...(googleClientId !== undefined && { googleClientId }),
        ...(firebaseProjectId !== undefined && { firebaseProjectId }),
        ...(firebaseClientEmail !== undefined && { firebaseClientEmail }),
        ...(firebasePrivateKey !== undefined && { firebasePrivateKey }),
      },
      include: { _count: { select: { tickets: true, feedbacks: true } } },
    });
    return res.json(app);
  } catch (err) {
    console.error("Update app error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upload app icon
router.post("/apps/:id/icon", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const app = await prisma.app.update({
      where: { id: req.params.id },
      data: { iconUrl: `/uploads/${req.file.filename}` },
    });
    return res.json(app);
  } catch (err) {
    console.error("Upload app icon error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Regenerate API key
router.post("/apps/:id/regenerate-key", async (req: Request, res: Response) => {
  try {
    const app = await prisma.app.update({
      where: { id: req.params.id },
      data: { apiKey: `fb_${uuidv4().replace(/-/g, "")}` },
    });
    return res.json(app);
  } catch (err) {
    console.error("Regenerate key error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Validate Firebase credentials
router.post("/apps/validate-firebase", async (req: Request, res: Response) => {
  try {
    const { firebaseProjectId, firebaseClientEmail, firebasePrivateKey } = req.body;
    if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
      return res.status(400).json({ error: "All Firebase fields are required", valid: false });
    }
    // Validate format
    if (!firebaseClientEmail.includes("@") || !firebaseClientEmail.includes("iam.gserviceaccount.com")) {
      return res.status(400).json({ error: "Client email should be a service account email (ending in iam.gserviceaccount.com)", valid: false });
    }
    if (!firebasePrivateKey.includes("BEGIN PRIVATE KEY") || !firebasePrivateKey.includes("END PRIVATE KEY")) {
      return res.status(400).json({ error: "Private key must be in PEM format (BEGIN/END PRIVATE KEY)", valid: false });
    }
    return res.json({ valid: true, message: "Firebase credentials format looks valid" });
  } catch (err) {
    console.error("Validate Firebase error:", err);
    return res.status(500).json({ error: "Validation failed", valid: false });
  }
});

// Send a test FCM push to the calling admin's own device tokens for this app.
// Useful from the Apps page after configuring Firebase credentials — if it
// arrives, credentials work; if nothing arrives, either Firebase isn't set up
// for the app or the admin hasn't registered a device token against it yet.
router.post("/apps/:id/test-push", async (req: Request, res: Response) => {
  try {
    const appId = req.params.id;
    const adminId = req.user!.id;

    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { firebaseProjectId: true, firebaseClientEmail: true, firebasePrivateKey: true, name: true },
    });
    if (!app) return res.status(404).json({ error: "App not found" });
    if (!app.firebaseProjectId || !app.firebaseClientEmail || !app.firebasePrivateKey) {
      return res.status(400).json({ error: "Firebase not configured for this app", sent: 0 });
    }

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: adminId, appId },
      select: { token: true },
    });
    if (tokens.length === 0) {
      return res.status(400).json({
        error: "You have no device tokens registered for this app. Install the app with your admin account and trigger a token refresh first.",
        sent: 0,
      });
    }

    const { sendPushToUser } = await import("../services/fcm.service");
    await sendPushToUser(adminId, appId, {
      title: `${app.name} · test push`,
      body: "If you see this, FCM is wired up correctly.",
    }, { type: "test", appId });

    return res.json({ sent: tokens.length });
  } catch (err) {
    console.error("Test push error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete app
router.delete("/apps/:id", async (req: Request, res: Response) => {
  try {
    await prisma.app.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete app error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---- Announcements ----

router.post("/apps/:id/announcements", async (req: Request, res: Response) => {
  try {
    const { title, body, link } = req.body as { title?: string; body?: string; link?: string };
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "title and body are required" });
    }
    const a = await announcementService.createAnnouncement({
      appId: req.params.id,
      title: title.trim(),
      body: body.trim(),
      link: link?.trim() || null,
      createdBy: req.user!.id,
    });
    return res.status(201).json(a);
  } catch (err) {
    console.error("Create announcement error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/apps/:id/announcements", async (req: Request, res: Response) => {
  try {
    const items = await announcementService.listAnnouncements(req.params.id, 100);
    return res.json(items);
  } catch (err) {
    console.error("List announcements error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/announcements/:id", async (req: Request, res: Response) => {
  try {
    await announcementService.deleteAnnouncement(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete announcement error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Cross-app announcement feed. Non-super admins see only their assigned apps'
// announcements — matches the scope rules used elsewhere (e.g. /my-dashboard).
router.get("/announcements", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    let appIds: string[] | undefined;
    if (role !== "super_admin") {
      const assignments = await prisma.appAdmin.findMany({
        where: { userId },
        select: { appId: true },
      });
      appIds = assignments.map((a) => a.appId);
    }
    const items = await announcementService.listAllAnnouncements(appIds, 200);
    return res.json(items);
  } catch (err) {
    console.error("List all announcements error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get admins assigned to an app
router.get("/apps/:id/admins", async (req: Request, res: Response) => {
  try {
    const rows = await prisma.appAdmin.findMany({
      where: { appId: req.params.id },
      select: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
    });
    return res.json(rows.map((r) => r.user));
  } catch (err) {
    console.error("Get app admins error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Replace admins assigned to an app
router.put("/apps/:id/admins", async (req: Request, res: Response) => {
  try {
    const { adminIds } = req.body as { adminIds: string[] };
    if (!Array.isArray(adminIds)) return res.status(400).json({ error: "adminIds must be an array" });
    await prisma.$transaction([
      prisma.appAdmin.deleteMany({ where: { appId: req.params.id } }),
      ...(adminIds.length > 0 ? [prisma.appAdmin.createMany({
        data: adminIds.map((userId) => ({ appId: req.params.id, userId })),
      })] : []),
    ]);
    return res.json({ success: true });
  } catch (err) {
    console.error("Update app admins error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Manage categories
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.query.appId) where.appId = req.query.appId as string;
    const categories = await prisma.category.findMany({ where, orderBy: { name: "asc" } });
    return res.json(categories);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/categories", async (req: Request, res: Response) => {
  try {
    const { appId, name, description } = req.body;
    if (!appId || !name) return res.status(400).json({ error: "appId and name are required" });
    const category = await prisma.category.create({ data: { appId, name, description } });
    return res.status(201).json(category);
  } catch (err) {
    console.error("Create category error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/categories/:id", async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }) },
    });
    return res.json(category);
  } catch (err) {
    console.error("Update category error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/categories/:id", async (req: Request, res: Response) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete category error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== FEEDBACK ====================

// List all feedbacks with filters
router.get("/feedbacks", async (req: Request, res: Response) => {
  try {
    const appIdsParam = req.query.appIds as string | undefined;
    const unread = req.query.unread === "true";
    const result = await feedbackService.listAllFeedbacks({
      appId: req.query.appId as string | undefined,
      appIds: appIdsParam ? appIdsParam.split(",") : undefined,
      category: req.query.category as any,
      status: req.query.status as any,
      rating: req.query.rating ? parseInt(req.query.rating as string) : undefined,
      search: req.query.search as string | undefined,
      page: parseInt((req.query.page as string) || "1"),
      limit: parseInt((req.query.limit as string) || "20"),
    });
    const enriched = result.feedbacks.map((f: any) => ({
      ...f,
      isUnread: !f.adminLastViewedAt || f.adminLastViewedAt < f.updatedAt,
    }));
    const filtered = unread ? enriched.filter((f: any) => f.isUnread) : enriched;
    return res.json({ ...result, feedbacks: filtered });
  } catch (err) {
    console.error("Admin list feedbacks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Export feedbacks as CSV — mirrors the filters on the list endpoint.
router.get("/feedbacks/export.csv", async (req: Request, res: Response) => {
  try {
    const appIdsParam = req.query.appIds as string | undefined;
    const result = await feedbackService.listAllFeedbacks({
      appId: req.query.appId as string | undefined,
      appIds: appIdsParam ? appIdsParam.split(",") : undefined,
      category: req.query.category as any,
      status: req.query.status as any,
      rating: req.query.rating ? parseInt(req.query.rating as string) : undefined,
      search: req.query.search as string | undefined,
      page: 1,
      limit: 10000,
    });

    const headers = [
      "ID", "App", "Rating", "Category", "Status",
      "Comment", "User Name", "User Email", "Created",
    ];
    const rows = result.feedbacks.map((f: any) => [
      f.id,
      f.app?.name ?? "",
      f.rating,
      f.category,
      f.status,
      f.comment ?? "",
      f.user?.name ?? "",
      f.user?.email ?? "",
      new Date(f.createdAt).toISOString(),
    ]);

    const csv = toCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="feedbacks-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error("Admin export feedbacks CSV error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk update feedback status. Registered BEFORE the /:id variant.
router.patch("/feedbacks/bulk", async (req: Request, res: Response) => {
  try {
    const { ids, status } = req.body as { ids?: string[]; status?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    if (ids.length > 500) {
      return res.status(400).json({ error: "Cannot bulk update more than 500 feedbacks at once" });
    }
    if (!status || !["new", "acknowledged", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ error: "valid status is required" });
    }
    const result = await prisma.feedback.updateMany({
      where: { id: { in: ids } },
      data: { status: status as any },
    });
    return res.json({ updated: result.count });
  } catch (err) {
    console.error("Bulk update feedbacks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/feedbacks/bulk", async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    if (ids.length > 500) {
      return res.status(400).json({ error: "Cannot bulk delete more than 500 feedbacks at once" });
    }
    // Attachments cascade-delete via the Prisma relation, but the files on
    // disk need a manual sweep.
    const feedbacks = await prisma.feedback.findMany({
      where: { id: { in: ids } },
      include: { attachments: true },
    });
    for (const f of feedbacks) {
      for (const a of f.attachments) deleteUploadedFile(a.fileUrl);
    }
    const result = await prisma.feedback.deleteMany({ where: { id: { in: ids } } });
    return res.json({ deleted: result.count });
  } catch (err) {
    console.error("Bulk delete feedbacks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get feedback detail
router.get("/feedbacks/:id", async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.getFeedbackDetail(req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found" });
    prisma.feedback.update({
      where: { id: feedback.id },
      data: { adminLastViewedAt: new Date() },
    }).catch((err) => console.warn("markFeedbackAdminViewed failed:", err));
    return res.json(feedback);
  } catch (err) {
    console.error("Admin get feedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update feedback status
router.patch("/feedbacks/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ["new", "acknowledged", "in_progress", "resolved"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const feedback = await feedbackService.updateFeedbackStatus(req.params.id, status);
    return res.json(feedback);
  } catch (err) {
    console.error("Update feedback status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Reply to feedback
router.post("/feedbacks/:id/reply", async (req: Request, res: Response) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: "body is required" });
    const reply = await feedbackService.addReply({
      feedbackId: req.params.id,
      userId: req.user!.id,
      body,
    });
    return res.status(201).json(reply);
  } catch (err) {
    console.error("Admin reply feedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upload attachment to feedback
router.post("/feedbacks/:id/attachments", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const attachment = await feedbackService.addFeedbackAttachment({
      feedbackId: req.params.id,
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
    return res.status(201).json(attachment);
  } catch (err) {
    console.error("Admin upload feedback attachment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete feedback
router.delete("/feedbacks/:id", async (req: Request, res: Response) => {
  try {
    const attachments = await prisma.feedbackAttachment.findMany({
      where: { feedbackId: req.params.id },
      select: { fileUrl: true },
    });
    await prisma.feedback.delete({ where: { id: req.params.id } });
    attachments.forEach((a) => deleteUploadedFile(a.fileUrl));
    return res.json({ success: true });
  } catch (err) {
    console.error("Admin delete feedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete feedback reply
router.delete("/feedbacks/:id/replies/:replyId", async (req: Request, res: Response) => {
  try {
    await prisma.feedbackReply.delete({ where: { id: req.params.replyId } });
    return res.json({ success: true });
  } catch (err) {
    console.error("Admin delete feedback reply error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Feedback analytics
router.get("/feedback-stats", async (req: Request, res: Response) => {
  try {
    const appIdsParam = req.query.appIds as string | undefined;
    const stats = await feedbackService.getFeedbackStats(
      req.query.appId as string | undefined,
      appIdsParam ? appIdsParam.split(",") : undefined,
    );
    return res.json(stats);
  } catch (err) {
    console.error("Feedback stats error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== PROFILE ====================

// Update own profile
router.patch("/profile", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: name.trim() },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true },
    });
    return res.json(user);
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upload avatar
router.post("/profile/avatar", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true },
    });
    return res.json(user);
  } catch (err) {
    console.error("Upload avatar error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Send test email
router.post("/test-email", async (req: Request, res: Response) => {
  try {
    const { to, appId } = req.body;
    const recipient = to?.trim() || req.user!.email;

    let app: { name: string; emailFrom?: string | null; emailName?: string | null; smtpHost?: string | null; smtpPort?: number | null; smtpUser?: string | null; smtpPass?: string | null } | undefined;
    if (appId) {
      const found = await prisma.app.findUnique({
        where: { id: appId },
        select: { name: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true },
      });
      if (!found) return res.status(404).json({ error: "App not found" });
      app = found;
    }

    const appName = app?.name || "SupportDesk";
    const testHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 32px;text-align:center;">
<span style="color:#fff;font-size:20px;font-weight:700;">${appName}</span>
</td></tr>
<tr><td style="padding:32px;">
<div style="text-align:center;margin-bottom:24px;">
<div style="display:inline-block;width:56px;height:56px;background:#ecfdf5;border-radius:50%;line-height:56px;font-size:28px;">&#10003;</div>
</div>
<h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;text-align:center;">SMTP is Working!</h1>
<p style="margin:0 0 24px;font-size:15px;color:#6b7280;text-align:center;">Your email configuration has been verified successfully.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="padding:20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Source</td><td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">${app ? "Per-app SMTP" : "Global SMTP"}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Sent to</td><td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">${recipient}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Time</td><td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">${new Date().toLocaleString()}</td></tr>
</table>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 32px 28px;border-top:1px solid #e5e7eb;">
<p style="padding-top:20px;margin:0;font-size:12px;color:#9ca3af;text-align:center;">Sent by ${appName}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

    const smtpResult = await emailService.sendEmailWithResponse(
      recipient,
      `Test Email – ${appName}`,
      testHtml,
      app
    );
    return res.json({ success: true, to: recipient, source: app ? "app" : "global", smtp: smtpResult });
  } catch (err: any) {
    console.error("Test email error:", err);
    return res.status(500).json({ error: err.message || "Failed to send test email" });
  }
});

// ==================== USERS ====================

// User stats
router.get("/user-stats", async (_req: Request, res: Response) => {
  try {
    const stats = await userService.getUserStats();
    return res.json(stats);
  } catch (err) {
    console.error("User stats error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List users
router.get("/users", async (req: Request, res: Response) => {
  try {
    const result = await userService.listUsers({
      role: req.query.role as string | undefined,
      search: req.query.search as string | undefined,
      isBanned: req.query.isBanned !== undefined ? req.query.isBanned === "true" : undefined,
      appId: req.query.appId as string | undefined,
      page: parseInt((req.query.page as string) || "1"),
      limit: parseInt((req.query.limit as string) || "20"),
    });
    return res.json(result);
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get user detail
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserDetail(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("Get user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update user role
router.patch("/users/:id/role", async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!["user", "admin", "super_admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const user = await userService.updateUserRole(req.params.id, role);
    return res.json(user);
  } catch (err) {
    console.error("Update role error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Ban/unban user
router.patch("/users/:id/ban", async (req: Request, res: Response) => {
  try {
    const { isBanned } = req.body;
    const user = await userService.toggleBan(req.params.id, isBanned);
    return res.json(user);
  } catch (err) {
    console.error("Toggle ban error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }
    await userService.deleteUser(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== NOTIFICATION PREFERENCES ====================

router.get("/notification-preferences", async (req: Request, res: Response) => {
  try {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: req.user!.id },
    });
    // Return all types with defaults for missing ones
    const allTypes = ["new_ticket", "ticket_update", "new_feedback", "new_comment", "feedback_reply"];
    const result = allTypes.map((type) => {
      const existing = prefs.find((p) => p.type === type);
      return { type, inApp: existing ? existing.inApp : true, email: existing ? existing.email : true };
    });
    return res.json(result);
  } catch (err) {
    console.error("Get notification prefs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/notification-preferences", async (req: Request, res: Response) => {
  try {
    const { preferences } = req.body as { preferences: { type: string; inApp: boolean; email: boolean }[] };
    if (!Array.isArray(preferences)) return res.status(400).json({ error: "preferences must be an array" });
    const validTypes = ["new_ticket", "ticket_update", "new_feedback", "new_comment", "feedback_reply"];
    await Promise.all(
      preferences
        .filter((p) => validTypes.includes(p.type))
        .map((p) =>
          prisma.notificationPreference.upsert({
            where: { userId_type: { userId: req.user!.id, type: p.type as any } },
            create: { userId: req.user!.id, type: p.type as any, inApp: p.inApp, email: p.email },
            update: { inApp: p.inApp, email: p.email },
          })
        )
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("Update notification prefs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== SYSTEM INFO (super_admin only) ====================

router.get("/system-info", async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "super_admin") return res.status(403).json({ error: "Forbidden" });
    const [totalApps, totalAdmins, totalUsers, totalTickets, totalFeedbacks, totalCategories,
      appsWithSmtp, lastTicket, lastFeedback] = await Promise.all([
      prisma.app.count(),
      prisma.user.count({ where: { role: { in: ["admin", "super_admin"] } } }),
      prisma.user.count({ where: { role: "user" } }),
      prisma.ticket.count(),
      prisma.feedback.count(),
      prisma.category.count(),
      prisma.app.count({ where: { smtpHost: { not: null } } }),
      prisma.ticket.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.feedback.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    return res.json({
      counts: { totalApps, totalAdmins, totalUsers, totalTickets, totalFeedbacks, totalCategories },
      smtp: { appsWithSmtp, globalConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER) },
      lastActivity: { lastTicket: lastTicket?.createdAt, lastFeedback: lastFeedback?.createdAt },
      server: { nodeVersion: process.version, uptime: Math.floor(process.uptime()), platform: process.platform },
    });
  } catch (err) {
    console.error("System info error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== CANNED REPLIES ====================

// Returns the admin's own replies + every admin's shared replies, so the
// reply composer can show a merged list without a second request.
router.get("/canned-replies", async (req: Request, res: Response) => {
  try {
    const replies = await prisma.cannedReply.findMany({
      where: {
        OR: [
          { ownerId: req.user!.id },
          { shared: true },
        ],
      },
      orderBy: [{ shared: "desc" }, { title: "asc" }],
    });
    return res.json(replies);
  } catch (err) {
    console.error("List canned replies error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/canned-replies", async (req: Request, res: Response) => {
  try {
    const { title, body, shared, tag } = req.body;
    if (!title || !body) return res.status(400).json({ error: "title and body are required" });
    const reply = await prisma.cannedReply.create({
      data: {
        ownerId: req.user!.id,
        title,
        body,
        shared: !!shared,
        tag: tag || null,
      },
    });
    return res.status(201).json(reply);
  } catch (err) {
    console.error("Create canned reply error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/canned-replies/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.cannedReply.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    // Shared replies are editable by any admin; private ones only by their owner.
    if (!existing.shared && existing.ownerId !== req.user!.id) {
      return res.status(403).json({ error: "Not allowed" });
    }
    const { title, body, shared, tag } = req.body;
    const reply = await prisma.cannedReply.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        ...(shared !== undefined && { shared: !!shared }),
        ...(tag !== undefined && { tag: tag || null }),
      },
    });
    return res.json(reply);
  } catch (err) {
    console.error("Update canned reply error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/canned-replies/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.cannedReply.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!existing.shared && existing.ownerId !== req.user!.id) {
      return res.status(403).json({ error: "Not allowed" });
    }
    await prisma.cannedReply.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete canned reply error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
