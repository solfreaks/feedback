import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";

const prisma = new PrismaClient();

// Cache OAuth2Client instances per clientId
const googleClients = new Map<string, OAuth2Client>();
function getGoogleClient(clientId: string): OAuth2Client {
  if (!googleClients.has(clientId)) {
    googleClients.set(clientId, new OAuth2Client(clientId));
  }
  return googleClients.get(clientId)!;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      appId?: string;
    }
  }
}

function signToken(user: { id: string; email: string; name: string; role: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: "7d" as any }
  );
}

// Google auth — used by mobile/Flutter apps
export async function googleAuth(req: Request, res: Response) {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: "idToken is required" });
  }

  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) {
    return res.status(400).json({ error: "x-api-key header is required" });
  }

  try {
    // Look up app to get per-app Google Client ID
    const app = await prisma.app.findUnique({ where: { apiKey } });
    if (!app) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const clientId = app.googleClientId || config.googleClientId;
    if (!clientId) {
      return res.status(500).json({ error: "Google Client ID not configured" });
    }

    const client = getGoogleClient(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        name: payload.name || payload.email,
        avatarUrl: payload.picture || null,
      },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        avatarUrl: payload.picture || null,
      },
    });

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl } });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(401).json({ error: "Invalid Google token" });
  }
}

// Email + password login — used by admin panel
export async function adminLogin(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl } });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Create admin account (super_admin only)
export async function createAdmin(req: Request, res: Response) {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role: "admin" },
    });

    return res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    console.error("Create admin error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Change password (authenticated admin)
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.password) {
      return res.status(400).json({ error: "Password login not configured for this account" });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

    return res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  try {
    const decoded = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = decoded;

    // Update lastActiveAt and check ban (non-blocking)
    prisma.user.findUnique({ where: { id: decoded.id }, select: { isBanned: true } }).then((user) => {
      if (user?.isBanned) return; // Will be caught on next request
      prisma.user.update({ where: { id: decoded.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
    });

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
