import { PrismaClient, FeedbackCategory } from "@prisma/client";
import { notifyAdmins } from "./notification.service";
import { sendPushToUser } from "./fcm.service";

const prisma = new PrismaClient();

const feedbackInclude = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  app: { select: { id: true, name: true } },
  _count: { select: { replies: true } },
};

export async function createFeedback(data: {
  appId: string;
  userId: string;
  rating: number;
  category?: FeedbackCategory;
  comment?: string;
}) {
  if (data.rating < 1 || data.rating > 5) throw new Error("Rating must be 1-5");

  const feedback = await prisma.feedback.create({
    data: {
      appId: data.appId,
      userId: data.userId,
      rating: data.rating,
      category: data.category || "general",
      comment: data.comment,
    },
    include: feedbackInclude,
  });

  // Notify admins
  notifyAdmins({
    type: "new_feedback",
    title: "New Feedback",
    message: `${feedback.user.name} left ${data.rating}★ feedback`,
    link: `/feedbacks/${feedback.id}`,
  });

  return feedback;
}

export async function listUserFeedbacks(userId: string, appId?: string, page = 1, limit = 20) {
  const where: any = { userId };
  if (appId) where.appId = appId;

  const [feedbacks, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: feedbackInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.feedback.count({ where }),
  ]);

  return { feedbacks, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getFeedbackDetail(feedbackId: string) {
  return prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: {
      ...feedbackInclude,
      replies: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: true,
    },
  });
}

export async function addReply(data: { feedbackId: string; userId: string; body: string }) {
  const reply = await prisma.feedbackReply.create({
    data,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // FCM push to feedback creator
  const feedback = await prisma.feedback.findUnique({
    where: { id: data.feedbackId },
    select: { userId: true, appId: true, rating: true },
  });
  if (feedback && feedback.userId !== data.userId) {
    sendPushToUser(feedback.userId, feedback.appId, {
      title: "Feedback Reply",
      body: `${reply.user.name} replied to your ${feedback.rating}★ feedback`,
    }, { type: "feedback_reply", feedbackId: data.feedbackId });
  }

  return reply;
}

export async function addFeedbackAttachment(data: {
  feedbackId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}) {
  return prisma.feedbackAttachment.create({ data });
}

export async function listAllFeedbacks(filters: {
  appId?: string;
  category?: FeedbackCategory;
  rating?: number;
  page?: number;
  limit?: number;
}) {
  const { appId, category, rating, page = 1, limit = 20 } = filters;
  const where: any = {};
  if (appId) where.appId = appId;
  if (category) where.category = category;
  if (rating) where.rating = rating;

  const [feedbacks, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: feedbackInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.feedback.count({ where }),
  ]);

  return { feedbacks, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getFeedbackStats(appId?: string) {
  const where: any = appId ? { appId } : {};

  const [totalFeedbacks, avgRating, byCategory, byRating, byApp] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.aggregate({ where, _avg: { rating: true } }),
    prisma.feedback.groupBy({ by: ["category"], _count: true, _avg: { rating: true }, where }),
    prisma.feedback.groupBy({ by: ["rating"], _count: true, where }),
    prisma.feedback.groupBy({
      by: ["appId"],
      _count: true,
      _avg: { rating: true },
      where,
    }),
  ]);

  const appIds = byApp.map((a) => a.appId);
  const apps = await prisma.app.findMany({ where: { id: { in: appIds } }, select: { id: true, name: true } });
  const appMap = Object.fromEntries(apps.map((a) => [a.id, a.name]));

  return {
    totalFeedbacks,
    averageRating: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : 0,
    byCategory: byCategory.map((c) => ({
      category: c.category,
      count: c._count,
      avgRating: c._avg.rating ? Math.round(c._avg.rating * 10) / 10 : 0,
    })),
    byRating: byRating.map((r) => ({ rating: r.rating, count: r._count })),
    byApp: byApp.map((a) => ({
      appId: a.appId,
      appName: appMap[a.appId] || "Unknown",
      count: a._count,
      avgRating: a._avg.rating ? Math.round(a._avg.rating * 10) / 10 : 0,
    })),
  };
}
