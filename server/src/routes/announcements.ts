import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { validateAppKey } from "../middleware/appKey";
import * as announcementService from "../services/announcement.service";

const router = Router();

// Every endpoint is user-authenticated + app-key-scoped so callers can only
// see announcements for the app tied to their API key.
router.use(authenticate, validateAppKey);

router.get("/", async (req: Request, res: Response) => {
  try {
    const items = await announcementService.listAnnouncements(req.appId!, 100);
    return res.json({ announcements: items });
  } catch (err) {
    console.error("List announcements error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
