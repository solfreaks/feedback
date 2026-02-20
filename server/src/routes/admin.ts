import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import { authenticate } from "../middleware/auth";
import { adminGuard } from "../middleware/adminGuard";
import * as ticketService from "../services/ticket.service";
import * as analyticsService from "../services/analytics.service";
import * as feedbackService from "../services/feedback.service";
import * as userService from "../services/user.service";
import * as emailService from "../services/email.service";
import { config } from "../config";

const router = Router();
const prisma = new PrismaClient();

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
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");

    const where: any = {};
    if (appId) where.appId = appId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true } },
          app: { select: { id: true, name: true } },
          _count: { select: { comments: true, attachments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return res.json({ tickets, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin list tickets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update ticket (status, priority, assignment, SLA)
router.patch("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const { status, priority, assignedTo } = req.body;
    const ticket = await ticketService.updateTicket(req.params.id, req.user!.id, {
      status,
      priority,
      assignedTo,
    });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
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
    await prisma.ticket.delete({ where: { id: req.params.id } });
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
    const comment = await ticketService.addComment({
      ticketId: req.params.id,
      userId: req.user!.id,
      body,
      isInternalNote: isInternalNote !== false, // default true for backwards compat
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

// Analytics dashboard
router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const stats = await analyticsService.getDashboardStats(req.query.appId as string | undefined);
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
      include: { _count: { select: { tickets: true, feedbacks: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json(apps);
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
      include: { _count: { select: { tickets: true, feedbacks: true } } },
    });
    if (!app) return res.status(404).json({ error: "App not found" });
    return res.json(app);
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

// ==================== FEEDBACK ====================

// List all feedbacks with filters
router.get("/feedbacks", async (req: Request, res: Response) => {
  try {
    const result = await feedbackService.listAllFeedbacks({
      appId: req.query.appId as string | undefined,
      category: req.query.category as any,
      rating: req.query.rating ? parseInt(req.query.rating as string) : undefined,
      page: parseInt((req.query.page as string) || "1"),
      limit: parseInt((req.query.limit as string) || "20"),
    });
    return res.json(result);
  } catch (err) {
    console.error("Admin list feedbacks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get feedback detail
router.get("/feedbacks/:id", async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.getFeedbackDetail(req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found" });
    return res.json(feedback);
  } catch (err) {
    console.error("Admin get feedback error:", err);
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
    await prisma.feedback.delete({ where: { id: req.params.id } });
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
    const stats = await feedbackService.getFeedbackStats(req.query.appId as string | undefined);
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

// Send test email
router.post("/test-email", async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    const recipient = to?.trim() || req.user!.email;
    await emailService.sendEmail(
      recipient,
      "Test Email – Feedback Hub",
      `<h2>Test Email</h2>
       <p>This is a test email sent from Feedback Hub to verify your SMTP configuration is working correctly.</p>
       <p>If you received this, your email setup is working!</p>
       <p style="color:#888;font-size:12px">Sent at ${new Date().toLocaleString()}</p>`
    );
    return res.json({ success: true, to: recipient });
  } catch (err: any) {
    console.error("Test email error:", err);
    return res.status(500).json({ error: err.message || "Failed to send test email" });
  }
});

// ==================== USERS ====================

// List users
router.get("/users", async (req: Request, res: Response) => {
  try {
    const result = await userService.listUsers({
      role: req.query.role as string | undefined,
      search: req.query.search as string | undefined,
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

export default router;
