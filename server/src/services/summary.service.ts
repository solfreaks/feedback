import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Per-user activity summary used by the "My support" screen in the SDK.
 *
 * Aggregates counts directly in the DB — all groupBy queries return in a
 * single round-trip. We filter by appId so each app only sees its own data
 * (enforced at the route layer via validateAppKey).
 */
export async function getUserSummary(userId: string, appId: string) {
  // Run every aggregate in parallel to keep latency low.
  const [
    ticketStatusGroups,
    feedbackStatusGroups,
    feedbackRatingAgg,
    feedbackTotal,
    ticketTotal,
  ] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["status"],
      where: { userId, appId },
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ["status"],
      where: { userId, appId },
      _count: { _all: true },
    }),
    prisma.feedback.aggregate({
      where: { userId, appId },
      _avg: { rating: true },
    }),
    prisma.feedback.count({ where: { userId, appId } }),
    prisma.ticket.count({ where: { userId, appId } }),
  ]);

  const ticketByStatus: Record<string, number> = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  };
  for (const group of ticketStatusGroups) {
    ticketByStatus[group.status] = group._count._all;
  }

  const feedbackByStatus: Record<string, number> = {
    new: 0,
    acknowledged: 0,
    in_progress: 0,
    resolved: 0,
  };
  for (const group of feedbackStatusGroups) {
    feedbackByStatus[group.status] = group._count._all;
  }

  return {
    tickets: {
      total: ticketTotal,
      byStatus: ticketByStatus,
    },
    feedback: {
      total: feedbackTotal,
      averageRating: feedbackRatingAgg._avg.rating ?? 0,
      byStatus: feedbackByStatus,
    },
  };
}
