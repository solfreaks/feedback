import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../middleware/auth";
import { validateAppKey } from "../middleware/appKey";
import * as feedbackService from "../services/feedback.service";
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
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate, validateAppKey);

// Submit feedback
router.post("/", async (req: Request, res: Response) => {
  try {
    const { rating, category, comment, deviceType, osVersion, appVersion } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating (1-5) is required" });
    }
    const feedback = await feedbackService.createFeedback({
      appId: req.appId!,
      userId: req.user!.id,
      rating,
      category,
      comment,
      deviceType,
      osVersion,
      appVersion,
    });
    return res.status(201).json(feedback);
  } catch (err) {
    console.error("Create feedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// List my feedbacks
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const result = await feedbackService.listUserFeedbacks(req.user!.id, req.appId!, page, limit);
    return res.json(result);
  } catch (err) {
    console.error("List feedbacks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get feedback detail. Accepts either a UUID or a legacy int ID — the old
// PHP proxy passes whichever the mobile client has cached. Numeric ids are
// resolved via the legacyId column populated by the import backfill.
router.get("/:id", async (req: Request, res: Response) => {
  try {
    let feedback = await feedbackService.getFeedbackDetailByIdOrLegacy(req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found" });
    return res.json(feedback);
  } catch (err) {
    console.error("Get feedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// User edits their own feedback (24h window). Only the rating, category, and
// comment are editable — status is server-managed. After 24h we reject to
// keep the audit trail meaningful for admins.
const FEEDBACK_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { rating, category, comment } = req.body as {
      rating?: number;
      category?: string;
      comment?: string | null;
    };
    const existing = await feedbackService.getFeedbackDetail(req.params.id);
    if (!existing) return res.status(404).json({ error: "Feedback not found" });
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ error: "You can only edit your own feedback" });
    }
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age > FEEDBACK_EDIT_WINDOW_MS) {
      return res.status(403).json({ error: "Edit window has expired" });
    }
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "Rating must be 1-5" });
    }
    const updated = await feedbackService.updateFeedbackContent(req.params.id, {
      rating,
      category: category as any,
      comment,
    });
    return res.json(updated);
  } catch (err) {
    console.error("Edit feedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await feedbackService.getFeedbackDetail(req.params.id);
    if (!existing) return res.status(404).json({ error: "Feedback not found" });
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ error: "You can only delete your own feedback" });
    }
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age > FEEDBACK_EDIT_WINDOW_MS) {
      return res.status(403).json({ error: "Delete window has expired" });
    }
    await feedbackService.deleteFeedback(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete feedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Mobile users adding a reply on their own feedback. Legacy PHP proxy relies
// on this — old installs POSTed to /api/feedback/:id/replies with optional
// multipart attachments under the `attachments` field. We accept both JSON
// (body only) and multipart (body + up to 10 files) so the proxy can stream
// files through without pre-uploading them.
router.post("/:id/replies", upload.array("attachments", 10), async (req: Request, res: Response) => {
  try {
    const { body, message } = req.body as { body?: string; message?: string };
    const text = (body ?? message ?? "").toString().trim();
    if (!text) return res.status(400).json({ error: "body is required" });
    const existing = await feedbackService.getFeedbackDetail(req.params.id);
    if (!existing) return res.status(404).json({ error: "Feedback not found" });
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ error: "You can only reply on your own feedback" });
    }
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const reply = await feedbackService.addReply({
      feedbackId: req.params.id,
      userId: req.user!.id,
      body: text,
      attachments: files.map((f) => ({
        fileUrl: `/uploads/${f.filename}`,
        fileName: f.originalname,
        fileSize: f.size,
      })),
    });
    return res.status(201).json(reply);
  } catch (err) {
    console.error("Add feedback reply error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upload attachment to feedback
router.post("/:id/attachments", upload.single("file"), async (req: Request, res: Response) => {
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
    console.error("Upload feedback attachment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
