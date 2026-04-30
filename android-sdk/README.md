# Feedback Android SDK

[![](https://jitpack.io/v/solfreaks/feedback.svg)](https://jitpack.io/#solfreaks/feedback)

Android library for integrating feedback, support tickets, announcements, and in-app notifications into your app.

## Features

- **Google Sign-In** authentication (or bring your own JWT)
- **Support tickets** with comments, attachments, inline media preview
- **Feedback** with star ratings, categories, attachments
- **Developer announcements** broadcast via FCM topic (admin → all users)
- **In-app notification feed** — new replies, @mentions, status changes
- **Live updates** over WebSocket — new comments appear without refresh, "support is typing…" indicator
- **Offline UX** — offline banner, keep-stale-data-visible, draft persistence, "failed · tap to retry" on send
- **User agency** — users can edit/delete their own feedback (24h) and comments (10 min)
- **Drop-in `FeedbackBellView`** — bell icon with unread badge for your own toolbar
- Pre-built UI screens **or** a programmatic `suspend` API for custom UI
- Edge-to-edge layouts (Android 15+ ready) with Material 3 theming
- FCM push notifications with automatic device-token registration + topic subscription

## Installation

### JitPack (recommended)

In **`settings.gradle.kts`**:

```kotlin
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}
```

In your app's **`build.gradle.kts`**:

```kotlin
dependencies {
    implementation("com.github.solfreaks:feedback:2.6.0")
}
```

Groovy equivalent:

```groovy
implementation 'com.github.solfreaks:feedback:2.6.0'
```

See the [JitPack badge](https://jitpack.io/#solfreaks/feedback) at the top for the latest version.

### Local module / AAR (dev fallback)

For active SDK development you can point at a local module (`include(":feedbacksdk")`) or an assembled AAR (`./gradlew :feedbacksdk:assembleRelease` → `feedbacksdk/build/outputs/aar/feedbacksdk-release.aar`). Remember to pull in the transitive deps yourself (Retrofit, OkHttp, play-services-auth, Material).

## Quick Start

### 1. Initialize the SDK

In your `Application.onCreate()`:

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        FeedbackSDK.initialize(
            context = this,
            baseUrl = "https://your-feedback-server.com/api",
            apiKey = "your-app-api-key",           // From the admin panel's App detail page
            appId = "your-app-id",                 // Enables announcements via FCM topic
            googleClientId = "your-google-client-id",
            debug = BuildConfig.DEBUG,
        )
    }
}
```

> **The admin panel shows ready-to-paste copy-integration snippets** on each app's detail page — API key, app ID, and base URL are baked in. Use those instead of writing the values by hand.

### 2. Google Sign-In

```kotlin
class LoginActivity : AppCompatActivity() {
    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            when (val r = FeedbackSDK.handleGoogleSignInResult(result.data)) {
                is SdkResult.Success -> toast("Welcome ${r.data.user.name}")
                is SdkResult.Error -> Log.e("Auth", r.message)
            }
        }
    }

    fun signIn() {
        signInLauncher.launch(FeedbackSDK.getGoogleSignInIntent(this))
    }
}
```

### 3. Pre-built screens

```kotlin
// Tickets
FeedbackSDK.openCreateTicket(activity)
FeedbackSDK.openTicketList(activity)        // list + in-screen "Create" button
FeedbackSDK.openTicketDetail(activity, id)  // live comments + typing indicator

// Feedback
FeedbackSDK.openFeedback(activity)           // star + category + comment + attachments
FeedbackSDK.openFeedbackList(activity)
FeedbackSDK.openFeedbackDetail(activity, id)

// Notifications + announcements
FeedbackSDK.openNotifications(activity)      // two-tab feed: Activity / Announcements

// Attachment viewer (pinch-to-zoom images; ACTION_VIEW for other types)
FeedbackSDK.openAttachment(activity, fileUrl, fileName)
```

### 4. Drop-in bell widget

Put a bell anywhere in your own UI — it polls the unread count and opens the notifications screen on tap:

```xml
<com.feedbacksdk.ui.FeedbackBellView
    android:layout_width="48dp"
    android:layout_height="48dp" />
```

The badge auto-refreshes when the hosting activity resumes. Call `bell.refresh()` if you want to poke it manually.

### 5. Dashboard / settings badges (no UI required)

```kotlin
lifecycleScope.launch {
    when (val r = FeedbackSDK.getSummary()) {
        is SdkResult.Success -> {
            val t = r.data.tickets
            val f = r.data.feedback
            // Show "My Tickets · 5 (2 new)" and "My Feedback · 7 · 4.3★"
            ticketsBadge.text = "${t.total} (${t.unread} new)"
            feedbackBadge.text = "${f.total} · ${"%.1f".format(f.averageRating)}★"
        }
        is SdkResult.Error -> Log.w("Feedback", r.message)
    }
}
```

### 6. Custom UI (programmatic API)

Every screen in the SDK is also a single `suspend` call so you can build your own UI:

```kotlin
lifecycleScope.launch {
    // Create
    FeedbackSDK.createTicket(title = "…", description = "…", priority = "high")
    FeedbackSDK.submitFeedback(rating = 4, category = "suggestion", comment = "…")

    // Read
    FeedbackSDK.listTickets(page = 1)
    FeedbackSDK.listFeedbacks(page = 1)
    FeedbackSDK.listAnnouncements()

    // Reply
    FeedbackSDK.addComment(ticketId, "Any update?")
    FeedbackSDK.uploadTicketAttachment(ticketId, File("/path/to/screenshot.png"))
    FeedbackSDK.uploadFeedbackAttachment(feedbackId, File("/path/…"))

    // Users can edit/delete what they wrote (server enforces the windows)
    FeedbackSDK.editFeedback(id, rating = 5, comment = "updated")
    FeedbackSDK.deleteFeedback(id)
    FeedbackSDK.editComment(ticketId, commentId, "fixed typo")
    FeedbackSDK.deleteComment(ticketId, commentId)

    // Unread + notifications
    FeedbackSDK.getUnreadCounts()
    FeedbackSDK.getUnreadNotificationCount()
    FeedbackSDK.listNotifications()
    FeedbackSDK.markNotificationRead(notificationId)
    FeedbackSDK.markAllNotificationsRead()
}
```

All methods return a sealed `SdkResult<T>` (`Success` or `Error`). No exceptions leak to the caller.

## Push Notifications (FCM)

Add Firebase Messaging to your app's dependencies and register the service:

```xml
<service
    android:name="com.feedbacksdk.FeedbackFirebaseService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

