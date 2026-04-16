# Feedback Android SDK

[![](https://jitpack.io/v/solfreaks/feedback.svg)](https://jitpack.io/#solfreaks/feedback)

Android library for integrating feedback, support tickets, and ratings into your app.

## Features

- Google Sign-In authentication
- Create & view support tickets with comments and attachments
- Submit feedback with star ratings and categories
- FCM push notification support
- Pre-built UI screens (ready to use) or programmatic API (build your own UI)

## Installation

### Option 1: Local module (recommended for now)

Copy the `feedbacksdk` folder into your project, then add to `settings.gradle.kts`:

```kotlin
include(":feedbacksdk")
```

Add dependency in your app's `build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":feedbacksdk"))
}
```

### Option 2: AAR file

Build the AAR:

```bash
./gradlew :feedbacksdk:assembleRelease
```

Copy `feedbacksdk/build/outputs/aar/feedbacksdk-release.aar` to your project's `libs/` folder and add:

```kotlin
dependencies {
    implementation(files("libs/feedbacksdk-release.aar"))
    // Also add these transitive dependencies:
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.google.android.gms:play-services-auth:20.7.0")
    implementation("com.google.android.material:material:1.11.0")
}
```

## Quick Start

### 1. Initialize the SDK

In your `Application` class or main `Activity`:

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        FeedbackSDK.initialize(
            context = this,
            baseUrl = "https://your-feedback-server.com",
            apiKey = "your-app-api-key",           // From admin panel
            googleClientId = "your-google-client-id", // For Google Sign-In
            debug = BuildConfig.DEBUG               // Enable logging in debug
        )
    }
}
```

### 2. Google Sign-In

```kotlin
class LoginActivity : AppCompatActivity() {

    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            when (val authResult = FeedbackSDK.handleGoogleSignInResult(result.data)) {
                is SdkResult.Success -> {
                    // User logged in: authResult.data.user
                    Log.d("Auth", "Welcome ${authResult.data.user.name}")
                }
                is SdkResult.Error -> {
                    Log.e("Auth", "Login failed: ${authResult.message}")
                }
            }
        }
    }

    fun signIn() {
        val intent = FeedbackSDK.getGoogleSignInIntent(this)
        signInLauncher.launch(intent)
    }
}
```

### 3. Using Pre-built UI (Easiest)

```kotlin
// Open create ticket screen
FeedbackSDK.openCreateTicket(activity)

// Open ticket list (user's tickets)
FeedbackSDK.openTicketList(activity)

// Open feedback/rating screen
FeedbackSDK.openFeedback(activity)

// Open specific ticket detail
FeedbackSDK.openTicketDetail(activity, ticketId)
```

### 4. Using Programmatic API (Custom UI)

```kotlin
lifecycleScope.launch {
    // Create a ticket
    when (val result = FeedbackSDK.createTicket(
        title = "App crashes on login",
        description = "When I tap the login button, the app crashes",
        priority = "high"  // low, medium, high, critical
    )) {
        is SdkResult.Success -> Log.d("Ticket", "Created: ${result.data.id}")
        is SdkResult.Error -> Log.e("Ticket", result.message)
    }

    // Submit feedback
    when (val result = FeedbackSDK.submitFeedback(
        rating = 4,
        category = "suggestion",  // general, bug_report, feature_request, suggestion, complaint
        comment = "Great app, but needs dark mode!"
    )) {
        is SdkResult.Success -> Log.d("Feedback", "Submitted!")
        is SdkResult.Error -> Log.e("Feedback", result.message)
    }

    // List user's tickets
    when (val result = FeedbackSDK.listTickets(page = 1)) {
        is SdkResult.Success -> {
            result.data.tickets.forEach { ticket ->
                Log.d("Ticket", "${ticket.title} - ${ticket.status}")
            }
        }
        is SdkResult.Error -> Log.e("Tickets", result.message)
    }

    // Add comment to ticket
    FeedbackSDK.addComment(ticketId, "Any update on this?")

    // Upload attachment
    FeedbackSDK.uploadTicketAttachment(ticketId, File("/path/to/screenshot.png"))
}
```

### 5. Push Notifications (FCM)

Add Firebase to your project, then register the service in `AndroidManifest.xml`:

```xml
<service
    android:name="com.feedbacksdk.FeedbackFirebaseService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

Or extend the service in your own class:

```kotlin
class MyFirebaseService : FeedbackFirebaseService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token) // Registers with feedback server
        // Your own token handling...
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Handle your push notifications
    }
}
```

To manually register/unregister tokens:

```kotlin
// Register (e.g., after login)
FeedbackSDK.registerDeviceToken(fcmToken)

// Unregister (e.g., on logout)
FeedbackSDK.removeDeviceToken(fcmToken)
```

### 6. Auth Token (Manual)

If you handle authentication yourself instead of using Google Sign-In:

```kotlin
// Set token from your own auth flow
FeedbackSDK.setAuthToken(jwtToken, user)

// Check login state
if (FeedbackSDK.isLoggedIn) {
    val user = FeedbackSDK.currentUser
}

// Logout
FeedbackSDK.logout()
```

## API Reference

| Method | Description |
|--------|-------------|
| `FeedbackSDK.initialize(...)` | Initialize the SDK (required) |
| `FeedbackSDK.getGoogleSignInIntent(activity)` | Get Google Sign-In intent |
| `FeedbackSDK.handleGoogleSignInResult(data)` | Process sign-in result |
| `FeedbackSDK.setAuthToken(token, user?)` | Set auth token manually |
| `FeedbackSDK.logout()` | Clear stored credentials |
| `FeedbackSDK.isLoggedIn` | Check if user is logged in |
| `FeedbackSDK.currentUser` | Get current user info |
| `FeedbackSDK.createTicket(...)` | Create support ticket |
| `FeedbackSDK.listTickets(page, limit)` | List user's tickets |
| `FeedbackSDK.getTicket(id)` | Get ticket with comments |
| `FeedbackSDK.addComment(ticketId, body)` | Add comment to ticket |
| `FeedbackSDK.uploadTicketAttachment(id, file)` | Upload file to ticket |
| `FeedbackSDK.submitFeedback(...)` | Submit feedback/rating |
| `FeedbackSDK.listFeedbacks(page, limit)` | List user's feedbacks |
| `FeedbackSDK.getFeedback(id)` | Get feedback with replies |
| `FeedbackSDK.registerDeviceToken(token)` | Register FCM token |
| `FeedbackSDK.removeDeviceToken(token)` | Remove FCM token |
| `FeedbackSDK.openCreateTicket(activity)` | Open create ticket UI |
| `FeedbackSDK.openTicketList(activity)` | Open ticket list UI |
| `FeedbackSDK.openTicketDetail(activity, id)` | Open ticket detail UI |
| `FeedbackSDK.openFeedback(activity)` | Open feedback UI |

## Requirements

- Android API 24+ (Android 7.0)
- Kotlin 1.9+
- Google Play Services (for Google Sign-In)
- Firebase (optional, for push notifications)
