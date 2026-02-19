# Firebase Cloud Messaging (FCM) — Setup Guide

This guide walks you through configuring Firebase for push notifications in the Feedback & Tickets system. Each app has its own Firebase project, so notifications are scoped per-app.

---

## Table of Contents

- [Overview](#overview)
- [How Push Notifications Work](#how-push-notifications-work)
- [Step 1: Create a Firebase Project](#step-1-create-a-firebase-project)
- [Step 2: Add Your App to Firebase](#step-2-add-your-app-to-firebase)
- [Step 3: Generate a Service Account Key](#step-3-generate-a-service-account-key)
- [Step 4: Configure in Admin Panel](#step-4-configure-in-admin-panel)
- [Step 5: Client-Side Integration (Android)](#step-5-client-side-integration-android)
- [Step 6: Client-Side Integration (Flutter)](#step-6-client-side-integration-flutter)
- [Step 7: Verify Push Notifications](#step-7-verify-push-notifications)
- [Notification Events](#notification-events)
- [Device Token API](#device-token-api)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)

---

## Overview

The system uses **Firebase Admin SDK** on the server to send push notifications to mobile app users. Each app registered in the admin panel can have its own Firebase project credentials. There is **no global fallback** — FCM only works for apps that have Firebase configured.

**Architecture:**

```
Mobile App                    Server                         Firebase
─────────                    ──────                         ────────
1. Get FCM token ──────────> 2. Store device token
                             3. Event happens (new comment,
                                status change, reply)
                             4. Look up user's tokens
                             5. Send via Firebase Admin SDK ──> 6. Deliver push
                                                                   to device
```

---

## How Push Notifications Work

1. **User logs in** → the mobile app gets an FCM device token from Firebase and sends it to the server via `POST /device-tokens`
2. **An event occurs** (ticket status change, new comment, feedback reply) → the server looks up the affected user's device tokens
3. **Server sends push** using the app's Firebase service account credentials via Firebase Admin SDK
4. **Device receives notification** → shown as a system notification; tapping opens the relevant screen
5. **User logs out** → the app calls `DELETE /device-tokens` to unregister the token
6. **Stale tokens** → if Firebase reports a token is invalid, the server automatically removes it

---

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** (or select an existing project)
3. Enter a project name (e.g., "MyApp Feedback")
4. (Optional) Enable Google Analytics — not required for FCM
5. Click **Create project**

> **Tip:** If your mobile app already uses Firebase for other features (auth, Firestore, etc.), use the same project — no need to create a new one.

---

## Step 2: Add Your App to Firebase

### For Android

1. In Firebase Console, click **Add app** → select **Android**
2. Enter your app's **package name** (e.g., `com.example.myapp`) — must match exactly
3. (Optional) Enter app nickname and SHA-1 signing certificate
4. Click **Register app**
5. Download `google-services.json` and place it in your Android project's `app/` directory
6. Follow the Firebase SDK setup instructions shown in the console

### For iOS

1. In Firebase Console, click **Add app** → select **iOS**
2. Enter your **Bundle ID** (e.g., `com.example.myapp`)
3. Click **Register app**
4. Download `GoogleService-Info.plist` and add it to your Xcode project
5. Follow the Firebase SDK setup instructions

### For Flutter

1. Install the FlutterFire CLI:
   ```bash
   dart pub global activate flutterfire_cli
   ```
2. Run:
   ```bash
   flutterfire configure --project=your-firebase-project-id
   ```
3. This generates `firebase_options.dart` and configures both Android and iOS automatically

---

## Step 3: Generate a Service Account Key

This is the **most important step** — the server needs a service account key to send push notifications.

1. Go to [Firebase Console](https://console.firebase.google.com/) → select your project
2. Click the **gear icon** (⚙️) next to "Project Overview" → **Project settings**
3. Go to the **Service accounts** tab
4. You'll see "Firebase Admin SDK" section with a code snippet
5. Click **Generate new private key**
6. Click **Generate key** in the confirmation dialog
7. A JSON file will download — **keep this file secure, do not commit it to version control**

The downloaded JSON file looks like this:

```json
{
  "type": "service_account",
  "project_id": "myapp-feedback-12345",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@myapp-feedback-12345.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40myapp-feedback-12345.iam.gserviceaccount.com"
}
```

You need **three values** from this file:

| JSON Field       | Admin Panel Field        | Example                                                                 |
|------------------|--------------------------|-------------------------------------------------------------------------|
| `project_id`     | Firebase Project ID      | `myapp-feedback-12345`                                                  |
| `client_email`   | Firebase Client Email    | `firebase-adminsdk-xxxxx@myapp-feedback-12345.iam.gserviceaccount.com`  |
| `private_key`    | Firebase Private Key     | `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...`                      |

---

## Step 4: Configure in Admin Panel

1. Log in to the admin panel (`https://your-domain.com`)
2. Go to **Apps** in the sidebar
3. Click the **edit icon** (pencil) on the app you want to configure
4. Scroll down to the **Firebase / FCM** section
5. Fill in the three fields:

   - **Firebase Project ID** — paste the `project_id` value from the JSON
   - **Firebase Client Email** — paste the `client_email` value from the JSON
   - **Firebase Private Key** — paste the **entire** `private_key` value including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`

6. Click **Save**

> **Important:** When pasting the private key, paste it exactly as it appears in the JSON file. The `\n` characters represent newlines and will be handled automatically by the server.

### Verifying Configuration

After saving, the app card in the admin panel will show a Firebase indicator if configured correctly. You can verify by:

1. Triggering a test event (e.g., changing a ticket's status)
2. Checking server logs for FCM send confirmations
3. Confirming the push notification arrives on the device

---

## Step 5: Client-Side Integration (Android)

### 1. Add Firebase dependencies

In `app/build.gradle`:

```groovy
dependencies {
    implementation platform('com.google.firebase:firebase-bom:33.0.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

In your root `build.gradle`:

```groovy
plugins {
    id 'com.google.gms.google-services' version '4.4.0' apply false
}
```

In `app/build.gradle` (top):

```groovy
plugins {
    id 'com.google.gms.google-services'
}
```

### 2. Create FCM Service

```kotlin
// FeedbackFcmService.kt
class FeedbackFcmService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send new token to server
        CoroutineScope(Dispatchers.IO).launch {
            try {
                FeedbackApi.registerDeviceToken(token, "android")
            } catch (e: Exception) {
                Log.e("FCM", "Failed to register token", e)
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.data["title"] ?: message.notification?.title ?: "Notification"
        val body = message.data["body"] ?: message.notification?.body ?: ""
        val type = message.data["type"] // "ticket_status", "ticket_comment", "feedback_reply"
        val targetId = message.data["targetId"]

        showNotification(title, body, type, targetId)
    }

    private fun showNotification(title: String, body: String, type: String?, targetId: String?) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("type", type)
            putExtra("targetId", targetId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, "feedback_channel")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
```

### 3. Register in AndroidManifest.xml

```xml
<service
    android:name=".FeedbackFcmService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

### 4. Create notification channel (in Application class)

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "feedback_channel",
                "Feedback Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Ticket and feedback notifications"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
```

### 5. Register device token after login

```kotlin
// After successful login
FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
    CoroutineScope(Dispatchers.IO).launch {
        FeedbackApi.registerDeviceToken(token, "android")
    }
}
```

### 6. Unregister on logout

```kotlin
// Before clearing session
CoroutineScope(Dispatchers.IO).launch {
    val token = FirebaseMessaging.getInstance().token.await()
    FeedbackApi.removeDeviceToken(token)
}
```

### 7. Request notification permission (Android 13+)

```kotlin
// In your Activity
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED) {
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
    }
}
```

---

## Step 6: Client-Side Integration (Flutter)

### 1. Add dependencies

```yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
```

### 2. Initialize Firebase and register token

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// In main() or after login:
await Firebase.initializeApp();
final fcmToken = await FirebaseMessaging.instance.getToken();
if (fcmToken != null) {
  await FeedbackService.registerDeviceToken(fcmToken);
}

// Listen for token refresh
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
  FeedbackService.registerDeviceToken(newToken);
});
```

### 3. Handle foreground notifications

```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // Show a local notification or in-app banner
  final title = message.data['title'] ?? message.notification?.title ?? '';
  final body = message.data['body'] ?? message.notification?.body ?? '';
  final type = message.data['type'];
  final targetId = message.data['targetId'];

  // Show using flutter_local_notifications or custom UI
  showLocalNotification(title: title, body: body);
});
```

### 4. Handle notification taps (background/terminated)

```dart
// When app is in background and user taps notification
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  final type = message.data['type'];
  final targetId = message.data['targetId'];
  navigateToScreen(type, targetId);
});

// When app was terminated and opened via notification
final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
if (initialMessage != null) {
  final type = initialMessage.data['type'];
  final targetId = initialMessage.data['targetId'];
  navigateToScreen(type, targetId);
}
```

### 5. Unregister on logout

```dart
Future<void> logout() async {
  final token = await FirebaseMessaging.instance.getToken();
  if (token != null) {
    await FeedbackService.removeDeviceToken(token);
  }
  // Clear session...
}
```

### 6. Request permission (iOS + Android 13+)

```dart
final settings = await FirebaseMessaging.instance.requestPermission(
  alert: true,
  badge: true,
  sound: true,
);
if (settings.authorizationStatus == AuthorizationStatus.authorized) {
  print('Permission granted');
}
```

---

## Step 7: Verify Push Notifications

### Quick Test Checklist

1. **Admin panel configured** — App has Firebase Project ID, Client Email, and Private Key set
2. **Device token registered** — After login, check server logs for successful `POST /device-tokens`
3. **Trigger an event:**
   - Change a ticket's status from the admin panel
   - Add a comment to a ticket from the admin panel
   - Reply to a feedback from the admin panel
4. **Check device** — Push notification should appear within a few seconds

### Server-Side Verification

Check server logs for:

```
# Successful send
FCM push sent to user <userId> for app <appId>

# Token cleanup (normal)
Removed stale FCM token for user <userId>

# Configuration error
Firebase not configured for app <appId>
```

### Test with cURL

Register a device token manually:

```bash
curl -X POST https://your-domain.com/api/device-tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user-jwt-token>" \
  -H "x-api-key: <app-api-key>" \
  -d '{
    "token": "fcm-device-token-from-app",
    "platform": "android"
  }'
```

---

## Notification Events

The server sends push notifications for these events:

| Event                  | Recipient         | Title                        | When                                     |
|------------------------|-------------------|------------------------------|------------------------------------------|
| Ticket status changed  | Ticket creator    | Ticket Status Updated        | Admin changes ticket status              |
| New comment            | Ticket creator    | New Comment on Ticket        | Non-internal comment added by non-creator |
| Feedback reply         | Feedback creator  | New Reply to Your Feedback   | Admin replies to user's feedback         |

### Notification Payload Format

```json
{
  "notification": {
    "title": "Ticket Status Updated",
    "body": "Your ticket \"Login Bug\" status changed to IN_PROGRESS"
  },
  "data": {
    "type": "ticket_status",
    "targetId": "ticket-uuid-here"
  }
}
```

**Data fields:**

| Field      | Values                                              | Description                              |
|------------|-----------------------------------------------------|------------------------------------------|
| `type`     | `ticket_status`, `ticket_comment`, `feedback_reply` | Type of event that triggered the push    |
| `targetId` | UUID string                                         | ID of the ticket or feedback             |

---

## Device Token API

### Register Token

```http
POST /device-tokens
Content-Type: application/json
Authorization: Bearer <jwt-token>
x-api-key: <app-api-key>

{
  "token": "fcm-device-token",
  "platform": "android"
}
```

**Response `200`:**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "appId": "app-uuid",
  "token": "fcm-device-token",
  "platform": "android",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

- Uses **upsert** — if the same user+token combination exists, it updates instead of creating a duplicate
- The `platform` field is optional (`"android"`, `"ios"`, or `null`)

### Remove Token

```http
DELETE /device-tokens
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "token": "fcm-device-token"
}
```

**Response `200`:**
```json
{ "message": "Token removed" }
```

- Call this on **logout** to stop receiving notifications
- Returns success even if token doesn't exist (idempotent)

---

## Troubleshooting

### "Firebase not configured for app"

The app doesn't have Firebase credentials in the admin panel. Go to **Apps → Edit** and fill in all three Firebase fields.

### Notifications not arriving

1. **Check device token registration** — Look for `POST /device-tokens` in server logs
2. **Check Firebase credentials** — Ensure Project ID, Client Email, and Private Key are correct
3. **Check private key format** — The entire key including `-----BEGIN` and `-----END` lines must be included
4. **Check notification permission** — Android 13+ requires explicit permission
5. **Check app is not in foreground** — By default, FCM doesn't show system notifications when the app is in the foreground; you need to handle `onMessageReceived`/`onMessage` explicitly

### "messaging/invalid-registration-token"

The device token is no longer valid. This happens when:
- The app was uninstalled and reinstalled
- The user cleared app data
- The token expired (rare)

The server automatically removes stale tokens when this error occurs.

### "messaging/authentication-error"

The Firebase service account credentials are wrong. Double-check:
- `project_id` matches the Firebase project
- `client_email` is the full service account email
- `private_key` is the complete RSA key (not truncated)

### "messaging/mismatched-credential"

The service account doesn't belong to the Firebase project specified. Make sure the Project ID and Client Email are from the **same** Firebase project.

### Notifications arriving but no sound/vibration

- Check notification channel importance is set to `HIGH`
- Check device Do Not Disturb settings
- On Samsung devices, check app notification settings in system settings

### Token refresh not updating

Ensure you're listening to token refresh events:
- Android: `onNewToken()` in your `FirebaseMessagingService`
- Flutter: `FirebaseMessaging.instance.onTokenRefresh.listen()`

---

## Security Notes

- **Never commit service account JSON** files to version control — add `*-service-account.json` to `.gitignore`
- **Private keys are stored encrypted** in the database — treat your database as sensitive
- **Device tokens are user-scoped** — a user can only see/manage their own tokens
- **Stale tokens are auto-cleaned** — the server removes invalid tokens on send failure
- **Per-app isolation** — each app's Firebase credentials are independent; one app cannot send notifications to another app's users
- **The `x-api-key` header** is required for token registration to ensure tokens are associated with the correct app
