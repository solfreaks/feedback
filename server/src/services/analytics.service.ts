import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getDashboardStats(appId?: string, appIds?: string[], days: number = 30) {
  const where: any = appId ? { appId } : appIds ? { appId: { in: appIds } } : {};

  // Signups window — midnight on the earliest day so daily buckets line up
  // cleanly (otherwise the oldest bucket is partial and looks tiny).
  const daysClamped = Math.max(1, Math.min(365, Math.floor(days)));
  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - (daysClamped - 1));

  // User scope: when the caller has a narrowed app list (non-super_admin),
  // only count users who have touched those apps. Otherwise global.
  const scopedAppIds = appId ? [appId] : appIds && appIds.length > 0 ? appIds : null;
  const userWhere: any = { createdAt: { gte: windowStart } };
  if (scopedAppIds) {
    userWhere.OR = [
      { tickets: { some: { appId: { in: scopedAppIds } } } },
      { feedbacks: { some: { appId: { in: scopedAppIds } } } },
    ];
  }

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
    rawSignups,
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
    // Raw per-user signup dates; we bucket by day in JS because Prisma's
    // groupBy on a date column requires raw SQL for the DATE() cast and
    // the N is tiny (<= 365 per admin per page load).
    prisma.user.findMany({
      where: userWhere,
      select: { createdAt: true },
    }),
  ]);

  // Build a dense [day, count] list with zeros filled so the chart x-axis
  // doesn't skip empty days.
  const byDay = new Map<string, number>();
  for (let i = 0; i < daysClamped; i++) {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const u of rawSignups) {
    const key = new Date(u.createdAt).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const newUsersByDay = Array.from(byDay.entries()).map(([date, count]) => ({ date, count }));
  const newUsersTotal = rawSignups.length;

  // Resolve app names for byApp
  const byAppIds = byApp.map((a) => a.appId);
  const apps = await prisma.app.findMany({ where: { id: { in: byAppIds } }, select: { id: true, name: true } });
  const appMap = Object.fromEntries(apps.map((a) => [a.id, a.name]));

  return {
    overview: { totalTickets, openTickets, inProgressTickets, resolvedTickets, closedTickets, criticalOpen, slaBreached, newUsersTotal },
    byApp: byApp.map((a) => ({ appId: a.appId, appName: appMap[a.appId] || "Unknown", count: a._count })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
    newUsersByDay,
    recentTickets,
  };
}
