import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { validateAppKey } from "../middleware/appKey";
import * as summaryService from "../services/summary.service";

const router = Router();

router.use(authenticate, validateAppKey);

// GET /summary — per-user activity snapshot for the SDK's support landing UI.
router.get("/", async (req: Request, res: Response) => {
  try {
    const summary = await summaryService.getUserSummary(req.user!.id, req.appId!);
    return res.json(summary);
  } catch (err) {
    console.error("Get summary error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
