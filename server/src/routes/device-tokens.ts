import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { validateAppKey } from "../middleware/appKey";
import * as fcmService from "../services/fcm.service";

const router = Router();

router.use(authenticate, validateAppKey);

// Register device token
router.post("/", async (req: Request, res: Response) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });
    const deviceToken = await fcmService.registerDeviceToken(req.user!.id, req.appId!, token, platform);
    return res.status(201).json(deviceToken);
  } catch (err) {
    console.error("Register device token error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Remove device token (on logout)
router.delete("/", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token is required" });
    await fcmService.removeDeviceToken(req.user!.id, token);
    return res.json({ success: true });
  } catch (err) {
    console.error("Remove device token error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
