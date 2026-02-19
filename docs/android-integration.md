# Android Native Integration Guide

How to integrate the Feedback & Tickets system into your Android app using Kotlin.

---

## Prerequisites

- Android Studio
- Min SDK 21+
- Google Play Services

---

## Step 1: Dependencies

Add to `app/build.gradle`:

```gradle
dependencies {
    // Google Sign-In
    implementation 'com.google.android.gms:play-services-auth:21.0.0'

    // HTTP client
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'

    // JSON parsing
    implementation 'com.google.code.gson:gson:2.10.1'

    // Coroutines (for async calls)
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

---

## Step 2: Google Sign-In Setup

### Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Create **two** OAuth client IDs:
   - **Android** type: set package name + SHA-1 fingerprint
   - **Web application** type: this is the `serverClientId`
4. Copy the **Web** Client ID — enter this in the admin panel for your app

### Get SHA-1 Fingerprint

```bash
# Debug key
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android

# Release key
keytool -list -v -keystore your-release-key.jks -alias your-alias
```

### Configure in AndroidManifest.xml

No special permissions needed beyond internet:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## Step 3: API Client

Create `FeedbackApi.kt`:

```kotlin
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

object FeedbackApi {

    private const val BASE_URL = "https://your-server.com/api"
    private const val API_KEY = "fb_your_api_key"

    private var token: String? = null
    var currentUser: Map<String, Any>? = null
        private set

    val isLoggedIn: Boolean get() = token != null

    private val gson = Gson()
    private val JSON = "application/json".toMediaType()

    private val client = OkHttpClient.Builder()
        .addInterceptor { chain ->
            val builder = chain.request().newBuilder()
                .addHeader("x-api-key", API_KEY)
            token?.let { builder.addHeader("Authorization", "Bearer $it") }
            chain.proceed(builder.build())
        }
        .build()

    // ── Auth ──────────────────────────────────────────

    /**
     * Authenticate with Google ID token.
     * Call this after GoogleSignIn succeeds.
     */
    suspend fun signIn(googleIdToken: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("idToken" to googleIdToken))
                .toRequestBody(JSON)

            val request = Request.Builder()
                .url("$BASE_URL/auth/google")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext false

            val data = gson.fromJson<Map<String, Any>>(
                response.body!!.string(),
                object : TypeToken<Map<String, Any>>() {}.type
            )

            token = data["token"] as String
            @Suppress("UNCHECKED_CAST")
            currentUser = data["user"] as Map<String, Any>
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun signOut() {
        token = null
        currentUser = null
    }

    // ── Tickets ───────────────────────────────────────

    /**
     * Create a new support ticket.
     * @param priority: "low", "medium", "high", "critical"
     */
    suspend fun createTicket(
        title: String,
        description: String,
        priority: String = "medium",
        category: String? = null
    ): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val bodyMap = mutableMapOf<String, Any>(
                "title" to title,
                "description" to description,
                "priority" to priority
            )
            category?.let { bodyMap["category"] = it }