Or subclass to pipe messages through your own handler:

```kotlin
class MyFirebaseService : FeedbackFirebaseService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token) // Registers with feedback server + subscribes to announcement topic
    }
    override fun onMessageReceived(message: RemoteMessage) {
        // Your own push handling
    }
}
```

### Announcement topic subscription

When you pass `appId` to `FeedbackSDK.initialize(...)`, the SDK subscribes the device to `app_<appId>` after an FCM token is registered. Admin broadcasts from the admin panel reach every subscribed device.

If your app manages FCM topics manually, opt out:

```kotlin
FeedbackSDK.setAutoSubscribeAnnouncements(enabled = false)
```

## Offline & Resilience

- **Offline banner** appears across every list/detail screen when the device loses connectivity
- **Retry banner** with a Retry button when a fetch fails and there's nothing cached
- **Stale data kept visible** — a failed refresh doesn't blank the screen
- **Send retry** — optimistic comment send shows "Sending…", converts to "Failed · tap to retry" on error, preserves the draft text
- **Drafts persist** across process death for Create Ticket and Feedback submission
- **Typing indicator** and **live comment arrival** use the SDK's WebSocket connection; auto-reconnects with backoff

## Theming

All pre-built screens use `@style/FeedbackSDK.Theme`. To customize, declare a style with the same name in your app:

```xml
<style name="FeedbackSDK.Theme" parent="Theme.FeedbackSDK.DayNight">
    <item name="colorPrimary">@color/my_brand</item>
    <item name="colorOnPrimary">#FFFFFF</item>
    <item name="sdkColorStatusResolved">@color/my_green</item>
</style>
```

Material 3 filter chips draw from the secondary color palette — if you want them to match your primary, set `colorSecondaryContainer` too (see `themes.xml` in the SDK for the baseline).

## API Reference

| Method | Description |
|---|---|
| **Init & auth** | |
| `initialize(context, baseUrl, apiKey, appId?, googleClientId?, debug?)` | Required. `appId` enables announcement topic subscription. |
| `setAutoSubscribeAnnouncements(enabled)` | Opt-in/out of auto FCM topic subscription. |
| `getGoogleSignInIntent(activity)` / `handleGoogleSignInResult(data)` | Google sign-in pair. |
| `setAuthToken(token, user?)` / `logout()` / `isLoggedIn` / `currentUser` | Manual auth. |
| **Tickets** | |
| `createTicket(title, description, category?, priority?)` | `priority`: low / medium / high / critical. |
| `listTickets(page, limit)` / `getTicket(id)` | |
| `addComment(id, body)` / `editComment(ticketId, commentId, body)` / `deleteComment(ticketId, commentId)` | 10-min edit window for own comments. |
| `uploadTicketAttachment(id, file)` | |
| **Feedback** | |
| `submitFeedback(rating, category?, comment?)` | |
| `listFeedbacks(page, limit)` / `getFeedback(id)` | |
| `editFeedback(id, rating?, category?, comment?)` / `deleteFeedback(id)` | 24h edit window. |
| `uploadFeedbackAttachment(id, file)` | |
| **Notifications & announcements** | |
| `listNotifications(page, limit)` / `markNotificationRead(id)` / `markAllNotificationsRead()` | |
| `getUnreadNotificationCount()` | Used by `FeedbackBellView`. |
| `listAnnouncements()` | Developer broadcasts (FCM topic + in-app feed). |
| **Summary & unread** | |
| `getSummary()` | Totals + status breakdowns + folded-in unread counts. |
| `getUnreadCounts(limit?)` | Raw per-item unread IDs (tickets + feedback). |
| `markTicketRead(id, updatedAt)` / `markFeedbackRead(id, replyCount)` | Manual mark-read (detail screens do this automatically). |
| **Device tokens** | |
| `registerDeviceToken(token)` / `removeDeviceToken(token)` | `FeedbackFirebaseService` handles this for you. |
| **Pre-built UI** | |
| `openCreateTicket(activity)` | |
| `openTicketList(activity)` / `openTicketDetail(activity, id)` | List has in-screen create button. |
| `openFeedback(activity)` / `openFeedbackList(activity)` / `openFeedbackDetail(activity, id)` | |
| `openNotifications(activity)` | Two-tab feed: Activity + Announcements. |
| `openAttachment(activity, fileUrl, fileName)` | Pinch-zoom viewer + ACTION_VIEW fallback. |

## Requirements

- Android API 24+ (Android 7.0)
- Kotlin 1.9+
- Google Play Services (for Google Sign-In)
- Firebase Messaging (optional — runtime dep, add yourself if you want push)

## License

Proprietary. See `server/` for the backend this SDK talks to.
