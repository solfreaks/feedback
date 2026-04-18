import { PrismaClient } from "@prisma/client";
import { sendPushToTopic } from "./fcm.service";

const prisma = new PrismaClient();

/**
 * Create an announcement row and (best effort) fire an FCM topic push to every
 * device subscribed to `app_<appId>`. The row is the source of truth for the
 * in-app feed; the push is for users with the app closed.
 */
export async function createAnnouncement(data: {
  appId: string;
  title: string;
  body: string;
  link?: string | null;
  createdBy: string;
}) {
  const announcement = await prisma.announcement.create({
    data: {
      appId: data.appId,
      title: data.title,
      body: data.body,
      link: data.link || null,
      createdBy: data.createdBy,
    },
  });

  // Fire-and-forget: if FCM isn't configured or the push fails, the row still
  // shows up in the in-app feed the next time any client polls. Don't block
  // the admin's request on FCM.
  sendPushToTopic(
    data.appId,
    `app_${data.appId}`,
    { title: data.title, body: data.body },
    {
      type: "announcement",
      announcementId: announcement.id,
      ...(data.link ? { link: data.link } : {}),
    }
  ).catch((err) => console.warn("Announcement topic push failed:", err));

  return announcement;
}

export async function listAnnouncements(appId: string, limit = 50) {
  return prisma.announcement.findMany({
    where: { appId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function deleteAnnouncement(announcementId: string) {
  return prisma.announcement.delete({ where: { id: announcementId } });
}