            val body = gson.toJson(bodyMap).toRequestBody(JSON)
            val request = Request.Builder()
                .url("$BASE_URL/tickets")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            if (response.code != 201) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Get paginated list of user's tickets.
     * Returns: { "tickets": [...], "total": 42, "page": 1, "totalPages": 3 }
     */
    suspend fun getTickets(page: Int = 1, limit: Int = 20): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/tickets?page=$page&limit=$limit")
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Get ticket detail with comments, attachments, and history.
     */
    suspend fun getTicket(ticketId: String): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/tickets/$ticketId")
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Add a comment to a ticket.
     */
    suspend fun addComment(ticketId: String, comment: String): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("body" to comment)).toRequestBody(JSON)
            val request = Request.Builder()
                .url("$BASE_URL/tickets/$ticketId/comments")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            if (response.code != 201) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Upload a file attachment to a ticket.
     */
    suspend fun uploadAttachment(ticketId: String, file: File): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "file", file.name,
                    file.asRequestBody("application/octet-stream".toMediaType())
                )
                .build()

            val request = Request.Builder()
                .url("$BASE_URL/tickets/$ticketId/attachments")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            if (response.code != 201) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // ── Feedback ──────────────────────────────────────

    /**
     * Submit a feedback rating.
     * @param rating: 1-5 stars
     * @param category: "general", "bug_report", "feature_request", "suggestion", "complaint"
     */
    suspend fun submitFeedback(
        rating: Int,
        comment: String? = null,
        category: String = "general"
    ): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val bodyMap = mutableMapOf<String, Any>(
                "rating" to rating,
                "category" to category
            )
            comment?.let { bodyMap["comment"] = it }

            val body = gson.toJson(bodyMap).toRequestBody(JSON)
            val request = Request.Builder()
                .url("$BASE_URL/feedbacks")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            if (response.code != 201) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Get paginated list of user's feedbacks.
     */
    suspend fun getFeedbacks(page: Int = 1): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/feedbacks?page=$page")
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Get feedback detail with admin replies.
     */
    suspend fun getFeedback(feedbackId: String): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/feedbacks/$feedbackId")
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Upload a file attachment to a feedback.
     */
    suspend fun uploadFeedbackAttachment(feedbackId: String, file: File): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "file", file.name,
                    file.asRequestBody("application/octet-stream".toMediaType())
                )
                .build()

            val request = Request.Builder()
                .url("$BASE_URL/feedbacks/$feedbackId/attachments")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            if (response.code != 201) return@withContext null

            gson.fromJson(response.body!!.string(), object : TypeToken<Map<String, Any>>() {}.type)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // ── Token Persistence ─────────────────────────────

    /**
     * Save token to SharedPreferences.
     * Call after successful signIn.
     */
    fun saveToken(context: android.content.Context) {
        context.getSharedPreferences("feedback", android.content.Context.MODE_PRIVATE)
            .edit()
            .putString("jwt_token", token)
            .apply()
    }

    /**
     * Load saved token on app start.
     * Returns true if a saved token was found.
     */
    fun loadToken(context: android.content.Context): Boolean {
        token = context.getSharedPreferences("feedback", android.content.Context.MODE_PRIVATE)
            .getString("jwt_token", null)
        return token != null
    }

    /**
     * Clear saved token on logout or 401.
     */
    fun clearToken(context: android.content.Context) {
        context.getSharedPreferences("feedback", android.content.Context.MODE_PRIVATE)
            .edit()
            .remove("jwt_token")
            .apply()
        token = null
        currentUser = null
    }
}
```

---

## Step 4: Google Sign-In Activity

```kotlin
import android.os.Bundle
import android.util.Log
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    // Use the Web Client ID (same one entered in admin panel)
    private val WEB_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"

    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account.idToken

            if (idToken != null) {
                lifecycleScope.launch {
                    val success = FeedbackApi.signIn(idToken)
                    if (success) {
                        FeedbackApi.saveToken(this@LoginActivity)
                        // Navigate to main screen
                        Log.d("Login", "Signed in as: ${FeedbackApi.currentUser}")
                    } else {
                        Log.e("Login", "Server authentication failed")
                    }
                }
            }
        } catch (e: ApiException) {
            Log.e("Login", "Google sign-in failed: ${e.statusCode}")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check for saved token
        if (FeedbackApi.loadToken(this)) {
            // Already logged in, go to main screen
            return
        }

        // Configure Google Sign-In
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(WEB_CLIENT_ID)  // Web Client ID, NOT Android Client ID
            .requestEmail()
            .requestProfile()
            .build()

        val googleSignInClient = GoogleSignIn.getClient(this, gso)

        // Trigger sign-in (call this from a button click)
        signInLauncher.launch(googleSignInClient.signInIntent)
    }
}
```

---

## Step 5: UI Examples

### Feedback Dialog

```kotlin
import android.app.AlertDialog
import android.content.Context
import android.view.LayoutInflater
import android.widget.*
import androidx.lifecycle.LifecycleCoroutineScope
import kotlinx.coroutines.launch

