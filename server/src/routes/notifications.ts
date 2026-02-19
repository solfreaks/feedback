import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { adminGuard } from "../middleware/adminGuard";
import * as notificationService from "../services/notification.service";

const router = Router();

router.use(authenticate, adminGuard);

// List notifications
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const result = await notificationService.getNotifications(req.user!.id, page, limit);
    return res.json(result);
  } catch (err) {
    console.error("List notifications error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Unread count
router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Mark one as read
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user!.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Mark all as read
router.patch("/read-all", async (req: Request, res: Response) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
