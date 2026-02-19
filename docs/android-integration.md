# Android Native Integration Guide

Complete guide for integrating the Feedback & Tickets system into your Android app using Kotlin, Jetpack libraries, and Material Design.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Step 1: Project Setup & Dependencies](#step-1-project-setup--dependencies)
- [Step 2: Google Sign-In Setup](#step-2-google-sign-in-setup)
- [Step 3: Data Models](#step-3-data-models)
- [Step 4: API Client (FeedbackApi)](#step-4-api-client-feedbackapi)
- [Step 5: Token Persistence & Session Management](#step-5-token-persistence--session-management)
- [Step 6: Google Sign-In Activity](#step-6-google-sign-in-activity)
- [Step 7: Tickets — List, Detail, Create, Comment](#step-7-tickets--list-detail-create-comment)
- [Step 8: Feedback — Submit & List](#step-8-feedback--submit--list)
- [Step 9: File Attachments](#step-9-file-attachments)
- [Step 10: Push Notifications (FCM)](#step-10-push-notifications-fcm)
- [Step 11: Error Handling & Token Refresh](#step-11-error-handling--token-refresh)
- [Step 12: ProGuard Rules](#step-12-proguard-rules)
- [Quick Checklist](#quick-checklist)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Android App                                        │
│                                                     │
│  ┌──────────┐   ┌───────────┐   ┌───────────────┐  │
│  │ Activity/ │──▶│ ViewModel │──▶│ FeedbackApi   │  │
│  │ Fragment  │   │           │   │ (OkHttp +     │  │
│  │ (UI)      │◀──│ LiveData  │◀──│  Coroutines)  │  │
│  └──────────┘   └───────────┘   └───────┬───────┘  │
│                                         │           │
│  ┌──────────────────────────────────────┘           │
│  │  SharedPreferences (JWT token)                   │
│  │  Firebase Messaging (FCM push)                   │
│  └──────────────────────────────────────────────────│
└─────────────────────────────────────┬───────────────┘
                                      │ HTTPS
                                      ▼
                          ┌───────────────────────┐
                          │  Feedback Server API   │
                          │  Authorization: Bearer │
                          │  x-api-key: fb_xxx     │
                          └───────────────────────┘
```

**Flow:** User opens app → Checks for saved JWT → If none, shows Google Sign-In → Gets `idToken` from Google → Sends to `/auth/google` with `x-api-key` → Server returns JWT + user → App stores JWT in SharedPreferences → Uses JWT for all subsequent API calls.

---

## Step 1: Project Setup & Dependencies

### build.gradle (project-level)

```groovy
plugins {
    id 'com.android.application' version '8.2.0' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.22' apply false
    id 'com.google.gms.google-services' version '4.4.0' apply false  // For FCM
}
```

### build.gradle (app-level)

```groovy
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'com.google.gms.google-services'  // For FCM
}

android {
    namespace 'com.example.yourapp'
    compileSdk 34

    defaultConfig {
        applicationId "com.example.yourapp"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildFeatures {
        viewBinding true  // Recommended for type-safe view access
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Android core
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.recyclerview:recyclerview:1.3.2'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'

    // Lifecycle (ViewModel + LiveData)
    implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-livedata-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.7.0'

    // Google Sign-In
    implementation 'com.google.android.gms:play-services-auth:21.0.0'

    // HTTP client
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'

    // JSON parsing
    implementation 'com.google.code.gson:gson:2.10.1'

    // Coroutines
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3'

    // Image loading (for avatars)
    implementation 'io.coil-kt:coil:2.5.0'

    // Firebase (FCM)
    implementation platform('com.google.firebase:firebase-bom:33.0.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

### AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".FeedbackApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.Material3.DayNight.NoActionBar"
        android:networkSecurityConfig="@xml/network_security_config">

        <activity
            android:name=".ui.LoginActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity android:name=".ui.MainActivity" />
        <activity android:name=".ui.CreateTicketActivity" />
        <activity android:name=".ui.TicketDetailActivity" />

        <!-- FCM Service -->
        <service android:name=".fcm.FeedbackFcmService" android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- Default FCM notification channel -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="feedback_updates" />

    </application>
</manifest>
```

### Network Security Config (for local development)

Create `res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext for local development only. Remove for production. -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>  <!-- Android emulator localhost -->
        <domain includeSubdomains="true">192.168.1.0</domain> <!-- Your local IP -->
    </domain-config>
</network-security-config>
```

---

## Step 2: Google Sign-In Setup

### Google Cloud Console Configuration

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Select (or create) the project for your app
3. Create **two** OAuth 2.0 Client IDs:

| Type | Purpose | Configuration |
|------|---------|--------------|
| **Android** | Used by the Google Sign-In SDK on the device | Package name + SHA-1 fingerprint |
| **Web application** | Used by the server to verify tokens | No special config needed |

4. Copy the **Web** Client ID → paste into the admin panel (Apps → Edit → Google Client ID)
5. The **Android** Client ID is auto-detected by Google Sign-In based on your package name + SHA-1

### Get SHA-1 Fingerprint

```bash
# Debug keystore (for development)
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android

# Release keystore (for production)
keytool -list -v \
  -keystore /path/to/your-release-key.jks \
  -alias your-key-alias

# From Gradle (alternative)
./gradlew signingReport
```

> **Important:** You need BOTH debug and release SHA-1 registered in Google Cloud Console. Debug for development, release for production. The Google Play Console also provides a SHA-1 if you use Play App Signing.

### OAuth Consent Screen

If you haven't configured the OAuth consent screen:
1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (or Internal for Workspace)
3. Fill in app name, support email, developer email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users while in "Testing" mode

---

## Step 3: Data Models

Create `models/FeedbackModels.kt`:

```kotlin
package com.example.yourapp.models

import com.google.gson.annotations.SerializedName

// ── Auth ─────────────────────────────────────────────

data class AuthResponse(
    val token: String,
    val user: User
)

data class User(
    val id: String,
    val email: String,
    val name: String,
    @SerializedName("avatarUrl") val avatarUrl: String?,
    val role: String
)

// ── Tickets ──────────────────────────────────────────

data class TicketListResponse(
    val tickets: List<Ticket>,
    val total: Int,
    val page: Int,
    val totalPages: Int
)

data class Ticket(
    val id: String,
    val appId: String,
    val userId: String,
    val title: String,
    val description: String,
    val category: String?,
    val priority: String,     // "low", "medium", "high", "critical"
    val status: String,       // "open", "in_progress", "resolved", "closed"
    val assignedTo: String?,
    val slaDeadline: String?,
    val createdAt: String,
    val updatedAt: String,
    val user: TicketUser,
    val assignee: TicketAssignee?,
    val app: TicketApp,
    @SerializedName("_count") val count: TicketCount?,
    val comments: List<Comment>?,
    val attachments: List<Attachment>?,
    val history: List<HistoryEntry>?
)

data class TicketUser(
    val id: String,
    val name: String,
    val email: String,
    @SerializedName("avatarUrl") val avatarUrl: String?
)

data class TicketAssignee(
    val id: String,
    val name: String,
    val email: String?
)

data class TicketApp(
    val id: String,
    val name: String
)

data class TicketCount(
    val comments: Int,
    val attachments: Int
)

data class Comment(
    val id: String,
    val ticketId: String,
    val userId: String,
    val body: String,
    @SerializedName("isInternalNote") val isInternalNote: Boolean,
    val createdAt: String,
    val user: CommentUser
)

data class CommentUser(
    val id: String,
    val name: String,
    @SerializedName("avatarUrl") val avatarUrl: String?
)

data class Attachment(
    val id: String,
    val fileUrl: String,
    val fileName: String,
    val fileSize: Int,
    val createdAt: String
)

data class HistoryEntry(
    val id: String,
    val field: String,
    val oldValue: String?,
    val newValue: String?,
    val createdAt: String,
    val user: HistoryUser
)

data class HistoryUser(
    val id: String,
    val name: String
)

// ── Feedback ─────────────────────────────────────────

data class FeedbackListResponse(
    val feedbacks: List<Feedback>,
    val total: Int,
    val page: Int,
    val totalPages: Int
)

data class Feedback(
    val id: String,
    val appId: String,
    val userId: String,
    val rating: Int,
    val category: String,
    val comment: String?,
    val createdAt: String,
    val user: TicketUser,
    val app: TicketApp,
    @SerializedName("_count") val count: FeedbackCount?,
    val replies: List<FeedbackReply>?,
    val attachments: List<Attachment>?
)

data class FeedbackCount(
    val replies: Int
)

data class FeedbackReply(
    val id: String,
    val feedbackId: String,
    val userId: String,
    val body: String,
    val createdAt: String,
    val user: CommentUser
)

// ── Requests ─────────────────────────────────────────

data class CreateTicketRequest(
    val title: String,
    val description: String,
    val priority: String = "medium",
    val category: String? = null
)

data class CreateCommentRequest(
    val body: String
)

data class CreateFeedbackRequest(
    val rating: Int,
    val category: String = "general",
    val comment: String? = null
)

data class RegisterTokenRequest(
    val token: String,
    val platform: String = "android"
)

// ── API Error ────────────────────────────────────────

data class ApiError(
    val error: String
)

// ── Enums ────────────────────────────────────────────

enum class Priority(val value: String, val label: String) {
    LOW("low", "Low"),
    MEDIUM("medium", "Medium"),
    HIGH("high", "High"),
    CRITICAL("critical", "Critical");

    companion object {
        fun fromValue(value: String) = entries.find { it.value == value } ?: MEDIUM
    }
}

enum class TicketStatus(val value: String, val label: String) {
    OPEN("open", "Open"),
    IN_PROGRESS("in_progress", "In Progress"),
    RESOLVED("resolved", "Resolved"),
    CLOSED("closed", "Closed");

    companion object {
        fun fromValue(value: String) = entries.find { it.value == value } ?: OPEN
    }
}

enum class FeedbackCategory(val value: String, val label: String) {
    GENERAL("general", "General"),
    BUG_REPORT("bug_report", "Bug Report"),
    FEATURE_REQUEST("feature_request", "Feature Request"),
    SUGGESTION("suggestion", "Suggestion"),
    COMPLAINT("complaint", "Complaint");

    companion object {
        fun fromValue(value: String) = entries.find { it.value == value } ?: GENERAL
    }
}
```

---

## Step 4: API Client (FeedbackApi)

Create `api/FeedbackApi.kt`:

```kotlin
package com.example.yourapp.api

import com.example.yourapp.models.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.io.File
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object FeedbackApi {

    // ══════════════════════════════════════════════════
    //  CONFIGURATION — Update these for your app
    // ══════════════════════════════════════════════════

    private const val BASE_URL = "https://your-server.com"  // No trailing slash
    private const val API_KEY = "fb_your_api_key_here"       // From admin panel

    // ══════════════════════════════════════════════════

    private var jwtToken: String? = null
    var currentUser: User? = null
        private set

    val isLoggedIn: Boolean get() = jwtToken != null

    private val gson = Gson()
    private val JSON_TYPE = "application/json".toMediaType()

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor { chain ->
                val builder = chain.request().newBuilder()
                    .addHeader("x-api-key", API_KEY)
                    .addHeader("Content-Type", "application/json")
                jwtToken?.let { builder.addHeader("Authorization", "Bearer $it") }
                chain.proceed(builder.build())
            }
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG)
                    HttpLoggingInterceptor.Level.BODY
                else
                    HttpLoggingInterceptor.Level.NONE
            })
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }

    // ── Internal helpers ─────────────────────────────

    class ApiException(val statusCode: Int, message: String) : Exception(message)

    private suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
        cont.invokeOnCancellation { cancel() }
        enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                cont.resume(response)
            }
            override fun onFailure(call: Call, e: IOException) {
                cont.resumeWithException(e)
            }
        })
    }

    private suspend inline fun <reified T> get(path: String): T = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("$BASE_URL$path").get().build()
        val response = client.newCall(request).await()
        val body = response.body?.string() ?: throw ApiException(response.code, "Empty response")
        if (!response.isSuccessful) {
            val error = try { gson.fromJson(body, ApiError::class.java).error } catch (_: Exception) { body }
            throw ApiException(response.code, error)
        }
        gson.fromJson(body, T::class.java)
    }

    private suspend inline fun <reified T> post(path: String, payload: Any): T = withContext(Dispatchers.IO) {
        val jsonBody = gson.toJson(payload).toRequestBody(JSON_TYPE)
        val request = Request.Builder().url("$BASE_URL$path").post(jsonBody).build()
        val response = client.newCall(request).await()
        val body = response.body?.string() ?: throw ApiException(response.code, "Empty response")
        if (!response.isSuccessful) {
            val error = try { gson.fromJson(body, ApiError::class.java).error } catch (_: Exception) { body }
            throw ApiException(response.code, error)
        }
        gson.fromJson(body, T::class.java)
    }

    private suspend fun delete(path: String, payload: Any? = null): Boolean = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("$BASE_URL$path")
        if (payload != null) {
            builder.delete(gson.toJson(payload).toRequestBody(JSON_TYPE))
        } else {
            builder.delete()
        }
        val response = client.newCall(builder.build()).await()
        response.isSuccessful
    }

    private suspend fun uploadFile(path: String, file: File, fieldName: String = "file"): Attachment =
        withContext(Dispatchers.IO) {
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    fieldName, file.name,
                    file.asRequestBody("application/octet-stream".toMediaType())
                )
                .build()
            val request = Request.Builder().url("$BASE_URL$path").post(body).build()
            val response = client.newCall(request).await()
            val responseBody = response.body?.string() ?: throw ApiException(response.code, "Empty response")
            if (!response.isSuccessful) {
                throw ApiException(response.code, responseBody)
            }
            gson.fromJson(responseBody, Attachment::class.java)
        }

    // ── Auth ─────────────────────────────────────────

    /**
     * Authenticate with a Google ID token.
     * Call after Google Sign-In succeeds.
     *
     * @param googleIdToken The ID token from GoogleSignInAccount.idToken
     * @return The authenticated User, or throws ApiException
     */
    suspend fun signIn(googleIdToken: String): User {
        val result: AuthResponse = post("/auth/google", mapOf("idToken" to googleIdToken))
        jwtToken = result.token
        currentUser = result.user
        return result.user
    }

    /**
     * Sign out — clears stored JWT and user.
     */
    fun signOut() {
        jwtToken = null
        currentUser = null
    }

    /**
     * Set JWT token directly (e.g., loaded from SharedPreferences).
     */
    fun setToken(token: String) {
        jwtToken = token
    }

    // ── Tickets ──────────────────────────────────────

    /**
     * Create a new support ticket.
     *
     * @param title Ticket title (required)
     * @param description Detailed description (required)
     * @param priority "low", "medium", "high", or "critical" (default: "medium")
     * @param category Optional category string
     * @return The created Ticket
     */
    suspend fun createTicket(
        title: String,
        description: String,
        priority: String = "medium",
        category: String? = null
    ): Ticket = post("/tickets", CreateTicketRequest(title, description, priority, category))

    /**
     * List the current user's tickets (paginated).
     *
     * @param page Page number (1-based)
     * @param limit Items per page (default: 20)
     * @return TicketListResponse with tickets array and pagination info
     */
    suspend fun getTickets(page: Int = 1, limit: Int = 20): TicketListResponse =
        get("/tickets?page=$page&limit=$limit")

    /**
     * Get full ticket detail including comments, attachments, and history.
     *
     * @param ticketId The ticket UUID
     * @return Full Ticket with nested data
     */
    suspend fun getTicket(ticketId: String): Ticket = get("/tickets/$ticketId")

    /**
     * Add a comment to a ticket.
     *
     * @param ticketId The ticket UUID
     * @param body Comment text
     * @return The created Comment
     */
    suspend fun addComment(ticketId: String, body: String): Comment =
        post("/tickets/$ticketId/comments", CreateCommentRequest(body))

    /**
     * Upload a file attachment to a ticket.
     * Max file size: 10MB.
     *
     * @param ticketId The ticket UUID
     * @param file The file to upload
     * @return The created Attachment with fileUrl, fileName, fileSize
     */
    suspend fun uploadTicketAttachment(ticketId: String, file: File): Attachment =
        uploadFile("/tickets/$ticketId/attachments", file)

    // ── Feedback ─────────────────────────────────────

    /**
     * Submit feedback.
     *
     * @param rating Star rating 1-5
     * @param category One of: "general", "bug_report", "feature_request", "suggestion", "complaint"
     * @param comment Optional comment text
     * @return The created Feedback
     */
    suspend fun submitFeedback(
        rating: Int,
        category: String = "general",
        comment: String? = null
    ): Feedback = post("/feedbacks", CreateFeedbackRequest(rating, category, comment))

    /**
     * List the current user's feedbacks (paginated).
     */
    suspend fun getFeedbacks(page: Int = 1, limit: Int = 20): FeedbackListResponse =
        get("/feedbacks?page=$page&limit=$limit")

    /**
     * Get feedback detail with admin replies and attachments.
     */
    suspend fun getFeedback(feedbackId: String): Feedback = get("/feedbacks/$feedbackId")

    /**
     * Upload a file attachment to feedback.
     */
    suspend fun uploadFeedbackAttachment(feedbackId: String, file: File): Attachment =
        uploadFile("/feedbacks/$feedbackId/attachments", file)

    // ── Device Tokens (FCM) ──────────────────────────

    /**
     * Register an FCM device token for push notifications.
     * Call after login and whenever the token refreshes.
     */
    suspend fun registerDeviceToken(token: String) {
        post<Map<String, Any>>("/device-tokens", RegisterTokenRequest(token))
    }

    /**
     * Remove the device token on logout.
     */
    suspend fun removeDeviceToken(token: String) {
        delete("/device-tokens", mapOf("token" to token))
    }
}
```

---

## Step 5: Token Persistence & Session Management

Create `api/SessionManager.kt`:

```kotlin
package com.example.yourapp.api

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

/**
 * Manages JWT token persistence using SharedPreferences.
 * Encrypted SharedPreferences is recommended for production:
 *   implementation "androidx.security:security-crypto:1.1.0-alpha06"
 */
object SessionManager {

    private const val PREFS_NAME = "feedback_session"
    private const val KEY_TOKEN = "jwt_token"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_EMAIL = "user_email"
    private const val KEY_USER_AVATAR = "user_avatar"

    private lateinit var prefs: SharedPreferences

    /**
     * Initialize in Application.onCreate().
     */
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Save session after successful login.
     */
    fun saveSession(token: String, user: com.example.yourapp.models.User) {
        prefs.edit {
            putString(KEY_TOKEN, token)
            putString(KEY_USER_ID, user.id)
            putString(KEY_USER_NAME, user.name)
            putString(KEY_USER_EMAIL, user.email)
            putString(KEY_USER_AVATAR, user.avatarUrl)
        }
    }

    /**
     * Restore session on app start.
     * Returns true if a valid session exists.
     */
    fun restoreSession(): Boolean {
        val token = prefs.getString(KEY_TOKEN, null) ?: return false
        FeedbackApi.setToken(token)
        return true
    }

    /**
     * Get the saved token (for FCM registration, etc.)
     */
    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    /**
     * Get the saved user name.
     */
    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)

    /**
     * Get the saved user email.
     */
    fun getUserEmail(): String? = prefs.getString(KEY_USER_EMAIL, null)

    /**
     * Clear session on logout.
     */
    fun clearSession() {
        prefs.edit { clear() }
        FeedbackApi.signOut()
    }

    /**
     * Check if user is logged in.
     */
    val isLoggedIn: Boolean
        get() = prefs.getString(KEY_TOKEN, null) != null
}
```

### Application Class

Create `FeedbackApp.kt`:

```kotlin
package com.example.yourapp

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.example.yourapp.api.SessionManager

class FeedbackApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Initialize session manager
        SessionManager.init(this)

        // Create notification channel for FCM
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "feedback_updates",
                "Feedback & Ticket Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for ticket updates, comments, and feedback replies"
                enableLights(true)
                enableVibration(true)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
```

---

## Step 6: Google Sign-In Activity

### Layout: `res/layout/activity_login.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="32dp"
    android:background="@color/white">

    <!-- App logo / title -->
    <ImageView
        android:id="@+id/ivLogo"
        android:layout_width="80dp"
        android:layout_height="80dp"
        android:src="@mipmap/ic_launcher"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toTopOf="@id/tvTitle"
        app:layout_constraintVertical_chainStyle="packed"
        android:layout_marginBottom="16dp" />

    <TextView
        android:id="@+id/tvTitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Welcome"
        android:textSize="28sp"
        android:textStyle="bold"
        android:textColor="@color/black"
        app:layout_constraintTop_toBottomOf="@id/ivLogo"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toTopOf="@id/tvSubtitle" />

    <TextView
        android:id="@+id/tvSubtitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Sign in to manage your tickets and feedback"
        android:textSize="14sp"
        android:textColor="#888"
        android:textAlignment="center"
        android:layout_marginTop="8dp"
        app:layout_constraintTop_toBottomOf="@id/tvTitle"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toTopOf="@id/btnGoogleSignIn" />

    <com.google.android.gms.common.SignInButton
        android:id="@+id/btnGoogleSignIn"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="40dp"
        app:layout_constraintTop_toBottomOf="@id/tvSubtitle"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toTopOf="@id/progressBar" />

    <ProgressBar
        android:id="@+id/progressBar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:visibility="gone"
        android:layout_marginTop="24dp"
        app:layout_constraintTop_toBottomOf="@id/btnGoogleSignIn"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toBottomOf="parent" />

    <TextView
        android:id="@+id/tvError"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textColor="#D32F2F"
        android:textSize="13sp"
        android:visibility="gone"
        android:layout_marginTop="16dp"
        app:layout_constraintTop_toBottomOf="@id/progressBar"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
```

### LoginActivity.kt

```kotlin
package com.example.yourapp.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.yourapp.api.FeedbackApi
import com.example.yourapp.api.SessionManager
import com.example.yourapp.databinding.ActivityLoginBinding
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    // ┌──────────────────────────────────────────────────┐
    // │  IMPORTANT: Use the Web Client ID here, NOT the  │
    // │  Android Client ID. This is what gets sent to    │
    // │  the server for token verification.              │
    // └──────────────────────────────────────────────────┘
    private val WEB_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"

    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        handleSignInResult(result.data)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Check for existing session
        if (SessionManager.restoreSession()) {
            navigateToMain()
            return
        }

        // Configure Google Sign-In
        binding.btnGoogleSignIn.setOnClickListener {
            startGoogleSignIn()
        }
    }

    private fun startGoogleSignIn() {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(WEB_CLIENT_ID)
            .requestEmail()
            .requestProfile()
            .build()

        val client = GoogleSignIn.getClient(this, gso)

        // Sign out first to force account picker every time
        client.signOut().addOnCompleteListener {
            signInLauncher.launch(client.signInIntent)
        }
    }

    private fun handleSignInResult(data: Intent?) {
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            val idToken = account.idToken

            if (idToken == null) {
                showError("Failed to get ID token from Google")
                return
            }

            // Authenticate with our server
            authenticateWithServer(idToken)

        } catch (e: ApiException) {
            Log.e("Login", "Google sign-in failed: code=${e.statusCode}", e)
            when (e.statusCode) {
                12501 -> { /* User cancelled — do nothing */ }
                7 -> showError("Network error. Check your connection.")
                else -> showError("Google sign-in failed (code: ${e.statusCode})")
            }
        }
    }

    private fun authenticateWithServer(idToken: String) {
        setLoading(true)

        lifecycleScope.launch {
            try {
                val user = FeedbackApi.signIn(idToken)

                // Save session
                SessionManager.saveSession(FeedbackApi.jwtToken ?: "", user)

                // Register FCM token for push notifications
                registerFcmToken()

                Toast.makeText(this@LoginActivity, "Welcome, ${user.name}!", Toast.LENGTH_SHORT).show()
                navigateToMain()

            } catch (e: FeedbackApi.ApiException) {
                Log.e("Login", "Server auth failed: ${e.statusCode} ${e.message}")
                when (e.statusCode) {
                    400 -> showError("Invalid request. Check your API key configuration.")
                    401 -> showError("Authentication failed. Please try again.")
                    403 -> showError("Your account has been suspended.")
                    else -> showError("Server error: ${e.message}")
                }
            } catch (e: Exception) {
                Log.e("Login", "Auth error", e)
                showError("Connection failed. Check your server URL.")
            } finally {
                setLoading(false)
            }
        }
    }

    private suspend fun registerFcmToken() {
        try {
            val fcmToken = FirebaseMessaging.getInstance().token.await()
            FeedbackApi.registerDeviceToken(fcmToken)
            Log.d("FCM", "Device token registered")
        } catch (e: Exception) {
            Log.e("FCM", "Failed to register FCM token", e)
            // Non-critical, don't block login
        }
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    private fun setLoading(loading: Boolean) {
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnGoogleSignIn.visibility = if (loading) View.GONE else View.VISIBLE
        binding.tvError.visibility = View.GONE
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
        binding.progressBar.visibility = View.GONE
        binding.btnGoogleSignIn.visibility = View.VISIBLE
    }
}
```

> **Note about `FeedbackApi.jwtToken`:** The `jwtToken` in our FeedbackApi is private. To make `saveSession` work, either add a `getToken()` method to FeedbackApi, or save the token directly in `signIn()`. Here's the quick fix — add this to `FeedbackApi`:
> ```kotlin
> fun getToken(): String? = jwtToken
> ```
> Then use `FeedbackApi.getToken() ?: ""` in `saveSession`.

---

## Step 7: Tickets — List, Detail, Create, Comment

### TicketViewModel.kt

```kotlin
package com.example.yourapp.viewmodel

import androidx.lifecycle.*
import com.example.yourapp.api.FeedbackApi
import com.example.yourapp.models.*
import kotlinx.coroutines.launch

class TicketViewModel : ViewModel() {

    private val _tickets = MutableLiveData<List<Ticket>>()
    val tickets: LiveData<List<Ticket>> = _tickets

    private val _ticketDetail = MutableLiveData<Ticket>()
    val ticketDetail: LiveData<Ticket> = _ticketDetail

    private val _loading = MutableLiveData(false)
    val loading: LiveData<Boolean> = _loading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _totalPages = MutableLiveData(1)
    val totalPages: LiveData<Int> = _totalPages

    private var currentPage = 1

    fun loadTickets(page: Int = 1) {
        _loading.value = true
        _error.value = null
        viewModelScope.launch {
            try {
                val result = FeedbackApi.getTickets(page)
                _tickets.value = result.tickets
                _totalPages.value = result.totalPages
                currentPage = page
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load tickets"
            } finally {
                _loading.value = false
            }
        }
    }

    fun loadTicketDetail(ticketId: String) {
        _loading.value = true
        _error.value = null
        viewModelScope.launch {
            try {
                _ticketDetail.value = FeedbackApi.getTicket(ticketId)
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load ticket"
            } finally {
                _loading.value = false
            }
        }
    }

    fun addComment(ticketId: String, body: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            try {
                FeedbackApi.addComment(ticketId, body)
                loadTicketDetail(ticketId) // Refresh
                onSuccess()
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to add comment"
            }
        }
    }

    fun createTicket(
        title: String,
        description: String,
        priority: String,
        category: String?,
        onSuccess: (Ticket) -> Unit
    ) {
        _loading.value = true
        viewModelScope.launch {
            try {
                val ticket = FeedbackApi.createTicket(title, description, priority, category)
                onSuccess(ticket)
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to create ticket"
            } finally {
                _loading.value = false
            }
        }
    }

    fun loadNextPage() {
        if (currentPage < (_totalPages.value ?: 1)) {
            loadTickets(currentPage + 1)
        }
    }
}
```

### Layout: `res/layout/activity_ticket_list.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <com.google.android.material.appbar.MaterialToolbar
        android:id="@+id/toolbar"
        android:layout_width="match_parent"
        android:layout_height="?attr/actionBarSize"
        android:background="?attr/colorSurface"
        app:title="My Tickets"
        app:layout_constraintTop_toTopOf="parent" />

    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipeRefresh"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        app:layout_constraintTop_toBottomOf="@id/toolbar"
        app:layout_constraintBottom_toBottomOf="parent">

        <androidx.recyclerview.widget.RecyclerView
            android:id="@+id/rvTickets"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:clipToPadding="false"
            android:padding="12dp" />

    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>

    <!-- Empty state -->
    <LinearLayout
        android:id="@+id/emptyState"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:gravity="center"
        android:visibility="gone"
        app:layout_constraintTop_toBottomOf="@id/toolbar"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="No tickets yet"
            android:textSize="18sp"
            android:textStyle="bold"
            android:textColor="#666" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Create your first support ticket"
            android:textSize="14sp"
            android:textColor="#999"
            android:layout_marginTop="4dp" />
    </LinearLayout>

    <com.google.android.material.floatingactionbutton.FloatingActionButton
        android:id="@+id/fabCreate"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_margin="16dp"
        android:src="@android:drawable/ic_input_add"
        android:contentDescription="Create ticket"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
```

### Layout: `res/layout/item_ticket.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<com.google.android.material.card.MaterialCardView
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginBottom="8dp"
    app:cardCornerRadius="12dp"
    app:cardElevation="1dp"
    android:clickable="true"
    android:focusable="true">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="16dp">

        <!-- Title row -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <TextView
                android:id="@+id/tvTitle"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:textSize="15sp"
                android:textStyle="bold"
                android:textColor="@color/black"
                android:maxLines="2"
                android:ellipsize="end" />

            <!-- Priority badge -->
            <TextView
                android:id="@+id/tvPriority"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:paddingHorizontal="8dp"
                android:paddingVertical="2dp"
                android:textSize="11sp"
                android:textStyle="bold"
                android:layout_marginStart="8dp" />
        </LinearLayout>

        <!-- Description preview -->
        <TextView
            android:id="@+id/tvDescription"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:textSize="13sp"
            android:textColor="#888"
            android:maxLines="2"
            android:ellipsize="end"
            android:layout_marginTop="4dp" />

        <!-- Bottom row: status + meta -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical"
            android:layout_marginTop="10dp">

            <!-- Status chip -->
            <TextView
                android:id="@+id/tvStatus"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:paddingHorizontal="10dp"
                android:paddingVertical="3dp"
                android:textSize="11sp"
                android:textAllCaps="true" />

            <View
                android:layout_width="0dp"
                android:layout_height="0dp"
                android:layout_weight="1" />

            <!-- Comments count -->
            <TextView
                android:id="@+id/tvComments"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="11sp"
                android:textColor="#999"
                android:layout_marginEnd="12dp" />

            <!-- Date -->
            <TextView
                android:id="@+id/tvDate"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="11sp"
                android:textColor="#999" />
        </LinearLayout>
    </LinearLayout>
</com.google.android.material.card.MaterialCardView>
```

### TicketAdapter.kt

```kotlin
package com.example.yourapp.adapter

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.yourapp.databinding.ItemTicketBinding
import com.example.yourapp.models.Ticket
import java.text.SimpleDateFormat
import java.util.*

class TicketAdapter(
    private val onClick: (Ticket) -> Unit
) : ListAdapter<Ticket, TicketAdapter.ViewHolder>(DiffCallback) {

    class ViewHolder(val binding: ItemTicketBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemTicketBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val ticket = getItem(position)
        with(holder.binding) {
            tvTitle.text = ticket.title
            tvDescription.text = ticket.description

            // Priority badge
            tvPriority.text = ticket.priority.uppercase()
            val priorityBg = GradientDrawable().apply {
                cornerRadius = 12f
                setColor(when (ticket.priority) {
                    "critical" -> Color.parseColor("#FECACA")
                    "high" -> Color.parseColor("#FED7AA")
                    "medium" -> Color.parseColor("#FEF08A")
                    else -> Color.parseColor("#D1FAE5")
                })
            }
            tvPriority.background = priorityBg
            tvPriority.setTextColor(when (ticket.priority) {
                "critical" -> Color.parseColor("#991B1B")
                "high" -> Color.parseColor("#9A3412")
                "medium" -> Color.parseColor("#854D0E")
                else -> Color.parseColor("#065F46")
            })

            // Status chip
            val statusLabel = ticket.status.replace("_", " ")
                .replaceFirstChar { it.uppercase() }
            tvStatus.text = statusLabel
            val statusBg = GradientDrawable().apply {
                cornerRadius = 12f
                setColor(when (ticket.status) {
                    "open" -> Color.parseColor("#DBEAFE")
                    "in_progress" -> Color.parseColor("#E0E7FF")
                    "resolved" -> Color.parseColor("#D1FAE5")
                    "closed" -> Color.parseColor("#F3F4F6")
                    else -> Color.parseColor("#F3F4F6")
                })
            }
            tvStatus.background = statusBg
            tvStatus.setTextColor(when (ticket.status) {
                "open" -> Color.parseColor("#1E40AF")
                "in_progress" -> Color.parseColor("#3730A3")
                "resolved" -> Color.parseColor("#065F46")
                "closed" -> Color.parseColor("#6B7280")
                else -> Color.parseColor("#6B7280")
            })

            // Meta
            tvComments.text = "${ticket.count?.comments ?: 0} comments"
            tvDate.text = formatDate(ticket.createdAt)

            root.setOnClickListener { onClick(ticket) }
        }
    }

    private fun formatDate(iso: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            val date = parser.parse(iso) ?: return iso
            val formatter = SimpleDateFormat("MMM d", Locale.US)
            formatter.format(date)
        } catch (_: Exception) { iso }
    }

    object DiffCallback : DiffUtil.ItemCallback<Ticket>() {
        override fun areItemsTheSame(old: Ticket, new: Ticket) = old.id == new.id
        override fun areContentsTheSame(old: Ticket, new: Ticket) = old == new
    }
}
```

### Layout: `res/layout/activity_create_ticket.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <com.google.android.material.appbar.MaterialToolbar
        android:id="@+id/toolbar"
        android:layout_width="match_parent"
        android:layout_height="?attr/actionBarSize"
        app:title="Create Ticket"
        app:navigationIcon="@drawable/ic_arrow_back_24" />

    <ScrollView
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_marginTop="?attr/actionBarSize"
        android:padding="20dp">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical">

            <!-- Title -->
            <com.google.android.material.textfield.TextInputLayout
                android:id="@+id/tilTitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:hint="Title"
                style="@style/Widget.Material3.TextInputLayout.OutlinedBox">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etTitle"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:inputType="textCapSentences"
                    android:maxLines="2" />
            </com.google.android.material.textfield.TextInputLayout>

            <!-- Description -->
            <com.google.android.material.textfield.TextInputLayout
                android:id="@+id/tilDescription"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:hint="Description"
                android:layout_marginTop="12dp"
                style="@style/Widget.Material3.TextInputLayout.OutlinedBox">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etDescription"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:inputType="textMultiLine|textCapSentences"
                    android:minLines="4"
                    android:gravity="top" />
            </com.google.android.material.textfield.TextInputLayout>

            <!-- Priority -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Priority"
                android:textSize="14sp"
                android:textStyle="bold"
                android:textColor="#555"
                android:layout_marginTop="16dp"
                android:layout_marginBottom="8dp" />

            <com.google.android.material.chip.ChipGroup
                android:id="@+id/cgPriority"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                app:singleSelection="true"
                app:selectionRequired="true">

                <com.google.android.material.chip.Chip
                    android:id="@+id/chipLow"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Low"
                    style="@style/Widget.Material3.Chip.Filter" />

                <com.google.android.material.chip.Chip
                    android:id="@+id/chipMedium"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Medium"
                    android:checked="true"
                    style="@style/Widget.Material3.Chip.Filter" />

                <com.google.android.material.chip.Chip
                    android:id="@+id/chipHigh"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="High"
                    style="@style/Widget.Material3.Chip.Filter" />

                <com.google.android.material.chip.Chip
                    android:id="@+id/chipCritical"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="Critical"
                    style="@style/Widget.Material3.Chip.Filter" />
            </com.google.android.material.chip.ChipGroup>

            <!-- Category (optional) -->
            <com.google.android.material.textfield.TextInputLayout
                android:id="@+id/tilCategory"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:hint="Category (optional)"
                android:layout_marginTop="12dp"
                style="@style/Widget.Material3.TextInputLayout.OutlinedBox">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etCategory"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:inputType="text" />
            </com.google.android.material.textfield.TextInputLayout>

            <!-- Submit button -->
            <com.google.android.material.button.MaterialButton
                android:id="@+id/btnSubmit"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="Submit Ticket"
                android:layout_marginTop="24dp"
                android:paddingVertical="12dp" />

            <ProgressBar
                android:id="@+id/progressBar"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="center"
                android:visibility="gone"
                android:layout_marginTop="16dp" />

        </LinearLayout>
    </ScrollView>