fun showFeedbackDialog(context: Context, scope: LifecycleCoroutineScope) {
    val view = LayoutInflater.from(context).inflate(android.R.layout.simple_list_item_1, null)

    // Build a simple dialog (or use your own layout)
    var selectedRating = 0
    val categories = arrayOf("General", "Bug Report", "Feature Request", "Suggestion", "Complaint")
    val categoryValues = arrayOf("general", "bug_report", "feature_request", "suggestion", "complaint")
    var selectedCategory = 0

    val layout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(48, 32, 48, 16)

        // Star rating
        addView(TextView(context).apply { text = "Rating" })
        val ratingBar = RatingBar(context).apply {
            numStars = 5
            stepSize = 1f
            setOnRatingBarChangeListener { _, rating, _ -> selectedRating = rating.toInt() }
        }
        addView(ratingBar)

        // Category
        addView(TextView(context).apply { text = "\nCategory" })
        val spinner = Spinner(context).apply {
            adapter = ArrayAdapter(context, android.R.layout.simple_spinner_dropdown_item, categories)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, pos: Int, id: Long) {
                    selectedCategory = pos
                }
                override fun onNothingSelected(parent: AdapterView<*>?) {}
            }
        }
        addView(spinner)

        // Comment
        addView(TextView(context).apply { text = "\nComment (optional)" })
        val commentInput = EditText(context).apply {
            hint = "Tell us what you think..."
            minLines = 3
        }
        addView(commentInput)
    }

    AlertDialog.Builder(context)
        .setTitle("Send Feedback")
        .setView(layout)
        .setPositiveButton("Submit") { _, _ ->
            if (selectedRating > 0) {
                scope.launch {
                    val comment = layout.findViewWithTag<EditText>("comment")?.text?.toString()
                    val result = FeedbackApi.submitFeedback(
                        rating = selectedRating,
                        comment = if (comment?.isNotEmpty() == true) comment else null,
                        category = categoryValues[selectedCategory]
                    )
                    if (result != null) {
                        Toast.makeText(context, "Thank you for your feedback!", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        .setNegativeButton("Cancel", null)
        .show()
}
```

### Create Ticket Activity

```kotlin
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class CreateTicketActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        val titleInput = EditText(this).apply { hint = "Title" }
        val descInput = EditText(this).apply {
            hint = "Describe your issue..."
            minLines = 5
        }

        val priorities = arrayOf("Low", "Medium", "High", "Critical")
        val priorityValues = arrayOf("low", "medium", "high", "critical")
        var selectedPriority = 1 // default: medium

        val prioritySpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@CreateTicketActivity, android.R.layout.simple_spinner_dropdown_item, priorities)
            setSelection(1)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, pos: Int, id: Long) {
                    selectedPriority = pos
                }
                override fun onNothingSelected(parent: AdapterView<*>?) {}
            }
        }

        val submitBtn = Button(this).apply {
            text = "Submit Ticket"
            setOnClickListener {
                val title = titleInput.text.toString().trim()
                val desc = descInput.text.toString().trim()
                if (title.isEmpty() || desc.isEmpty()) {
                    Toast.makeText(this@CreateTicketActivity, "Title and description required", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }

                isEnabled = false
                lifecycleScope.launch {
                    val result = FeedbackApi.createTicket(
                        title = title,
                        description = desc,
                        priority = priorityValues[selectedPriority]
                    )
                    if (result != null) {
                        Toast.makeText(this@CreateTicketActivity, "Ticket created!", Toast.LENGTH_SHORT).show()
                        finish()
                    } else {
                        isEnabled = true
                        Toast.makeText(this@CreateTicketActivity, "Failed to create ticket", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        layout.addView(TextView(this).apply { text = "Title" })
        layout.addView(titleInput)
        layout.addView(TextView(this).apply { text = "\nDescription" })
        layout.addView(descInput)
        layout.addView(TextView(this).apply { text = "\nPriority" })
        layout.addView(prioritySpinner)
        layout.addView(submitBtn)

        setContentView(layout)
        title = "Create Ticket"
    }
}
```

---

## Token Handling & Error Recovery

```kotlin
// Add a response interceptor for 401 handling
private val client = OkHttpClient.Builder()
    .addInterceptor { chain ->
        val builder = chain.request().newBuilder()
            .addHeader("x-api-key", API_KEY)
        token?.let { builder.addHeader("Authorization", "Bearer $it") }
        val response = chain.proceed(builder.build())

        // If 401, token is expired
        if (response.code == 401 && token != null) {
            token = null
            // Trigger re-login in your app
        }

        response
    }
    .build()
```

---

## ProGuard Rules

If using R8/ProGuard, add to `proguard-rules.pro`:

```
# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
```

---

## Quick Checklist

- [ ] Add dependencies (play-services-auth, okhttp, gson)
- [ ] Create Android OAuth client ID with package name + SHA-1 in Google Cloud Console
- [ ] Create Web OAuth client ID in the same project
- [ ] Enter the Web Client ID in the admin panel (Apps → Edit → Google Client ID)
- [ ] Copy API key from admin panel
- [ ] Update `FeedbackApi.kt` with your server URL and API key
- [ ] Use Web Client ID in `GoogleSignInOptions.requestIdToken()`
- [ ] Test: Sign in → Create ticket → Submit feedback
- [ ] Add ProGuard rules for release builds
