import { PrismaClient, NotificationType } from "@prisma/client";
import { broadcastToUser } from "../websocket";

const prisma = new PrismaClient();

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
    },
  });

  // Push real-time via WebSocket
  broadcastToUser(data.userId, {
    type: "notification",
    data: notification,
  });

  return notification;
}

// Notify all admins
export async function notifyAdmins(data: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "super_admin"] } },
    select: { id: true },
  });

  const notifications = await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
      })
    )
  );

  return notifications;
}

export async function getNotifications(userId: string, page = 1, limit = 20) {
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, unreadCount, page, totalPages: Math.ceil(total / limit) };
}

export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