</androidx.coordinatorlayout.widget.CoordinatorLayout>
```

### CreateTicketActivity.kt

```kotlin
package com.example.yourapp.ui

import android.os.Bundle
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.example.yourapp.R
import com.example.yourapp.databinding.ActivityCreateTicketBinding
import com.example.yourapp.viewmodel.TicketViewModel

class CreateTicketActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCreateTicketBinding
    private val viewModel: TicketViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreateTicketBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.btnSubmit.setOnClickListener { submitTicket() }

        viewModel.loading.observe(this) { loading ->
            binding.btnSubmit.isEnabled = !loading
            binding.progressBar.visibility = if (loading) android.view.View.VISIBLE else android.view.View.GONE
        }

        viewModel.error.observe(this) { error ->
            error?.let { Toast.makeText(this, it, Toast.LENGTH_SHORT).show() }
        }
    }

    private fun submitTicket() {
        val title = binding.etTitle.text?.toString()?.trim() ?: ""
        val description = binding.etDescription.text?.toString()?.trim() ?: ""
        val category = binding.etCategory.text?.toString()?.trim()?.ifEmpty { null }

        // Validate
        if (title.isEmpty()) {
            binding.tilTitle.error = "Title is required"
            return
        }
        binding.tilTitle.error = null

        if (description.isEmpty()) {
            binding.tilDescription.error = "Description is required"
            return
        }
        binding.tilDescription.error = null

        // Get priority from ChipGroup
        val priority = when (binding.cgPriority.checkedChipId) {
            R.id.chipLow -> "low"
            R.id.chipHigh -> "high"
            R.id.chipCritical -> "critical"
            else -> "medium"
        }

        viewModel.createTicket(title, description, priority, category) { ticket ->
            Toast.makeText(this, "Ticket created!", Toast.LENGTH_SHORT).show()
            setResult(RESULT_OK)
            finish()
        }
    }
}
```

### Layout: `res/layout/activity_ticket_detail.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <com.google.android.material.appbar.MaterialToolbar
        android:id="@+id/toolbar"
        android:layout_width="match_parent"
        android:layout_height="?attr/actionBarSize"
        app:title="Ticket Detail"
        app:navigationIcon="@drawable/ic_arrow_back_24" />

    <androidx.core.widget.NestedScrollView
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_marginTop="?attr/actionBarSize">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="16dp">

            <!-- Title -->
            <TextView
                android:id="@+id/tvTitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:textSize="20sp"
                android:textStyle="bold"
                android:textColor="@color/black" />

            <!-- Status + Priority row -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:layout_marginTop="8dp">

                <TextView
                    android:id="@+id/tvStatus"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:paddingHorizontal="12dp"
                    android:paddingVertical="4dp"
                    android:textSize="12sp"
                    android:textAllCaps="true" />

                <TextView
                    android:id="@+id/tvPriority"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:paddingHorizontal="12dp"
                    android:paddingVertical="4dp"
                    android:textSize="12sp"
                    android:textAllCaps="true"
                    android:layout_marginStart="8dp" />

                <TextView
                    android:id="@+id/tvDate"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:textSize="12sp"
                    android:textColor="#999"
                    android:layout_marginStart="12dp"
                    android:gravity="center_vertical" />
            </LinearLayout>

            <!-- Description -->
            <TextView
                android:id="@+id/tvDescription"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:textSize="14sp"
                android:textColor="#444"
                android:lineSpacingMultiplier="1.4"
                android:layout_marginTop="16dp" />

            <!-- Attachments section -->
            <TextView
                android:id="@+id/tvAttachmentsHeader"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Attachments"
                android:textSize="16sp"
                android:textStyle="bold"
                android:textColor="@color/black"
                android:layout_marginTop="20dp"
                android:visibility="gone" />

            <androidx.recyclerview.widget.RecyclerView
                android:id="@+id/rvAttachments"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:visibility="gone"
                android:layout_marginTop="8dp" />

            <!-- Divider -->
            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:background="#E5E7EB"
                android:layout_marginTop="20dp" />

            <!-- Comments header -->
            <TextView
                android:id="@+id/tvCommentsHeader"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Comments"
                android:textSize="16sp"
                android:textStyle="bold"
                android:textColor="@color/black"
                android:layout_marginTop="16dp" />

            <!-- Comments list -->
            <androidx.recyclerview.widget.RecyclerView
                android:id="@+id/rvComments"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:nestedScrollingEnabled="false"
                android:layout_marginTop="8dp" />

            <!-- Add comment -->
            <com.google.android.material.textfield.TextInputLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:hint="Write a comment..."
                android:layout_marginTop="12dp"
                style="@style/Widget.Material3.TextInputLayout.OutlinedBox"
                app:endIconMode="custom"
                app:endIconDrawable="@android:drawable/ic_menu_send">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etComment"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:inputType="textMultiLine|textCapSentences"
                    android:minLines="2" />
            </com.google.android.material.textfield.TextInputLayout>

            <com.google.android.material.button.MaterialButton
                android:id="@+id/btnSendComment"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Send"
                android:layout_marginTop="8dp"
                android:layout_gravity="end"
                style="@style/Widget.Material3.Button.TonalButton" />

        </LinearLayout>
    </androidx.core.widget.NestedScrollView>

    <ProgressBar
        android:id="@+id/progressBar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:visibility="gone" />

