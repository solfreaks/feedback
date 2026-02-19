import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function validateAppKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) {
    return res.status(400).json({ error: "x-api-key header is required" });
  }

  try {
    const app = await prisma.app.findUnique({ where: { apiKey } });
    if (!app) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    req.appId = app.id;
    next();
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}
