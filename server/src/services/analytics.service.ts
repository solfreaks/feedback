import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getDashboardStats(appId?: string) {
  const where: any = appId ? { appId } : {};

  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    criticalOpen,
    slaBreached,
    byApp,
    byPriority,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: "open" } }),
    prisma.ticket.count({ where: { ...where, status: "in_progress" } }),
    prisma.ticket.count({ where: { ...where, status: "resolved" } }),
    prisma.ticket.count({ where: { ...where, status: "closed" } }),
    prisma.ticket.count({ where: { ...where, status: { in: ["open", "in_progress"] }, priority: "critical" } }),
    prisma.ticket.count({
      where: { ...where, status: { in: ["open", "in_progress"] }, slaDeadline: { lt: new Date() } },
    }),
    prisma.ticket.groupBy({
      by: ["appId"],
      _count: true,
      where,
    }),
    prisma.ticket.groupBy({
      by: ["priority"],
      _count: true,
      where,
    }),
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
        app: { select: { name: true } },
      },
    }),
  ]);

  // Resolve app names for byApp
  const appIds = byApp.map((a) => a.appId);
  const apps = await prisma.app.findMany({ where: { id: { in: appIds } }, select: { id: true, name: true } });
  const appMap = Object.fromEntries(apps.map((a) => [a.id, a.name]));

  return {
    overview: { totalTickets, openTickets, inProgressTickets, resolvedTickets, closedTickets, criticalOpen, slaBreached },
    byApp: byApp.map((a) => ({ appId: a.appId, appName: appMap[a.appId] || "Unknown", count: a._count })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
    recentTickets,
  };
}