</androidx.coordinatorlayout.widget.CoordinatorLayout>
```

### TicketDetailActivity.kt

```kotlin
package com.example.yourapp.ui

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.yourapp.adapter.CommentAdapter
import com.example.yourapp.databinding.ActivityTicketDetailBinding
import com.example.yourapp.viewmodel.TicketViewModel
import java.text.SimpleDateFormat
import java.util.*

class TicketDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTicketDetailBinding
    private val viewModel: TicketViewModel by viewModels()
    private val commentAdapter = CommentAdapter()

    companion object {
        const val EXTRA_TICKET_ID = "ticket_id"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTicketDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.rvComments.apply {
            layoutManager = LinearLayoutManager(this@TicketDetailActivity)
            adapter = commentAdapter
        }

        val ticketId = intent.getStringExtra(EXTRA_TICKET_ID) ?: run {
            finish(); return
        }

        viewModel.ticketDetail.observe(this) { ticket ->
            binding.tvTitle.text = ticket.title
            binding.tvDescription.text = ticket.description

            // Status badge
            val statusLabel = ticket.status.replace("_", " ").replaceFirstChar { it.uppercase() }
            binding.tvStatus.text = statusLabel
            binding.tvStatus.background = GradientDrawable().apply {
                cornerRadius = 12f
                setColor(when (ticket.status) {
                    "open" -> Color.parseColor("#DBEAFE")
                    "in_progress" -> Color.parseColor("#E0E7FF")
                    "resolved" -> Color.parseColor("#D1FAE5")
                    else -> Color.parseColor("#F3F4F6")
                })
            }

            // Priority badge
            binding.tvPriority.text = ticket.priority.uppercase()
            binding.tvPriority.background = GradientDrawable().apply {
                cornerRadius = 12f
                setColor(when (ticket.priority) {
                    "critical" -> Color.parseColor("#FECACA")
                    "high" -> Color.parseColor("#FED7AA")
                    "medium" -> Color.parseColor("#FEF08A")
                    else -> Color.parseColor("#D1FAE5")
                })
            }

            // Date
            binding.tvDate.text = formatDate(ticket.createdAt)

            // Comments
            val publicComments = ticket.comments?.filter { !it.isInternalNote } ?: emptyList()
            commentAdapter.submitList(publicComments)
            binding.tvCommentsHeader.text = "Comments (${publicComments.size})"

            // Attachments
            val attachments = ticket.attachments ?: emptyList()
            if (attachments.isNotEmpty()) {
                binding.tvAttachmentsHeader.visibility = View.VISIBLE
                binding.tvAttachmentsHeader.text = "Attachments (${attachments.size})"
                // You could add an attachment adapter here
            }
        }

        viewModel.loading.observe(this) { loading ->
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }

        viewModel.error.observe(this) { error ->
            error?.let { Toast.makeText(this, it, Toast.LENGTH_SHORT).show() }
        }

        // Send comment
        binding.btnSendComment.setOnClickListener {
            val body = binding.etComment.text?.toString()?.trim() ?: ""
            if (body.isEmpty()) return@setOnClickListener

            viewModel.addComment(ticketId, body) {
                binding.etComment.text?.clear()
                Toast.makeText(this, "Comment added", Toast.LENGTH_SHORT).show()
            }
        }

        // Load ticket
        viewModel.loadTicketDetail(ticketId)
    }

    private fun formatDate(iso: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            val date = parser.parse(iso) ?: return iso
            val formatter = SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.US)
            formatter.format(date)
        } catch (_: Exception) { iso }
    }
}
```

### CommentAdapter.kt

```kotlin
package com.example.yourapp.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.yourapp.databinding.ItemCommentBinding
import com.example.yourapp.models.Comment
import java.text.SimpleDateFormat
import java.util.*

