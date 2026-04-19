import { PrismaClient, FeedbackCategory, FeedbackStatus } from "@prisma/client";
import { notifyAdmins } from "./notification.service";
import { notifyAdminNewFeedback } from "./email.service";
import { sendPushToUser } from "./fcm.service";
import { config } from "../config";

const prisma = new PrismaClient();

const feedbackInclude = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  app: { select: { id: true, name: true, iconUrl: true, emailFrom: true, emailName: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } },
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

  // Email all app admins about the new feedback
  const appAdmins = await prisma.appAdmin.findMany({
    where: { appId: data.appId },
    include: { user: { select: { email: true } } },
  });
  for (const aa of appAdmins) {
    notifyAdminNewFeedback(aa.user.email!, {
      userName: feedback.user.name,
      userEmail: feedback.user.email,
      rating: data.rating,
      category: data.category || "general",
      comment: data.comment || null,
    }, feedback.app as any);
  }

  // Notify admins in real-time
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

export async function updateFeedbackStatus(feedbackId: string, status: FeedbackStatus) {
  return prisma.feedback.update({
    where: { id: feedbackId },
    data: { status },
    include: feedbackInclude,
  });
}

/**
 * User-facing content edit. Only accepts the fields a submitter should control;
 * status / admin notes are explicitly excluded. The route layer enforces the
 * 24h edit window and ownership check.
 */
export async function updateFeedbackContent(
  feedbackId: string,
  data: { rating?: number; category?: FeedbackCategory; comment?: string | null }
) {
  const patch: any = {};
  if (data.rating !== undefined) patch.rating = data.rating;
  if (data.category !== undefined) patch.category = data.category;
  if (data.comment !== undefined) patch.comment = data.comment;
  return prisma.feedback.update({
    where: { id: feedbackId },
    data: patch,
    include: feedbackInclude,
  });
}

export async function deleteFeedback(feedbackId: string) {
  // Replies cascade-delete. Attachments also cascade on the row level, but
  // their files on disk don't — we sweep them ourselves to avoid a leak.
  const existing = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: { attachments: true },
  });
  if (existing) {
    for (const a of existing.attachments) {
      try {
        const fs = require("fs");
        const path = require("path");
        const filename = path.basename(a.fileUrl);
        const filepath = path.join(config.uploadDir, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch { /* best effort */ }
    }
  }
  return prisma.feedback.delete({ where: { id: feedbackId } });
}

export async function addReply(data: {
  feedbackId: string;
  userId: string;
  body: string;
  // Files are saved to disk upstream; caller passes metadata only. Kept
  // optional so existing admin-path callers (which don't attach files) stay
  // unchanged.
  attachments?: Array<{ fileUrl: string; fileName: string; fileSize: number }>;
}) {
  const reply = await prisma.feedbackReply.create({
    data: {
      feedbackId: data.feedbackId,
      userId: data.userId,
      body: data.body,
      // Nested create: each attachment row gets feedbackId + feedbackReplyId
      // wired up in one transaction so partial writes aren't possible.
      ...(data.attachments && data.attachments.length > 0
        ? {
            attachments: {
              create: data.attachments.map((a) => ({
                feedbackId: data.feedbackId,
                fileUrl: a.fileUrl,
                fileName: a.fileName,
                fileSize: a.fileSize,
              })),
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      attachments: true,
    },
  });

  // Bump the parent feedback's updatedAt so clients can detect "new reply since
  // last viewed". Combined with auto-acknowledge on first reply (below) when
  // applicable. We issue the update unconditionally because @updatedAt only
  // fires on row updates to the feedback itself, not on child inserts.
  const feedback = await prisma.feedback.findUnique({
    where: { id: data.feedbackId },
    select: { userId: true, appId: true, rating: true, status: true },
  });
  await prisma.feedback.update({
    where: { id: data.feedbackId },
    data: feedback && feedback.status === "new"
      ? { status: "acknowledged" }
      : { updatedAt: new Date() },
  });

  // FCM push to feedback creator
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
  appIds?: string[];
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  rating?: number;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { appId, appIds, category, status, rating, search, page = 1, limit = 20 } = filters;
  const where: any = {};
  if (appId) where.appId = appId;
  else if (appIds) where.appId = { in: appIds };
  if (category) where.category = category;
  if (status) where.status = status;
  if (rating) where.rating = rating;
  if (search) {
    where.OR = [
      { comment: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
    ];
  }

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

export async function getFeedbackStats(appId?: string, appIds?: string[]) {
  const where: any = appId ? { appId } : appIds ? { appId: { in: appIds } } : {};

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

  const byAppIds = byApp.map((a) => a.appId);
  const apps = await prisma.app.findMany({ where: { id: { in: byAppIds } }, select: { id: true, name: true } });
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
