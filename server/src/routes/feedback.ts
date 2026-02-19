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
    const { rating, category, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating (1-5) is required" });
    }
    const feedback = await feedbackService.createFeedback({
      appId: req.appId!,
      userId: req.user!.id,
      rating,
      category,
      comment,
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

// Get feedback detail
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.getFeedbackDetail(req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found" });
    return res.json(feedback);
  } catch (err) {
    console.error("Get feedback error:", err);
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