class CommentAdapter : ListAdapter<Comment, CommentAdapter.ViewHolder>(DiffCallback) {

    class ViewHolder(val binding: ItemCommentBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemCommentBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val comment = getItem(position)
        with(holder.binding) {
            tvAuthor.text = comment.user.name
            tvBody.text = comment.body
            tvTime.text = formatDate(comment.createdAt)

            // Show avatar initial
            tvAvatar.text = comment.user.name.firstOrNull()?.uppercase() ?: "?"
        }
    }

    private fun formatDate(iso: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            val date = parser.parse(iso) ?: return iso
            val formatter = SimpleDateFormat("MMM d 'at' h:mm a", Locale.US)
            formatter.format(date)
        } catch (_: Exception) { iso }
    }

    object DiffCallback : DiffUtil.ItemCallback<Comment>() {
        override fun areItemsTheSame(old: Comment, new: Comment) = old.id == new.id
        override fun areContentsTheSame(old: Comment, new: Comment) = old == new
    }
}
```

### Layout: `res/layout/item_comment.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:paddingVertical="10dp">

    <!-- Avatar circle -->
    <TextView
        android:id="@+id/tvAvatar"
        android:layout_width="36dp"
        android:layout_height="36dp"
        android:gravity="center"
        android:textSize="14sp"
        android:textStyle="bold"
        android:textColor="@color/white"
        android:background="@drawable/bg_avatar_circle" />

    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:orientation="vertical"
        android:layout_marginStart="10dp">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <TextView
                android:id="@+id/tvAuthor"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="13sp"
                android:textStyle="bold"
                android:textColor="@color/black" />

            <TextView
                android:id="@+id/tvTime"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="11sp"
                android:textColor="#999"
                android:layout_marginStart="8dp" />
        </LinearLayout>

        <TextView
            android:id="@+id/tvBody"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:textSize="13sp"
            android:textColor="#444"
            android:layout_marginTop="2dp"
            android:lineSpacingMultiplier="1.3" />
    </LinearLayout>
