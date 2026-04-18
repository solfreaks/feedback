import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../middleware/auth";
import { validateAppKey } from "../middleware/appKey";
import * as ticketService from "../services/ticket.service";
import { config } from "../config";

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// All ticket routes require auth + app key
router.use(authenticate, validateAppKey);

// Create ticket
router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, description, category, priority } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "title and description are required" });
    }
    const ticket = await ticketService.createTicket({
      appId: req.appId!,
      userId: req.user!.id,
      title,
      description,
      category,
      priority,
    });
    return res.status(201).json(ticket);
  } catch (err) {
    console.error("Create ticket error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List user's tickets
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const result = await ticketService.listUserTickets(req.user!.id, req.appId!, page, limit);
    return res.json(result);
  } catch (err) {
    console.error("List tickets error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get ticket detail
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const ticket = await ticketService.getTicketDetail(req.params.id, req.user!.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (ticket.userId !== req.user!.id) return res.status(403).json({ error: "Access denied" });
    return res.json(ticket);
  } catch (err) {
    console.error("Get ticket error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Add comment
router.post("/:id/comments", async (req: Request, res: Response) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: "body is required" });
    const comment = await ticketService.addComment({
      ticketId: req.params.id,
      userId: req.user!.id,
      body,
    });
    return res.status(201).json(comment);
  } catch (err) {
    console.error("Add comment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Typing indicator: fans out "user is typing on ticket X" to the ticket's
// creator and assignee. No persistence — purely ephemeral WS broadcast.
// Debounced on the client to avoid spam.
router.post("/:id/typing", async (req: Request, res: Response) => {
  try {
    // Dynamic require to avoid a circular import; this route is hot enough
    // that the import cost is immaterial.
    const { broadcastToUser } = require("../websocket");
    const ticket = await (await import("../services/ticket.service")).getTicketDetail(req.params.id, req.user!.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const payload = { type: "ticket_typing", ticketId: req.params.id, userId: req.user!.id };
    if (ticket.userId !== req.user!.id) broadcastToUser(ticket.userId, payload);
    if (ticket.assignedTo && ticket.assignedTo !== req.user!.id) {
      broadcastToUser(ticket.assignedTo, payload);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("Typing indicator error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// User edits their own comment (10-min window). Only the body is editable.
// Server enforces ownership and the edit window — the SDK mirrors the window
// locally just to hide the option cleanly.
const COMMENT_EDIT_WINDOW_MS = 10 * 60 * 1000;

router.patch("/:id/comments/:commentId", async (req: Request, res: Response) => {
  try {
    const { body } = req.body as { body?: string };
    if (!body || !body.trim()) return res.status(400).json({ error: "body is required" });

    const existing = await ticketService.getComment(req.params.commentId);
    if (!existing || existing.ticketId !== req.params.id) {
      return res.status(404).json({ error: "Comment not found" });
    }
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ error: "You can only edit your own comment" });
    }
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age > COMMENT_EDIT_WINDOW_MS) {
      return res.status(403).json({ error: "Edit window has expired" });
    }
    const updated = await ticketService.updateCommentBody(req.params.commentId, body.trim());
    return res.json(updated);
  } catch (err) {
    console.error("Edit comment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id/comments/:commentId", async (req: Request, res: Response) => {
  try {
    const existing = await ticketService.getComment(req.params.commentId);
    if (!existing || existing.ticketId !== req.params.id) {
      return res.status(404).json({ error: "Comment not found" });
    }
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ error: "You can only delete your own comment" });
    }
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age > COMMENT_EDIT_WINDOW_MS) {
      return res.status(403).json({ error: "Delete window has expired" });
    }
    await ticketService.deleteComment(req.params.commentId);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete comment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upload attachment
router.post("/:id/attachments", upload.single("file"), async (req: Request, res: Response) => {
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
    console.error("Upload attachment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
