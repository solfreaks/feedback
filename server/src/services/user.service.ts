import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listUsers(opts: {
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = opts.page || 1;
  const limit = opts.limit || 20;
  const where: any = {};

  if (opts.role) where.role = opts.role;
  if (opts.search) {
    where.OR = [
      { name: { contains: opts.search } },
      { email: { contains: opts.search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, avatarUrl: true, role: true,
        isBanned: true, lastActiveAt: true, createdAt: true,
        _count: { select: { tickets: true, feedbacks: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, avatarUrl: true, role: true,
      googleId: true, isBanned: true, lastActiveAt: true, createdAt: true,
      _count: { select: { tickets: true, feedbacks: true, comments: true } },
    },
  });
  if (!user) return null;

  const [recentTickets, recentFeedbacks] = await Promise.all([
    prisma.ticket.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, priority: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.feedback.findMany({
      where: { userId },
      select: { id: true, rating: true, category: true, comment: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return { ...user, recentTickets, recentFeedbacks };
}

export async function updateUserRole(userId: string, role: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { role: role as any },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function toggleBan(userId: string, isBanned: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { isBanned },
    select: { id: true, email: true, name: true, isBanned: true },
  });
}