</LinearLayout>
```

### Drawable: `res/drawable/bg_avatar_circle.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="#6366F1" />
</shape>
```

---

## Step 8: Feedback — Submit & List

### FeedbackViewModel.kt

```kotlin
package com.example.yourapp.viewmodel

import androidx.lifecycle.*
import com.example.yourapp.api.FeedbackApi
import com.example.yourapp.models.*
import kotlinx.coroutines.launch

class FeedbackViewModel : ViewModel() {

    private val _feedbacks = MutableLiveData<List<Feedback>>()
    val feedbacks: LiveData<List<Feedback>> = _feedbacks

    private val _loading = MutableLiveData(false)
    val loading: LiveData<Boolean> = _loading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    fun loadFeedbacks(page: Int = 1) {
        _loading.value = true
        _error.value = null
        viewModelScope.launch {
            try {
                val result = FeedbackApi.getFeedbacks(page)
                _feedbacks.value = result.feedbacks
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load feedbacks"
            } finally {
                _loading.value = false
            }
        }
    }

    fun submitFeedback(
        rating: Int,
        category: String,
        comment: String?,
        onSuccess: () -> Unit
    ) {
        _loading.value = true
        viewModelScope.launch {
            try {
                FeedbackApi.submitFeedback(rating, category, comment)
                onSuccess()
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to submit feedback"
            } finally {
                _loading.value = false
            }
        }
    }
}
```

### Feedback Dialog (Material Bottom Sheet)

```kotlin
package com.example.yourapp.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.viewModels
import com.example.yourapp.databinding.DialogFeedbackBinding
import com.example.yourapp.models.FeedbackCategory
import com.example.yourapp.viewmodel.FeedbackViewModel
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class FeedbackBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogFeedbackBinding? = null
    private val binding get() = _binding!!
    private val viewModel: FeedbackViewModel by viewModels()

    var onSubmitted: (() -> Unit)? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = DialogFeedbackBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Category dropdown
        val categories = FeedbackCategory.entries.map { it.label }
        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, categories)
        binding.actvCategory.setAdapter(adapter)
        binding.actvCategory.setText(categories[0], false)

        // Submit
        binding.btnSubmit.setOnClickListener {
            val rating = binding.ratingBar.rating.toInt()
            if (rating == 0) {
                Toast.makeText(requireContext(), "Please select a rating", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val categoryIndex = categories.indexOf(binding.actvCategory.text.toString())
            val category = if (categoryIndex >= 0) FeedbackCategory.entries[categoryIndex].value else "general"
            val comment = binding.etComment.text?.toString()?.trim()?.ifEmpty { null }

            viewModel.submitFeedback(rating, category, comment) {
                Toast.makeText(requireContext(), "Thank you for your feedback!", Toast.LENGTH_SHORT).show()
                onSubmitted?.invoke()
                dismiss()
            }
        }

        viewModel.loading.observe(viewLifecycleOwner) { loading ->
            binding.btnSubmit.isEnabled = !loading
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }

        viewModel.error.observe(viewLifecycleOwner) { error ->
            error?.let { Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show() }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "FeedbackBottomSheet"
    }
}
```

### Layout: `res/layout/dialog_feedback.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="24dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Send Feedback"
        android:textSize="20sp"
        android:textStyle="bold"
        android:textColor="@color/black" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="How was your experience?"
        android:textSize="14sp"
        android:textColor="#666"
        android:layout_marginTop="4dp" />

    <!-- Star rating -->
    <RatingBar
        android:id="@+id/ratingBar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:numStars="5"
        android:stepSize="1"
        android:layout_marginTop="16dp"
        android:layout_gravity="center_horizontal"
        style="?android:attr/ratingBarStyle" />

    <!-- Category dropdown -->
    <com.google.android.material.textfield.TextInputLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Category"
        android:layout_marginTop="16dp"
        style="@style/Widget.Material3.TextInputLayout.OutlinedBox.ExposedDropdownMenu">

        <com.google.android.material.textfield.MaterialAutoCompleteTextView
            android:id="@+id/actvCategory"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:inputType="none" />
    </com.google.android.material.textfield.TextInputLayout>

    <!-- Comment -->
    <com.google.android.material.textfield.TextInputLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Comment (optional)"
        android:layout_marginTop="12dp"
        style="@style/Widget.Material3.TextInputLayout.OutlinedBox">

        <com.google.android.material.textfield.TextInputEditText
            android:id="@+id/etComment"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:inputType="textMultiLine|textCapSentences"
            android:minLines="3"
            android:gravity="top" />
    </com.google.android.material.textfield.TextInputLayout>

    <com.google.android.material.button.MaterialButton
        android:id="@+id/btnSubmit"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Submit Feedback"
        android:layout_marginTop="20dp"
        android:paddingVertical="12dp" />

    <ProgressBar
        android:id="@+id/progressBar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:visibility="gone"
        android:layout_marginTop="8dp" />

</LinearLayout>
```

### Showing the Feedback Dialog

```kotlin
// From any Activity or Fragment:
val sheet = FeedbackBottomSheet()
sheet.onSubmitted = { /* refresh list, etc. */ }
sheet.show(supportFragmentManager, FeedbackBottomSheet.TAG)
```

---

## Step 9: File Attachments

### Picking a File

```kotlin
// In your Activity:
private val filePickerLauncher = registerForActivityResult(
    ActivityResultContracts.GetContent()
) { uri ->
    uri?.let { uploadFile(it) }
}

// Launch picker:
filePickerLauncher.launch("*/*")  // or "image/*" for images only

private fun uploadFile(uri: Uri) {
    lifecycleScope.launch {
        try {
            // Copy URI to a temp file
            val inputStream = contentResolver.openInputStream(uri) ?: return@launch
            val fileName = getFileName(uri) ?: "attachment"
            val tempFile = File(cacheDir, fileName)
            tempFile.outputStream().use { output ->
                inputStream.copyTo(output)
            }

            val attachment = FeedbackApi.uploadTicketAttachment(ticketId, tempFile)
            Toast.makeText(this@TicketDetailActivity, "File uploaded: ${attachment.fileName}", Toast.LENGTH_SHORT).show()

            tempFile.delete()

        } catch (e: Exception) {
            Toast.makeText(this@TicketDetailActivity, "Upload failed: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
}

private fun getFileName(uri: Uri): String? {
    val cursor = contentResolver.query(uri, null, null, null, null)
    cursor?.use {
        if (it.moveToFirst()) {
            val index = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (index >= 0) return it.getString(index)
        }
    }
    return null
}
```

### Downloading / Viewing Attachments

```kotlin
// Attachments have a relative fileUrl like "/uploads/1234-file.pdf"
// Build the full URL:
val fullUrl = "${FeedbackApi.BASE_URL}${attachment.fileUrl}"

// Open in browser or download manager:
val intent = Intent(Intent.ACTION_VIEW, Uri.parse(fullUrl))
startActivity(intent)
```

---

## Step 10: Push Notifications (FCM)

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) → select/create project
2. Add Android app: enter your **package name** and **SHA-1** fingerprint
3. Download `google-services.json` → place in `app/` directory
4. Go to **Project Settings → Service accounts → Generate new private key**
5. In the admin panel, edit your app and paste the values from the JSON:
   - `project_id` → **Firebase Project ID**
   - `client_email` → **Firebase Client Email**
   - `private_key` → **Firebase Private Key**

### 2. FCM Service

Create `fcm/FeedbackFcmService.kt`:

```kotlin
package com.example.yourapp.fcm

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.yourapp.R
import com.example.yourapp.api.FeedbackApi
import com.example.yourapp.api.SessionManager
import com.example.yourapp.ui.TicketDetailActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FeedbackFcmService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FCM"
        private const val CHANNEL_ID = "feedback_updates"
    }

    /**
     * Called when the FCM token is created or refreshed.
     * Register it with the server if user is logged in.
     */
    override fun onNewToken(token: String) {
        Log.d(TAG, "FCM token refreshed")

        if (SessionManager.isLoggedIn) {
            SessionManager.restoreSession()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    FeedbackApi.registerDeviceToken(token)
                    Log.d(TAG, "Token registered with server")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to register token", e)
                }
            }
        }
    }

    /**
     * Called when a push notification is received while the app is in the foreground.
     * Background messages are handled automatically by the system tray.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        Log.d(TAG, "Message received: ${message.data}")

        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"] ?: return
        val type = message.data["type"]           // "ticket_update", "new_comment", "feedback_reply"
        val ticketId = message.data["ticketId"]
        val feedbackId = message.data["feedbackId"]

        showNotification(title, body, type, ticketId, feedbackId)
    }

    private fun showNotification(
        title: String,
        body: String,
        type: String?,
        ticketId: String?,
        feedbackId: String?
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create a tap intent based on notification type
        val intent = when {
            ticketId != null -> Intent(this, TicketDetailActivity::class.java).apply {
                putExtra(TicketDetailActivity.EXTRA_TICKET_ID, ticketId)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            else -> packageManager.getLaunchIntentForPackage(packageName)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)  // Create this drawable
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .build()

        notificationManager.notify(
            System.currentTimeMillis().toInt(),
            notification
        )
    }
}
```

### 3. Request Notification Permission (Android 13+)

```kotlin
// In your MainActivity.onCreate():
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            // User denied — notifications won't show
            Log.w("FCM", "Notification permission denied")
        }
    }

    if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED) {
        permissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
    }
}
```

### 4. Register Token After Login

This is already done in `LoginActivity.kt` above (see `registerFcmToken()`).

### 5. Unregister on Logout

```kotlin
fun logout(context: Context) {
    // Remove FCM token from server
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val fcmToken = FirebaseMessaging.getInstance().token.await()
            FeedbackApi.removeDeviceToken(fcmToken)
        } catch (e: Exception) {
            Log.e("Logout", "Failed to remove FCM token", e)
        }
    }

    // Clear local session
    SessionManager.clearSession()

    // Navigate to login
    val intent = Intent(context, LoginActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    }
    context.startActivity(intent)
}
```

### Notification Data Payload

The server sends these data fields with each push notification:

| Field | Value | Description |
|-------|-------|-------------|
| `type` | `ticket_update` | Ticket status changed |
| `type` | `new_comment` | New comment on a ticket |
| `type` | `feedback_reply` | Admin replied to feedback |
| `ticketId` | UUID | Present for ticket-related notifications |
| `feedbackId` | UUID | Present for feedback-related notifications |

---

## Step 11: Error Handling & Token Refresh

### Centralized Error Handling

```kotlin
// Add to FeedbackApi — a global 401 handler:
private val client: OkHttpClient by lazy {
    OkHttpClient.Builder()
        .addInterceptor { chain ->
            val builder = chain.request().newBuilder()
                .addHeader("x-api-key", API_KEY)
            jwtToken?.let { builder.addHeader("Authorization", "Bearer $it") }
            val response = chain.proceed(builder.build())

            // If 401, token has expired
            if (response.code == 401 && jwtToken != null) {
                jwtToken = null
                // Post an event to navigate to login
                // Use an EventBus, LiveData, or callback
            }

            response
        }
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG)
                HttpLoggingInterceptor.Level.BODY
            else
                HttpLoggingInterceptor.Level.NONE
        })
        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .build()
}
```

### Network Connectivity Check

```kotlin
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

fun isOnline(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = cm.activeNetwork ?: return false
    val capabilities = cm.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}
```

### Retry with Exponential Backoff

```kotlin
suspend fun <T> retryWithBackoff(
    maxRetries: Int = 3,
    initialDelay: Long = 1000,
    block: suspend () -> T
): T {
    var currentDelay = initialDelay
    repeat(maxRetries - 1) {
        try {
            return block()
        } catch (e: Exception) {
            if (e is FeedbackApi.ApiException && e.statusCode < 500) throw e
            kotlinx.coroutines.delay(currentDelay)
            currentDelay *= 2
        }
    }
    return block() // Last attempt, let it throw
}

// Usage:
val tickets = retryWithBackoff { FeedbackApi.getTickets() }
```

---

## Step 12: ProGuard Rules

Add to `proguard-rules.pro`:

```
# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# Gson
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# Keep your data models (adjust package name)
-keep class com.example.yourapp.models.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Google Sign-In
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
```

---

## Quick Checklist

- [ ] Add all dependencies (play-services-auth, okhttp, gson, material, lifecycle, coil, firebase)
- [ ] Create Android OAuth client ID with package name + SHA-1 (debug AND release)
- [ ] Create Web OAuth client ID in the same Google Cloud project
- [ ] Enter the Web Client ID in the admin panel (Apps → Edit → Google Client ID)
- [ ] Copy API key from admin panel
- [ ] Update `FeedbackApi.kt` with your server URL and API key
- [ ] Use Web Client ID in `GoogleSignInOptions.requestIdToken()`
- [ ] Add `google-services.json` from Firebase Console
- [ ] Add `network_security_config.xml` for local development
- [ ] Create the `FeedbackApp` Application class and register in manifest
- [ ] Set up data models in `models/FeedbackModels.kt`
- [ ] Implement login flow: Google Sign-In → server auth → save session
- [ ] Implement ticket list, detail, create, and comment screens
- [ ] Implement feedback bottom sheet dialog
- [ ] Set up FCM: add Firebase config in admin panel + implement `FeedbackFcmService`
- [ ] Register FCM token after login, remove on logout
- [ ] Request POST_NOTIFICATIONS permission on Android 13+
- [ ] Test: Sign in → Create ticket → Add comment → Submit feedback → Receive push notification
- [ ] Add ProGuard rules for release builds
- [ ] Update server URL to production before release
