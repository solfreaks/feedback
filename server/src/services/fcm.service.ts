import * as admin from "firebase-admin";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Cache initialized Firebase apps per appId
const firebaseApps = new Map<string, admin.app.App>();

function getFirebaseApp(appId: string, projectId: string, clientEmail: string, privateKey: string): admin.app.App {
  if (!firebaseApps.has(appId)) {
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      },
      `app-${appId}` // unique name per app
    );
    firebaseApps.set(appId, app);
  }
  return firebaseApps.get(appId)!;
}

// Clear cached Firebase app (call when app's Firebase config changes)
export function clearFirebaseApp(appId: string) {
  const app = firebaseApps.get(appId);
  if (app) {
    app.delete();
    firebaseApps.delete(appId);
  }
}

// Register or update a device token
export async function registerDeviceToken(userId: string, appId: string, token: string, platform?: string) {
  return prisma.deviceToken.upsert({
    where: { userId_token: { userId, token } },
    update: { appId, platform, updatedAt: new Date() },
    create: { userId, appId, token, platform },
  });
}

// Remove a device token (on logout)
export async function removeDeviceToken(userId: string, token: string) {
  return prisma.deviceToken.deleteMany({
    where: { userId, token },
  });
}

// Send push notification to a specific user for a specific app
export async function sendPushToUser(
  userId: string,
  appId: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
) {
  // Get app's Firebase config
  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { firebaseProjectId: true, firebaseClientEmail: true, firebasePrivateKey: true },
  });

  if (!app?.firebaseProjectId || !app.firebaseClientEmail || !app.firebasePrivateKey) {
    return; // Firebase not configured for this app
  }

  // Get user's device tokens for this app
  const deviceTokens = await prisma.deviceToken.findMany({
    where: { userId, appId },
    select: { id: true, token: true },
  });

  if (deviceTokens.length === 0) return;

  const firebaseApp = getFirebaseApp(appId, app.firebaseProjectId, app.firebaseClientEmail, app.firebasePrivateKey);
  const messaging = firebaseApp.messaging();

  const staleTokenIds: string[] = [];

  await Promise.all(
    deviceTokens.map(async (dt) => {
      try {
        await messaging.send({
          token: dt.token,
          notification,
          data,
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default", badge: 1 } } },
        });
      } catch (err: any) {
        // Remove invalid tokens
        if (
          err.code === "messaging/invalid-registration-token" ||
          err.code === "messaging/registration-token-not-registered"
        ) {
          staleTokenIds.push(dt.id);
        } else {
          console.error(`FCM send error for user ${userId}:`, err.message);
        }
      }
    })
  );

  // Clean up stale tokens
  if (staleTokenIds.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: staleTokenIds } } });
  }
}

// Send push notification to multiple users for a specific app
export async function sendPushToUsers(
  userIds: string[],
  appId: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
) {
  await Promise.all(userIds.map((userId) => sendPushToUser(userId, appId, notification, data)));
}

/**
 * Send a push notification to an FCM topic. The SDK subscribes each device to
 * `app_<appId>` after it registers its FCM token, so calling this with that
 * topic name reaches every device that has the app installed + launched once.
 * One API call, Firebase handles fan-out.
 *
 * Returns true if the send succeeded. Missing Firebase config silently no-ops
 * so callers don't need a guard; the announcement row still saves either way.
 */
export async function sendPushToTopic(
  appId: string,
  topic: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
): Promise<boolean> {
  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { firebaseProjectId: true, firebaseClientEmail: true, firebasePrivateKey: true },
  });
  if (!app?.firebaseProjectId || !app.firebaseClientEmail || !app.firebasePrivateKey) {
    return false;
  }
  try {
    const firebaseApp = getFirebaseApp(appId, app.firebaseProjectId, app.firebaseClientEmail, app.firebasePrivateKey);
    await firebaseApp.messaging().send({
      topic,
      notification,
      data,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
    return true;
  } catch (err: any) {
    console.error(`FCM topic send error for app ${appId}, topic ${topic}:`, err.message);
    return false;
  }
}
