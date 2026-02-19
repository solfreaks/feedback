import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { config } from "./config";
import type { AuthUser } from "./middleware/auth";

const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    // Authenticate via query param token
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    try {
      const user = jwt.verify(token, config.jwtSecret) as AuthUser;
      const userId = user.id;

      // Register client
      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId)!.add(ws);

      // Send confirmation
      ws.send(JSON.stringify({ type: "connected", userId }));

      ws.on("close", () => {
        const userClients = clients.get(userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) clients.delete(userId);
        }
      });

      ws.on("error", () => {
        const userClients = clients.get(userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) clients.delete(userId);
        }
      });
    } catch {
      ws.close(4002, "Invalid token");
    }
  });

  return wss;
}

export function broadcastToUser(userId: string, message: object) {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const data = JSON.stringify(message);
  for (const ws of userClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function broadcastToAll(message: object) {
  const data = JSON.stringify(message);
  for (const [, userClients] of clients) {
    for (const ws of userClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}
