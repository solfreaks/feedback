import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { config } from "./config";
import { setupWebSocket } from "./websocket";
import authRoutes from "./routes/auth";
import ticketRoutes from "./routes/tickets";
import feedbackRoutes from "./routes/feedback";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notifications";
import deviceTokenRoutes from "./routes/device-tokens";

const app = express();
const server = createServer(app);

// Setup WebSocket
setupWebSocket(server);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(config.uploadDir)));

// Routes
app.use("/auth", authRoutes);
app.use("/tickets", ticketRoutes);
app.use("/feedbacks", feedbackRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", notificationRoutes);
app.use("/device-tokens", deviceTokenRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

server.listen(config.port, () => {
  console.log(`Feedback server running on port ${config.port}`);
});

export default app;
